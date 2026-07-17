import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addEntry,
  deleteEntry,
  notifyLocalStorageChange,
  updateEntry,
} from '../db'
import { formatDisplayDate } from '../lib/dates'
import { computeDailyStatus } from '../lib/dailyStatus'
import { useEntriesByDate, useTargets } from '../hooks/useEntries'
import {
  MEAL_LABELS,
  MEAL_TYPES,
  type FoodEntry,
  type MealType,
} from '../types'
import { estimateFoodNutrition } from '../lib/foodEstimate'
import DayProgress from './DayProgress'

function guessMeal(): MealType {
  const h = new Date().getHours()
  if (h < 10) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 20) return 'dinner'
  return 'snack'
}

interface EntryFormProps {
  date: string
  initial?: FoodEntry
  onDone: () => void
  onCancel: () => void
}

/** Nutrition labels use 1 kcal = 4.184 kJ */
const KJ_PER_KCAL = 4.184

function kjToKcal(kj: number) {
  return kj / KJ_PER_KCAL
}

function kcalToKj(kcal: number) {
  return kcal * KJ_PER_KCAL
}

function roundEnergy(n: number) {
  return Math.round(n * 10) / 10
}

function EntryForm({ date, initial, onDone, onCancel }: EntryFormProps) {
  const nameRef = useRef<HTMLInputElement>(null)
  const [meal, setMeal] = useState<MealType>(initial?.meal ?? guessMeal())
  const [name, setName] = useState(initial?.name ?? '')
  const [unit, setUnit] = useState<'kcal' | 'kJ'>('kcal')
  const [energy, setEnergy] = useState(
    initial?.calories ? String(initial.calories) : '',
  )
  const [showLabelCalc, setShowLabelCalc] = useState(false)
  const [per100, setPer100] = useState('')
  const [grams, setGrams] = useState('')
  const [protein, setProtein] = useState(
    initial?.protein ? String(initial.protein) : '',
  )
  const [carbs, setCarbs] = useState(initial?.carbs ? String(initial.carbs) : '')
  const [fat, setFat] = useState(initial?.fat ? String(initial.fat) : '')
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [saving, setSaving] = useState(false)
  const [estimating, setEstimating] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => nameRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [])

  const energyNum = Number(energy)
  const kcalPreview =
    energyNum > 0
      ? unit === 'kcal'
        ? energyNum
        : roundEnergy(kjToKcal(energyNum))
      : 0

  const switchUnit = (next: 'kcal' | 'kJ') => {
    if (next === unit) return
    const n = Number(energy)
    if (n > 0) {
      setEnergy(
        String(
          next === 'kJ'
            ? Math.round(kcalToKj(n))
            : roundEnergy(kjToKcal(n)),
        ),
      )
    }
    setUnit(next)
  }

  const applyLabelCalc = () => {
    const per = Number(per100)
    const g = Number(grams)
    if (!per || per <= 0 || !g || g <= 0) {
      setError('请填写每100g热量和实际克数')
      return
    }
    setError('')
    const totalKj = (per * g) / 100
    const totalKcal = roundEnergy(kjToKcal(totalKj))
    setUnit('kcal')
    setEnergy(String(totalKcal))
    setShowLabelCalc(false)
  }

  const handleEstimate = async () => {
    setError('')
    setHint('')
    setEstimating(true)
    try {
      const result = await estimateFoodNutrition(name)
      setName(result.name)
      setUnit('kcal')
      setEnergy(String(result.calories))
      setProtein(String(result.protein))
      setCarbs(String(result.carbs))
      setFat(String(result.fat))
      setHint(
        result.source === 'local'
          ? '已按常见份量估算，可再改'
          : 'AI 估算，仅供参考，可再改',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '估算失败')
    } finally {
      setEstimating(false)
    }
  }

  const handleSubmit = async () => {
    setError('')
    const raw = Number(energy)
    if (!raw || raw <= 0) {
      setError('请填写热量，或点「估算」')
      return
    }
    const caloriesNum =
      unit === 'kcal' ? raw : roundEnergy(kjToKcal(raw))

    const trimmed = name.trim() || MEAL_LABELS[meal]
    const payload = {
      date,
      meal,
      name: trimmed,
      calories: caloriesNum,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      source: 'manual' as const,
    }

    setSaving(true)
    try {
      if (initial) {
        await updateEntry(initial.id, payload)
      } else {
        await addEntry(payload)
      }
      notifyLocalStorageChange()
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        void handleSubmit()
      }}
    >
      <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
        {MEAL_TYPES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMeal(m)}
            className={[
              'rounded-xl py-2.5 text-sm font-medium transition',
              meal === m
                ? 'bg-white text-orange-500 shadow-sm dark:bg-slate-600'
                : 'text-slate-500',
            ].join(' ')}
          >
            {MEAL_LABELS[m]}
          </button>
        ))}
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-medium text-slate-400">
          吃了什么
        </span>
        <div className="flex gap-2">
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setHint('')
            }}
            placeholder="例如 鸡胸饭、蒸虾"
            enterKeyHint="go"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleEstimate()
              }
            }}
            className="min-w-0 flex-1 rounded-2xl bg-white px-4 py-3.5 text-[17px] outline-none ring-orange-500 focus:ring-2 dark:bg-[#2c2c2e]"
          />
          <button
            type="button"
            onClick={() => void handleEstimate()}
            disabled={estimating || !name.trim()}
            className="shrink-0 rounded-2xl bg-orange-500 px-4 text-[15px] font-semibold text-white disabled:opacity-40"
          >
            {estimating ? '…' : '估算'}
          </button>
        </div>
        {hint && (
          <p className="mt-1.5 text-center text-xs text-slate-400">{hint}</p>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">热量</span>
          <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            {(['kcal', 'kJ'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => switchUnit(u)}
                className={[
                  'rounded-md px-2.5 py-1 text-[11px] font-semibold',
                  unit === u
                    ? 'bg-white text-orange-500 shadow-sm dark:bg-slate-600'
                    : 'text-slate-400',
                ].join(' ')}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            value={energy}
            onChange={(e) => setEnergy(e.target.value)}
            placeholder="估算后自动填，也可手改"
            enterKeyHint="next"
            className="w-full rounded-2xl bg-white px-4 py-4 pr-14 text-3xl font-semibold tracking-tight outline-none ring-orange-500 focus:ring-2 dark:bg-[#2c2c2e]"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            {unit}
          </span>
        </div>
        {unit === 'kJ' && kcalPreview > 0 && (
          <p className="mt-1.5 text-center text-sm text-slate-400">
            ≈ <span className="font-medium text-orange-500">{kcalPreview}</span> kcal
          </p>
        )}
        <button
          type="button"
          onClick={() => setShowLabelCalc((v) => !v)}
          className="mt-2 w-full text-center text-xs font-medium text-orange-500"
        >
          {showLabelCalc ? '收起成分表换算' : '成分表：每100g → 换算'}
        </button>
        {showLabelCalc && (
          <div className="mt-2 space-y-2 rounded-2xl bg-white p-3 dark:bg-[#2c2c2e]">
            <p className="text-[11px] leading-relaxed text-slate-400">
              包装上写的「每100克 / kJ」，再填你吃了多少克
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[11px] text-slate-400">
                  每100g (kJ)
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={per100}
                  onChange={(e) => setPer100(e.target.value)}
                  placeholder="如 1650"
                  className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-base font-semibold outline-none ring-orange-500 focus:ring-2 dark:bg-slate-800"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-slate-400">
                  吃了 (g)
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  placeholder="如 80"
                  className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-base font-semibold outline-none ring-orange-500 focus:ring-2 dark:bg-slate-800"
                />
              </label>
            </div>
            {Number(per100) > 0 && Number(grams) > 0 && (
              <p className="text-center text-xs text-slate-500">
                ≈{' '}
                <span className="font-semibold text-orange-500">
                  {roundEnergy(kjToKcal((Number(per100) * Number(grams)) / 100))}
                </span>{' '}
                kcal
              </p>
            )}
            <button
              type="button"
              onClick={applyLabelCalc}
              className="w-full rounded-xl bg-orange-500/10 py-2.5 text-sm font-semibold text-orange-500"
            >
              填入热量
            </button>
          </div>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-slate-400">宏量（可空）</p>
        <div className="grid grid-cols-3 gap-2">
          <MacroField label="蛋白" value={protein} onChange={setProtein} />
          <MacroField label="碳水" value={carbs} onChange={setCarbs} />
          <MacroField label="脂肪" value={fat} onChange={setFat} />
        </div>
      </div>

      {error && <p className="text-center text-sm text-red-500">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl px-5 py-3.5 text-[15px] font-medium text-slate-500"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-2xl bg-orange-500 py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {saving ? '保存中…' : initial ? '更新' : '添加'}
        </button>
      </div>
    </form>
  )
}

function MacroField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-center text-[11px] text-slate-400">
        {label}
      </span>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          enterKeyHint="done"
          className="w-full rounded-2xl bg-white py-3 text-center text-lg font-semibold outline-none ring-orange-500 focus:ring-2 dark:bg-[#2c2c2e]"
        />
        <span className="pointer-events-none absolute bottom-1.5 right-2 text-[10px] text-slate-300">
          g
        </span>
      </div>
    </label>
  )
}

function RecordItem({
  record,
  onEdit,
  onDelete,
}: {
  record: FoodEntry
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center rounded-2xl bg-white px-4 py-3.5 dark:bg-[#2c2c2e]">
      <button
        type="button"
        onClick={onEdit}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[11px] font-medium text-orange-500">
            {MEAL_LABELS[record.meal]}
          </span>
          <span className="truncate text-[15px] font-medium">{record.name}</span>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          {Math.round(record.calories)} kcal
          {(record.protein > 0 || record.carbs > 0 || record.fat > 0) && (
            <>
              {' '}
              · P{Math.round(record.protein)} C{Math.round(record.carbs)} F
              {Math.round(record.fat)}
            </>
          )}
        </p>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="ml-3 shrink-0 px-2 py-1 text-xs text-red-400"
      >
        删
      </button>
    </div>
  )
}

interface DaySheetProps {
  date: string
  onClose: () => void
}

export function DaySheet({ date, onClose }: DaySheetProps) {
  const entries = useEntriesByDate(date)
  const targets = useTargets()
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list')
  const [editing, setEditing] = useState<FoodEntry | null>(null)

  const grouped = useMemo(() => {
    const map = new Map<MealType, FoodEntry[]>()
    for (const meal of MEAL_TYPES) map.set(meal, [])
    for (const entry of entries) {
      map.get(entry.meal)?.push(entry)
    }
    return map
  }, [entries])

  const status = computeDailyStatus(entries, targets)

  const handleDelete = async (id: string) => {
    if (!confirm('删除这条？')) return
    try {
      await deleteEntry(id)
      notifyLocalStorageChange()
    } catch {
      alert('删除失败')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="关闭" className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[#f2f2f7] p-5 pb-8 shadow-xl dark:bg-black sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {formatDisplayDate(date)}
            </h2>
            <p className="mt-0.5 text-sm text-slate-400">
              {entries.length === 0
                ? '还没记'
                : status.onTrack
                  ? '已到位'
                  : '未到位'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-black/5 px-3 py-1.5 text-sm text-slate-500 dark:bg-white/10"
          >
            完成
          </button>
        </div>

        {mode === 'list' && (
          <div className="space-y-4">
            {entries.length > 0 && (
              <DayProgress entries={entries} targets={targets} compact />
            )}

            {MEAL_TYPES.map((meal) => {
              const list = grouped.get(meal) ?? []
              if (list.length === 0) return null
              return (
                <div key={meal} className="space-y-2">
                  {list.map((record) => (
                    <RecordItem
                      key={record.id}
                      record={record}
                      onEdit={() => {
                        setEditing(record)
                        setMode('edit')
                      }}
                      onDelete={() => handleDelete(record.id)}
                    />
                  ))}
                </div>
              )
            })}

            {entries.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">
                点下方添加这一餐
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                setEditing(null)
                setMode('add')
              }}
              className="w-full rounded-2xl bg-orange-500 py-4 text-[15px] font-semibold text-white"
            >
              + 添加
            </button>
          </div>
        )}

        {(mode === 'add' || mode === 'edit') && (
          <EntryForm
            date={date}
            initial={mode === 'edit' ? editing ?? undefined : undefined}
            onDone={() => {
              setMode('list')
              setEditing(null)
            }}
            onCancel={() => {
              setMode('list')
              setEditing(null)
            }}
          />
        )}
      </div>
    </div>
  )
}

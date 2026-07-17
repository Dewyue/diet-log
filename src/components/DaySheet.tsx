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

function EntryForm({ date, initial, onDone, onCancel }: EntryFormProps) {
  const calRef = useRef<HTMLInputElement>(null)
  const [meal, setMeal] = useState<MealType>(initial?.meal ?? guessMeal())
  const [name, setName] = useState(initial?.name ?? '')
  const [calories, setCalories] = useState(
    initial?.calories ? String(initial.calories) : '',
  )
  const [protein, setProtein] = useState(
    initial?.protein ? String(initial.protein) : '',
  )
  const [carbs, setCarbs] = useState(initial?.carbs ? String(initial.carbs) : '')
  const [fat, setFat] = useState(initial?.fat ? String(initial.fat) : '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => calRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [])

  const handleSubmit = async () => {
    setError('')
    const caloriesNum = Number(calories)
    if (!caloriesNum || caloriesNum <= 0) {
      setError('请填写热量')
      return
    }

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

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-400">
          热量
        </span>
        <div className="relative">
          <input
            ref={calRef}
            type="number"
            inputMode="numeric"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="0"
            enterKeyHint="next"
            className="w-full rounded-2xl bg-white px-4 py-4 text-3xl font-semibold tracking-tight outline-none ring-orange-500 focus:ring-2 dark:bg-[#2c2c2e]"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            kcal
          </span>
        </div>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-400">
          吃了什么（可空）
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`例如 鸡胸饭（空则记为「${MEAL_LABELS[meal]}」）`}
          enterKeyHint="next"
          className="w-full rounded-2xl bg-white px-4 py-3.5 text-[17px] outline-none ring-orange-500 focus:ring-2 dark:bg-[#2c2c2e]"
        />
      </label>

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

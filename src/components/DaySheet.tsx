import { useMemo, useState } from 'react'
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
  caloriesFromMacros,
  formatPortions,
  PORTION_KCAL,
  PORTION_TEMPLATES,
  scaleTemplate,
  type PortionTemplate,
} from '../lib/portionTemplates'
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
  const [meal, setMeal] = useState<MealType>(initial?.meal ?? guessMeal())
  const [name, setName] = useState(initial?.name ?? '')
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [portions, setPortions] = useState(1)
  const [protein, setProtein] = useState(
    initial?.protein ? String(initial.protein) : '',
  )
  const [carbs, setCarbs] = useState(initial?.carbs ? String(initial.carbs) : '')
  const [fat, setFat] = useState(initial?.fat ? String(initial.fat) : '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const selected = PORTION_TEMPLATES.find((t) => t.id === templateId) ?? null

  const p = Number(protein) || 0
  const c = Number(carbs) || 0
  const f = Number(fat) || 0
  const calories = caloriesFromMacros(p, c, f)

  const applyTemplate = (template: PortionTemplate, nextPortions: number) => {
    const scaled = scaleTemplate(template, nextPortions)
    setTemplateId(template.id)
    setPortions(nextPortions)
    setProtein(String(scaled.protein))
    setCarbs(String(scaled.carbs))
    setFat(String(scaled.fat))
    setName((prev) => {
      if (initial?.name && prev === initial.name) return prev
      const autoNames = new Set(
        PORTION_TEMPLATES.flatMap((t) =>
          [0.5, 1, 1.5, 2, 2.5, 3].map(
            (n) => `${t.label} × ${formatPortions(n)}`,
          ),
        ),
      )
      if (!prev.trim() || autoNames.has(prev)) {
        return `${template.label} × ${formatPortions(nextPortions)}`
      }
      return prev
    })
    setError('')
  }

  const bumpPortions = (delta: number) => {
    const next = Math.round((portions + delta) * 10) / 10
    if (next < 0.5 || next > 12) return
    if (selected) applyTemplate(selected, next)
    else setPortions(next)
  }

  const handleSubmit = async () => {
    setError('')
    const label = name.trim() || (selected ? `${selected.label} × ${formatPortions(portions)}` : '')
    if (!label) {
      setError('请选择模版或填写名称')
      return
    }
    if (calories <= 0) {
      setError('请选择一份模版，或填写蛋白/碳水/脂肪')
      return
    }

    const payload = {
      date,
      meal,
      name: label,
      calories,
      protein: p,
      carbs: c,
      fat: f,
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
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-slate-400">按份选择</span>
          <span className="text-[11px] text-slate-400">
            每份约 {PORTION_KCAL} kcal
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PORTION_TEMPLATES.map((t) => {
            const on = templateId === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t, portions)}
                className={[
                  'rounded-2xl px-3 py-3 text-left transition',
                  on
                    ? 'bg-orange-500 text-white'
                    : 'bg-white dark:bg-[#2c2c2e]',
                ].join(' ')}
              >
                <p className="text-[15px] font-semibold">{t.label}</p>
                <p
                  className={[
                    'mt-0.5 text-[11px]',
                    on ? 'text-white/80' : 'text-slate-400',
                  ].join(' ')}
                >
                  {t.hint}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl bg-white px-4 py-3 dark:bg-[#2c2c2e]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">份数</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="减少份数"
              onClick={() => bumpPortions(-0.5)}
              disabled={portions <= 0.5}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-medium disabled:opacity-30 dark:bg-slate-700"
            >
              −
            </button>
            <span className="min-w-[3ch] text-center text-xl font-semibold tabular-nums">
              {formatPortions(portions)}
            </span>
            <button
              type="button"
              aria-label="增加份数"
              onClick={() => bumpPortions(0.5)}
              disabled={portions >= 12}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-medium disabled:opacity-30 dark:bg-slate-700"
            >
              +
            </button>
          </div>
        </div>
        {selected && (
          <p className="mt-2 text-center text-xs text-slate-400">
            {selected.label} × {formatPortions(portions)} · 约 {calories} kcal
          </p>
        )}
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-medium text-slate-400">
          名称（可选）
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如 午饭鸡胸"
          enterKeyHint="done"
          className="w-full rounded-2xl bg-white px-4 py-3.5 text-[17px] outline-none ring-orange-500 focus:ring-2 dark:bg-[#2c2c2e]"
        />
      </div>

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
        <p className="mb-1.5 text-xs font-medium text-slate-400">
          成分（g，可再改）
        </p>
        <div className="grid grid-cols-3 gap-2">
          <MacroField label="蛋白" value={protein} onChange={setProtein} />
          <MacroField label="碳水" value={carbs} onChange={setCarbs} />
          <MacroField label="脂肪" value={fat} onChange={setFat} />
        </div>
      </div>

      <div className="rounded-2xl bg-white px-4 py-4 text-center dark:bg-[#2c2c2e]">
        <p className="text-xs font-medium text-slate-400">总热量</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
          {calories > 0 ? calories : '—'}
          <span className="ml-1 text-sm font-normal text-slate-400">kcal</span>
        </p>
        <p className="mt-1 text-[11px] text-slate-400">
          按 蛋白×4 + 碳水×4 + 脂肪×9
        </p>
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

function MealRecordItem({
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

export { MealRecordItem }

interface DaySheetProps {
  date: string
  onClose: () => void
  /** Open directly on the add form (e.g. FAB quick log) */
  startInAdd?: boolean
  /** Open directly on the edit form for this entry */
  editEntry?: FoodEntry
}

export function DaySheet({
  date,
  onClose,
  startInAdd = false,
  editEntry,
}: DaySheetProps) {
  const entries = useEntriesByDate(date)
  const targets = useTargets()
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>(() => {
    if (editEntry) return 'edit'
    if (startInAdd) return 'add'
    return 'list'
  })
  const [editing, setEditing] = useState<FoodEntry | null>(editEntry ?? null)

  const timeline = useMemo(
    () => [...entries].sort((a, b) => b.createdAt - a.createdAt),
    [entries],
  )

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

            {timeline.length > 0 && (
              <div className="space-y-2">
                {timeline.map((record) => (
                  <MealRecordItem
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
            )}

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

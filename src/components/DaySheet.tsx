import { useMemo, useRef, useState } from 'react'
import {
  addEntry,
  deleteEntry,
  notifyLocalStorageChange,
  updateEntry,
} from '../db'
import { formatDisplayDate } from '../lib/dates'
import { computeDailyStatus } from '../lib/dailyStatus'
import { parseImportText, type ParsedMealDraft } from '../lib/importParse'
import { hasVisionApiKey } from '../lib/visionSettings'
import { recognizeFoodFromImage } from '../lib/visionRecognize'
import { useEntriesByDate, useTargets } from '../hooks/useEntries'
import {
  MEAL_LABELS,
  MEAL_TYPES,
  type FoodEntry,
  type MealType,
} from '../types'
import DayProgress from './DayProgress'

interface EntryFormProps {
  date: string
  initial?: FoodEntry
  draft?: ParsedMealDraft
  onDone: () => void
  onCancel: () => void
}

function EntryForm({ date, initial, draft, onDone, onCancel }: EntryFormProps) {
  const seed = initial ?? draft
  const [meal, setMeal] = useState<MealType>(seed?.meal ?? 'lunch')
  const [name, setName] = useState(seed?.name ?? '')
  const [calories, setCalories] = useState(String(seed?.calories ?? ''))
  const [protein, setProtein] = useState(String(seed?.protein ?? ''))
  const [carbs, setCarbs] = useState(String(seed?.carbs ?? ''))
  const [fat, setFat] = useState(String(seed?.fat ?? ''))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    setError('')
    const trimmed = name.trim()
    if (!trimmed) {
      setError('请输入食物名称')
      return
    }
    const caloriesNum = Number(calories)
    if (!caloriesNum || caloriesNum <= 0) {
      setError('请输入有效热量')
      return
    }

    const payload = {
      date: seed && 'date' in seed && seed.date ? seed.date : date,
      meal,
      name: trimmed,
      calories: caloriesNum,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      source: initial?.source ?? draft?.source ?? ('manual' as const),
      rawNote: draft?.rawNote ?? initial?.rawNote,
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
      setError(err instanceof Error ? err.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {MEAL_TYPES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMeal(m)}
            className={[
              'rounded-full px-3 py-1.5 text-xs font-medium transition',
              meal === m
                ? 'bg-orange-500 text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
            ].join(' ')}
          >
            {MEAL_LABELS[m]}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="mb-1 block text-sm text-slate-500">名称</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如 鸡胸饭"
          className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base outline-none focus:border-orange-500 dark:border-white/10 dark:bg-[#2c2c2e]"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="热量 (kcal)" value={calories} onChange={setCalories} />
        <NumberField label="蛋白 (g)" value={protein} onChange={setProtein} />
        <NumberField label="碳水 (g)" value={carbs} onChange={setCarbs} />
        <NumberField label="脂肪 (g)" value={fat} onChange={setFat} />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-black/10 py-3 text-sm font-medium dark:border-white/10"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 rounded-xl bg-orange-500 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? '保存中…' : initial ? '更新' : '保存'}
        </button>
      </div>
    </div>
  )
}

function NumberField({
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
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-base outline-none focus:border-orange-500 dark:border-white/10 dark:bg-[#2c2c2e]"
      />
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
    <div className="flex items-start justify-between rounded-xl bg-slate-50 px-3 py-3 dark:bg-[#2c2c2e]">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-orange-500">
            {MEAL_LABELS[record.meal]}
          </span>
          <span className="truncate text-sm font-medium">{record.name}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {Math.round(record.calories)} kcal · P{Math.round(record.protein)} · C
          {Math.round(record.carbs)} · F{Math.round(record.fat)}
        </p>
      </div>
      <div className="ml-2 flex shrink-0 gap-2">
        <button type="button" onClick={onEdit} className="text-xs text-slate-500">
          编辑
        </button>
        <button type="button" onClick={onDelete} className="text-xs text-red-500">
          删除
        </button>
      </div>
    </div>
  )
}

interface DaySheetProps {
  date: string
  onClose: () => void
  initialDraft?: ParsedMealDraft | null
  onDraftConsumed?: () => void
}

export function DaySheet({
  date,
  onClose,
  initialDraft,
  onDraftConsumed,
}: DaySheetProps) {
  const entries = useEntriesByDate(date)
  const targets = useTargets()
  const [mode, setMode] = useState<'list' | 'add' | 'edit' | 'paste'>(
    initialDraft ? 'add' : 'list',
  )
  const [editing, setEditing] = useState<FoodEntry | null>(null)
  const [draft, setDraft] = useState<ParsedMealDraft | null>(initialDraft ?? null)
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const photoRef = useRef<HTMLInputElement>(null)

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
    if (!confirm('确定删除这条记录？')) return
    try {
      await deleteEntry(id)
      notifyLocalStorageChange()
    } catch {
      alert('删除失败，请重试')
    }
  }

  const handlePaste = () => {
    setPasteError('')
    const parsed = parseImportText(pasteText, date)
    if (parsed.length === 0) {
      setPasteError('无法识别，请粘贴 JSON 或「热量 xxxkcal | 蛋白…」文本')
      return
    }
    const first = { ...parsed[0], date: parsed[0].date || date }
    setDraft(first)
    setMode('add')
    setPasteText('')
  }

  const handlePhotoPick = async (file: File | undefined) => {
    if (!file) return
    setPhotoError('')
    if (!hasVisionApiKey()) {
      setPhotoError('请先到「设置」填写视觉 API Key（Gemini 或 OpenAI）')
      return
    }
    setPhotoBusy(true)
    try {
      const result = await recognizeFoodFromImage(file, date)
      setDraft(result)
      setMode('add')
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : '识别失败')
    } finally {
      setPhotoBusy(false)
      if (photoRef.current) photoRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="关闭" className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[#f2f2f7] p-5 shadow-xl dark:bg-black sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{formatDisplayDate(date)}</h2>
            <p className="text-sm text-slate-500">
              {entries.length} 条 · {status.onTrack ? '到位' : status.hasEntries ? '未到位' : '未记录'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-slate-400 hover:bg-black/5"
          >
            ✕
          </button>
        </div>

        {mode === 'list' && (
          <div className="space-y-4">
            <DayProgress entries={entries} targets={targets} compact />

            {MEAL_TYPES.map((meal) => {
              const list = grouped.get(meal) ?? []
              if (list.length === 0) return null
              return (
                <div key={meal}>
                  <h3 className="mb-2 text-xs font-medium text-slate-400">
                    {MEAL_LABELS[meal]}
                  </h3>
                  <div className="space-y-2">
                    {list.map((record) => (
                      <RecordItem
                        key={record.id}
                        record={record}
                        onEdit={() => {
                          setEditing(record)
                          setDraft(null)
                          setMode('edit')
                        }}
                        onDelete={() => handleDelete(record.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}

            {entries.length === 0 && (
              <p className="py-4 text-center text-sm text-slate-400">暂无记录</p>
            )}

            {photoError && <p className="text-sm text-red-500">{photoError}</p>}

            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handlePhotoPick(e.target.files?.[0])}
            />

            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              disabled={photoBusy}
              className="w-full rounded-xl bg-orange-500 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {photoBusy ? '识别中…' : '拍照识别热量'}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft(null)
                  setMode('add')
                }}
                className="flex-1 rounded-xl border border-black/10 bg-white py-3 text-sm font-medium dark:border-white/10 dark:bg-[#1c1c1e]"
              >
                手动添加
              </button>
              <button
                type="button"
                onClick={() => setMode('paste')}
                className="flex-1 rounded-xl border border-black/10 bg-white py-3 text-sm font-medium dark:border-white/10 dark:bg-[#1c1c1e]"
              >
                粘贴导入
              </button>
            </div>
          </div>
        )}

        {mode === 'paste' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              粘贴快捷指令 JSON，或「热量 650kcal | 蛋白 45g | 碳水 60g | 脂肪 18g」
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 dark:border-white/10 dark:bg-[#1c1c1e]"
              placeholder='{"meal":"lunch","name":"鸡胸饭","calories":650,"protein":45,"carbs":60,"fat":18}'
            />
            {pasteError && <p className="text-sm text-red-500">{pasteError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('list')}
                className="flex-1 rounded-xl border border-black/10 py-3 text-sm dark:border-white/10"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handlePaste}
                className="flex-1 rounded-xl bg-orange-500 py-3 text-sm font-medium text-white"
              >
                解析并确认
              </button>
            </div>
          </div>
        )}

        {(mode === 'add' || mode === 'edit') && (
          <EntryForm
            date={date}
            initial={mode === 'edit' ? editing ?? undefined : undefined}
            draft={mode === 'add' ? draft ?? undefined : undefined}
            onDone={() => {
              setMode('list')
              setEditing(null)
              setDraft(null)
              onDraftConsumed?.()
            }}
            onCancel={() => {
              setMode('list')
              setEditing(null)
              setDraft(null)
              onDraftConsumed?.()
            }}
          />
        )}
      </div>
    </div>
  )
}

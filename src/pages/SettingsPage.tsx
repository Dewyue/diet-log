import { useEffect, useRef, useState } from 'react'
import {
  bulkUpsertEntries,
  clearAllEntries,
  getAllEntries,
  getStorageBackend,
  notifyLocalStorageChange,
  saveTargets,
} from '../db'
import {
  copyBackupToClipboard,
  downloadBackup,
  exportBackup,
  importBackup,
  importBackupFromText,
} from '../lib/backup'
import {
  draftsToEntries,
  isDuplicateIcsEntry,
  parseIcsMeals,
  parseImportText,
} from '../lib/importParse'
import { useTargets } from '../hooks/useEntries'
import {
  DEFAULT_TARGETS,
  MEAL_LABELS,
  MEAL_TYPES,
  type DailyTargets,
  type MealType,
} from '../types'

export default function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const icsRef = useRef<HTMLInputElement>(null)
  const currentTargets = useTargets()
  const [targets, setTargets] = useState<DailyTargets>(DEFAULT_TARGETS)
  const [message, setMessage] = useState('')
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const [busy, setBusy] = useState(false)
  const [storageBackend, setStorageBackend] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [icsText, setIcsText] = useState('')
  const [mealImportText, setMealImportText] = useState('')

  useEffect(() => {
    setStorageBackend(getStorageBackend())
  }, [])

  useEffect(() => {
    setTargets(currentTargets)
  }, [currentTargets])

  const showMessage = (text: string) => {
    setMessage(text)
    setTimeout(() => setMessage(''), 4000)
  }

  const handleSaveTargets = async () => {
    setBusy(true)
    try {
      await saveTargets(targets)
      notifyLocalStorageChange()
      showMessage('目标已保存')
    } finally {
      setBusy(false)
    }
  }

  const toggleRequiredMeal = (meal: MealType) => {
    setTargets((prev) => {
      const has = prev.requiredMeals.includes(meal)
      return {
        ...prev,
        requiredMeals: has
          ? prev.requiredMeals.filter((m) => m !== meal)
          : [...prev.requiredMeals, meal],
      }
    })
  }

  const handleExport = async () => {
    setBusy(true)
    try {
      const data = await exportBackup()
      downloadBackup(data)
      showMessage(`已导出 ${data.entries.length} 条记录`)
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    setBusy(true)
    try {
      const count = await copyBackupToClipboard()
      showMessage(`已复制 ${count} 条记录到剪贴板`)
    } catch (err) {
      showMessage(err instanceof Error ? err.message : '复制失败，请改用导出文件')
    } finally {
      setBusy(false)
    }
  }

  const handlePasteImport = async () => {
    if (!pasteText.trim()) {
      showMessage('请先粘贴备份数据')
      return
    }
    setBusy(true)
    try {
      const count = await importBackupFromText(pasteText, importMode)
      setPasteText('')
      showMessage(`已导入 ${count} 条记录`)
    } catch (err) {
      showMessage(err instanceof Error ? err.message : '导入失败')
    } finally {
      setBusy(false)
    }
  }

  const handleClipboardImport = async () => {
    setBusy(true)
    try {
      const text = await navigator.clipboard.readText()
      const count = await importBackupFromText(text, importMode)
      showMessage(`已从剪贴板导入 ${count} 条记录`)
    } catch (err) {
      showMessage(err instanceof Error ? err.message : '读取剪贴板失败，请手动粘贴')
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const count = await importBackup(file, importMode)
      showMessage(`已导入 ${count} 条记录`)
    } catch (err) {
      showMessage(err instanceof Error ? err.message : '导入失败')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const importIcsContent = async (text: string) => {
    const drafts = parseIcsMeals(text)
    if (drafts.length === 0) {
      throw new Error('未解析到有效日历事件，请确认含热量/餐次信息')
    }
    const existing = await getAllEntries()
    const filtered = drafts.filter((d) => !isDuplicateIcsEntry(existing, d))
    if (filtered.length === 0) {
      showMessage('没有新记录（可能已导入过）')
      return
    }
    await bulkUpsertEntries(draftsToEntries(filtered))
    notifyLocalStorageChange()
    showMessage(`已从日历导入 ${filtered.length} 条`)
  }

  const handleIcsPaste = async () => {
    if (!icsText.trim()) {
      showMessage('请粘贴 .ics 内容')
      return
    }
    setBusy(true)
    try {
      await importIcsContent(icsText)
      setIcsText('')
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'ICS 导入失败')
    } finally {
      setBusy(false)
    }
  }

  const handleIcsFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      await importIcsContent(await file.text())
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'ICS 导入失败')
    } finally {
      setBusy(false)
      if (icsRef.current) icsRef.current.value = ''
    }
  }

  const handleMealImport = async () => {
    if (!mealImportText.trim()) {
      showMessage('请粘贴一餐的 JSON 或文本')
      return
    }
    setBusy(true)
    try {
      const drafts = parseImportText(mealImportText)
      if (drafts.length === 0) throw new Error('无法识别导入内容')
      await bulkUpsertEntries(draftsToEntries(drafts))
      notifyLocalStorageChange()
      setMealImportText('')
      showMessage(`已导入 ${drafts.length} 餐`)
    } catch (err) {
      showMessage(err instanceof Error ? err.message : '导入失败')
    } finally {
      setBusy(false)
    }
  }

  const handleClear = async () => {
    if (!confirm('确定清空所有饮食记录？此操作不可恢复，建议先导出备份。')) return
    if (!confirm('再次确认：将删除全部本地饮食数据。')) return
    await clearAllEntries()
    notifyLocalStorageChange()
    showMessage('已清空所有饮食记录')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">设置</h1>
        <p className="mt-1 text-sm text-slate-500">
          数据保存在本机浏览器
          {storageBackend && `（${storageBackend === 'indexeddb' ? 'IndexedDB' : 'localStorage'}）`}
        </p>
      </div>

      {message && (
        <div className="rounded-2xl bg-orange-500/10 px-4 py-3 text-sm text-orange-700 dark:text-orange-300">
          {message}
        </div>
      )}

      <section className="space-y-3 rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-[#1c1c1e]">
        <h2 className="font-medium">每日目标</h2>
        <div className="grid grid-cols-2 gap-3">
          <TargetField
            label="热量 (kcal)"
            value={targets.calories}
            onChange={(n) => setTargets((t) => ({ ...t, calories: n }))}
          />
          <TargetField
            label="蛋白 (g)"
            value={targets.protein}
            onChange={(n) => setTargets((t) => ({ ...t, protein: n }))}
          />
          <TargetField
            label="碳水 (g)"
            value={targets.carbs}
            onChange={(n) => setTargets((t) => ({ ...t, carbs: n }))}
          />
          <TargetField
            label="脂肪 (g)"
            value={targets.fat}
            onChange={(n) => setTargets((t) => ({ ...t, fat: n }))}
          />
          <TargetField
            label="热量容差 %"
            value={targets.calorieTolerancePct}
            onChange={(n) => setTargets((t) => ({ ...t, calorieTolerancePct: n }))}
          />
        </div>

        <div>
          <p className="mb-2 text-sm text-slate-500">必吃餐次（到位需都有记录）</p>
          <div className="flex flex-wrap gap-2">
            {MEAL_TYPES.map((meal) => {
              const on = targets.requiredMeals.includes(meal)
              return (
                <button
                  key={meal}
                  type="button"
                  onClick={() => toggleRequiredMeal(meal)}
                  className={[
                    'rounded-full px-3 py-1.5 text-xs font-medium',
                    on
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                  ].join(' ')}
                >
                  {MEAL_LABELS[meal]}
                </button>
              )
            })}
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-slate-600 dark:text-slate-300">宏量不超过目标 120%</span>
          <input
            type="checkbox"
            checked={targets.macroCapEnabled}
            onChange={(e) =>
              setTargets((t) => ({ ...t, macroCapEnabled: e.target.checked }))
            }
            className="h-4 w-4 accent-orange-500"
          />
        </label>

        <button
          type="button"
          onClick={handleSaveTargets}
          disabled={busy}
          className="w-full rounded-xl bg-orange-500 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          保存目标
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-[#1c1c1e]">
        <h2 className="font-medium">快捷指令 / 单餐导入</h2>
        <p className="text-sm text-slate-500">
          粘贴 AI 识别结果 JSON，或键值文本。也可在日历页用
          <code className="mx-1 text-xs">?import=...</code>
          深链导入。
        </p>
        <textarea
          value={mealImportText}
          onChange={(e) => setMealImportText(e.target.value)}
          rows={3}
          placeholder='{"date":"2026-07-17","meal":"lunch","name":"鸡胸饭","calories":650,"protein":45,"carbs":60,"fat":18}'
          className="w-full rounded-xl border border-black/10 bg-transparent px-3 py-2 text-xs outline-none focus:border-orange-500 dark:border-white/10"
        />
        <button
          type="button"
          onClick={handleMealImport}
          disabled={busy || !mealImportText.trim()}
          className="w-full rounded-xl border border-orange-300 py-3 text-sm font-medium text-orange-600 disabled:opacity-50 dark:border-orange-800 dark:text-orange-300"
        >
          导入这一餐
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-[#1c1c1e]">
        <h2 className="font-medium">日历 ICS 导入</h2>
        <p className="text-sm text-slate-500">
          从「日历」导出 .ics，或粘贴 ICS 文本。事件建议格式：标题「午餐 · 鸡胸饭」，备注「热量
          650kcal | 蛋白 45g | 碳水 60g | 脂肪 18g」。
        </p>
        <input
          ref={icsRef}
          type="file"
          accept=".ics,text/calendar"
          className="hidden"
          onChange={(e) => handleIcsFile(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => icsRef.current?.click()}
          disabled={busy}
          className="w-full rounded-xl border border-black/10 py-3 text-sm font-medium disabled:opacity-50 dark:border-white/10"
        >
          选择 .ics 文件
        </button>
        <textarea
          value={icsText}
          onChange={(e) => setIcsText(e.target.value)}
          rows={4}
          placeholder="或粘贴 BEGIN:VCALENDAR …"
          className="w-full rounded-xl border border-black/10 bg-transparent px-3 py-2 text-xs outline-none focus:border-orange-500 dark:border-white/10"
        />
        <button
          type="button"
          onClick={handleIcsPaste}
          disabled={busy || !icsText.trim()}
          className="w-full rounded-xl border border-orange-300 py-3 text-sm font-medium text-orange-600 disabled:opacity-50 dark:border-orange-800 dark:text-orange-300"
        >
          从文本导入 ICS
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-[#1c1c1e]">
        <h2 className="font-medium">跨设备同步</h2>
        <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setImportMode('merge')}
            className={[
              'flex-1 rounded-lg py-2 text-sm',
              importMode === 'merge' ? 'bg-white shadow dark:bg-slate-600' : '',
            ].join(' ')}
          >
            合并导入
          </button>
          <button
            type="button"
            onClick={() => setImportMode('replace')}
            className={[
              'flex-1 rounded-lg py-2 text-sm',
              importMode === 'replace' ? 'bg-white shadow dark:bg-slate-600' : '',
            ].join(' ')}
          >
            覆盖导入
          </button>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          disabled={busy}
          className="w-full rounded-xl bg-slate-900 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-700"
        >
          复制全部数据到剪贴板
        </button>
        <button
          type="button"
          onClick={handleClipboardImport}
          disabled={busy}
          className="w-full rounded-xl border border-black/10 py-3 text-sm font-medium disabled:opacity-50 dark:border-white/10"
        >
          从剪贴板导入备份
        </button>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="或将备份 JSON 粘贴到这里…"
          rows={3}
          className="w-full rounded-xl border border-black/10 bg-transparent px-3 py-2 text-xs outline-none focus:border-orange-500 dark:border-white/10"
        />
        <button
          type="button"
          onClick={handlePasteImport}
          disabled={busy || !pasteText.trim()}
          className="w-full rounded-xl border border-black/10 py-3 text-sm font-medium disabled:opacity-50 dark:border-white/10"
        >
          从文本框导入备份
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-[#1c1c1e]">
        <h2 className="font-medium">文件备份</h2>
        <button
          type="button"
          onClick={handleExport}
          disabled={busy}
          className="w-full rounded-xl bg-slate-900 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-700"
        >
          导出 JSON 文件
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => handleImport(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="w-full rounded-xl border border-black/10 py-3 text-sm font-medium disabled:opacity-50 dark:border-white/10"
        >
          选择 JSON 文件导入
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-red-200 bg-white p-4 dark:border-red-900/50 dark:bg-[#1c1c1e]">
        <h2 className="font-medium text-red-600">危险操作</h2>
        <button
          type="button"
          onClick={handleClear}
          className="w-full rounded-xl border border-red-300 py-3 text-sm font-medium text-red-600 dark:border-red-800"
        >
          清空所有饮食记录
        </button>
      </section>

      <p className="text-center text-xs text-slate-400">饮食日志 · 本地存储 · 数据归你所有</p>
    </div>
  )
}

function TargetField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-xl border border-black/10 bg-transparent px-3 py-2.5 text-base outline-none focus:border-orange-500 dark:border-white/10"
      />
    </label>
  )
}

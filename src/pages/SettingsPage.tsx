import { useEffect, useRef, useState } from 'react'
import {
  clearAllEntries,
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
import { useTargets } from '../hooks/useEntries'
import {
  loadVisionSettings,
  saveVisionSettings,
  type VisionSettings,
} from '../lib/visionSettings'
import { getUsdaApiKey, setUsdaApiKey } from '../lib/foodApi'
import {
  DEFAULT_TARGETS,
  MEAL_LABELS,
  MEAL_TYPES,
  type DailyTargets,
  type MealType,
} from '../types'

export default function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const currentTargets = useTargets()
  const [targets, setTargets] = useState<DailyTargets>(DEFAULT_TARGETS)
  const [vision, setVision] = useState<VisionSettings>(() => loadVisionSettings())
  const [usdaKey, setUsdaKey] = useState(() => getUsdaApiKey())
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [storageBackend, setStorageBackend] = useState('')

  useEffect(() => {
    setStorageBackend(getStorageBackend())
    setVision(loadVisionSettings())
    setUsdaKey(getUsdaApiKey())
  }, [])

  useEffect(() => {
    setTargets(currentTargets)
  }, [currentTargets])

  const showMessage = (text: string) => {
    setMessage(text)
    setTimeout(() => setMessage(''), 3000)
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
      showMessage(`已导出 ${data.entries.length} 条`)
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    setBusy(true)
    try {
      const count = await copyBackupToClipboard()
      showMessage(`已复制 ${count} 条`)
    } catch {
      showMessage('复制失败，请改用导出文件')
    } finally {
      setBusy(false)
    }
  }

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const count = await importBackup(file, 'merge')
      showMessage(`已导入 ${count} 条`)
    } catch (err) {
      showMessage(err instanceof Error ? err.message : '导入失败')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleClipboardImport = async () => {
    setBusy(true)
    try {
      const text = await navigator.clipboard.readText()
      const count = await importBackupFromText(text, 'merge')
      showMessage(`已导入 ${count} 条`)
    } catch (err) {
      showMessage(err instanceof Error ? err.message : '读取剪贴板失败')
    } finally {
      setBusy(false)
    }
  }

  const handleClear = async () => {
    if (!confirm('确定清空所有饮食记录？建议先导出备份。')) return
    await clearAllEntries()
    notifyLocalStorageChange()
    showMessage('已清空')
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">设置</h1>
        <p className="mt-1 text-sm text-slate-500">
          数据仅存本机
          {storageBackend === 'indexeddb' ? '' : '（兼容模式）'}
        </p>
      </div>

      {message && (
        <div className="rounded-2xl bg-orange-500/10 px-4 py-3 text-sm text-orange-700 dark:text-orange-300">
          {message}
        </div>
      )}

      <section className="space-y-4 rounded-2xl bg-white p-4 dark:bg-[#1c1c1e]">
        <h2 className="text-[15px] font-semibold">每日目标</h2>
        <div className="grid grid-cols-2 gap-3">
          <TargetField
            label="热量"
            unit="kcal"
            value={targets.calories}
            onChange={(n) => setTargets((t) => ({ ...t, calories: n }))}
          />
          <TargetField
            label="蛋白"
            unit="g"
            value={targets.protein}
            onChange={(n) => setTargets((t) => ({ ...t, protein: n }))}
          />
          <TargetField
            label="碳水"
            unit="g"
            value={targets.carbs}
            onChange={(n) => setTargets((t) => ({ ...t, carbs: n }))}
          />
          <TargetField
            label="脂肪"
            unit="g"
            value={targets.fat}
            onChange={(n) => setTargets((t) => ({ ...t, fat: n }))}
          />
        </div>

        <div>
          <p className="mb-2 text-xs text-slate-500">到位需包含的餐次</p>
          <div className="flex flex-wrap gap-2">
            {MEAL_TYPES.map((meal) => {
              const on = targets.requiredMeals.includes(meal)
              return (
                <button
                  key={meal}
                  type="button"
                  onClick={() => toggleRequiredMeal(meal)}
                  className={[
                    'rounded-full px-3.5 py-2 text-sm font-medium transition',
                    on
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                  ].join(' ')}
                >
                  {MEAL_LABELS[meal]}
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveTargets}
          disabled={busy}
          className="w-full rounded-2xl bg-orange-500 py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          保存
        </button>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 dark:bg-[#1c1c1e]">
        <h2 className="text-[15px] font-semibold">食物数据库</h2>
        <p className="text-xs leading-relaxed text-slate-500">
          点「估算」优先查{' '}
          <a
            className="text-orange-500"
            href="https://world.openfoodfacts.org"
            target="_blank"
            rel="noreferrer"
          >
            Open Food Facts
          </a>
          {' '}
          + USDA；找不到再用本地常用与 Gemini 兜底。
        </p>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">
            USDA API Key（可选，免费申请）
          </span>
          <input
            type="password"
            autoComplete="off"
            value={usdaKey}
            onChange={(e) => setUsdaKey(e.target.value)}
            placeholder="fdc.nal.usda.gov 申请"
            className="w-full rounded-xl bg-slate-50 px-3 py-3 text-sm outline-none ring-orange-500 focus:ring-2 dark:bg-slate-800"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">
            Gemini Key（可选，库没有时兜底）
          </span>
          <input
            type="password"
            autoComplete="off"
            value={vision.apiKey}
            onChange={(e) => setVision((v) => ({ ...v, apiKey: e.target.value }))}
            placeholder="aistudio.google.com 申请"
            className="w-full rounded-xl bg-slate-50 px-3 py-3 text-sm outline-none ring-orange-500 focus:ring-2 dark:bg-slate-800"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setUsdaApiKey(usdaKey)
            saveVisionSettings({
              provider: 'gemini',
              apiKey: vision.apiKey.trim(),
            })
            showMessage('已保存数据库配置')
          }}
          className="w-full rounded-xl bg-slate-100 py-3 text-sm font-medium dark:bg-slate-800"
        >
          保存
        </button>
      </section>

      <section className="space-y-2 rounded-2xl bg-white p-4 dark:bg-[#1c1c1e]">
        <h2 className="mb-1 text-[15px] font-semibold">备份</h2>
        <button
          type="button"
          onClick={handleCopy}
          disabled={busy}
          className="w-full rounded-xl bg-slate-100 py-3 text-sm font-medium dark:bg-slate-800"
        >
          复制到剪贴板
        </button>
        <button
          type="button"
          onClick={handleClipboardImport}
          disabled={busy}
          className="w-full rounded-xl bg-slate-100 py-3 text-sm font-medium dark:bg-slate-800"
        >
          从剪贴板导入
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={busy}
          className="w-full rounded-xl bg-slate-100 py-3 text-sm font-medium dark:bg-slate-800"
        >
          导出文件
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => handleImportFile(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="w-full rounded-xl bg-slate-100 py-3 text-sm font-medium dark:bg-slate-800"
        >
          导入文件
        </button>
      </section>

      <button
        type="button"
        onClick={handleClear}
        className="w-full rounded-2xl py-3 text-sm font-medium text-red-500"
      >
        清空全部记录
      </button>
    </div>
  )
}

function TargetField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string
  unit: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-slate-500">
        {label}
        <span className="ml-1 text-slate-300">{unit}</span>
      </span>
      <input
        type="number"
        inputMode="numeric"
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-xl bg-slate-50 px-3 py-3 text-lg font-semibold outline-none ring-orange-500 focus:ring-2 dark:bg-slate-800"
      />
    </label>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DaySheet } from '../components/DaySheet'
import DayProgress from '../components/DayProgress'
import MonthCalendar from '../components/MonthCalendar'
import StatsCharts, { StatsSummary } from '../components/StatsCharts'
import { useEntriesByMonth, useTargets, groupByDate } from '../hooks/useEntries'
import {
  autosaveDrafts,
  decodeImportParam,
  tryImportFromClipboard,
} from '../lib/autoImport'
import { formatDate, formatMonthLabel } from '../lib/dates'
import { parseImportText, type ParsedMealDraft } from '../lib/importParse'

export default function CalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [statsExpanded, setStatsExpanded] = useState(false)
  const [importDraft, setImportDraft] = useState<ParsedMealDraft | null>(null)
  const [banner, setBanner] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()

  const { entries } = useEntriesByMonth(year, month)
  const targets = useTargets()
  const today = formatDate(new Date())
  const byDate = groupByDate(entries)
  const todayEntries = byDate.get(today) ?? []

  const monthLabel = useMemo(() => formatMonthLabel(year, month), [year, month])

  const showBanner = (text: string) => {
    setBanner(text)
    window.setTimeout(() => setBanner(''), 4000)
  }

  // Deep-link import from Shortcuts: ?import= / ?import_b64= & autosave=1
  useEffect(() => {
    const rawB64 = searchParams.get('import_b64')
    const raw = searchParams.get('import')
    if (!rawB64 && !raw) return

    const autosave = searchParams.get('autosave') === '1'
    let cancelled = false

    ;(async () => {
      try {
        const decoded = rawB64
          ? decodeImportParam(rawB64, true)
          : decodeImportParam(raw ?? '', false)
        const drafts = parseImportText(decoded)
        if (cancelled || drafts.length === 0) return

        if (autosave) {
          const count = await autosaveDrafts(drafts)
          const date = drafts[0].date || today
          const [y, m] = date.split('-').map(Number)
          if (y && m) {
            setYear(y)
            setMonth(m)
          }
          showBanner(count > 0 ? `已自动写入 ${count} 餐` : '这些记录已存在，未重复添加')
        } else {
          const draft = drafts[0]
          const date = draft.date || today
          setImportDraft(draft)
          setSelectedDate(date)
          const [y, m] = date.split('-').map(Number)
          if (y && m) {
            setYear(y)
            setMonth(m)
          }
        }
      } catch {
        // ignore bad payload
      }

      const next = new URLSearchParams(searchParams)
      next.delete('import')
      next.delete('import_b64')
      next.delete('autosave')
      setSearchParams(next, { replace: true })
    })()

    return () => {
      cancelled = true
    }
  }, [searchParams, setSearchParams, today])

  // Optional: when opening the PWA, pull 小仓鼠 text from clipboard
  useEffect(() => {
    let alive = true

    const run = async () => {
      const result = await tryImportFromClipboard()
      if (!alive) return
      if (result.imported > 0) {
        showBanner(`已从剪贴板自动写入 ${result.imported} 餐`)
      }
    }

    run()
    const onVis = () => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const goPrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1)
      setMonth(12)
    } else {
      setMonth((m) => m - 1)
    }
  }

  const goNextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1)
      setMonth(1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const goToday = () => {
    const t = new Date()
    setYear(t.getFullYear())
    setMonth(t.getMonth() + 1)
  }

  return (
    <div className="space-y-4">
      {banner && (
        <div className="rounded-2xl bg-orange-500/15 px-4 py-3 text-sm text-orange-700 dark:text-orange-300">
          {banner}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goPrevMonth}
          className="rounded-lg px-3 py-2 text-slate-500 hover:bg-black/5 dark:hover:bg-white/10"
        >
          ‹
        </button>
        <div className="text-center">
          <h1 className="text-lg font-semibold tracking-tight">{monthLabel}</h1>
          <button
            type="button"
            onClick={goToday}
            className="text-xs font-medium text-orange-500"
          >
            回到今天
          </button>
        </div>
        <button
          type="button"
          onClick={goNextMonth}
          className="rounded-lg px-3 py-2 text-slate-500 hover:bg-black/5 dark:hover:bg-white/10"
        >
          ›
        </button>
      </div>

      {year === now.getFullYear() && month === now.getMonth() + 1 && (
        <DayProgress entries={todayEntries} targets={targets} />
      )}

      <StatsSummary entries={entries} targets={targets} />

      <button
        type="button"
        onClick={() => setStatsExpanded((v) => !v)}
        className="w-full rounded-xl border border-black/5 bg-white py-2.5 text-sm text-slate-600 dark:border-white/10 dark:bg-[#1c1c1e] dark:text-slate-300"
      >
        {statsExpanded ? '收起统计 ▲' : '展开统计 ▼'}
      </button>

      <StatsCharts
        entries={entries}
        targets={targets}
        year={year}
        month={month}
        expanded={statsExpanded}
      />

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500" /> 到位
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-slate-400" /> 未到位
        </span>
      </div>

      <MonthCalendar
        year={year}
        month={month}
        entries={entries}
        targets={targets}
        onSelectDate={(date) => {
          setImportDraft(null)
          setSelectedDate(date)
        }}
      />

      {selectedDate && (
        <DaySheet
          date={selectedDate}
          initialDraft={importDraft}
          onDraftConsumed={() => setImportDraft(null)}
          onClose={() => {
            setSelectedDate(null)
            setImportDraft(null)
          }}
        />
      )}
    </div>
  )
}

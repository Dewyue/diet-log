import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DaySheet } from '../components/DaySheet'
import DayProgress from '../components/DayProgress'
import MonthCalendar from '../components/MonthCalendar'
import StatsCharts, { StatsSummary } from '../components/StatsCharts'
import { useEntriesByMonth, useTargets, groupByDate } from '../hooks/useEntries'
import { formatDate, formatMonthLabel } from '../lib/dates'
import { parseImportText, type ParsedMealDraft } from '../lib/importParse'

export default function CalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [statsExpanded, setStatsExpanded] = useState(false)
  const [importDraft, setImportDraft] = useState<ParsedMealDraft | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const { entries } = useEntriesByMonth(year, month)
  const targets = useTargets()
  const today = formatDate(new Date())
  const byDate = groupByDate(entries)
  const todayEntries = byDate.get(today) ?? []

  const monthLabel = useMemo(() => formatMonthLabel(year, month), [year, month])

  useEffect(() => {
    const raw = searchParams.get('import')
    if (!raw) return

    try {
      const decoded = decodeURIComponent(raw)
      const drafts = parseImportText(decoded)
      if (drafts.length > 0) {
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
      // ignore bad import payload
    }

    const next = new URLSearchParams(searchParams)
    next.delete('import')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, today])

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

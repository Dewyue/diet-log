import { useMemo, useState } from 'react'
import { DaySheet } from '../components/DaySheet'
import MonthCalendar from '../components/MonthCalendar'
import StatsCharts, { StatsSummary } from '../components/StatsCharts'
import { useEntriesByMonth, useTargets } from '../hooks/useEntries'
import { formatMonthLabel } from '../lib/dates'

export default function CalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [statsExpanded, setStatsExpanded] = useState(true)

  const { entries } = useEntriesByMonth(year, month)
  const targets = useTargets()
  const monthLabel = useMemo(() => formatMonthLabel(year, month), [year, month])

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
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">数据</h1>
        <p className="mt-1 text-sm text-slate-400">按月查看日历与营养趋势</p>
      </header>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goPrevMonth}
          className="rounded-lg px-3 py-2 text-slate-500 hover:bg-black/5 dark:hover:bg-white/10"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="text-lg font-semibold tracking-tight">{monthLabel}</p>
          <button
            type="button"
            onClick={goToday}
            className="text-xs font-medium text-orange-500"
          >
            回到本月
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
        onSelectDate={setSelectedDate}
      />

      {selectedDate && (
        <DaySheet date={selectedDate} onClose={() => setSelectedDate(null)} />
      )}
    </div>
  )
}

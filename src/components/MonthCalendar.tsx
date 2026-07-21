import { useMemo } from 'react'
import { groupByDate } from '../hooks/useEntries'
import { getCalendarCells, WEEKDAY_LABELS } from '../lib/dates'
import type { DailyTargets, FoodEntry } from '../types'
import DayCell from './DayCell'

interface MonthCalendarProps {
  year: number
  month: number
  entries: FoodEntry[]
  targets: DailyTargets
  onSelectDate: (date: string) => void
}

export default function MonthCalendar({
  year,
  month,
  entries,
  targets,
  onSelectDate,
}: MonthCalendarProps) {
  const cells = useMemo(() => getCalendarCells(year, month), [year, month])
  const byDate = useMemo(() => groupByDate(entries), [entries])

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1.5 px-0.5">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-[11px] font-medium text-slate-400"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell) => (
          <DayCell
            key={cell.date}
            day={cell.day}
            date={cell.date}
            inMonth={cell.inMonth}
            isToday={cell.isToday}
            dayEntries={byDate.get(cell.date) ?? []}
            targets={targets}
            onSelect={onSelectDate}
          />
        ))}
      </div>
    </div>
  )
}

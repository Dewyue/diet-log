import { WEEKDAY_LABELS, getCalendarCells } from '../lib/dates'
import { computeDailyStatus } from '../lib/dailyStatus'
import { groupByDate } from '../hooks/useEntries'
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
  const cells = getCalendarCells(year, month)
  const byDate = groupByDate(entries)

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-xs font-medium text-slate-400"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const dayEntries = byDate.get(cell.date) ?? []
          const status =
            dayEntries.length > 0 ? computeDailyStatus(dayEntries, targets) : null
          return (
            <DayCell
              key={cell.date}
              day={cell.day}
              inMonth={cell.inMonth}
              isToday={cell.isToday}
              status={status}
              onClick={() => onSelectDate(cell.date)}
            />
          )
        })}
      </div>
    </div>
  )
}

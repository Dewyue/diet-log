import {
  getCalorieBadge,
  sumEntries,
  type CalorieBadgeTone,
} from '../lib/dailyStatus'
import type { DailyTargets, FoodEntry } from '../types'

interface DayCellProps {
  day: number
  date: string
  inMonth: boolean
  isToday: boolean
  dayEntries: FoodEntry[]
  targets: DailyTargets
  onSelect: (date: string) => void
}

const TONE_BG: Record<CalorieBadgeTone, string> = {
  blue: 'bg-sky-100 text-sky-800 dark:bg-sky-500/25 dark:text-sky-200',
  green: 'bg-green-100 text-green-800 dark:bg-green-500/25 dark:text-green-200',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/25 dark:text-red-200',
}

export default function DayCell({
  day,
  date,
  inMonth,
  isToday,
  dayEntries,
  targets,
  onSelect,
}: DayCellProps) {
  const hasData = dayEntries.length > 0
  const tone = hasData
    ? getCalorieBadge(sumEntries(dayEntries).calories, targets.calories).tone
    : null

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      className={[
        'relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition',
        inMonth ? '' : 'opacity-35',
        tone
          ? TONE_BG[tone]
          : 'bg-white text-slate-700 dark:bg-[#1c1c1e] dark:text-slate-200',
        isToday ? 'ring-2 ring-orange-500 ring-offset-1 dark:ring-offset-black' : '',
      ].join(' ')}
    >
      <span className={isToday ? 'font-semibold' : ''}>{day}</span>
    </button>
  )
}

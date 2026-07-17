import type { DailyStatus } from '../lib/dailyStatus'

interface DayCellProps {
  day: number
  inMonth: boolean
  isToday: boolean
  status: DailyStatus | null
  onClick: () => void
}

export default function DayCell({
  day,
  inMonth,
  isToday,
  status,
  onClick,
}: DayCellProps) {
  const hasEntries = Boolean(status?.hasEntries)
  const onTrack = Boolean(status?.onTrack)
  const kcal = status?.totals.calories ?? 0

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex min-h-[72px] flex-col rounded-[10px] border p-1.5 text-left transition active:scale-[0.98]',
        inMonth
          ? 'border-black/5 bg-white dark:border-white/10 dark:bg-[#1c1c1e]'
          : 'border-transparent bg-transparent opacity-35',
        isToday ? 'ring-2 ring-orange-500 ring-offset-1 dark:ring-offset-black' : '',
        hasEntries ? 'shadow-sm' : '',
      ].join(' ')}
    >
      <div className="mb-1 flex items-center justify-between">
        <span
          className={[
            'text-xs font-semibold',
            isToday ? 'text-orange-500' : 'text-slate-700 dark:text-slate-200',
          ].join(' ')}
        >
          {day}
        </span>
        {hasEntries && (
          <span
            className={[
              'h-2 w-2 rounded-full',
              onTrack ? 'bg-green-500' : 'bg-slate-400',
            ].join(' ')}
          />
        )}
      </div>

      <div className="flex flex-1 flex-col justify-end overflow-hidden">
        {hasEntries && (
          <span className="truncate text-[10px] leading-tight text-slate-500 dark:text-slate-400">
            {Math.round(kcal)}
          </span>
        )}
      </div>
    </button>
  )
}

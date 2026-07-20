import {
  computeDailyStatus,
  getCalorieBadge,
  progressPct,
  type CalorieBadgeTone,
} from '../lib/dailyStatus'
import type { DailyTargets, FoodEntry } from '../types'

interface DayProgressProps {
  entries: FoodEntry[]
  targets: DailyTargets
  compact?: boolean
}

const BADGE_TONE: Record<CalorieBadgeTone, string> = {
  blue: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400',
}

function MacroBar({
  label,
  actual,
  target,
  color,
}: {
  label: string
  actual: number
  target: number
  color: string
}) {
  const pct = progressPct(actual, target)
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-slate-500">
        <span>{label}</span>
        <span>
          {Math.round(actual)}/{target}g
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export default function DayProgress({ entries, targets, compact }: DayProgressProps) {
  const status = computeDailyStatus(entries, targets)
  const { totals } = status
  const calPct = progressPct(totals.calories, targets.calories)
  const calorieBadge = getCalorieBadge(totals.calories, targets.calories)

  return (
    <div
      className={[
        'rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-[#1c1c1e]',
        compact ? '' : '',
      ].join(' ')}
    >
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            今日热量
          </p>
          <p className="mt-0.5 text-3xl font-semibold tracking-tight">
            {Math.round(totals.calories)}
            <span className="ml-1 text-sm font-normal text-slate-400">
              / {targets.calories}
            </span>
          </p>
        </div>
        {status.hasEntries && (
          <span
            className={[
              'shrink-0 rounded-xl px-2.5 py-1.5 text-xs font-semibold tabular-nums',
              BADGE_TONE[calorieBadge.tone],
            ].join(' ')}
          >
            {calorieBadge.label}
          </span>
        )}
      </div>

      <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-orange-500 transition-all"
          style={{ width: `${Math.min(100, calPct)}%` }}
        />
      </div>

      <div className="space-y-2.5">
        <MacroBar
          label="蛋白"
          actual={totals.protein}
          target={targets.protein}
          color="#ff3b30"
        />
        <MacroBar
          label="碳水"
          actual={totals.carbs}
          target={targets.carbs}
          color="#34c759"
        />
        <MacroBar
          label="脂肪"
          actual={totals.fat}
          target={targets.fat}
          color="#5856d6"
        />
      </div>

      {!compact && status.hasEntries && status.gaps.length > 0 && (
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          {status.gaps.join(' · ')}
        </p>
      )}
    </div>
  )
}

import { computeDailyStatus } from '../lib/dailyStatus'
import { groupByDate } from '../hooks/useEntries'
import type { DailyTargets, FoodEntry } from '../types'

export function StatsSummary({
  entries,
  targets,
}: {
  entries: FoodEntry[]
  targets: DailyTargets
}) {
  const byDate = groupByDate(entries)
  let onTrackDays = 0
  let daysWithData = 0
  let proteinOkDays = 0
  let calorieSum = 0

  for (const dayEntries of byDate.values()) {
    if (dayEntries.length === 0) continue
    daysWithData += 1
    const status = computeDailyStatus(dayEntries, targets)
    calorieSum += status.totals.calories
    if (status.onTrack) onTrackDays += 1
    if (status.proteinOk) proteinOkDays += 1
  }

  const avgCalories = daysWithData > 0 ? Math.round(calorieSum / daysWithData) : 0
  const proteinRate =
    daysWithData > 0 ? Math.round((proteinOkDays / daysWithData) * 100) : 0

  return (
    <div className="grid grid-cols-3 gap-2">
      <StatCard label="本月到位" value={onTrackDays} unit="天" accent />
      <StatCard label="日均热量" value={avgCalories} unit="kcal" />
      <StatCard label="蛋白达标" value={proteinRate} unit="%" />
    </div>
  )
}

function StatCard({
  label,
  value,
  unit,
  accent,
}: {
  label: string
  value: number
  unit: string
  accent?: boolean
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-[#1c1c1e]">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p
        className={[
          'text-lg font-semibold tracking-tight',
          accent ? 'text-orange-500' : 'text-slate-900 dark:text-slate-100',
        ].join(' ')}
      >
        {value}
        <span className="ml-0.5 text-xs font-normal text-slate-400">{unit}</span>
      </p>
    </div>
  )
}

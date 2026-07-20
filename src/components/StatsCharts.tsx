import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { computeDailyStatus, sumEntries } from '../lib/dailyStatus'
import { groupByDate } from '../hooks/useEntries'
import type { DailyTargets, FoodEntry } from '../types'

interface StatsChartsProps {
  entries: FoodEntry[]
  targets: DailyTargets
  year: number
  month: number
  expanded: boolean
}

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

export default function StatsCharts({
  entries,
  targets,
  year,
  month,
  expanded,
}: StatsChartsProps) {
  const caloriesTrend = useMemo(() => {
    const lastDay = new Date(year, month, 0).getDate()
    const daily: { day: string; calories: number; target: number }[] = []
    for (let d = 1; d <= lastDay; d++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayEntries = entries.filter((e) => e.date === date)
      if (dayEntries.length === 0) continue
      daily.push({
        day: `${d}日`,
        calories: Math.round(sumEntries(dayEntries).calories),
        target: targets.calories,
      })
    }
    return daily
  }, [entries, year, month, targets.calories])

  if (!expanded) return null

  const hasData = entries.length > 0

  return (
    <div className="space-y-4">
      {!hasData && (
        <p className="rounded-2xl bg-white/60 py-6 text-center text-sm text-slate-400 dark:bg-[#1c1c1e]/60">
          本月暂无数据
        </p>
      )}

      {caloriesTrend.length > 0 && (
        <ChartCard title="热量趋势">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={caloriesTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={36} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="calories"
                stroke="#ff9500"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="热量"
              />
              <Line
                type="monotone"
                dataKey="target"
                stroke="#8e8e93"
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={false}
                name="目标"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-[#1c1c1e]">
      <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">{title}</h3>
      {children}
    </div>
  )
}

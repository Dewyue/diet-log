import type { DailyTargets, FoodEntry, MacroTotals, MealType } from '../types'
import { MEAL_LABELS } from '../types'

/** Below this → 还需；from here up to target → 余量；above target → 已超 */
export const CALORIE_COMFORT_MIN = 1500

export interface DailyStatus {
  onTrack: boolean
  hasEntries: boolean
  totals: MacroTotals
  missingMeals: MealType[]
  caloriesOk: boolean
  proteinOk: boolean
  carbsOk: boolean
  fatOk: boolean
  mealsOk: boolean
  gaps: string[]
}

export type CalorieBadgeTone = 'blue' | 'green' | 'red'

export interface CalorieBadge {
  label: string
  amount: number
  tone: CalorieBadgeTone
}

export function sumEntries(entries: FoodEntry[]): MacroTotals {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + (e.calories || 0),
      protein: acc.protein + (e.protein || 0),
      carbs: acc.carbs + (e.carbs || 0),
      fat: acc.fat + (e.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

function macroFloorOk(actual: number, target: number) {
  if (target <= 0) return true
  return actual >= target * 0.9
}

function macroCapOk(actual: number, target: number, enabled: boolean) {
  if (!enabled || target <= 0) return true
  return actual <= target * 1.2
}

/** 还需 / 余量 / 已超 — for today's calorie pill */
export function getCalorieBadge(
  actualCalories: number,
  targetCalories: number,
): CalorieBadge {
  const actual = Math.round(actualCalories)
  const target = Math.round(targetCalories)

  if (actual > target) {
    const amount = actual - target
    return { label: `已超（${amount}）`, amount, tone: 'red' }
  }

  const remaining = Math.max(0, target - actual)
  if (actual >= CALORIE_COMFORT_MIN) {
    return { label: `余量（${remaining}）`, amount: remaining, tone: 'green' }
  }

  return { label: `还需（${remaining}）`, amount: remaining, tone: 'blue' }
}

export function computeDailyStatus(entries: FoodEntry[], targets: DailyTargets): DailyStatus {
  const totals = sumEntries(entries)
  const hasEntries = entries.length > 0
  const gaps: string[] = []

  const caloriesOk =
    hasEntries &&
    totals.calories >= CALORIE_COMFORT_MIN &&
    totals.calories <= targets.calories

  const proteinOk =
    hasEntries &&
    macroFloorOk(totals.protein, targets.protein) &&
    macroCapOk(totals.protein, targets.protein, targets.macroCapEnabled)
  const carbsOk =
    hasEntries &&
    macroFloorOk(totals.carbs, targets.carbs) &&
    macroCapOk(totals.carbs, targets.carbs, targets.macroCapEnabled)
  const fatOk =
    hasEntries &&
    macroFloorOk(totals.fat, targets.fat) &&
    macroCapOk(totals.fat, targets.fat, targets.macroCapEnabled)

  if (hasEntries && !proteinOk) gaps.push('蛋白未到位')

  const presentMeals = new Set(entries.map((e) => e.meal))
  const missingMeals = (targets.requiredMeals ?? []).filter((m) => !presentMeals.has(m))
  const mealsOk = hasEntries && missingMeals.length === 0
  if (hasEntries && !mealsOk) {
    gaps.push(`缺餐：${missingMeals.map((m) => MEAL_LABELS[m]).join('、')}`)
  }

  // Fat/carbs no longer surface as gap copy; calorie state is the badge
  const onTrack = hasEntries && caloriesOk && proteinOk && mealsOk

  return {
    onTrack,
    hasEntries,
    totals,
    missingMeals,
    caloriesOk,
    proteinOk,
    carbsOk,
    fatOk,
    mealsOk,
    gaps,
  }
}

export function progressPct(actual: number, target: number) {
  if (target <= 0) return 0
  return Math.min(150, Math.round((actual / target) * 100))
}

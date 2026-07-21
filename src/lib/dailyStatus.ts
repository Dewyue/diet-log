import type { DailyTargets, FoodEntry, MacroTotals, MealType } from '../types'

/** Fixed hard ceiling for 已超 — not the editable daily target */
export const CALORIE_HARD_CAP = 1800

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

/**
 * Zones (1800 is fixed):
 * - actual < target → 还需（浅蓝）
 * - target ≤ actual ≤ 1800 → 余量（绿）
 * - actual > 1800 → 已超（红）
 */
export function getCalorieBadge(
  actualCalories: number,
  targetCalories: number,
): CalorieBadge {
  const actual = Math.round(actualCalories)
  const target = Math.round(targetCalories)

  if (actual > CALORIE_HARD_CAP) {
    const amount = actual - CALORIE_HARD_CAP
    return { label: `已超（${amount}）`, amount, tone: 'red' }
  }

  if (actual >= target) {
    const amount = Math.max(0, CALORIE_HARD_CAP - actual)
    return { label: `余量（${amount}）`, amount, tone: 'green' }
  }

  const amount = Math.max(0, target - actual)
  return { label: `还需（${amount}）`, amount, tone: 'blue' }
}

export function computeDailyStatus(entries: FoodEntry[], targets: DailyTargets): DailyStatus {
  const totals = sumEntries(entries)
  const hasEntries = entries.length > 0

  const caloriesOk =
    hasEntries &&
    totals.calories >= targets.calories &&
    totals.calories <= CALORIE_HARD_CAP

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

  const presentMeals = new Set(entries.map((e) => e.meal))
  const missingMeals = (targets.requiredMeals ?? []).filter((m) => !presentMeals.has(m))
  const mealsOk = hasEntries && missingMeals.length === 0

  const onTrack = hasEntries && caloriesOk

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
    gaps: [],
  }
}

export function progressPct(actual: number, target: number) {
  if (target <= 0) return 0
  return Math.min(150, Math.round((actual / target) * 100))
}

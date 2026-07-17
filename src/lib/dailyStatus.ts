import type { DailyTargets, FoodEntry, MacroTotals, MealType } from '../types'
import { MEAL_LABELS } from '../types'

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

export function computeDailyStatus(entries: FoodEntry[], targets: DailyTargets): DailyStatus {
  const totals = sumEntries(entries)
  const hasEntries = entries.length > 0
  const gaps: string[] = []

  const tol = Math.max(0, targets.calorieTolerancePct) / 100
  const calMin = targets.calories * (1 - tol)
  const calMax = targets.calories * (1 + tol)
  const caloriesOk =
    hasEntries && totals.calories >= calMin && totals.calories <= calMax
  if (hasEntries && !caloriesOk) {
    if (totals.calories < calMin) gaps.push('热量不足')
    else gaps.push('热量超标')
  }

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
  if (hasEntries && !carbsOk) gaps.push('碳水未到位')
  if (hasEntries && !fatOk) gaps.push('脂肪未到位')

  const presentMeals = new Set(entries.map((e) => e.meal))
  const missingMeals = (targets.requiredMeals ?? []).filter((m) => !presentMeals.has(m))
  const mealsOk = hasEntries && missingMeals.length === 0
  if (hasEntries && !mealsOk) {
    gaps.push(`缺餐：${missingMeals.map((m) => MEAL_LABELS[m]).join('、')}`)
  }

  const onTrack =
    hasEntries && caloriesOk && proteinOk && carbsOk && fatOk && mealsOk

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

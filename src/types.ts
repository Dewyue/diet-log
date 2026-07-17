export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type EntrySource = 'manual' | 'shortcut' | 'ics' | 'photo'

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
}

export interface FoodEntry {
  id: string
  date: string
  meal: MealType
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  source?: EntrySource
  rawNote?: string
  createdAt: number
}

export interface DailyTargets {
  calories: number
  protein: number
  carbs: number
  fat: number
  calorieTolerancePct: number
  requiredMeals: MealType[]
  /** 开启后宏量不得超过目标 120% */
  macroCapEnabled: boolean
}

export const DEFAULT_TARGETS: DailyTargets = {
  calories: 1800,
  protein: 120,
  carbs: 180,
  fat: 55,
  calorieTolerancePct: 10,
  requiredMeals: ['breakfast', 'lunch', 'dinner'],
  macroCapEnabled: false,
}

export interface BackupData {
  version: 1
  exportedAt: string
  entries: FoodEntry[]
  targets: DailyTargets
}

export interface MacroTotals {
  calories: number
  protein: number
  carbs: number
  fat: number
}

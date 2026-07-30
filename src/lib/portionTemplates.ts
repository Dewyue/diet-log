/** One exchange portion ≈ 90 kcal (食物交换份). Labels are P:C:F ratios（蛋=蛋白）. */

export interface PortionTemplate {
  id: string
  label: string
  hint: string
  /** Grams per 1 portion */
  protein: number
  carbs: number
  fat: number
}

export const PORTION_KCAL = 90

export const PORTION_TEMPLATES: PortionTemplate[] = [
  {
    id: 'egg-pure',
    label: '蛋纯',
    hint: '鸡胸、虾、蛋白粉',
    protein: 22.5,
    carbs: 0,
    fat: 0,
  },
  {
    id: 'egg2-fat1',
    label: '蛋2脂1',
    hint: '鸡蛋、瘦牛肉、豆腐',
    protein: 10,
    carbs: 0,
    fat: 5,
  },
  {
    id: 'egg1-carb10',
    label: '蛋1碳10',
    hint: '米饭、面条、红薯、香蕉',
    protein: 2,
    carbs: 20,
    fat: 0,
  },
  {
    id: 'egg1-carb3',
    label: '蛋1碳3',
    hint: '青菜、黄瓜、番茄',
    protein: 5,
    carbs: 15,
    fat: 0,
  },
  {
    id: 'egg1-carb1-fat1',
    label: '蛋1碳1脂1',
    hint: '牛奶、原味酸奶',
    protein: 5,
    carbs: 5,
    fat: 5,
  },
  {
    id: 'egg1-carb1-fat4',
    label: '蛋1碳1脂4',
    hint: '坚果、油、酱',
    protein: 2,
    carbs: 2,
    fat: 8,
  },
  {
    id: 'egg2-carb3-fat1',
    label: '蛋2碳3脂1',
    hint: '简单套餐粗估',
    protein: 6,
    carbs: 9,
    fat: 3,
  },
]

export function caloriesFromMacros(protein: number, carbs: number, fat: number) {
  return Math.round(protein * 4 + carbs * 4 + fat * 9)
}

export function scaleTemplate(template: PortionTemplate, portions: number) {
  const protein = Math.round(template.protein * portions * 10) / 10
  const carbs = Math.round(template.carbs * portions * 10) / 10
  const fat = Math.round(template.fat * portions * 10) / 10
  return {
    protein,
    carbs,
    fat,
    calories: caloriesFromMacros(protein, carbs, fat),
  }
}

export function formatPortions(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

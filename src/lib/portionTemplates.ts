/** One exchange portion ≈ 90 kcal (食物交换份). */

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
    id: 'pure-protein',
    label: '纯蛋白',
    hint: '鸡胸、虾、蛋白粉',
    protein: 22.5,
    carbs: 0,
    fat: 0,
  },
  {
    id: 'lean-meat',
    label: '瘦肉蛋',
    hint: '鸡蛋、瘦牛肉、豆腐',
    protein: 12,
    carbs: 0,
    fat: 5,
  },
  {
    id: 'staple-carb',
    label: '主食碳水',
    hint: '米饭、面条、馒头',
    protein: 2,
    carbs: 20,
    fat: 0,
  },
  {
    id: 'starchy',
    label: '淀粉果蔬',
    hint: '红薯、香蕉、玉米',
    protein: 1,
    carbs: 21,
    fat: 0,
  },
  {
    id: 'dairy',
    label: '奶类',
    hint: '牛奶、原味酸奶',
    protein: 5,
    carbs: 7,
    fat: 5,
  },
  {
    id: 'fat-nuts',
    label: '坚果油脂',
    hint: '坚果、油、酱',
    protein: 2,
    carbs: 2,
    fat: 8,
  },
  {
    id: 'balanced',
    label: '均衡一份',
    hint: '简单套餐粗估',
    protein: 7,
    carbs: 10,
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

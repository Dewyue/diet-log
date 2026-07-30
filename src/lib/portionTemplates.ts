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
    id: 'egg1-fat2',
    label: '蛋1脂2',
    hint: '五花、肥牛、红烧肉',
    protein: 6,
    carbs: 0,
    fat: 7,
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
    id: 'pure-carb',
    label: '纯碳',
    hint: '砂糖、果汁、甜品',
    protein: 0,
    carbs: 22.5,
    fat: 0,
  },
  {
    id: 'egg1-carb2',
    label: '蛋1碳2',
    hint: '杂豆、全麦、豆制品',
    protein: 7,
    carbs: 14,
    fat: 0,
  },
  {
    id: 'egg1-carb2-fat2',
    label: '蛋1碳2脂2',
    hint: '油条、酥点、薯条',
    protein: 3,
    carbs: 6,
    fat: 6,
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

/** Names auto-filled as「模版 × 份数」 */
export function isAutoPortionName(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return false
  return PORTION_TEMPLATES.some((t) => {
    if (trimmed === t.label) return true
    return trimmed.startsWith(`${t.label} × `) || trimmed.startsWith(`${t.label}×`)
  })
}

/** Recover template + portions when editing a saved entry */
export function inferTemplateFromEntry(entry: {
  name: string
  protein: number
  carbs: number
  fat: number
}): { template: PortionTemplate | null; portions: number } {
  const nameMatch = entry.name.trim().match(/^(.+?)\s*×\s*([\d.]+)$/)
  if (nameMatch) {
    const label = nameMatch[1].trim()
    const portions = Math.round(Number(nameMatch[2]) * 10) / 10
    const template = PORTION_TEMPLATES.find((t) => t.label === label)
    if (template && portions >= 0.5 && portions <= 12) {
      return { template, portions }
    }
  }

  for (const template of PORTION_TEMPLATES) {
    const ratios: number[] = []
    if (template.protein > 0) ratios.push(entry.protein / template.protein)
    if (template.carbs > 0) ratios.push(entry.carbs / template.carbs)
    if (template.fat > 0) ratios.push(entry.fat / template.fat)
    if (ratios.length === 0) continue

    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length
    const portions = Math.round(avg * 2) / 2
    if (portions < 0.5 || portions > 12) continue

    const scaled = scaleTemplate(template, portions)
    if (
      Math.abs(scaled.protein - entry.protein) <= 0.25 &&
      Math.abs(scaled.carbs - entry.carbs) <= 0.25 &&
      Math.abs(scaled.fat - entry.fat) <= 0.25
    ) {
      return { template, portions }
    }
  }

  return { template: null, portions: 1 }
}

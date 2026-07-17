import { createId } from './id'
import {
  MEAL_LABELS,
  type EntrySource,
  type FoodEntry,
  type MealType,
} from '../types'
import { formatDate } from './dates'

export type ParsedMealDraft = Omit<FoodEntry, 'id' | 'createdAt'> & {
  id?: string
  createdAt?: number
}

const MEAL_ALIASES: Record<string, MealType> = {
  早餐: 'breakfast',
  早饭: 'breakfast',
  早: 'breakfast',
  breakfast: 'breakfast',
  午餐: 'lunch',
  午饭: 'lunch',
  中餐: 'lunch',
  午: 'lunch',
  lunch: 'lunch',
  晚餐: 'dinner',
  晚饭: 'dinner',
  晚: 'dinner',
  dinner: 'dinner',
  加餐: 'snack',
  零食: 'snack',
  snack: 'snack',
}

/** Strip emoji / variation selectors so "热量：🔥 700kcal" still parses. */
function stripEmoji(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\uFE0F/g, '')
    .replace(/\u200D/g, '')
}

function detectMeal(text: string, fallback: MealType = 'snack'): MealType {
  const lower = text.toLowerCase()
  for (const [alias, meal] of Object.entries(MEAL_ALIASES)) {
    if (text.includes(alias) || lower.includes(alias.toLowerCase())) {
      return meal
    }
  }
  return fallback
}

function extractNumber(text: string, patterns: RegExp[]): number {
  const normalized = stripEmoji(text)
  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match?.[1]) {
      const n = Number(match[1])
      if (!Number.isNaN(n)) return n
    }
  }
  return 0
}

function parseNutrition(text: string) {
  const calories = extractNumber(text, [
    /热量\s*[：:]?\s*(\d+(?:\.\d+)?)\s*(?:k?cal|千卡)?/i,
    /摄入热量\s*[：:]?\s*(\d+(?:\.\d+)?)\s*(?:k?cal|千卡)?/i,
    /卡路里\s*[：:]?\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*k?cal/i,
  ])
  const protein = extractNumber(text, [
    /蛋白(?:质)?\s*[：:]?\s*(\d+(?:\.\d+)?)\s*g?/i,
    /P\s*[：:]?\s*(\d+(?:\.\d+)?)/i,
  ])
  const carbs = extractNumber(text, [
    /碳水(?:化合物)?\s*[：:]?\s*(\d+(?:\.\d+)?)\s*g?/i,
    /C\s*[：:]?\s*(\d+(?:\.\d+)?)/i,
  ])
  const fat = extractNumber(text, [
    /脂肪\s*[：:]?\s*(\d+(?:\.\d+)?)\s*g?/i,
    /F\s*[：:]?\s*(\d+(?:\.\d+)?)/i,
  ])
  return { calories, protein, carbs, fat }
}

/** e.g. 食物：🍤7只蒸虾 『低 GI』 */
function extractFoodName(text: string): string {
  const match = text.match(/食物\s*[：:]\s*(.+)/)
  if (!match?.[1]) return ''
  let name = stripEmoji(match[1]).trim()
  // Drop trailing decorative tags like 『低 GI』 but keep core dish name
  name = name.replace(/\s*[『「【\[].*?[』」】\]]\s*$/u, '').trim()
  return name
}

function stripMealPrefix(name: string): string {
  return name
    .replace(/^(早餐|午餐|晚餐|加餐|早饭|午饭|晚饭|早|午|晚)\s*[：:·•\-—|｜]?\s*/u, '')
    .replace(/^摄入热量\s*\d+(?:\.\d+)?\s*(?:k?cal|千卡)?/iu, '')
    .trim()
}

function isMealType(value: unknown): value is MealType {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner' || value === 'snack'
}

function draftFromPartial(
  partial: Partial<ParsedMealDraft> & { name?: string },
  source: EntrySource,
  rawNote?: string,
): ParsedMealDraft | null {
  const name = (partial.name ?? '').trim()
  if (!name && !partial.calories) return null

  const date =
    typeof partial.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(partial.date)
      ? partial.date
      : formatDate(new Date())

  const meal = isMealType(partial.meal) ? partial.meal : detectMeal(name || rawNote || '')

  return {
    date,
    meal,
    name: name || MEAL_LABELS[meal],
    calories: Number(partial.calories) || 0,
    protein: Number(partial.protein) || 0,
    carbs: Number(partial.carbs) || 0,
    fat: Number(partial.fat) || 0,
    source,
    rawNote,
  }
}

/**
 * Parse 小仓鼠 Ai 记账 → 日历 style text.
 *
 * Title: 午餐：摄入热量 700 kcal
 * Notes:
 *   食物：🍤7只蒸虾 『低 GI』
 *   摄入比例：🍽️ 100%
 *   热量：🔥 700kcal
 *   碳水：🍚 10g
 *   蛋白质：🍗 40g
 *   脂肪：🧈 20g
 */
export function parseHamsterCalendarText(
  text: string,
  defaultDate?: string,
): ParsedMealDraft | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const looksLikeHamster =
    /食物\s*[：:]/.test(trimmed) ||
    /摄入热量/.test(trimmed) ||
    (/热量\s*[：:]/.test(trimmed) && /蛋白/.test(trimmed) && /碳水/.test(trimmed))

  if (!looksLikeHamster && !/热量|kcal|卡路里/i.test(trimmed)) {
    return null
  }

  const nutrition = parseNutrition(trimmed)
  const meal = detectMeal(trimmed)
  const foodName = extractFoodName(trimmed)

  let name = foodName
  if (!name) {
    // Fall back to first line without the "摄入热量 xxx" title pattern
    const firstLine = trimmed.split(/\n/)[0] ?? ''
    name = stripMealPrefix(stripEmoji(firstLine))
    name = name
      .replace(/热量[\s\S]*/i, '')
      .replace(/[|｜].*$/, '')
      .trim()
  }
  if (!name) name = MEAL_LABELS[meal]

  if (!nutrition.calories && !nutrition.protein && !nutrition.carbs && !nutrition.fat) {
    return null
  }

  return draftFromPartial(
    {
      date: defaultDate,
      meal,
      name,
      ...nutrition,
    },
    'shortcut',
    trimmed,
  )
}

export function parseJsonMeal(
  text: string,
  source: EntrySource = 'shortcut',
): ParsedMealDraft | null {
  try {
    const data = JSON.parse(text) as Record<string, unknown>
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    if (Array.isArray((data as { entries?: unknown }).entries)) return null

    const mealRaw = data.meal
    let meal: MealType | undefined
    if (isMealType(mealRaw)) meal = mealRaw
    else if (typeof mealRaw === 'string') meal = detectMeal(mealRaw)

    const name =
      typeof data.name === 'string'
        ? data.name
        : typeof data.食物 === 'string'
          ? data.食物
          : undefined

    return draftFromPartial(
      {
        date: typeof data.date === 'string' ? data.date : undefined,
        meal,
        name,
        calories:
          typeof data.calories === 'number'
            ? data.calories
            : Number(data.calories ?? data.热量),
        protein:
          typeof data.protein === 'number'
            ? data.protein
            : Number(data.protein ?? data.蛋白质 ?? data.蛋白),
        carbs:
          typeof data.carbs === 'number'
            ? data.carbs
            : Number(data.carbs ?? data.碳水),
        fat:
          typeof data.fat === 'number' ? data.fat : Number(data.fat ?? data.脂肪),
      },
      source,
      text,
    )
  } catch {
    return null
  }
}

export function parseKeyValueMeal(text: string, defaultDate?: string): ParsedMealDraft | null {
  const hamster = parseHamsterCalendarText(text, defaultDate)
  if (hamster) return hamster

  const nutrition = parseNutrition(text)
  if (!nutrition.calories && !nutrition.protein && !text.trim()) return null

  const meal = detectMeal(text)
  let name = stripMealPrefix(stripEmoji(text.split('\n')[0] ?? ''))
  name = name
    .replace(/热量[\s\S]*/i, '')
    .replace(/[|｜].*$/, '')
    .trim()
  if (!name) name = MEAL_LABELS[meal]

  if (!nutrition.calories && !nutrition.protein && !nutrition.carbs && !nutrition.fat) {
    return null
  }

  return draftFromPartial(
    {
      date: defaultDate,
      meal,
      name,
      ...nutrition,
    },
    'shortcut',
    text,
  )
}

function unfoldIcs(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
}

function icsUnescape(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

function parseIcsDate(value: string): string | null {
  const compact = value.replace(/[^0-9T]/g, '')
  const m = compact.match(/^(\d{4})(\d{2})(\d{2})/)
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

export function parseIcsMeals(text: string): ParsedMealDraft[] {
  if (!/BEGIN:VCALENDAR|BEGIN:VEVENT/i.test(text)) return []

  const unfolded = unfoldIcs(text)
  const blocks = unfolded.split(/BEGIN:VEVENT/i).slice(1)
  const drafts: ParsedMealDraft[] = []

  for (const block of blocks) {
    const body = block.split(/END:VEVENT/i)[0] ?? ''
    const fields: Record<string, string> = {}
    for (const line of body.split('\n')) {
      const idx = line.indexOf(':')
      if (idx <= 0) continue
      const key = line.slice(0, idx).split(';')[0]?.toUpperCase() ?? ''
      fields[key] = icsUnescape(line.slice(idx + 1).trim())
    }

    const date =
      parseIcsDate(fields.DTSTART ?? '') ??
      parseIcsDate(fields.DTEND ?? '') ??
      formatDate(new Date())
    const summary = fields.SUMMARY ?? ''
    const description = fields.DESCRIPTION ?? ''
    const combined = `${summary}\n${description}`

    // Prefer 小仓鼠-style parser (title + 备注)
    const hamster = parseHamsterCalendarText(combined, date)
    if (hamster) {
      drafts.push({ ...hamster, date, source: 'ics' })
      continue
    }

    const nutrition = parseNutrition(combined)
    const meal = detectMeal(combined)
    const name =
      extractFoodName(combined) ||
      stripMealPrefix(stripEmoji(summary)) ||
      MEAL_LABELS[meal]

    if (!summary && !description) continue
    if (!nutrition.calories && !nutrition.protein && !name) continue

    const draft = draftFromPartial(
      {
        date,
        meal,
        name,
        ...nutrition,
      },
      'ics',
      combined,
    )
    if (draft) drafts.push(draft)
  }

  return drafts
}

export function parseImportText(text: string, defaultDate?: string): ParsedMealDraft[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  if (/BEGIN:VCALENDAR|BEGIN:VEVENT/i.test(trimmed)) {
    return parseIcsMeals(trimmed)
  }

  // Multiple meals separated by --- (for Shortcuts batch sync)
  if (/\n\s*---\s*\n/.test(trimmed)) {
    return trimmed
      .split(/\n\s*---\s*\n/)
      .flatMap((chunk) => parseImportText(chunk.trim(), defaultDate))
  }

  try {
    const data = JSON.parse(trimmed) as unknown
    if (Array.isArray(data)) {
      return data
        .map((item) => parseJsonMeal(JSON.stringify(item)))
        .filter((d): d is ParsedMealDraft => Boolean(d))
    }
    if (data && typeof data === 'object') {
      const obj = data as { entries?: unknown }
      if (Array.isArray(obj.entries)) {
        return []
      }
      const single = parseJsonMeal(trimmed)
      return single ? [single] : []
    }
  } catch {
    // not JSON
  }

  const kv = parseKeyValueMeal(trimmed, defaultDate)
  return kv ? [kv] : []
}

export function draftsToEntries(drafts: ParsedMealDraft[]): FoodEntry[] {
  return drafts.map((d) => ({
    id: d.id ?? createId(),
    date: d.date,
    meal: d.meal,
    name: d.name,
    calories: d.calories,
    protein: d.protein,
    carbs: d.carbs,
    fat: d.fat,
    source: d.source,
    rawNote: d.rawNote,
    createdAt: d.createdAt ?? Date.now(),
  }))
}

export function isDuplicateIcsEntry(existing: FoodEntry[], draft: ParsedMealDraft): boolean {
  return existing.some(
    (e) =>
      e.source === 'ics' &&
      e.date === draft.date &&
      e.name === draft.name &&
      e.calories === draft.calories,
  )
}

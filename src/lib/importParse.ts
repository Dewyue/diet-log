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
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const n = Number(match[1])
      if (!Number.isNaN(n)) return n
    }
  }
  return 0
}

function parseNutrition(text: string) {
  const calories = extractNumber(text, [
    /热量\s*[：:]?\s*(\d+(?:\.\d+)?)\s*k?cal/i,
    /(\d+(?:\.\d+)?)\s*k?cal/i,
    /热量\s*[：:]?\s*(\d+(?:\.\d+)?)/i,
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

function stripMealPrefix(name: string): string {
  return name
    .replace(/^(早餐|午餐|晚餐|加餐|早饭|午饭|晚饭|早|午|晚)\s*[·•\-—|｜]?\s*/u, '')
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

    return draftFromPartial(
      {
        date: typeof data.date === 'string' ? data.date : undefined,
        meal,
        name: typeof data.name === 'string' ? data.name : undefined,
        calories: typeof data.calories === 'number' ? data.calories : Number(data.calories),
        protein: typeof data.protein === 'number' ? data.protein : Number(data.protein),
        carbs: typeof data.carbs === 'number' ? data.carbs : Number(data.carbs),
        fat: typeof data.fat === 'number' ? data.fat : Number(data.fat),
      },
      source,
      text,
    )
  } catch {
    return null
  }
}

export function parseKeyValueMeal(text: string, defaultDate?: string): ParsedMealDraft | null {
  const nutrition = parseNutrition(text)
  if (!nutrition.calories && !nutrition.protein && !text.trim()) return null

  const meal = detectMeal(text)
  let name = stripMealPrefix(text.split('\n')[0] ?? '')
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
    const nutrition = parseNutrition(combined)
    const meal = detectMeal(combined)
    const name = stripMealPrefix(summary) || MEAL_LABELS[meal]

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

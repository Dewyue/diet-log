export interface FoodCandidate {
  id: string
  name: string
  brand?: string
  calories: number
  protein: number
  carbs: number
  fat: number
  /** Basis note, e.g. 每100g */
  basis: string
  source: 'openfoodfacts' | 'usda'
}

const OFF_SEARCH =
  'https://world.openfoodfacts.org/cgi/search.pl'

const USDA_KEY_STORAGE = 'diet-log-usda-key'
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1'

export function getUsdaApiKey(): string {
  return localStorage.getItem(USDA_KEY_STORAGE)?.trim() ?? ''
}

export function setUsdaApiKey(key: string) {
  const trimmed = key.trim()
  if (trimmed) localStorage.setItem(USDA_KEY_STORAGE, trimmed)
  else localStorage.removeItem(USDA_KEY_STORAGE)
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

/** OFF stores energy_100g in kJ when kcal field missing */
function offKcalPer100(n: Record<string, unknown>): number {
  const kcal = num(n['energy-kcal_100g'] ?? n['energy-kcal'])
  if (kcal > 0) return round1(kcal)
  const kj = num(n['energy_100g'] ?? n.energy)
  if (kj > 0) return round1(kj / 4.184)
  return 0
}

function offServingMacros(product: {
  product_name?: string
  product_name_zh?: string
  product_name_en?: string
  generic_name?: string
  brands?: string
  serving_size?: string
  nutriments?: Record<string, unknown>
  code?: string
}): FoodCandidate | null {
  const n = product.nutriments ?? {}
  const kcal100 = offKcalPer100(n)
  const p100 = num(n.proteins_100g)
  const c100 = num(n.carbohydrates_100g)
  const f100 = num(n.fat_100g)

  const kcalServing = num(n['energy-kcal_serving'])
  const pServing = num(n.proteins_serving)
  const cServing = num(n.carbohydrates_serving)
  const fServing = num(n.fat_serving)

  const name =
    product.product_name_zh ||
    product.product_name ||
    product.product_name_en ||
    product.generic_name ||
    ''
  if (!name.trim()) return null

  // Prefer per-serving when available and looks like a real meal portion
  if (kcalServing > 0 && (pServing > 0 || cServing > 0 || fServing > 0)) {
    return {
      id: `off-${product.code ?? name}`,
      name: name.trim(),
      brand: product.brands?.split(',')[0]?.trim(),
      calories: Math.round(kcalServing),
      protein: round1(pServing),
      carbs: round1(cServing),
      fat: round1(fServing),
      basis: product.serving_size ? `每份 ${product.serving_size}` : '每份',
      source: 'openfoodfacts',
    }
  }

  if (kcal100 <= 0 && p100 <= 0 && c100 <= 0 && f100 <= 0) return null

  // Default: one serving ≈ 100g label values
  return {
    id: `off-${product.code ?? name}`,
    name: name.trim(),
    brand: product.brands?.split(',')[0]?.trim(),
    calories: Math.round(kcal100 || p100 * 4 + c100 * 4 + f100 * 9),
    protein: round1(p100),
    carbs: round1(c100),
    fat: round1(f100),
    basis: '每100g',
    source: 'openfoodfacts',
  }
}

export async function searchOpenFoodFacts(
  query: string,
  limit = 8,
): Promise<FoodCandidate[]> {
  const params = new URLSearchParams({
    search_terms: query.trim(),
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(limit),
  })

  const res = await fetch(`${OFF_SEARCH}?${params}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Open Food Facts 请求失败（${res.status}）`)

  const data = (await res.json()) as {
    products?: Array<Parameters<typeof offServingMacros>[0]>
  }

  const out: FoodCandidate[] = []
  const seen = new Set<string>()
  for (const product of data.products ?? []) {
    const cand = offServingMacros(product)
    if (!cand) continue
    const key = `${cand.name}|${cand.calories}|${cand.protein}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(cand)
  }
  return out
}

type UsdaFood = {
  fdcId: number
  description: string
  brandOwner?: string
  foodNutrients?: Array<{
    nutrientName?: string
    nutrientNumber?: string
    value?: number
    unitName?: string
  }>
}

function usdaCandidate(food: UsdaFood): FoodCandidate | null {
  const nutrients = food.foodNutrients ?? []
  const byName = (names: string[]) => {
    const hit = nutrients.find((n) =>
      names.some((name) => (n.nutrientName ?? '').toLowerCase() === name.toLowerCase()),
    )
    return num(hit?.value)
  }

  // USDA search returns Energy in kcal as "Energy" often; also KCAL nutrient number 1008
  const byNumber = (numStr: string) => {
    const hit = nutrients.find((n) => n.nutrientNumber === numStr)
    return num(hit?.value)
  }

  let kcal = byNumber('1008') || byName(['Energy'])
  // Sometimes energy is in kJ (unitName KJ)
  const energyRow = nutrients.find(
    (n) => n.nutrientNumber === '1008' || (n.nutrientName ?? '').toLowerCase() === 'energy',
  )
  if (energyRow?.unitName?.toUpperCase() === 'KJ' && kcal > 0) {
    kcal = kcal / 4.184
  }

  const protein = byNumber('1003') || byName(['Protein'])
  const carbs =
    byNumber('1005') || byName(['Carbohydrate, by difference', 'Carbohydrate'])
  const fat = byNumber('1004') || byName(['Total lipid (fat)', 'Fat'])

  if (kcal <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return null

  return {
    id: `usda-${food.fdcId}`,
    name: food.description.trim(),
    brand: food.brandOwner,
    calories: Math.round(kcal || protein * 4 + carbs * 4 + fat * 9),
    protein: round1(protein),
    carbs: round1(carbs),
    fat: round1(fat),
    basis: '每100g',
    source: 'usda',
  }
}

export async function searchUsda(
  query: string,
  limit = 6,
): Promise<FoodCandidate[]> {
  const apiKey = getUsdaApiKey() || 'DEMO_KEY'
  const url = `${USDA_BASE}/foods/search?api_key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      query: query.trim(),
      pageSize: limit,
      dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'],
    }),
  })

  if (!res.ok) {
    if (res.status === 403 || res.status === 429) {
      throw new Error('USDA 额度不足，请在设置填写自己的免费 API Key')
    }
    throw new Error(`USDA 请求失败（${res.status}）`)
  }

  const data = (await res.json()) as { foods?: UsdaFood[] }
  const out: FoodCandidate[] = []
  for (const food of data.foods ?? []) {
    const cand = usdaCandidate(food)
    if (cand) out.push(cand)
  }
  return out
}

export async function searchFoodDatabases(query: string): Promise<FoodCandidate[]> {
  const q = query.trim()
  if (!q) return []

  const results: FoodCandidate[] = []
  const errors: string[] = []

  try {
    results.push(...(await searchOpenFoodFacts(q)))
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Open Food Facts 失败')
  }

  try {
    results.push(...(await searchUsda(q)))
  } catch (err) {
    // USDA is optional; don't fail whole search if OFF worked
    if (results.length === 0) {
      errors.push(err instanceof Error ? err.message : 'USDA 失败')
    }
  }

  if (results.length === 0 && errors.length > 0) {
    throw new Error(errors[0])
  }

  // Prefer items with more complete macros
  return results.sort((a, b) => {
    const score = (x: FoodCandidate) =>
      (x.protein > 0 ? 2 : 0) + (x.carbs > 0 ? 1 : 0) + (x.fat > 0 ? 1 : 0) + (x.calories > 0 ? 2 : 0)
    return score(b) - score(a)
  })
}

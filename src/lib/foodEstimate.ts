import { hasVisionApiKey, loadVisionSettings } from './visionSettings'

export interface NutritionEstimate {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  source: 'local' | 'ai'
}

/** Typical one-serving estimates for common Chinese foods (rough). */
const FOOD_DB: Array<{
  keys: string[]
  calories: number
  protein: number
  carbs: number
  fat: number
  name: string
}> = [
  { keys: ['鸡胸', '鸡胸肉'], name: '鸡胸肉', calories: 165, protein: 31, carbs: 0, fat: 4 },
  { keys: ['鸡胸饭', '鸡胸肉饭'], name: '鸡胸饭', calories: 450, protein: 40, carbs: 50, fat: 8 },
  { keys: ['牛肉', '牛排'], name: '牛肉', calories: 250, protein: 26, carbs: 0, fat: 15 },
  { keys: ['牛排饭'], name: '牛排饭', calories: 650, protein: 35, carbs: 60, fat: 25 },
  { keys: ['猪肉', '里脊'], name: '猪肉', calories: 240, protein: 20, carbs: 0, fat: 18 },
  { keys: ['排骨', '红烧排骨'], name: '排骨', calories: 350, protein: 22, carbs: 5, fat: 28 },
  { keys: ['虾', '蒸虾', '白灼虾'], name: '虾', calories: 100, protein: 20, carbs: 0, fat: 2 },
  { keys: ['鱼', '清蒸鱼', '鲈鱼', '巴沙鱼'], name: '鱼', calories: 150, protein: 25, carbs: 0, fat: 5 },
  { keys: ['三文鱼'], name: '三文鱼', calories: 200, protein: 22, carbs: 0, fat: 13 },
  { keys: ['鸡蛋', '水煮蛋', '茶叶蛋'], name: '鸡蛋', calories: 70, protein: 6, carbs: 1, fat: 5 },
  { keys: ['蛋炒饭'], name: '蛋炒饭', calories: 550, protein: 15, carbs: 70, fat: 20 },
  { keys: ['白米饭', '米饭', '一碗饭'], name: '白米饭', calories: 230, protein: 4, carbs: 50, fat: 0 },
  { keys: ['糙米饭'], name: '糙米饭', calories: 220, protein: 5, carbs: 45, fat: 2 },
  { keys: ['面条', '挂面', '阳春面'], name: '面条', calories: 350, protein: 12, carbs: 65, fat: 4 },
  { keys: ['牛肉面', '兰州牛肉面'], name: '牛肉面', calories: 550, protein: 28, carbs: 70, fat: 15 },
  { keys: ['饺子', '水饺'], name: '饺子', calories: 400, protein: 18, carbs: 50, fat: 14 },
  { keys: ['包子', '肉包'], name: '包子', calories: 250, protein: 10, carbs: 35, fat: 8 },
  { keys: ['馒头'], name: '馒头', calories: 220, protein: 7, carbs: 45, fat: 1 },
  { keys: ['粥', '白粥', '皮蛋瘦肉粥'], name: '粥', calories: 150, protein: 5, carbs: 25, fat: 3 },
  { keys: ['豆浆'], name: '豆浆', calories: 80, protein: 6, carbs: 6, fat: 3 },
  { keys: ['牛奶'], name: '牛奶', calories: 130, protein: 7, carbs: 10, fat: 7 },
  { keys: ['酸奶'], name: '酸奶', calories: 100, protein: 5, carbs: 12, fat: 3 },
  { keys: ['燕麦', '燕麦粥', '麦片'], name: '燕麦', calories: 150, protein: 5, carbs: 27, fat: 3 },
  { keys: ['全麦面包', '面包'], name: '面包', calories: 180, protein: 6, carbs: 30, fat: 3 },
  { keys: ['三明治'], name: '三明治', calories: 350, protein: 15, carbs: 35, fat: 15 },
  { keys: ['汉堡'], name: '汉堡', calories: 500, protein: 25, carbs: 40, fat: 25 },
  { keys: ['披萨', '比萨'], name: '披萨', calories: 300, protein: 12, carbs: 35, fat: 12 },
  { keys: ['沙拉', '蔬菜沙拉'], name: '沙拉', calories: 120, protein: 5, carbs: 10, fat: 7 },
  { keys: ['西兰花'], name: '西兰花', calories: 50, protein: 4, carbs: 7, fat: 0 },
  { keys: ['青菜', '炒青菜', '生菜'], name: '青菜', calories: 40, protein: 2, carbs: 5, fat: 2 },
  { keys: ['番茄炒蛋', '西红柿炒蛋'], name: '番茄炒蛋', calories: 200, protein: 12, carbs: 8, fat: 14 },
  { keys: ['麻婆豆腐', '豆腐'], name: '豆腐', calories: 180, protein: 15, carbs: 8, fat: 10 },
  { keys: ['宫保鸡丁'], name: '宫保鸡丁', calories: 350, protein: 28, carbs: 15, fat: 20 },
  { keys: ['鱼香肉丝'], name: '鱼香肉丝', calories: 320, protein: 22, carbs: 18, fat: 18 },
  { keys: ['回锅肉'], name: '回锅肉', calories: 400, protein: 18, carbs: 10, fat: 32 },
  { keys: ['红烧肉'], name: '红烧肉', calories: 450, protein: 20, carbs: 12, fat: 35 },
  { keys: ['糖醋里脊'], name: '糖醋里脊', calories: 380, protein: 22, carbs: 30, fat: 18 },
  { keys: ['烤鸭', '北京烤鸭'], name: '烤鸭', calories: 400, protein: 25, carbs: 10, fat: 28 },
  { keys: ['火锅'], name: '火锅', calories: 700, protein: 40, carbs: 30, fat: 40 },
  { keys: ['麻辣烫'], name: '麻辣烫', calories: 500, protein: 25, carbs: 40, fat: 25 },
  { keys: ['冒菜'], name: '冒菜', calories: 450, protein: 20, carbs: 35, fat: 22 },
  { keys: ['黄焖鸡', '黄焖鸡米饭'], name: '黄焖鸡米饭', calories: 650, protein: 35, carbs: 70, fat: 20 },
  { keys: ['盖浇饭', '盖饭'], name: '盖浇饭', calories: 600, protein: 25, carbs: 75, fat: 18 },
  { keys: ['便当', '盒饭'], name: '盒饭', calories: 550, protein: 25, carbs: 65, fat: 18 },
  { keys: ['寿司'], name: '寿司', calories: 300, protein: 12, carbs: 50, fat: 5 },
  { keys: ['意面', '意大利面', 'pasta'], name: '意面', calories: 450, protein: 15, carbs: 60, fat: 15 },
  { keys: ['炸鸡'], name: '炸鸡', calories: 400, protein: 25, carbs: 20, fat: 25 },
  { keys: ['薯条'], name: '薯条', calories: 300, protein: 4, carbs: 40, fat: 15 },
  { keys: ['奶茶'], name: '奶茶', calories: 350, protein: 3, carbs: 50, fat: 12 },
  { keys: ['咖啡', '拿铁'], name: '咖啡', calories: 80, protein: 4, carbs: 8, fat: 3 },
  { keys: ['可乐', '汽水'], name: '可乐', calories: 140, protein: 0, carbs: 35, fat: 0 },
  { keys: ['啤酒'], name: '啤酒', calories: 150, protein: 1, carbs: 12, fat: 0 },
  { keys: ['苹果'], name: '苹果', calories: 80, protein: 0, carbs: 20, fat: 0 },
  { keys: ['香蕉'], name: '香蕉', calories: 90, protein: 1, carbs: 23, fat: 0 },
  { keys: ['橙子', '橙'], name: '橙子', calories: 60, protein: 1, carbs: 15, fat: 0 },
  { keys: ['西瓜'], name: '西瓜', calories: 50, protein: 1, carbs: 12, fat: 0 },
  { keys: ['坚果', '杏仁', '腰果'], name: '坚果', calories: 180, protein: 6, carbs: 6, fat: 15 },
  { keys: ['蛋白棒'], name: '蛋白棒', calories: 200, protein: 20, carbs: 20, fat: 6 },
  { keys: ['蛋白粉', '乳清'], name: '蛋白粉', calories: 120, protein: 25, carbs: 3, fat: 1 },
  { keys: ['牛奶燕麦'], name: '牛奶燕麦', calories: 280, protein: 12, carbs: 40, fat: 8 },
  { keys: ['水煮菜', '水煮肉片'], name: '水煮肉片', calories: 400, protein: 30, carbs: 10, fat: 28 },
  { keys: ['酸菜鱼'], name: '酸菜鱼', calories: 450, protein: 35, carbs: 15, fat: 25 },
  { keys: ['小龙虾'], name: '小龙虾', calories: 300, protein: 30, carbs: 5, fat: 15 },
  { keys: ['烤串', '烧烤'], name: '烧烤', calories: 400, protein: 25, carbs: 15, fat: 25 },
  { keys: ['煎饼', '煎饼果子'], name: '煎饼果子', calories: 350, protein: 12, carbs: 40, fat: 15 },
  { keys: ['油条'], name: '油条', calories: 250, protein: 5, carbs: 25, fat: 15 },
  { keys: ['稀饭'], name: '稀饭', calories: 100, protein: 2, carbs: 22, fat: 0 },
  { keys: ['玉米'], name: '玉米', calories: 100, protein: 3, carbs: 22, fat: 1 },
  { keys: ['红薯', '地瓜'], name: '红薯', calories: 120, protein: 2, carbs: 28, fat: 0 },
  { keys: ['土豆', '马铃薯'], name: '土豆', calories: 90, protein: 2, carbs: 20, fat: 0 },
  { keys: ['鸡腿'], name: '鸡腿', calories: 220, protein: 25, carbs: 0, fat: 13 },
  { keys: ['鸡翅'], name: '鸡翅', calories: 200, protein: 18, carbs: 0, fat: 14 },
  { keys: ['鸭肉'], name: '鸭肉', calories: 280, protein: 20, carbs: 0, fat: 22 },
  { keys: ['羊肉'], name: '羊肉', calories: 250, protein: 25, carbs: 0, fat: 16 },
  { keys: ['蟹', '螃蟹'], name: '蟹', calories: 100, protein: 18, carbs: 1, fat: 2 },
  { keys: ['贝', '花甲', '蛤蜊'], name: '贝类', calories: 80, protein: 14, carbs: 3, fat: 1 },
  { keys: ['紫菜包饭', '寿司卷'], name: '紫菜包饭', calories: 350, protein: 10, carbs: 55, fat: 8 },
  { keys: ['关东煮'], name: '关东煮', calories: 250, protein: 15, carbs: 25, fat: 8 },
  { keys: ['拉面'], name: '拉面', calories: 500, protein: 20, carbs: 65, fat: 15 },
  { keys: ['炒河粉', '河粉'], name: '炒河粉', calories: 450, protein: 12, carbs: 70, fat: 12 },
  { keys: ['炒面'], name: '炒面', calories: 480, protein: 14, carbs: 65, fat: 16 },
  { keys: ['煲仔饭'], name: '煲仔饭', calories: 650, protein: 28, carbs: 80, fat: 20 },
]

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[0-9０-９]+只?/g, '')
    .replace(/[『』「」【】\[\]（）()·•、，,。.!！？?]/g, '')
}

export function estimateFromLocal(query: string): NutritionEstimate | null {
  const q = normalize(query)
  if (!q) return null

  let best: (typeof FOOD_DB)[number] | null = null
  let bestScore = 0

  for (const item of FOOD_DB) {
    for (const key of item.keys) {
      const k = normalize(key)
      if (!k) continue
      let score = 0
      if (q === k) score = 100
      else if (q.includes(k)) score = 80 + k.length
      else if (k.includes(q) && q.length >= 2) score = 60 + q.length
      if (score > bestScore) {
        bestScore = score
        best = item
      }
    }
  }

  if (!best || bestScore < 60) return null
  return {
    name: best.name,
    calories: best.calories,
    protein: best.protein,
    carbs: best.carbs,
    fat: best.fat,
    source: 'local',
  }
}

function extractJson(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1)
  return trimmed
}

async function estimateFromAi(query: string): Promise<NutritionEstimate> {
  const { apiKey, provider } = loadVisionSettings()
  const key = apiKey.trim()
  if (!key) throw new Error('NO_API_KEY')

  const prompt = `根据中文食物描述估算「一整份/一次吃完」的营养，不要解释。只输出 JSON：
{"name":"简短菜名","calories":数字,"protein":数字,"carbs":数字,"fat":数字}
热量单位 kcal，宏量单位克。描述：「${query}」`

  let raw = ''
  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const body = (await res.json()) as {
      error?: { message?: string }
      choices?: Array<{ message?: { content?: string } }>
    }
    if (!res.ok) throw new Error(body.error?.message || `OpenAI 失败（${res.status}）`)
    raw = body.choices?.[0]?.message?.content ?? ''
  } else {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    })
    const body = (await res.json()) as {
      error?: { message?: string }
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    if (!res.ok) throw new Error(body.error?.message || `Gemini 失败（${res.status}）`)
    raw = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  }

  const data = JSON.parse(extractJson(raw)) as Record<string, unknown>
  const calories = Number(data.calories)
  if (!calories || calories <= 0) throw new Error('估算结果无效')

  return {
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : query,
    calories: Math.round(calories),
    protein: Math.round(Number(data.protein) || 0),
    carbs: Math.round(Number(data.carbs) || 0),
    fat: Math.round(Number(data.fat) || 0),
    source: 'ai',
  }
}

export async function estimateFoodNutrition(query: string): Promise<NutritionEstimate> {
  const trimmed = query.trim()
  if (!trimmed) throw new Error('请先填写食物名称')

  const local = estimateFromLocal(trimmed)
  if (local) return local

  if (!hasVisionApiKey()) {
    throw new Error('本地没有匹配。可在设置填写免费 Gemini Key，或手动填数字')
  }

  return estimateFromAi(trimmed)
}

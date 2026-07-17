import { parseJsonMeal, type ParsedMealDraft } from './importParse'
import { loadVisionSettings } from './visionSettings'

const PROMPT = `你是营养估算助手。根据餐食照片估算整份食物的营养。
只输出一个 JSON 对象，不要 markdown，不要其它说明。字段：
{
  "name": "简短中文菜名",
  "meal": "breakfast|lunch|dinner|snack",
  "calories": 数字(kcal),
  "protein": 数字(克),
  "carbs": 数字(克),
  "fat": 数字(克)
}
按常见份量合理估算；看不清就尽量估并在 name 里加「约」。meal 按一天中常见用餐时间猜，不确定用 snack。`

function extractJsonText(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1)
  return trimmed
}

export async function fileToCompressedDataUrl(
  file: File,
  maxEdge = 1280,
  quality = 0.82,
): Promise<{ dataUrl: string; mimeType: string; base64: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法处理图片')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const mimeType = 'image/jpeg'
  const dataUrl = canvas.toDataURL(mimeType, quality)
  const base64 = dataUrl.split(',')[1] ?? ''
  if (!base64) throw new Error('图片编码失败')
  return { dataUrl, mimeType, base64 }
}

async function recognizeWithGemini(
  apiKey: string,
  base64: string,
  mimeType: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  })

  const body = (await res.json()) as {
    error?: { message?: string }
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }

  if (!res.ok) {
    throw new Error(body.error?.message || `Gemini 请求失败（${res.status}）`)
  }

  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!text.trim()) throw new Error('模型没有返回识别结果')
  return text
}

async function recognizeWithOpenAI(
  apiKey: string,
  dataUrl: string,
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  })

  const body = (await res.json()) as {
    error?: { message?: string }
    choices?: Array<{ message?: { content?: string } }>
  }

  if (!res.ok) {
    throw new Error(body.error?.message || `OpenAI 请求失败（${res.status}）`)
  }

  const text = body.choices?.[0]?.message?.content ?? ''
  if (!text.trim()) throw new Error('模型没有返回识别结果')
  return text
}

export async function recognizeFoodFromImage(
  file: File,
  defaultDate: string,
): Promise<ParsedMealDraft> {
  const settings = loadVisionSettings()
  const apiKey = settings.apiKey.trim()
  if (!apiKey) {
    throw new Error('请先在设置里填写视觉 API Key')
  }

  const { dataUrl, mimeType, base64 } = await fileToCompressedDataUrl(file)
  const rawText =
    settings.provider === 'openai'
      ? await recognizeWithOpenAI(apiKey, dataUrl)
      : await recognizeWithGemini(apiKey, base64, mimeType)

  const jsonText = extractJsonText(rawText)
  const draft = parseJsonMeal(jsonText, 'photo')
  if (!draft || !draft.calories) {
    throw new Error('识别结果无法解析，请重试或改用手动输入')
  }

  return {
    ...draft,
    date: draft.date || defaultDate,
    source: 'photo',
    rawNote: jsonText,
  }
}

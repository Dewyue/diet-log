export type VisionProvider = 'gemini' | 'openai'

export interface VisionSettings {
  provider: VisionProvider
  apiKey: string
}

const LS_KEY = 'diet-log-vision'

const DEFAULT: VisionSettings = {
  provider: 'gemini',
  apiKey: '',
}

export function loadVisionSettings(): VisionSettings {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { ...DEFAULT }
    const parsed = JSON.parse(raw) as Partial<VisionSettings>
    return {
      provider: parsed.provider === 'openai' ? 'openai' : 'gemini',
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
    }
  } catch {
    return { ...DEFAULT }
  }
}

export function saveVisionSettings(settings: VisionSettings) {
  localStorage.setItem(LS_KEY, JSON.stringify(settings))
}

export function clearVisionSettings() {
  localStorage.removeItem(LS_KEY)
}

export function hasVisionApiKey() {
  return Boolean(loadVisionSettings().apiKey.trim())
}

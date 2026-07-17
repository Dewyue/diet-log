import {
  addEntry,
  getAllEntries,
  notifyLocalStorageChange,
} from '../db'
import { parseImportText, type ParsedMealDraft } from './importParse'

const AUTO_CLIPBOARD_KEY = 'diet-log-auto-clipboard'
const LAST_CLIP_HASH_KEY = 'diet-log-last-clip-hash'

export function loadAutoClipboardImport(): boolean {
  try {
    return localStorage.getItem(AUTO_CLIPBOARD_KEY) === '1'
  } catch {
    return false
  }
}

export function saveAutoClipboardImport(enabled: boolean) {
  localStorage.setItem(AUTO_CLIPBOARD_KEY, enabled ? '1' : '0')
}

function draftKey(d: ParsedMealDraft) {
  return `${d.date}|${d.name}|${d.calories}|${d.protein}|${d.carbs}|${d.fat}`
}

export function filterNewDrafts(
  drafts: ParsedMealDraft[],
  existing: Awaited<ReturnType<typeof getAllEntries>>,
): ParsedMealDraft[] {
  const existingKeys = new Set(
    existing.map((e) => `${e.date}|${e.name}|${e.calories}|${e.protein}|${e.carbs}|${e.fat}`),
  )
  return drafts.filter((d) => !existingKeys.has(draftKey(d)))
}

export async function autosaveDrafts(drafts: ParsedMealDraft[]): Promise<number> {
  if (drafts.length === 0) return 0
  const existing = await getAllEntries()
  const fresh = filterNewDrafts(drafts, existing)
  if (fresh.length === 0) return 0

  for (const d of fresh) {
    await addEntry({
      date: d.date,
      meal: d.meal,
      name: d.name,
      calories: d.calories,
      protein: d.protein,
      carbs: d.carbs,
      fat: d.fat,
      source: d.source ?? 'shortcut',
      rawNote: d.rawNote,
    })
  }
  notifyLocalStorageChange()
  return fresh.length
}

export function decodeImportParam(raw: string, isBase64: boolean): string {
  const decoded = decodeURIComponent(raw)
  if (!isBase64) return decoded
  try {
    const bin = atob(decoded)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return decoded
  }
}

export function encodeImportForUrl(text: string, useBase64 = true): string {
  if (!useBase64) return encodeURIComponent(text)
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  bytes.forEach((b) => {
    bin += String.fromCharCode(b)
  })
  return encodeURIComponent(btoa(bin))
}

export function buildAutosaveImportUrl(text: string): string {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/?$/, '/')
  const payload = encodeImportForUrl(text, true)
  return `${base}?autosave=1&import_b64=${payload}`
}

function hashText(text: string) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return String(h)
}

export async function tryImportFromClipboard(): Promise<{
  imported: number
  skipped: boolean
  error?: string
}> {
  if (!loadAutoClipboardImport()) {
    return { imported: 0, skipped: true }
  }

  let text = ''
  try {
    text = (await navigator.clipboard.readText()).trim()
  } catch {
    return { imported: 0, skipped: true, error: '无法读取剪贴板' }
  }

  if (!text) return { imported: 0, skipped: true }

  // Only auto-import 小仓鼠 / nutrition-looking clipboard
  if (!/食物\s*[：:]|摄入热量|热量\s*[：:].*蛋白/s.test(text)) {
    return { imported: 0, skipped: true }
  }

  const hash = hashText(text)
  if (sessionStorage.getItem(LAST_CLIP_HASH_KEY) === hash) {
    return { imported: 0, skipped: true }
  }

  const drafts = parseImportText(text)
  if (drafts.length === 0) return { imported: 0, skipped: true }

  const count = await autosaveDrafts(drafts)
  sessionStorage.setItem(LAST_CLIP_HASH_KEY, hash)
  return { imported: count, skipped: false }
}

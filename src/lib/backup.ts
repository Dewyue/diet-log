import {
  bulkUpsertEntries,
  clearAllEntries,
  getAllEntries,
  getTargets,
  notifyLocalStorageChange,
  saveTargets,
} from '../db'
import type { BackupData, DailyTargets, FoodEntry } from '../types'
import { DEFAULT_TARGETS, MEAL_TYPES } from '../types'

export async function exportBackup(): Promise<BackupData> {
  const [entries, targets] = await Promise.all([getAllEntries(), getTargets()])
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    entries,
    targets,
  }
}

export function downloadBackup(data: BackupData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  anchor.href = url
  anchor.download = `diet-log-backup-${date}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

function isValidEntry(item: unknown): item is FoodEntry {
  if (!item || typeof item !== 'object') return false
  const record = item as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.date !== 'string') return false
  if (typeof record.name !== 'string') return false
  if (!MEAL_TYPES.includes(record.meal as FoodEntry['meal'])) return false
  if (typeof record.createdAt !== 'number') return false
  if (typeof record.calories !== 'number') return false
  return true
}

function isValidTargets(value: unknown): value is DailyTargets {
  if (!value || typeof value !== 'object') return false
  const t = value as Record<string, unknown>
  return (
    typeof t.calories === 'number' &&
    typeof t.protein === 'number' &&
    typeof t.carbs === 'number' &&
    typeof t.fat === 'number'
  )
}

function parseBackup(parsed: BackupData | FoodEntry[]): {
  entries: FoodEntry[]
  targets?: DailyTargets
} {
  if (Array.isArray(parsed)) {
    const entries = parsed.filter(isValidEntry)
    if (entries.length === 0) throw new Error('备份中没有有效记录')
    return { entries }
  }

  if (!parsed || !Array.isArray(parsed.entries)) {
    throw new Error('无效的备份格式')
  }

  const entries = parsed.entries.filter(isValidEntry)
  if (entries.length === 0) {
    throw new Error('备份中没有有效记录')
  }

  const targets = isValidTargets(parsed.targets)
    ? { ...DEFAULT_TARGETS, ...parsed.targets }
    : undefined

  return { entries, targets }
}

export async function importBackupFromText(text: string, mode: 'merge' | 'replace' = 'merge') {
  const parsed = JSON.parse(text) as BackupData | FoodEntry[]
  const { entries, targets } = parseBackup(parsed)

  if (mode === 'replace') {
    await clearAllEntries()
  }

  await bulkUpsertEntries(entries)
  if (targets) {
    await saveTargets(targets)
  }
  notifyLocalStorageChange()
  return entries.length
}

export async function importBackup(file: File, mode: 'merge' | 'replace' = 'merge') {
  const text = await file.text()
  return importBackupFromText(text, mode)
}

export async function copyBackupToClipboard(): Promise<number> {
  const data = await exportBackup()
  await navigator.clipboard.writeText(JSON.stringify(data))
  return data.entries.length
}

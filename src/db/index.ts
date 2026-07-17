import Dexie, { liveQuery, type Table } from 'dexie'
import type { DailyTargets, FoodEntry } from '../types'
import { DEFAULT_TARGETS } from '../types'
import { createId } from '../lib/id'

const LS_ENTRIES_KEY = 'diet-log-entries'
const LS_TARGETS_KEY = 'diet-log-targets'
const CHANGE_EVENT = 'diet-log-changed'

export type StorageBackend = 'indexeddb' | 'localstorage'

interface SettingsRow {
  id: 'targets'
  value: DailyTargets
}

export class DietDB extends Dexie {
  entries!: Table<FoodEntry, string>
  settings!: Table<SettingsRow, string>

  constructor() {
    super('diet-log')
    this.version(1).stores({
      entries: 'id, date, meal, createdAt',
      settings: 'id',
    })
  }
}

export const db = new DietDB()

let backend: StorageBackend = 'indexeddb'
let storageReady = false
let storageError: string | null = null

function readLocalEntries(): FoodEntry[] {
  try {
    const raw = localStorage.getItem(LS_ENTRIES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as FoodEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalEntries(records: FoodEntry[]) {
  localStorage.setItem(LS_ENTRIES_KEY, JSON.stringify(records))
}

function readLocalTargets(): DailyTargets {
  try {
    const raw = localStorage.getItem(LS_TARGETS_KEY)
    if (!raw) return { ...DEFAULT_TARGETS }
    return { ...DEFAULT_TARGETS, ...(JSON.parse(raw) as DailyTargets) }
  } catch {
    return { ...DEFAULT_TARGETS }
  }
}

function writeLocalTargets(targets: DailyTargets) {
  localStorage.setItem(LS_TARGETS_KEY, JSON.stringify(targets))
}

function sortEntries(records: FoodEntry[]) {
  return [...records].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.createdAt - b.createdAt
  })
}

export function getStorageBackend() {
  return backend
}

export function getStorageError() {
  return storageError
}

export async function initStorage(): Promise<StorageBackend> {
  if (storageReady) return backend

  try {
    await db.open()
    backend = 'indexeddb'
    storageError = null
    storageReady = true
    return backend
  } catch (err) {
    const message = err instanceof Error ? err.message : 'IndexedDB 不可用'
    console.warn('IndexedDB failed, falling back to localStorage:', message)

    try {
      localStorage.setItem('__diet_log_test__', '1')
      localStorage.removeItem('__diet_log_test__')
      backend = 'localstorage'
      storageError = `IndexedDB 不可用，已切换为 localStorage（${message}）`
      storageReady = true
      return backend
    } catch {
      storageError = '浏览器存储不可用，请退出无痕模式或换用系统浏览器打开'
      storageReady = true
      throw new Error(storageError)
    }
  }
}

async function withLocalEntries<T>(fn: (records: FoodEntry[]) => { records: FoodEntry[]; result: T }) {
  const records = readLocalEntries()
  const { records: next, result } = fn(records)
  writeLocalEntries(next)
  return result
}

export async function getEntriesByMonth(year: number, month: number) {
  await initStorage()
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  if (backend === 'indexeddb') {
    return db.entries.where('date').between(start, end, true, true).toArray()
  }

  return readLocalEntries().filter((r) => r.date >= start && r.date <= end)
}

export async function getEntriesByDate(date: string) {
  await initStorage()

  if (backend === 'indexeddb') {
    return db.entries.where('date').equals(date).sortBy('createdAt')
  }

  return readLocalEntries()
    .filter((r) => r.date === date)
    .sort((a, b) => a.createdAt - b.createdAt)
}

export async function getAllEntries() {
  await initStorage()

  if (backend === 'indexeddb') {
    return db.entries.orderBy('date').toArray()
  }

  return sortEntries(readLocalEntries())
}

export async function addEntry(
  data: Omit<FoodEntry, 'id' | 'createdAt'>,
): Promise<FoodEntry> {
  await initStorage()

  const record: FoodEntry = {
    ...data,
    id: createId(),
    createdAt: Date.now(),
  }

  if (backend === 'indexeddb') {
    await db.entries.add(record)
    return record
  }

  await withLocalEntries((records) => ({
    records: [...records, record],
    result: record,
  }))
  return record
}

export async function updateEntry(id: string, data: Partial<FoodEntry>) {
  await initStorage()

  if (backend === 'indexeddb') {
    await db.entries.update(id, data)
    return
  }

  await withLocalEntries((records) => ({
    records: records.map((r) => (r.id === id ? { ...r, ...data } : r)),
    result: undefined,
  }))
}

export async function deleteEntry(id: string) {
  await initStorage()

  if (backend === 'indexeddb') {
    await db.entries.delete(id)
    return
  }

  await withLocalEntries((records) => ({
    records: records.filter((r) => r.id !== id),
    result: undefined,
  }))
}

export async function clearAllEntries() {
  await initStorage()

  if (backend === 'indexeddb') {
    await db.entries.clear()
    return
  }

  writeLocalEntries([])
}

export async function bulkUpsertEntries(records: FoodEntry[]) {
  await initStorage()

  if (backend === 'indexeddb') {
    await db.entries.bulkPut(records)
    return
  }

  const map = new Map(readLocalEntries().map((r) => [r.id, r]))
  for (const record of records) {
    map.set(record.id, record)
  }
  writeLocalEntries(sortEntries([...map.values()]))
}

export async function getTargets(): Promise<DailyTargets> {
  await initStorage()

  if (backend === 'indexeddb') {
    const row = await db.settings.get('targets')
    return row ? { ...DEFAULT_TARGETS, ...row.value } : { ...DEFAULT_TARGETS }
  }

  return readLocalTargets()
}

export async function saveTargets(targets: DailyTargets) {
  await initStorage()

  if (backend === 'indexeddb') {
    await db.settings.put({ id: 'targets', value: targets })
    return
  }

  writeLocalTargets(targets)
}

export async function subscribeEntries(
  onChange: (records: FoodEntry[]) => void,
  filter?: { start: string; end: string } | { date: string },
) {
  await initStorage()

  if (backend === 'indexeddb') {
    const query =
      filter && 'date' in filter
        ? () => db.entries.where('date').equals(filter.date).sortBy('createdAt')
        : filter && 'start' in filter
          ? () =>
              db.entries
                .where('date')
                .between(filter.start, filter.end, true, true)
                .toArray()
          : () => db.entries.toArray()

    return liveQuery(query).subscribe({
      next: onChange,
      error: (err) => console.error('liveQuery error:', err),
    })
  }

  const notify = () => {
    const all = readLocalEntries()
    if (!filter) {
      onChange(all)
      return
    }
    if ('date' in filter) {
      onChange(all.filter((r) => r.date === filter.date).sort((a, b) => a.createdAt - b.createdAt))
      return
    }
    onChange(all.filter((r) => r.date >= filter.start && r.date <= filter.end))
  }

  notify()
  const onStorage = (e: StorageEvent) => {
    if (e.key === LS_ENTRIES_KEY) notify()
  }
  const onCustom = () => notify()
  window.addEventListener('storage', onStorage)
  window.addEventListener(CHANGE_EVENT, onCustom)

  return {
    unsubscribe: () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(CHANGE_EVENT, onCustom)
    },
  }
}

export async function subscribeTargets(onChange: (targets: DailyTargets) => void) {
  await initStorage()

  if (backend === 'indexeddb') {
    return liveQuery(async () => {
      const row = await db.settings.get('targets')
      return row ? { ...DEFAULT_TARGETS, ...row.value } : { ...DEFAULT_TARGETS }
    }).subscribe({
      next: onChange,
      error: (err) => console.error('liveQuery targets error:', err),
    })
  }

  const notify = () => onChange(readLocalTargets())
  notify()
  const onStorage = (e: StorageEvent) => {
    if (e.key === LS_TARGETS_KEY) notify()
  }
  const onCustom = () => notify()
  window.addEventListener('storage', onStorage)
  window.addEventListener(CHANGE_EVENT, onCustom)

  return {
    unsubscribe: () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(CHANGE_EVENT, onCustom)
    },
  }
}

export function notifyLocalStorageChange() {
  if (backend === 'localstorage') {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  }
}

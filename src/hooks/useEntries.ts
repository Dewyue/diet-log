import { useEffect, useState } from 'react'
import { subscribeEntries, subscribeTargets } from '../db'
import type { DailyTargets, FoodEntry } from '../types'
import { DEFAULT_TARGETS } from '../types'

export function useEntriesByMonth(year: number, month: number) {
  const [entries, setEntries] = useState<FoodEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const lastDay = new Date(year, month, 0).getDate()
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    let subscription: { unsubscribe: () => void } | undefined

    subscribeEntries(
      (data) => {
        setEntries(data)
        setLoading(false)
      },
      { start, end },
    ).then((sub) => {
      subscription = sub
    })

    return () => subscription?.unsubscribe()
  }, [year, month])

  return { entries, loading }
}

export function useEntriesByDate(date: string | null) {
  const [entries, setEntries] = useState<FoodEntry[]>([])

  useEffect(() => {
    if (!date) {
      setEntries([])
      return
    }

    let subscription: { unsubscribe: () => void } | undefined

    subscribeEntries(setEntries, { date }).then((sub) => {
      subscription = sub
    })

    return () => subscription?.unsubscribe()
  }, [date])

  return entries
}

export function useTargets() {
  const [targets, setTargets] = useState<DailyTargets>(DEFAULT_TARGETS)

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined

    subscribeTargets(setTargets).then((sub) => {
      subscription = sub
    })

    return () => subscription?.unsubscribe()
  }, [])

  return targets
}

export function groupByDate(entries: FoodEntry[]): Map<string, FoodEntry[]> {
  const map = new Map<string, FoodEntry[]>()
  for (const item of entries) {
    const list = map.get(item.date) ?? []
    list.push(item)
    map.set(item.date, list)
  }
  return map
}

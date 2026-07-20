import { useMemo, useState } from 'react'
import { DaySheet, MealRecordItem } from '../components/DaySheet'
import DayProgress from '../components/DayProgress'
import { deleteEntry, notifyLocalStorageChange } from '../db'
import { useEntriesByDate, useTargets } from '../hooks/useEntries'
import { computeDailyStatus } from '../lib/dailyStatus'
import { formatDate, formatDisplayDate } from '../lib/dates'
import type { FoodEntry } from '../types'

export default function TodayPage() {
  const today = formatDate(new Date())
  const entries = useEntriesByDate(today)
  const targets = useTargets()
  const status = computeDailyStatus(entries, targets)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [startInAdd, setStartInAdd] = useState(false)
  const [editEntry, setEditEntry] = useState<FoodEntry | null>(null)

  const timeline = useMemo(
    () => [...entries].sort((a, b) => a.createdAt - b.createdAt),
    [entries],
  )

  const openAdd = () => {
    setEditEntry(null)
    setStartInAdd(true)
    setSheetOpen(true)
  }

  const openEdit = (entry: FoodEntry) => {
    setStartInAdd(false)
    setEditEntry(entry)
    setSheetOpen(true)
  }

  const closeSheet = () => {
    setSheetOpen(false)
    setStartInAdd(false)
    setEditEntry(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('删除这条？')) return
    try {
      await deleteEntry(id)
      notifyLocalStorageChange()
    } catch {
      alert('删除失败')
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-medium text-slate-400">今日</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
          {formatDisplayDate(today)}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {entries.length === 0
            ? '还没记，点右下角加一餐'
            : status.onTrack
              ? '热量到位'
              : '继续记录'}
        </p>
      </header>

      <DayProgress entries={entries} targets={targets} />

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">今日餐食</h2>
          <span className="text-xs text-slate-400">{timeline.length} 条</span>
        </div>

        {timeline.length === 0 ? (
          <p className="rounded-2xl bg-white py-10 text-center text-sm text-slate-400 dark:bg-[#1c1c1e]">
            还没有记录
          </p>
        ) : (
          <div className="space-y-2">
            {timeline.map((record) => (
              <MealRecordItem
                key={record.id}
                record={record}
                onEdit={() => openEdit(record)}
                onDelete={() => handleDelete(record.id)}
              />
            ))}
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={openAdd}
        aria-label="快速记录今天"
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-[max(1rem,calc(50%-215px+1rem))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-3xl font-light leading-none text-white shadow-lg shadow-orange-500/40 transition active:scale-95"
      >
        +
      </button>

      {sheetOpen && (
        <DaySheet
          key={`today-${startInAdd ? 'add' : editEntry?.id ?? 'list'}`}
          date={today}
          startInAdd={startInAdd}
          editEntry={editEntry ?? undefined}
          onClose={closeSheet}
        />
      )}
    </div>
  )
}

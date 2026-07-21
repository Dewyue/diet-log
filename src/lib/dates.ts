export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatMonthLabel(year: number, month: number): string {
  return `${year}年${month}月`
}

export function formatDisplayDate(dateStr: string): string {
  const date = parseDate(dateStr)
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`
}

export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export interface CalendarCell {
  date: string
  day: number
  inMonth: boolean
  isToday: boolean
}

export function getCalendarCells(year: number, month: number): CalendarCell[] {
  const today = formatDate(new Date())
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0).getDate()

  // Monday-based week: Mon=0 ... Sun=6
  const startOffset = (firstDay.getDay() + 6) % 7
  const cells: CalendarCell[] = []

  for (let i = 0; i < startOffset; i++) {
    const date = new Date(year, month - 1, -startOffset + i + 1)
    const dateStr = formatDate(date)
    cells.push({
      date: dateStr,
      day: date.getDate(),
      inMonth: false,
      isToday: dateStr === today,
    })
  }

  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({
      date: dateStr,
      day,
      inMonth: true,
      isToday: dateStr === today,
    })
  }

  const trailing = (7 - (cells.length % 7)) % 7
  for (let i = 1; i <= trailing; i++) {
    const date = new Date(year, month, i)
    const dateStr = formatDate(date)
    cells.push({
      date: dateStr,
      day: date.getDate(),
      inMonth: false,
      isToday: dateStr === today,
    })
  }

  return cells
}

export function getWeekRange(): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { start: formatDate(monday), end: formatDate(sunday) }
}

export function isDateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}

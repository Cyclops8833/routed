export interface PublicHoliday {
  date: string // YYYY-MM-DD
  name: string
  isLongWeekend: boolean
}

export const victorianHolidays: PublicHoliday[] = [
  // 2026 Victorian public holidays
  { date: '2026-01-01', name: "New Year's Day", isLongWeekend: false },
  { date: '2026-01-26', name: 'Australia Day', isLongWeekend: true },
  { date: '2026-03-09', name: 'Labour Day', isLongWeekend: true },
  { date: '2026-04-03', name: 'Good Friday', isLongWeekend: true },
  { date: '2026-04-04', name: 'Easter Saturday', isLongWeekend: true },
  { date: '2026-04-06', name: 'Easter Monday', isLongWeekend: true },
  { date: '2026-04-25', name: 'Anzac Day', isLongWeekend: false },
  { date: '2026-06-08', name: "King's Birthday", isLongWeekend: true },
  { date: '2026-09-25', name: 'Friday before AFL Grand Final', isLongWeekend: true },
  { date: '2026-11-03', name: 'Melbourne Cup', isLongWeekend: false },
  { date: '2026-12-25', name: 'Christmas Day', isLongWeekend: false },
  { date: '2026-12-26', name: 'Boxing Day', isLongWeekend: false },
  { date: '2026-12-28', name: 'Boxing Day (substitute)', isLongWeekend: true },
  // 2027
  { date: '2027-01-01', name: "New Year's Day", isLongWeekend: false },
  { date: '2027-01-26', name: 'Australia Day', isLongWeekend: true },
  { date: '2027-03-08', name: 'Labour Day', isLongWeekend: true },
  { date: '2027-03-26', name: 'Good Friday', isLongWeekend: true },
  { date: '2027-03-27', name: 'Easter Saturday', isLongWeekend: true },
  { date: '2027-03-29', name: 'Easter Monday', isLongWeekend: true },
  { date: '2027-04-25', name: 'Anzac Day', isLongWeekend: false },
  { date: '2027-06-14', name: "King's Birthday", isLongWeekend: true },
  { date: '2027-09-24', name: 'Friday before AFL Grand Final', isLongWeekend: true },
  { date: '2027-11-02', name: 'Melbourne Cup', isLongWeekend: false },
  { date: '2027-12-25', name: 'Christmas Day', isLongWeekend: false },
  { date: '2027-12-26', name: 'Boxing Day', isLongWeekend: false },
  { date: '2027-12-27', name: 'Christmas Day (substitute)', isLongWeekend: true },
]

/** Returns holidays that fall within or adjacent (±1 day) to a date range */
export function getHolidaysInRange(from: string, to: string): PublicHoliday[] {
  if (!from || !to) return []
  const fromDate = new Date(from)
  const toDate = new Date(to)
  // extend by ±1 day
  const rangeStart = new Date(fromDate.getTime() - 86400000)
  const rangeEnd = new Date(toDate.getTime() + 86400000)

  return victorianHolidays.filter((h) => {
    const d = new Date(h.date)
    return d >= rangeStart && d <= rangeEnd
  })
}

/** Determine if a date string is a Friday (day 5) */
function isFriday(dateStr: string): boolean {
  return new Date(dateStr).getDay() === 5
}

/** Determine if a date string is a Monday (day 1) */
function isMonday(dateStr: string): boolean {
  return new Date(dateStr).getDay() === 1
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

/**
 * Returns the next N upcoming long weekends from today.
 * For multi-day holiday clusters (like Easter), they are merged into one range.
 */
export function getUpcomingLongWeekends(n: number): Array<{ holiday: PublicHoliday; from: string; to: string }> {
  const today = new Date().toISOString().split('T')[0]
  const longWeekends = victorianHolidays.filter(
    (h) => h.isLongWeekend && h.date >= today
  )

  // Group consecutive holidays within 3 days of each other
  const clusters: PublicHoliday[][] = []
  for (const holiday of longWeekends) {
    const lastCluster = clusters[clusters.length - 1]
    if (lastCluster) {
      const lastDate = lastCluster[lastCluster.length - 1].date
      const diff =
        (new Date(holiday.date).getTime() - new Date(lastDate).getTime()) /
        86400000
      if (diff <= 3) {
        lastCluster.push(holiday)
        continue
      }
    }
    clusters.push([holiday])
  }

  const result: Array<{ holiday: PublicHoliday; from: string; to: string }> = []

  for (const cluster of clusters) {
    if (result.length >= n) break
    const firstHoliday = cluster[0]
    const lastDate = cluster[cluster.length - 1].date
    const firstDate = firstHoliday.date

    let fromDate = firstDate
    let toDate = lastDate

    // Extend to full long weekend
    if (isFriday(firstDate)) {
      // Holiday is Friday: from = Friday, to = Sunday after
      toDate = addDays(lastDate, lastDate === firstDate ? 2 : 0)
      if (lastDate === firstDate) toDate = addDays(firstDate, 2)
    } else if (isMonday(lastDate)) {
      // Holiday ends Monday: from = Saturday before first
      const firstDay = new Date(firstDate).getDay()
      if (firstDay !== 6) {
        // back to Saturday
        fromDate = addDays(firstDate, -(((firstDay - 6 + 7) % 7) || 7))
      }
    } else {
      // Generic: expand to nearest weekend
      const dayOfWeek = new Date(firstDate).getDay()
      if (dayOfWeek === 1) {
        // Monday
        fromDate = addDays(firstDate, -2)
      } else if (dayOfWeek === 5) {
        toDate = addDays(lastDate, 2)
      }
    }

    result.push({ holiday: firstHoliday, from: fromDate, to: toDate })
  }

  return result
}

// Slot generation. Pure: everything it needs comes in as arguments, so the
// timezone arithmetic can be tested without a clock or a calendar.

const MIN = 60_000
const DAY = 24 * 60 * MIN

const formatters = new Map()
function partsFormatter(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(timeZone, new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    }))
  }
  return formatters.get(timeZone)
}

// Wall-clock fields of an instant in a timezone
export function zonedParts(ms, timeZone) {
  const p = {}
  for (const { type, value } of partsFormatter(timeZone).formatToParts(new Date(ms))) {
    if (type !== 'literal') p[type] = Number(value)
  }
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second }
}

const offsetAt = (ms, timeZone) => {
  const p = zonedParts(ms, timeZone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000
}

// The instant at which a timezone's wall clock reads the given date and
// minutes-after-midnight. Returns null for a wall time that doesn't exist
// (the hour skipped when clocks go forward).
export function zonedTimeToUtc(year, month, day, minutes, timeZone) {
  const wall = Date.UTC(year, month - 1, day, 0, minutes)
  let ms = wall - offsetAt(wall, timeZone)
  ms = wall - offsetAt(ms, timeZone)
  const p = zonedParts(ms, timeZone)
  const back = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  return back === wall ? ms : null
}

export const hostDate = (ms, timeZone) => {
  const p = zonedParts(ms, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/* Every bookable slot start, as UTC milliseconds, in order.
   now   — the current instant (ms)
   busy  — [{ start, end }] in ms: the host calendar's existing events
   rules — see config.js */
export function generateSlots({ now, busy = [], rules }) {
  const { timezone, days, dayStart, dayEnd, slotMinutes, bufferMinutes, minNoticeHours, horizonDays } = rules
  const earliest = now + minNoticeHours * 60 * MIN
  const latest = now + horizonDays * DAY
  const length = slotMinutes * MIN
  const buffer = bufferMinutes * MIN
  const today = zonedParts(now, timezone)
  const slots = []

  // One extra day either side of the horizon costs nothing and means a host
  // date that straddles the window's edges is never missed
  for (let i = 0; i <= horizonDays + 1; i++) {
    // Calendar-date arithmetic in UTC, purely to roll months and years over
    const date = new Date(Date.UTC(today.year, today.month - 1, today.day + i))
    if (!days.includes(date.getUTCDay())) continue

    for (let m = dayStart; m + slotMinutes <= dayEnd; m += slotMinutes) {
      const start = zonedTimeToUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), m, timezone)
      if (start === null || start < earliest || start > latest) continue
      const end = start + length
      if (busy.some((b) => b.start < end + buffer && b.end > start - buffer)) continue
      slots.push(start)
    }
  }
  return slots
}

// Grouped by the host's calendar date — a server detail; the client regroups
// by the visitor's own timezone from the ISO strings
export function groupByHostDay(slots, timeZone) {
  const days = []
  for (const ms of slots) {
    const date = hostDate(ms, timeZone)
    if (days.at(-1)?.date !== date) days.push({ date, slots: [] })
    days.at(-1).slots.push(new Date(ms).toISOString())
  }
  return days
}

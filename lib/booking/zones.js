// Time zone helpers for the Book a Call picker: naming a zone the way a
// client would, and regrouping the open slots (UTC instants) by a zone's own
// calendar days and parts of the day. Pure — Intl only, no secrets, no I/O —
// so the form and node's test runner both import it.

const MIN = 60_000

const partsFmt = new Map()
function partsIn(tz) {
  if (!partsFmt.has(tz)) {
    partsFmt.set(tz, new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
    }))
  }
  return partsFmt.get(tz)
}

// The wall clock in a zone at an instant: { year, month (1-12), day, hour (0-23), minute }
export function zoneParts(tz, ms) {
  const out = {}
  for (const p of partsIn(tz).formatToParts(new Date(ms))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  out.hour %= 24
  return out
}

// Minutes east of UTC at an instant: -240 for New York in summer
export function offsetMinutes(tz, ms) {
  const p = zoneParts(tz, ms)
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(ms / MIN) * MIN) / MIN)
}

// The offset without daylight saving, which is the one that matches where
// the zone sits on a map: -300 for New York all year
export function standardOffsetMinutes(tz, ms = Date.now()) {
  const year = new Date(ms).getUTCFullYear()
  return Math.min(offsetMinutes(tz, Date.UTC(year, 0, 15)), offsetMinutes(tz, Date.UTC(year, 6, 15)))
}

// -240 -> "GMT-4", 330 -> "GMT+5:30", 0 -> "GMT"
export function offsetLabel(minutes) {
  if (!minutes) return 'GMT'
  const abs = Math.abs(minutes)
  const mm = abs % 60
  return `GMT${minutes < 0 ? '-' : '+'}${Math.floor(abs / 60)}${mm ? `:${String(mm).padStart(2, '0')}` : ''}`
}

const zoneName = (tz, ms, style) => {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: style })
      .formatToParts(new Date(ms)).find(p => p.type === 'timeZoneName')?.value ?? ''
  } catch {
    return '' // an engine without this name style
  }
}

// "America/New_York" -> "New York"
export const zoneCity = (tz) => tz.split('/').pop().replace(/_/g, ' ')

// Where Intl's name is stiffer than what people say
const NAME_OVERRIDES = {
  'United Kingdom Time': 'UK Time',
}

/* A zone in words a client recognises.
   -> { name: 'Eastern Time', city: 'New York', offset: 'GMT-4',
        label: 'Eastern Time (New York), GMT-4' }
   name is '' when the engine only knows the zone as an offset. */
export function friendlyZone(tz, ms = Date.now()) {
  const city = zoneCity(tz)
  const offset = offsetLabel(offsetMinutes(tz, ms))
  // Intl sometimes adds its own city: "Hawaii-Aleutian Time (Adak)"
  let name = zoneName(tz, ms, 'longGeneric').replace(/\s*\(.*\)$/, '')
  if (/^(GMT|UTC)([+-]|$)/.test(name)) name = ''
  name = NAME_OVERRIDES[name] ?? name
  const label = name && name !== city ? `${name} (${city}), ${offset}` : `${city}, ${offset}`
  return { name, city, offset, label }
}

// "EST", "PDT", "GMT+5" — only for matching what people type into the search
export const zoneAbbreviation = (tz, ms = Date.now()) => zoneName(tz, ms, 'short')

// True when two zones show the same clock at both ends of a period, so one
// can stand in for the other on the rail (Toronto for New York)
export function sameClock(a, b, from, to = from) {
  return offsetMinutes(a, from) === offsetMinutes(b, from) && offsetMinutes(a, to) === offsetMinutes(b, to)
}

const pad = (n) => String(n).padStart(2, '0')

// The calendar day in a zone at an instant: '2026-10-14'
export function zoneDayKey(tz, ms) {
  const p = zoneParts(tz, ms)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

// Slots (ms instants) -> [{ key: '2026-10-13', slots: [ms] }], one entry per
// calendar day in the zone, in order
export function groupByZoneDay(slots, tz) {
  const days = new Map()
  for (const ms of [...slots].sort((a, b) => a - b)) {
    const key = zoneDayKey(tz, ms)
    if (!days.has(key)) days.set(key, { key, slots: [] })
    days.get(key).slots.push(ms)
  }
  return [...days.values()]
}

// The hours a call is offered in, on the visitor's own clock: 07:00 to 22:00
export const WAKING_HOURS = { from: 7, to: 22 }

// The slots that start within WAKING_HOURS in the zone. When none do (a
// narrow host window seen from the far side of the world) all of them are
// kept, so the picker is never empty.
export function wakingSlots(slots, tz) {
  const waking = slots.filter(ms => {
    const { hour } = zoneParts(tz, ms)
    return hour >= WAKING_HOURS.from && hour < WAKING_HOURS.to
  })
  return waking.length ? waking : [...slots]
}

const DAY = 24 * 60 * MIN
const civilKey = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` }

/* One month as a wall calendar shows it: always six weeks, from the week
   holding the 1st, with the neighbouring months' days filling the first and
   last rows. month is 'YYYY-MM', keys are 'YYYY-MM-DD' civil dates, firstDay
   is the column weeks start on (0 = Sunday). open marks the keys in dayKeys,
   whichever month they belong to.
   -> [[{ key, day, inMonth, isToday, open } x 7] x 6] */
export function monthGrid(month, dayKeys, todayKey, firstDay = 0) {
  const open = new Set(dayKeys)
  const [y, m] = month.split('-').map(Number)
  let ms = Date.UTC(y, m - 1, 1)
  ms -= ((new Date(ms).getUTCDay() - firstDay + 7) % 7) * DAY
  const weeks = []
  for (let w = 0; w < 6; w++) {
    const week = []
    for (let i = 0; i < 7; i++, ms += DAY) {
      const d = new Date(ms)
      const key = civilKey(ms)
      week.push({ key, day: d.getUTCDate(), inMonth: d.getUTCMonth() === m - 1, isToday: key === todayKey, open: open.has(key) })
    }
    weeks.push(week)
  }
  return weeks
}

// '2026-10' -> '2026-11' (delta 1) or '2026-09' (delta -1)
export function addMonths(month, delta) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
}

// West to east: where clients are most likely to be. `short` is the name on
// the rail; the detected zone is added when none of these keeps its clock.
export const RAIL_ZONES = [
  { id: 'America/Los_Angeles', short: 'Pacific' },
  { id: 'America/Denver',      short: 'Mountain' },
  { id: 'America/Chicago',     short: 'Central' },
  { id: 'America/New_York',    short: 'Eastern' },
  { id: 'Europe/London',       short: 'London' },
  { id: 'Europe/Berlin',       short: 'C. Europe' },
  { id: 'Asia/Dubai',          short: 'Gulf' },
]

/* The rail for a visitor: RAIL_ZONES, plus `tz` itself when no rail zone
   shows the same clock from `from` to `to`, sorted west to east.
   -> { zones: [{ id, short }], selected: index of the node standing for tz } */
export function railFor(tz, from = Date.now(), to = from) {
  const zones = [...RAIL_ZONES]
  let match = zones.find(z => z.id === tz) ?? zones.find(z => sameClock(z.id, tz, from, to))
  if (!match) {
    match = { id: tz, short: zoneCity(tz) }
    zones.push(match)
    zones.sort((a, b) => offsetMinutes(a.id, from) - offsetMinutes(b.id, from))
  }
  return { zones, selected: zones.indexOf(match) }
}

// For engines without Intl.supportedValuesOf: one zone per common offset
const FALLBACK_ZONES = [
  'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles', 'America/Phoenix', 'America/Denver',
  'America/Chicago', 'America/Mexico_City', 'America/New_York', 'America/Toronto', 'America/Bogota',
  'America/Halifax', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'Atlantic/Reykjavik', 'Europe/London',
  'Europe/Dublin', 'Europe/Lisbon', 'Africa/Lagos', 'Europe/Paris', 'Europe/Berlin',
  'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Stockholm', 'Europe/Warsaw',
  'Africa/Cairo', 'Africa/Johannesburg', 'Europe/Athens', 'Europe/Istanbul', 'Europe/Moscow',
  'Asia/Riyadh', 'Africa/Nairobi', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata',
  'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Singapore', 'Asia/Hong_Kong',
  'Asia/Shanghai', 'Australia/Perth', 'Asia/Tokyo', 'Asia/Seoul', 'Australia/Sydney',
  'Pacific/Auckland',
]

export function listZones() {
  try {
    const all = Intl.supportedValuesOf('timeZone')
    if (all.length) return all
  } catch { /* fall through */ }
  return FALLBACK_ZONES
}

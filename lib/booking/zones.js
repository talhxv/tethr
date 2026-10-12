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

// Slots (ms instants) -> [{ key: '2026-10-13', slots: [ms] }], one entry per
// calendar day in the zone, in order
export function groupByZoneDay(slots, tz) {
  const days = new Map()
  for (const ms of [...slots].sort((a, b) => a - b)) {
    const p = zoneParts(tz, ms)
    const key = `${p.year}-${pad(p.month)}-${pad(p.day)}`
    if (!days.has(key)) days.set(key, { key, slots: [] })
    days.get(key).slots.push(ms)
  }
  return [...days.values()]
}

// A day in clock order. `folded` marks the hours nobody wants a call offered
// first — before 07:00 and from 22:00 — which the picker keeps behind a link.
export const DAY_PARTS = [
  { id: 'early',     label: 'Early morning', from: 0,  to: 7,  folded: true },
  { id: 'morning',   label: 'Morning',       from: 7,  to: 12 },
  { id: 'afternoon', label: 'Afternoon',     from: 12, to: 17 },
  { id: 'evening',   label: 'Evening',       from: 17, to: 22 },
  { id: 'late',      label: 'Late evening',  from: 22, to: 24, folded: true },
]

export function partOfDay(hour) {
  return DAY_PARTS.find(p => hour >= p.from && hour < p.to).id
}

// One day's slots -> [{ id, label, folded, slots: [ms] }] in clock order,
// empty parts left out
export function groupByPartOfDay(slots, tz) {
  const byPart = new Map(DAY_PARTS.map(p => [p.id, { id: p.id, label: p.label, folded: !!p.folded, slots: [] }]))
  for (const ms of [...slots].sort((a, b) => a - b)) byPart.get(partOfDay(zoneParts(tz, ms).hour)).slots.push(ms)
  return [...byPart.values()].filter(p => p.slots.length)
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

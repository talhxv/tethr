import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateSlots, groupByHostDay, zonedTimeToUtc, zonedParts } from '../lib/booking/slots.js'
import { bookingRules } from '../lib/booking/config.js'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const utc = (iso) => Date.parse(iso)
const iso = (ms) => new Date(ms).toISOString()

const DEFAULTS = bookingRules({})
// The day-shape tests below pin an 18:00 close so their numbers don't move
// with the deployment's hours
const KARACHI = bookingRules({ BOOKING_END: '18:00' })
const NEW_YORK = bookingRules({ BOOKING_TIMEZONE: 'America/New_York', BOOKING_END: '18:00' })

// Wall-clock "HH:MM" of a slot in the host timezone
const wall = (ms, tz) => {
  const p = zonedParts(ms, tz)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

test('defaults: Karachi, weekdays, 09:00-23:00, 30 minutes, 15 buffer, 12h notice, 14 days', () => {
  assert.deepEqual(DEFAULTS, {
    timezone: 'Asia/Karachi', days: [1, 2, 3, 4, 5], dayStart: 540, dayEnd: 1380,
    slotMinutes: 30, bufferMinutes: 15, minNoticeHours: 12, horizonDays: 14,
  })
})

test('a full default day is 28 half-hour slots, 09:00 to 22:30 Karachi, on one host date', () => {
  const days = groupByHostDay(generateSlots({ now: utc('2026-10-05T00:00:00Z'), rules: DEFAULTS }), 'Asia/Karachi')
  const tuesday = days.find((d) => d.date === '2026-10-06')
  assert.equal(tuesday.slots.length, 28)
  assert.equal(tuesday.slots[0], '2026-10-06T04:00:00.000Z')
  assert.equal(tuesday.slots.at(-1), '2026-10-06T17:30:00.000Z')
  // Friday's late slots must not leak into Saturday
  assert.ok(!days.some((d) => d.date === '2026-10-10' || d.date === '2026-10-11'))
})

test('env overrides the hours; bad values fall back to the defaults', () => {
  const r = bookingRules({ BOOKING_START: '10:30', BOOKING_END: '16:00', BOOKING_DAYS: '1,3', BOOKING_TIMEZONE: 'Not/AZone', BOOKING_SLOT_MINUTES: 'x' })
  assert.equal(r.dayStart, 630)
  assert.equal(r.dayEnd, 960)
  assert.equal(bookingRules({ BOOKING_END: '25:00' }).dayEnd, 1380)
  assert.deepEqual(r.days, [1, 3])
  assert.equal(r.timezone, 'Asia/Karachi')
  assert.equal(r.slotMinutes, 30)
})

test('zonedTimeToUtc: Karachi is UTC+5 all year', () => {
  assert.equal(iso(zonedTimeToUtc(2026, 1, 15, 9 * 60, 'Asia/Karachi')), '2026-01-15T04:00:00.000Z')
  assert.equal(iso(zonedTimeToUtc(2026, 7, 15, 9 * 60, 'Asia/Karachi')), '2026-07-15T04:00:00.000Z')
})

test('zonedTimeToUtc: New York either side of a clock change, and the skipped hour', () => {
  // Clocks go forward on Sunday 8 March 2026 and back on Sunday 1 November 2026
  assert.equal(iso(zonedTimeToUtc(2026, 3, 6, 9 * 60, 'America/New_York')), '2026-03-06T14:00:00.000Z')
  assert.equal(iso(zonedTimeToUtc(2026, 3, 9, 9 * 60, 'America/New_York')), '2026-03-09T13:00:00.000Z')
  assert.equal(iso(zonedTimeToUtc(2026, 10, 30, 9 * 60, 'America/New_York')), '2026-10-30T13:00:00.000Z')
  assert.equal(iso(zonedTimeToUtc(2026, 11, 2, 9 * 60, 'America/New_York')), '2026-11-02T14:00:00.000Z')
  assert.equal(zonedTimeToUtc(2026, 3, 8, 2 * 60 + 30, 'America/New_York'), null)
})

test('with an 18:00 close a Karachi day is 18 half-hour slots, 09:00 to 17:30', () => {
  // Monday 5 Oct 2026, 00:00 UTC. Notice ends 12:00 UTC = 17:00 Karachi.
  const now = utc('2026-10-05T00:00:00Z')
  const days = groupByHostDay(generateSlots({ now, rules: KARACHI }), 'Asia/Karachi')
  const tuesday = days.find((d) => d.date === '2026-10-06')
  assert.equal(tuesday.slots.length, 18)
  assert.equal(tuesday.slots[0], '2026-10-06T04:00:00.000Z')
  assert.equal(tuesday.slots.at(-1), '2026-10-06T12:30:00.000Z')
})

test('notice window: nothing sooner than 12 hours from now, and exactly 12 hours is allowed', () => {
  const now = utc('2026-10-05T00:00:00Z')
  const slots = generateSlots({ now, rules: KARACHI })
  assert.equal(iso(slots[0]), '2026-10-05T12:00:00.000Z') // 17:00 Karachi the same Monday
  assert.ok(slots.every((s) => s >= now + 12 * HOUR))

  const later = generateSlots({ now: now + MIN, rules: KARACHI })
  assert.equal(iso(later[0]), '2026-10-05T12:30:00.000Z')
})

test('horizon: nothing more than 14 days ahead', () => {
  const now = utc('2026-10-05T06:10:00Z')
  const slots = generateSlots({ now, rules: KARACHI })
  assert.ok(slots.every((s) => s <= now + 14 * DAY))
  // Monday 19 Oct is day 14: slots up to 11:10 Karachi (06:10 UTC) are in, later ones out
  assert.equal(iso(slots.at(-1)), '2026-10-19T06:00:00.000Z')
  assert.equal(generateSlots({ now, rules: { ...KARACHI, horizonDays: 1 } }).every((s) => s <= now + DAY), true)
})

test('weekends: no Saturday or Sunday slots in host time', () => {
  const slots = generateSlots({ now: utc('2026-10-05T00:00:00Z'), rules: KARACHI })
  for (const s of slots) {
    const p = zonedParts(s, 'Asia/Karachi')
    const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
    assert.ok(dow >= 1 && dow <= 5, iso(s))
  }
  assert.equal(new Set(groupByHostDay(slots, 'Asia/Karachi').map((d) => d.date)).size, 10)
})

test('weekday is judged in host time, not UTC', () => {
  // Auckland's Monday 09:00 is still Sunday in UTC
  const rules = bookingRules({ BOOKING_TIMEZONE: 'Pacific/Auckland', BOOKING_MIN_NOTICE_HOURS: '0' })
  const slots = generateSlots({ now: utc('2026-10-03T00:00:00Z'), rules })
  assert.equal(iso(slots[0]), '2026-10-04T20:00:00.000Z')
  assert.equal(wall(slots[0], 'Pacific/Auckland'), '09:00')
})

test('buffers: 15 minutes clear either side of a busy block', () => {
  const now = utc('2026-10-05T00:00:00Z')
  // Tuesday 11:00-12:00 Karachi
  const busy = [{ start: utc('2026-10-06T06:00:00Z'), end: utc('2026-10-06T07:00:00Z') }]
  const day = groupByHostDay(generateSlots({ now, busy, rules: KARACHI }), 'Asia/Karachi').find((d) => d.date === '2026-10-06')
  const times = day.slots.map((s) => wall(Date.parse(s), 'Asia/Karachi'))
  // 10:30 would end as the meeting starts and 12:00 would start as it ends: both inside the buffer
  assert.deepEqual(times.slice(0, 6), ['09:00', '09:30', '10:00', '12:30', '13:00', '13:30'])
  assert.equal(times.length, 14)
})

test('buffers: a block ending exactly 15 minutes before a slot leaves it free', () => {
  const now = utc('2026-10-05T00:00:00Z')
  const busy = [{ start: utc('2026-10-06T03:00:00Z'), end: utc('2026-10-06T03:45:00Z') }] // ends 08:45 Karachi
  const slots = generateSlots({ now, busy, rules: KARACHI })
  assert.ok(slots.includes(utc('2026-10-06T04:00:00Z')))
  const tighter = [{ start: utc('2026-10-06T03:00:00Z'), end: utc('2026-10-06T03:46:00Z') }]
  assert.ok(!generateSlots({ now, busy: tighter, rules: KARACHI }).includes(utc('2026-10-06T04:00:00Z')))
})

test('no buffer configured: back-to-back is allowed', () => {
  const now = utc('2026-10-05T00:00:00Z')
  const busy = [{ start: utc('2026-10-06T06:00:00Z'), end: utc('2026-10-06T07:00:00Z') }]
  const slots = generateSlots({ now, busy, rules: { ...KARACHI, bufferMinutes: 0 } })
  assert.ok(slots.includes(utc('2026-10-06T05:30:00Z')))
  assert.ok(slots.includes(utc('2026-10-06T07:00:00Z')))
  assert.ok(!slots.includes(utc('2026-10-06T06:30:00Z')))
})

test('day boundaries: the last slot ends at closing time; a short window that fits nothing gives nothing', () => {
  const now = utc('2026-10-05T00:00:00Z')
  const slots = generateSlots({ now, rules: KARACHI })
  assert.ok(slots.every((s) => ['09:00', '17:30'].includes(wall(s, 'Asia/Karachi')) || (wall(s, 'Asia/Karachi') > '09:00' && wall(s, 'Asia/Karachi') < '17:30')))
  assert.deepEqual(generateSlots({ now, rules: { ...KARACHI, dayStart: 540, dayEnd: 560 } }), [])
  // 45-minute calls in a 09:00-10:00 window: only 09:00 fits
  const odd = generateSlots({ now, rules: { ...KARACHI, slotMinutes: 45, dayStart: 540, dayEnd: 600 } })
  assert.ok(odd.length > 0 && odd.every((s) => wall(s, 'Asia/Karachi') === '09:00'))
})

test('grouping: a host day that spans two UTC dates stays one day', () => {
  const rules = bookingRules({ BOOKING_TIMEZONE: 'Pacific/Auckland', BOOKING_MIN_NOTICE_HOURS: '0', BOOKING_END: '18:00' })
  const days = groupByHostDay(generateSlots({ now: utc('2026-10-05T12:00:00Z'), rules }), 'Pacific/Auckland')
  const tuesday = days.find((d) => d.date === '2026-10-06')
  assert.equal(tuesday.slots.length, 18)
  assert.ok(tuesday.slots[0].startsWith('2026-10-05T20:00'))
  assert.ok(tuesday.slots.at(-1).startsWith('2026-10-06T04:30'))
})

test('New York across the spring clock change: 09:00 stays 09:00 local, the UTC time moves', () => {
  const now = utc('2026-03-05T00:00:00Z')
  const days = groupByHostDay(generateSlots({ now, rules: NEW_YORK }), 'America/New_York')
  const friday = days.find((d) => d.date === '2026-03-06')
  const monday = days.find((d) => d.date === '2026-03-09')
  assert.equal(friday.slots[0], '2026-03-06T14:00:00.000Z') // EST, UTC-5
  assert.equal(monday.slots[0], '2026-03-09T13:00:00.000Z') // EDT, UTC-4
  for (const d of [friday, monday]) {
    assert.equal(d.slots.length, 18)
    assert.equal(wall(Date.parse(d.slots[0]), 'America/New_York'), '09:00')
    assert.equal(wall(Date.parse(d.slots.at(-1)), 'America/New_York'), '17:30')
  }
  assert.ok(!days.some((d) => d.date === '2026-03-07' || d.date === '2026-03-08'))
})

test('New York across the autumn clock change', () => {
  const now = utc('2026-10-29T00:00:00Z')
  const days = groupByHostDay(generateSlots({ now, rules: NEW_YORK }), 'America/New_York')
  assert.equal(days.find((d) => d.date === '2026-10-30').slots[0], '2026-10-30T13:00:00.000Z')
  const monday = days.find((d) => d.date === '2026-11-02')
  assert.equal(monday.slots[0], '2026-11-02T14:00:00.000Z')
  assert.equal(monday.slots.length, 18)
})

test('a working window over the skipped hour drops only the times that do not exist', () => {
  // Sunday 8 March 2026 in New York has no 02:00-02:59
  const rules = { ...NEW_YORK, days: [0], dayStart: 60, dayEnd: 240, minNoticeHours: 0 }
  const slots = generateSlots({ now: utc('2026-03-07T12:00:00Z'), rules }).filter((s) => s < utc('2026-03-09T00:00:00Z'))
  assert.deepEqual(slots.map((s) => wall(s, 'America/New_York')), ['01:00', '01:30', '03:00', '03:30'])
  assert.deepEqual(slots.map(iso), ['2026-03-08T06:00:00.000Z', '2026-03-08T06:30:00.000Z', '2026-03-08T07:00:00.000Z', '2026-03-08T07:30:00.000Z'])
})

test('slots come out in order with no duplicates', () => {
  const slots = generateSlots({ now: utc('2026-10-29T00:00:00Z'), rules: NEW_YORK })
  assert.deepEqual(slots, [...new Set(slots)].sort((a, b) => a - b))
})

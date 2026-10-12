import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  zoneParts, offsetMinutes, standardOffsetMinutes, offsetLabel, friendlyZone, sameClock,
  groupByZoneDay, groupByPartOfDay, partOfDay, railFor, listZones, RAIL_ZONES,
} from '../lib/booking/zones.js'

const at = (iso) => Date.parse(iso)
const HALF_HOUR = 30 * 60_000
const JULY = at('2026-07-15T12:00:00Z')
const JANUARY = at('2026-01-15T12:00:00Z')

// The host's bookable window on one Karachi day: 09:00 to 23:00, 28 half-hour slots
const KARACHI_DAY = Array.from({ length: 28 }, (_, i) => at('2026-10-14T04:00:00Z') + i * HALF_HOUR)

test('offsets follow each zone through the year', () => {
  assert.equal(offsetMinutes('America/New_York', JULY), -240)
  assert.equal(offsetMinutes('America/New_York', JANUARY), -300)
  assert.equal(offsetMinutes('America/Los_Angeles', JULY), -420)
  assert.equal(offsetMinutes('Europe/London', JULY), 60)
  assert.equal(offsetMinutes('Europe/London', JANUARY), 0)
  assert.equal(offsetMinutes('Asia/Dubai', JULY), 240)
  assert.equal(offsetMinutes('Asia/Karachi', JANUARY), 300)
  assert.equal(offsetMinutes('Asia/Kolkata', JULY), 330)
})

test('the standard offset ignores daylight saving, in both hemispheres', () => {
  assert.equal(standardOffsetMinutes('America/New_York', JULY), -300)
  assert.equal(standardOffsetMinutes('America/New_York', JANUARY), -300)
  assert.equal(standardOffsetMinutes('Europe/London', JULY), 0)
  assert.equal(standardOffsetMinutes('Australia/Sydney', JANUARY), 600)
  assert.equal(standardOffsetMinutes('Asia/Karachi', JULY), 300)
})

test('offset labels read as GMT plus or minus', () => {
  assert.equal(offsetLabel(-240), 'GMT-4')
  assert.equal(offsetLabel(330), 'GMT+5:30')
  assert.equal(offsetLabel(-210), 'GMT-3:30')
  assert.equal(offsetLabel(0), 'GMT')
})

test('a zone is named in words, with its city and offset', () => {
  assert.deepEqual(friendlyZone('America/New_York', JULY), {
    name: 'Eastern Time', city: 'New York', offset: 'GMT-4', label: 'Eastern Time (New York), GMT-4',
  })
  assert.equal(friendlyZone('America/New_York', JANUARY).label, 'Eastern Time (New York), GMT-5')
  assert.equal(friendlyZone('America/Los_Angeles', JULY).label, 'Pacific Time (Los Angeles), GMT-7')

  for (const [tz, city, offset] of [
    ['Europe/London', 'London', 'GMT+1'],
    ['Asia/Dubai', 'Dubai', 'GMT+4'],
    ['Asia/Karachi', 'Karachi', 'GMT+5'],
  ]) {
    const z = friendlyZone(tz, JULY)
    assert.equal(z.city, city)
    assert.equal(z.offset, offset)
    assert.ok(z.label.endsWith(`, ${offset}`), z.label)
    assert.ok(z.label.includes(city), z.label)
    assert.ok(!z.label.includes('/'), `no IANA id in "${z.label}"`)
  }
  assert.equal(friendlyZone('Europe/London', JANUARY).offset, 'GMT')
  assert.equal(friendlyZone('Europe/London', JULY).label, 'UK Time (London), GMT+1')
  assert.ok(!friendlyZone('America/Adak', JULY).name.includes('('))
})

test('the Karachi window lands on one day in Karachi, Dubai and London', () => {
  for (const tz of ['Asia/Karachi', 'Asia/Dubai', 'Europe/London']) {
    const days = groupByZoneDay(KARACHI_DAY, tz)
    assert.deepEqual(days.map(d => [d.key, d.slots.length]), [['2026-10-14', 28]], tz)
  }
})

test('in Los Angeles the same window starts the evening before', () => {
  const days = groupByZoneDay(KARACHI_DAY, 'America/Los_Angeles')
  assert.deepEqual(days.map(d => [d.key, d.slots.length]), [['2026-10-13', 6], ['2026-10-14', 22]])
  assert.deepEqual(zoneParts('America/Los_Angeles', days[0].slots[0]), { year: 2026, month: 10, day: 13, hour: 21, minute: 0 })
  assert.equal(zoneParts('America/Los_Angeles', days[1].slots.at(-1)).hour, 10)
})

test('in New York the window runs midnight to 2 pm, and the early hours are folded', () => {
  const [day, ...rest] = groupByZoneDay(KARACHI_DAY, 'America/New_York')
  assert.equal(rest.length, 0)
  assert.equal(day.key, '2026-10-14')
  const parts = groupByPartOfDay(day.slots, 'America/New_York')
  assert.deepEqual(parts.map(p => [p.id, p.label, p.folded, p.slots.length]),
    [['early', 'Early morning', true, 14], ['morning', 'Morning', false, 10], ['afternoon', 'Afternoon', false, 4]])
  assert.equal(zoneParts('America/New_York', parts[1].slots[0]).hour, 7)
})

test('parts of the day: Karachi sees mostly daytime, Los Angeles mostly early and late', () => {
  assert.deepEqual(
    groupByPartOfDay(KARACHI_DAY, 'Asia/Karachi').map(p => [p.id, p.slots.length]),
    [['morning', 6], ['afternoon', 10], ['evening', 10], ['late', 2]])
  assert.deepEqual(
    groupByPartOfDay(KARACHI_DAY, 'Asia/Dubai').map(p => [p.id, p.slots.length]),
    [['morning', 8], ['afternoon', 10], ['evening', 10]])
  const la = groupByZoneDay(KARACHI_DAY, 'America/Los_Angeles')
  assert.deepEqual(groupByPartOfDay(la[0].slots, 'America/Los_Angeles').map(p => [p.id, p.slots.length]), [['evening', 2], ['late', 4]])
  assert.deepEqual(groupByPartOfDay(la[1].slots, 'America/Los_Angeles').map(p => [p.id, p.slots.length]), [['early', 14], ['morning', 8]])
})

test('part-of-day boundaries', () => {
  assert.deepEqual([6, 7, 11, 12, 16, 17, 21, 22, 23, 0].map(partOfDay),
    ['early', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'late', 'late', 'early'])
})

test('a day that crosses a clock change keeps every slot, on the right day', () => {
  // New York falls back on 1 Nov 2026: 01:00 to 01:59 happens twice
  const slots = ['2026-11-01T03:30:00Z', '2026-11-01T05:00:00Z', '2026-11-01T05:30:00Z', '2026-11-01T06:00:00Z', '2026-11-01T06:30:00Z', '2026-11-02T04:30:00Z', '2026-11-02T05:00:00Z'].map(at)
  const days = groupByZoneDay(slots, 'America/New_York')
  assert.deepEqual(days.map(d => [d.key, d.slots.length]), [['2026-10-31', 1], ['2026-11-01', 5], ['2026-11-02', 1]])
  assert.deepEqual(days[1].slots.slice(0, 4).map(ms => zoneParts('America/New_York', ms).hour), [1, 1, 1, 1])
  assert.deepEqual(days[1].slots.slice(0, 4).map(ms => offsetMinutes('America/New_York', ms)), [-240, -240, -300, -300])
  assert.equal(friendlyZone('America/New_York', slots[1]).offset, 'GMT-4')
  assert.equal(friendlyZone('America/New_York', slots[3]).offset, 'GMT-5')

  // London springs forward on 29 Mar 2026: 01:00 to 01:59 never happens
  const spring = ['2026-03-29T00:30:00Z', '2026-03-29T01:00:00Z', '2026-03-29T23:00:00Z'].map(at)
  const london = groupByZoneDay(spring, 'Europe/London')
  assert.deepEqual(london.map(d => [d.key, d.slots.length]), [['2026-03-29', 2], ['2026-03-30', 1]])
  assert.deepEqual(london[0].slots.map(ms => zoneParts('Europe/London', ms).hour), [0, 2])
})

test('the rail stands in for zones that keep the same clock, and adds the ones that do not', () => {
  const to = JULY + 14 * 24 * 60 * 60_000
  assert.ok(sameClock('America/Toronto', 'America/New_York', JULY, to))
  assert.ok(!sameClock('America/Phoenix', 'America/Denver', JULY, JANUARY))

  const toronto = railFor('America/Toronto', JULY, to)
  assert.equal(toronto.zones.length, RAIL_ZONES.length)
  assert.equal(toronto.zones[toronto.selected].id, 'America/New_York')

  const karachi = railFor('Asia/Karachi', JULY, to)
  assert.equal(karachi.zones.length, RAIL_ZONES.length + 1)
  assert.deepEqual(karachi.zones[karachi.selected], { id: 'Asia/Karachi', short: 'Karachi' })
  assert.equal(karachi.selected, karachi.zones.length - 1) // east of the Gulf

  const honolulu = railFor('Pacific/Honolulu', JULY, to)
  assert.equal(honolulu.selected, 0) // west of Pacific
  const offsets = honolulu.zones.map(z => offsetMinutes(z.id, JULY))
  assert.deepEqual(offsets, [...offsets].sort((a, b) => a - b))
})

test('the zone list is usable everywhere', () => {
  const zones = listZones()
  assert.ok(zones.length >= 40)
  for (const tz of ['America/New_York', 'Europe/London', 'Asia/Dubai', 'Asia/Karachi']) assert.ok(zones.includes(tz), tz)
})

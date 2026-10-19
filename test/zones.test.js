import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  zoneParts, offsetMinutes, standardOffsetMinutes, offsetLabel, friendlyZone, sameClock,
  groupByZoneDay, zoneDayKey, wakingSlots, WAKING_HOURS, monthGrid, addMonths, railFor, listZones, RAIL_ZONES,
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

const clock = (tz, slots) => slots.map(ms => { const p = zoneParts(tz, ms); return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}` })

test('in New York the window runs midnight to 2 pm, and only 07:00 on is offered', () => {
  const [day, ...rest] = groupByZoneDay(KARACHI_DAY, 'America/New_York')
  assert.equal(rest.length, 0)
  assert.equal(day.key, '2026-10-14')
  const kept = wakingSlots(KARACHI_DAY, 'America/New_York')
  assert.equal(kept.length, 14)
  assert.equal(clock('America/New_York', kept)[0], '07:00')
  assert.equal(clock('America/New_York', kept).at(-1), '13:30')
  assert.ok(!clock('America/New_York', kept).some(t => t < '07:00'))
})

test('in Los Angeles the evening before and the morning are kept, the night is not', () => {
  const kept = wakingSlots(KARACHI_DAY, 'America/Los_Angeles')
  assert.deepEqual(groupByZoneDay(kept, 'America/Los_Angeles').map(d => [d.key, clock('America/Los_Angeles', d.slots)]), [
    ['2026-10-13', ['21:00', '21:30']],
    ['2026-10-14', ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30']],
  ])
})

test('in Karachi the host day loses only its last hour', () => {
  const kept = clock('Asia/Karachi', wakingSlots(KARACHI_DAY, 'Asia/Karachi'))
  assert.equal(kept.length, 26)
  assert.equal(kept[0], '09:00')
  assert.equal(kept.at(-1), '21:30')
  assert.ok(!kept.includes('22:00') && !kept.includes('22:30'))
  assert.deepEqual(WAKING_HOURS, { from: 7, to: 22 })
})

test('when no slot falls in waking hours, all of them are kept', () => {
  // 02:00 to 04:30 in New York
  const night = Array.from({ length: 6 }, (_, i) => at('2026-10-14T06:00:00Z') + i * HALF_HOUR)
  assert.deepEqual(wakingSlots(night, 'America/New_York'), night)
  assert.deepEqual(wakingSlots([], 'America/New_York'), [])
})

test('a day key is the calendar day in the zone', () => {
  assert.equal(zoneDayKey('America/Los_Angeles', at('2026-10-14T04:00:00Z')), '2026-10-13')
  assert.equal(zoneDayKey('Asia/Karachi', at('2026-10-14T20:00:00Z')), '2026-10-15')
})

const keysOf = (grid) => grid.flat().map(c => c.key)

test('a month is always six weeks of seven days', () => {
  for (const month of ['2026-02', '2026-03', '2026-08', '2026-10', '2026-11', '2027-01']) {
    for (const firstDay of [0, 1, 6]) {
      const grid = monthGrid(month, [], '2026-10-15', firstDay)
      assert.equal(grid.length, 6, month)
      assert.ok(grid.every(w => w.length === 7), month)
      assert.equal(grid[0][0].key <= `${month}-01`, true, month)
      // Consecutive civil days, no gaps or repeats across the month and the DST changes
      const keys = keysOf(grid)
      for (let i = 1; i < keys.length; i++) assert.equal(Date.parse(keys[i]) - Date.parse(keys[i - 1]), 86_400_000, keys[i])
    }
  }
})

test('the grid starts on the week holding the 1st, for Sunday and Monday starts', () => {
  // 1 October 2026 is a Thursday
  const sunday = monthGrid('2026-10', [], '2026-10-15', 0)
  assert.deepEqual(sunday[0].map(c => c.day), [27, 28, 29, 30, 1, 2, 3])
  assert.deepEqual(sunday[5].map(c => c.day), [1, 2, 3, 4, 5, 6, 7])
  const monday = monthGrid('2026-10', [], '2026-10-15', 1)
  assert.deepEqual(monday[0].map(c => c.day), [28, 29, 30, 1, 2, 3, 4])
  assert.deepEqual(monday[5].map(c => c.day), [2, 3, 4, 5, 6, 7, 8])
  assert.equal(monday[0][0].key, '2026-09-28')
})

test('a month that starts on the first day of the week opens with it', () => {
  // 1 November 2026 is a Sunday; 1 February 2027 a Monday
  const nov = monthGrid('2026-11', [], '2026-10-15', 0)
  assert.equal(nov[0][0].key, '2026-11-01')
  assert.equal(nov[0][0].inMonth, true)
  const feb = monthGrid('2027-02', [], '2026-10-15', 1)
  assert.equal(feb[0][0].key, '2027-02-01')
})

test('February 2026 starts on a Sunday and has 28 days', () => {
  const grid = monthGrid('2026-02', [], '2026-02-10', 0)
  assert.equal(grid[0][0].key, '2026-02-01')
  assert.equal(grid.flat().filter(c => c.inMonth).length, 28)
  // Four full weeks of February, then two of March
  assert.deepEqual(grid[4].map(c => c.key), ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07'])
  assert.ok(grid.slice(4).flat().every(c => !c.inMonth))
  assert.equal(grid.flat().filter(c => c.isToday).map(c => c.key).join(), '2026-02-10')
})

test('the days either side are marked out of the month', () => {
  const grid = monthGrid('2026-10', [], '2026-10-15', 0)
  assert.deepEqual(grid[0].map(c => c.inMonth), [false, false, false, false, true, true, true])
  assert.deepEqual(grid[5].map(c => c.inMonth), [false, false, false, false, false, false, false])
  assert.equal(grid.flat().filter(c => c.inMonth).length, 31)
})

test('an open day in the trailing row is open, whichever month it is in', () => {
  // Today Friday 30 October; the first open day is Monday 2 November
  const open = ['2026-11-02', '2026-11-03', '2026-11-04']
  const grid = monthGrid('2026-10', open, '2026-10-30', 0)
  const nov2 = grid.flat().find(c => c.key === '2026-11-02')
  assert.deepEqual(nov2, { key: '2026-11-02', day: 2, inMonth: false, isToday: false, open: true })
  assert.deepEqual(grid.flat().filter(c => c.open).map(c => c.key), open)
  assert.equal(grid.flat().find(c => c.isToday).key, '2026-10-30')
})

test('months step across the year', () => {
  assert.equal(addMonths('2026-10', 1), '2026-11')
  assert.equal(addMonths('2026-12', 1), '2027-01')
  assert.equal(addMonths('2026-01', -1), '2025-12')
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

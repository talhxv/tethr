// The API end to end against the in-memory mock (BOOKING_MOCK=1), plus the
// rule that without the flag a missing backend is an error.
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.BOOKING_MOCK = '1'
for (const k of ['NOTION_TOKEN', 'VITE_NOTION_TOKEN', 'NOTION_LEADS_DB_ID', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'BOOKING_CALENDAR_ID', 'VERCEL_ENV', 'NODE_ENV']) delete process.env[k]
const { handle } = await import('../lib/booking/handlers.js')

const GOOD = {
  name: 'Ada Lovelace', title: 'VP Engineering', company: 'TechCorp LLC', email: 'ada@techcorp.com',
  challenge: 'Hiring takes too long', headcount: '2-5', timeline: 'ASAP', elapsedMs: 30_000, book_ref: '',
}
const mock = (body) => handle('POST', '/api/booking-mock', body)
const newLead = async () => (await handle('POST', '/api/lead', GOOD)).body.leadId
const firstSlot = async () => (await handle('GET', '/api/availability')).body.days[0].slots[0]

test('POST /api/lead stores the lead and returns its id', async () => {
  const res = await handle('POST', '/api/lead', GOOD)
  assert.equal(res.status, 201)
  const stored = (await mock({})).body.leads.find((l) => l.id === res.body.leadId)
  assert.equal(stored.email, 'ada@techcorp.com')
  assert.equal(stored.booked, false)
})

test('POST /api/lead accepts a JSON string body', async () => {
  assert.equal((await handle('POST', '/api/lead', JSON.stringify(GOOD))).status, 201)
})

test('POST /api/lead: bad input is a 400 with field errors and nothing stored', async () => {
  const before = (await mock({})).body.leads.length
  const res = await handle('POST', '/api/lead', { ...GOOD, email: 'nope', headcount: '99' })
  assert.equal(res.status, 400)
  assert.deepEqual(res.body.fields, { email: 'Enter a valid email address.', headcount: 'Choose how many to hire.' })
  assert.equal((await mock({})).body.leads.length, before)
})

test('POST /api/lead: bots get a 201 and nothing is stored', async () => {
  const before = (await mock({})).body.leads.length
  for (const body of [{ ...GOOD, book_ref: 'x' }, { ...GOOD, elapsedMs: 200 }]) {
    const res = await handle('POST', '/api/lead', body)
    assert.equal(res.status, 201)
    assert.ok(res.body.leadId)
  }
  assert.equal((await mock({})).body.leads.length, before)
})

test('POST /api/lead: a store failure is a 502, never a success', async () => {
  await mock({ leads: 'down' })
  const res = await handle('POST', '/api/lead', GOOD)
  await mock({ leads: 'up' })
  assert.equal(res.status, 502)
  assert.equal(res.body.leadId, undefined)
})

test('GET /api/availability: shape, and 503 when the calendar is down', async () => {
  const res = await handle('GET', '/api/availability')
  assert.equal(res.status, 200)
  assert.equal(res.body.timezone, 'Asia/Karachi')
  assert.equal(res.body.slotMinutes, 30)
  assert.match(res.body.days[0].date, /^\d{4}-\d{2}-\d{2}$/)
  assert.match(res.body.days[0].slots[0], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/)

  await mock({ calendar: 'down' })
  const down = await handle('GET', '/api/availability')
  await mock({ calendar: 'up' })
  assert.equal(down.status, 503)
  assert.deepEqual(down.body, { reason: 'calendar_unavailable' })
})

test('POST /api/book books the slot, marks the lead, and takes the slot out of availability', async () => {
  const leadId = await newLead()
  const start = await firstSlot()
  const res = await handle('POST', '/api/book', { leadId, start, email: 'attacker@example.com' })
  assert.equal(res.status, 200)
  assert.equal(res.body.start, start)
  assert.equal(Date.parse(res.body.end) - Date.parse(start), 30 * 60_000)
  assert.ok(res.body.meetLink)

  const stored = (await mock({})).body.leads.find((l) => l.id === leadId)
  assert.equal(stored.booked, true)
  assert.equal(stored.email, 'ada@techcorp.com')
  assert.notEqual(await firstSlot(), start)
})

test('POST /api/book: a lead with a call already booked is a 409', async () => {
  const leadId = await newLead()
  assert.equal((await handle('POST', '/api/book', { leadId, start: await firstSlot() })).status, 200)
  const again = await handle('POST', '/api/book', { leadId, start: await firstSlot() })
  assert.equal(again.status, 409)
  assert.equal(again.body.reason, 'already_booked')
})

test('POST /api/book: a slot someone else just took is a 409 slot_taken', async () => {
  const leadId = await newLead()
  const start = await firstSlot()
  await mock({ take: start })
  const res = await handle('POST', '/api/book', { leadId, start })
  assert.equal(res.status, 409)
  assert.equal(res.body.reason, 'slot_taken')
})

test('POST /api/book: a time the rules would never offer is slot_taken', async () => {
  const leadId = await newLead()
  for (const start of [new Date(Date.now() + 3_600_000).toISOString(), new Date(Date.parse(await firstSlot()) + 60_000).toISOString(), '2031-01-06T05:00:00.000Z']) {
    assert.equal((await handle('POST', '/api/book', { leadId, start })).body.reason, 'slot_taken', start)
  }
})

test('POST /api/book: unknown lead, bad input, calendar down', async () => {
  const start = await firstSlot()
  assert.equal((await handle('POST', '/api/book', { leadId: 'no-such-lead', start })).status, 404)
  assert.equal((await handle('POST', '/api/book', { leadId: 'x', start: 'tomorrow' })).status, 400)
  assert.equal((await handle('POST', '/api/book', { start })).status, 400)

  const leadId = await newLead()
  await mock({ calendar: 'down' })
  const res = await handle('POST', '/api/book', { leadId, start })
  await mock({ calendar: 'up' })
  assert.equal(res.status, 503)
  assert.equal(res.body.reason, 'calendar_unavailable')
  assert.equal((await mock({})).body.leads.find((l) => l.id === leadId).booked, false)
})

test('wrong method is a 405', async () => {
  assert.equal((await handle('GET', '/api/lead')).status, 405)
  assert.equal((await handle('POST', '/api/availability')).status, 405)
})

test('without BOOKING_MOCK=1, missing configuration is an error on every endpoint', async () => {
  delete process.env.BOOKING_MOCK
  const quiet = console.error
  console.error = () => {}
  try {
    assert.equal((await handle('POST', '/api/lead', GOOD)).status, 502)
    assert.equal((await handle('GET', '/api/availability')).status, 503)
    assert.equal((await handle('POST', '/api/book', { leadId: '0123456789abcdef0123456789abcdef', start: '2031-01-06T05:00:00.000Z' })).status, 502)
    assert.equal((await handle('POST', '/api/booking-mock', {})).status, 404)
    // Still a 400 for bad input and a silent drop for bots
    assert.equal((await handle('POST', '/api/lead', { ...GOOD, email: 'nope' })).status, 400)
    assert.equal((await handle('POST', '/api/lead', { ...GOOD, book_ref: 'x' })).status, 201)
  } finally {
    console.error = quiet
    process.env.BOOKING_MOCK = '1'
  }
})

test('BOOKING_MOCK is ignored in production: NODE_ENV (Docker) or VERCEL_ENV', async () => {
  const quiet = console.error
  console.error = () => {}
  try {
    for (const name of ['NODE_ENV', 'VERCEL_ENV']) {
      process.env[name] = 'production'
      assert.equal((await handle('POST', '/api/lead', GOOD)).status, 502, name)
      assert.equal((await handle('POST', '/api/booking-mock', {})).status, 404, name)
      delete process.env[name]
    }
  } finally {
    console.error = quiet
    delete process.env.NODE_ENV
    delete process.env.VERCEL_ENV
  }
})

test('POST /api/book retries the lead update once; a second failure is still a 200, logged', async () => {
  let leadId = await newLead()
  await mock({ markFails: 1 })
  assert.equal((await handle('POST', '/api/book', { leadId, start: await firstSlot() })).status, 200)
  assert.equal((await mock({})).body.leads.find((l) => l.id === leadId).booked, true)

  leadId = await newLead()
  await mock({ markFails: 2 })
  const logged = []
  const quiet = console.error
  console.error = (...a) => logged.push(a.join(' '))
  try {
    assert.equal((await handle('POST', '/api/book', { leadId, start: await firstSlot() })).status, 200)
  } finally {
    console.error = quiet
  }
  assert.equal((await mock({})).body.leads.find((l) => l.id === leadId).booked, false)
  assert.match(logged[0], /created but the Notion row was not updated/)
})

// The API end to end against the in-memory mock (BOOKING_MOCK=1), plus the
// rule that without the flag a missing backend is an error.
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.BOOKING_MOCK = '1'
for (const k of ['NOTION_TOKEN', 'VITE_NOTION_TOKEN', 'NOTION_LEADS_DB_ID', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'BOOKING_CALENDAR_ID', 'TURNSTILE_SECRET_KEY', 'VERCEL_ENV', 'NODE_ENV']) delete process.env[k]
const { handle } = await import('../lib/booking/handlers.js')

// Cloudflare's siteverify, stood in for: the token says what it answers.
// Mock mode checks tokens against Cloudflare's test secret, so without this
// the tests would need the network.
const realFetch = globalThis.fetch
let verifyCalls = 0
globalThis.fetch = async (url, init) => {
  if (!String(url).includes('/turnstile/v0/siteverify')) return realFetch(url, init)
  verifyCalls++
  const token = new URLSearchParams(init.body).get('response')
  if (token === 'cloudflare-down') throw new TypeError('fetch failed')
  const body = token === 'pass' ? { success: true }
    : token === 'spent' ? { success: false, 'error-codes': ['timeout-or-duplicate'] }
    : { success: false, 'error-codes': ['invalid-input-response'] }
  return new Response(JSON.stringify(body), { status: 200 })
}

const GOOD = {
  name: 'Ada Lovelace', title: 'VP Engineering', company: 'TechCorp LLC', email: 'ada@techcorp.com',
  challenge: 'Hiring takes too long', headcount: '2-5', timeline: 'ASAP', elapsedMs: 30_000, book_ref: '',
  captchaToken: 'pass',
}
const mock = (body) => handle('POST', '/api/booking-mock', body)
const newLead = async () => (await handle('POST', '/api/lead', GOOD)).body.leadId
const firstSlot = async () => (await handle('GET', '/api/availability')).body.days[0].slots[0]

test('POST /api/lead stores the lead and returns its id', async () => {
  const res = await handle('POST', '/api/lead', GOOD)
  assert.equal(res.status, 201)
  assert.equal(res.body.verified, true)
  const stored = (await mock({})).body.leads.find((l) => l.id === res.body.leadId)
  assert.equal(stored.email, 'ada@techcorp.com')
  assert.equal(stored.booked, false)
  assert.equal(stored.unverified, false)
  assert.equal(stored.captchaToken, undefined) // the token is never stored
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

// ── Captcha ──
const quietly = async (fn) => {
  const quiet = console.error
  console.error = () => {}
  try { return await fn() } finally { console.error = quiet }
}

test('POST /api/lead: a lead that fails the captcha is still saved, as unverified', async () => {
  for (const [why, captchaToken] of [['no token', undefined], ['empty token', ''], ['rejected', 'nonsense'], ['already spent', 'spent'], ['Cloudflare unreachable', 'cloudflare-down']]) {
    const res = await quietly(() => handle('POST', '/api/lead', { ...GOOD, captchaToken }))
    assert.equal(res.status, 201, why)
    assert.equal(res.body.verified, false, why)
    const stored = (await mock({})).body.leads.find((l) => l.id === res.body.leadId)
    assert.equal(stored.email, 'ada@techcorp.com', why)
    assert.equal(stored.unverified, true, why)
  }
})

test('POST /api/lead: bad input and bots are decided before the captcha is asked', async () => {
  const before = verifyCalls
  assert.equal((await handle('POST', '/api/lead', { ...GOOD, email: 'nope' })).status, 400)
  const bot = await handle('POST', '/api/lead', { ...GOOD, book_ref: 'x' })
  assert.deepEqual(Object.keys(bot.body).sort(), ['leadId', 'verified'])
  assert.equal(bot.body.verified, true) // a bot can't tell it was dropped
  assert.equal(verifyCalls, before)
})

test('POST /api/book refuses an unverified lead: 403 unverified, no event, no slot taken', async () => {
  const { leadId } = (await quietly(() => handle('POST', '/api/lead', { ...GOOD, captchaToken: undefined }))).body
  const start = await firstSlot()
  const res = await handle('POST', '/api/book', { leadId, start })
  assert.equal(res.status, 403)
  assert.deepEqual(res.body, { reason: 'unverified' })
  const stored = (await mock({})).body.leads.find((l) => l.id === leadId)
  assert.equal(stored.booked, false)
  assert.equal(await firstSlot(), start) // still on offer
})

test('with no captcha secret on the server nothing is enforced: no token needed, the lead can book', async (t) => {
  t.mock.method(console, 'warn', () => {})
  await mock({ captcha: 'off' })
  try {
    const before = verifyCalls
    const res = await handle('POST', '/api/lead', { ...GOOD, captchaToken: undefined })
    assert.equal(res.status, 201)
    assert.equal(res.body.verified, true)
    assert.equal(verifyCalls, before)
    assert.equal((await handle('POST', '/api/book', { leadId: res.body.leadId, start: await firstSlot() })).status, 200)
  } finally {
    await mock({ captcha: 'on' })
  }
})

test('POST /api/lead: a secret Cloudflare refuses does not stop bookings', async (t) => {
  const error = t.mock.method(console, 'error', () => {})
  const stub = globalThis.fetch
  globalThis.fetch = async (url, init) => String(url).includes('/turnstile/v0/siteverify')
    ? new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-secret'] }), { status: 200 })
    : stub(url, init)
  try {
    const res = await handle('POST', '/api/lead', GOOD)
    assert.equal(res.body.verified, true)
    assert.equal((await handle('POST', '/api/book', { leadId: res.body.leadId, start: await firstSlot() })).status, 200)
    assert.match(error.mock.calls[0].arguments[0], /Cloudflare refused TURNSTILE_SECRET_KEY/)
  } finally {
    globalThis.fetch = stub
  }
})

test('on the mock, a real TURNSTILE_SECRET_KEY in the environment is not the one sent to Cloudflare', async () => {
  let sent
  const stub = globalThis.fetch
  globalThis.fetch = async (url, init) => { sent = new URLSearchParams(init.body).get('secret'); return stub(url, init) }
  process.env.TURNSTILE_SECRET_KEY = 'configured-secret'
  try {
    assert.equal((await handle('POST', '/api/lead', GOOD)).body.verified, true)
    assert.equal(sent, '1x0000000000000000000000000000000AA')
  } finally {
    delete process.env.TURNSTILE_SECRET_KEY
    globalThis.fetch = stub
  }
})

// ── Confirmation email ──
const emails = async () => (await mock({})).body.emails

test('POST /api/book emails the confirmation once, to the lead\'s own address, with the time in the zone the client picked', async () => {
  const leadId = await newLead()
  const start = await firstSlot()
  const before = (await emails()).length
  const res = await handle('POST', '/api/book', { leadId, start, email: 'attacker@example.com', zone: 'America/New_York', hour12: true })
  assert.equal(res.status, 200)
  assert.deepEqual(Object.keys(res.body).sort(), ['end', 'meetLink', 'start'])

  const sent = (await emails()).slice(before)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].to, 'ada@techcorp.com')
  assert.ok(sent[0].subject.startsWith("You're booked, Ada."), sent[0].subject)
  // Newer ICU puts a narrow no-break space before AM/PM; the email uses a plain one
  const time = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(start)).replace(/[  ]/g, ' ')
  assert.ok(sent[0].subject.includes(time), sent[0].subject + ' should contain ' + time)
  assert.ok(sent[0].text.includes(time))
  assert.ok(sent[0].htmlBytes > 0)
})

test('POST /api/book: hour12 false gives a 24-hour time in the subject', async () => {
  const leadId = await newLead()
  const start = await firstSlot()
  assert.equal((await handle('POST', '/api/book', { leadId, start, zone: 'America/New_York', hour12: false })).status, 200)
  const { subject } = (await emails()).at(-1)
  const time = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).format(new Date(start))
  assert.ok(subject.endsWith(' at ' + time), subject)
  assert.doesNotMatch(subject, /AM|PM/)
})

test('POST /api/book: a missing or invalid zone falls back to the host zone', async () => {
  for (const zone of [undefined, 'Not/AZone', 42]) {
    const leadId = await newLead()
    assert.equal((await handle('POST', '/api/book', { leadId, start: await firstSlot(), zone })).status, 200, String(zone))
    assert.match((await emails()).at(-1).text, /Karachi/, String(zone))
  }
})

test('POST /api/book: a confirmation email that fails to send is logged and the booking still stands', async (t) => {
  const error = t.mock.method(console, 'error', () => {})
  const leadId = await newLead()
  const before = (await emails()).length
  await mock({ mail: 'down' })
  let res
  try {
    res = await handle('POST', '/api/book', { leadId, start: await firstSlot() })
  } finally {
    await mock({ mail: 'up' })
  }
  assert.equal(res.status, 200)
  assert.ok(res.body.meetLink)
  assert.equal((await mock({})).body.leads.find((l) => l.id === leadId).booked, true)
  assert.match(error.mock.calls[0].arguments[0], /confirmation email not sent/)
  assert.equal((await emails()).length, before)
})

test('POST /api/book: no confirmation email for a booking that was refused', async () => {
  const booked = await newLead()
  assert.equal((await handle('POST', '/api/book', { leadId: booked, start: await firstSlot() })).status, 200)
  const before = (await emails()).length

  const again = await handle('POST', '/api/book', { leadId: booked, start: await firstSlot() })
  assert.equal(again.body.reason, 'already_booked')

  const start = await firstSlot()
  await mock({ take: start })
  const taken = await handle('POST', '/api/book', { leadId: await newLead(), start })
  assert.equal(taken.body.reason, 'slot_taken')

  const { leadId } = (await quietly(() => handle('POST', '/api/lead', { ...GOOD, captchaToken: undefined }))).body
  const refused = await handle('POST', '/api/book', { leadId, start: await firstSlot() })
  assert.equal(refused.body.reason, 'unverified')

  assert.equal((await emails()).length, before)
})

test('POST /api/book: the confirmation email carries its eight images inside the message', async () => {
  const leadId = await newLead()
  assert.equal((await handle('POST', '/api/book', { leadId, start: await firstSlot() })).status, 200)
  const { inline } = (await emails()).at(-1)
  assert.equal(inline.length, 8)
  assert.equal(new Set(inline).size, 8)
  for (const cid of inline) assert.ok(cid.endsWith('@email.tethrhq.com'), cid)
})

test('POST /api/lead: a personal email address is a 400 and nothing is stored', async () => {
  const before = (await mock({})).body.leads.length
  const res = await handle('POST', '/api/lead', { ...GOOD, email: 'someone@gmail.com' })
  assert.equal(res.status, 400)
  assert.equal(res.body.fields.email, 'Use your work email address.')
  assert.equal((await mock({})).body.leads.length, before)
})

// ── One email: Google quiet, the invite in the confirmation ──
const callsFor = async (leadId) => (await mock({})).body.calendarCalls.filter((c) => c.eventId === leadId.replace(/-/g, ''))

test('POST /api/book with mail configured: the event is created with sendUpdates none and Google is not asked to send anything', async () => {
  const leadId = await newLead()
  assert.equal((await handle('POST', '/api/book', { leadId, start: await firstSlot() })).status, 200)
  const calls = await callsFor(leadId)
  // The one patch after the insert only records the confirmation on the event
  assert.deepEqual(calls.map((c) => [c.op, c.sendUpdates]), [['insert', 'none'], ['patch', 'none']])
  assert.deepEqual(calls[0].attendees, [{ email: 'ada@techcorp.com', displayName: 'Ada Lovelace' }])
  assert.equal(calls[1].attendees, undefined)
})

test('POST /api/book: the confirmation carries the invite for the created event', async () => {
  const leadId = await newLead()
  const start = await firstSlot()
  assert.equal((await handle('POST', '/api/book', { leadId, start })).status, 200)
  const { invite, to } = (await emails()).at(-1)
  assert.equal(to, 'ada@techcorp.com')
  const lines = invite.replace(/\r\n /g, '').split('\r\n')
  assert.ok(lines.includes('METHOD:REQUEST'))
  assert.ok(lines.includes(`UID:${leadId.replace(/-/g, '')}@google.com`))
  assert.ok(lines.includes(`DTSTART:${start.replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`))
  assert.ok(lines.includes('SUMMARY:Intro call: TechCorp LLC and Tethr'))
  assert.ok(lines.some((l) => /^ATTENDEE;CN="Ada Lovelace";.*PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:ada@techcorp\.com$/.test(l)))
  assert.ok(lines.some((l) => /^ATTENDEE;.*PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:calendar@example\.com$/.test(l)))
})

test('POST /api/book: a confirmation that fails has Google send its invite: two patches, none then all; still booked', async (t) => {
  const error = t.mock.method(console, 'error', () => {})
  const leadId = await newLead()
  await mock({ mail: 'down' })
  let res
  try {
    res = await handle('POST', '/api/book', { leadId, start: await firstSlot() })
  } finally {
    await mock({ mail: 'up' })
  }
  assert.equal(res.status, 200)
  assert.equal((await mock({})).body.leads.find((l) => l.id === leadId).booked, true)
  const calls = await callsFor(leadId)
  assert.deepEqual(calls.map((c) => [c.op, c.sendUpdates]), [['insert', 'none'], ['patch', 'none'], ['patch', 'all']])
  assert.deepEqual(calls[1].attendees, [])
  assert.deepEqual(calls[2].attendees, calls[0].attendees)
  assert.match(error.mock.calls[0].arguments[0], /confirmation email not sent/)
})

test('POST /api/book: if Google cannot be made to send its invite either, that is logged and the booking stands', async (t) => {
  const error = t.mock.method(console, 'error', () => {})
  const leadId = await newLead()
  await mock({ mail: 'down', patch: 'down' })
  let res
  try {
    res = await handle('POST', '/api/book', { leadId, start: await firstSlot() })
  } finally {
    await mock({ mail: 'up', patch: 'up' })
  }
  assert.equal(res.status, 200)
  assert.ok(res.body.meetLink)
  const logged = error.mock.calls.map((c) => c.arguments[0])
  assert.ok(logged.some((m) => /created but the client got no email/.test(m)), logged.join('\n'))
})

test('POST /api/book with no mail configured: Google sends its invite at insert, no patches, no email', async () => {
  const leadId = await newLead()
  const before = (await emails()).length
  await mock({ mail: 'off' })
  let res
  try {
    res = await handle('POST', '/api/book', { leadId, start: await firstSlot() })
  } finally {
    await mock({ mail: 'on' })
  }
  assert.equal(res.status, 200)
  assert.deepEqual((await callsFor(leadId)).map((c) => [c.op, c.sendUpdates]), [['insert', 'all']])
  assert.equal((await emails()).length, before)
})

// ── What the reminder needs, kept on the event ──

test('POST /api/book: the insert carries the reminder\'s private properties, with the zone and clock of the request', async () => {
  const leadId = await newLead()
  const start = await firstSlot()
  assert.equal((await handle('POST', '/api/book', { leadId, start, zone: 'America/New_York', hour12: false })).status, 200)
  const [insert] = await callsFor(leadId)
  assert.equal(insert.op, 'insert')
  assert.deepEqual(insert.private, { tethrBooking: '1', zone: 'America/New_York', clock: '24h', bookedStart: start })

  // Without them, the confirmation's own defaults: the host zone, a 12-hour clock
  const other = await newLead()
  const next = await firstSlot()
  assert.equal((await handle('POST', '/api/book', { leadId: other, start: next })).status, 200)
  assert.deepEqual((await callsFor(other))[0].private, { tethrBooking: '1', zone: 'Asia/Karachi', clock: '12h', bookedStart: next })
})

test('POST /api/book: the confirmation sets its own Message-ID', async () => {
  const leadId = await newLead()
  assert.equal((await handle('POST', '/api/book', { leadId, start: await firstSlot() })).status, 200)
  const { messageId } = (await emails()).at(-1)
  // No BOOKING_CALENDAR_ID here, so no From address to take a domain from
  assert.match(messageId, new RegExp(`^<confirm\\.${leadId.replace(/-/g, '')}\\.[0-9a-z]+@tethrhq\\.com>$`))
})

test('POST /api/book: once the confirmation is sent, its id, thread and subject are patched onto the event, guests not told', async () => {
  const leadId = await newLead()
  const start = await firstSlot()
  assert.equal((await handle('POST', '/api/book', { leadId, start })).status, 200)
  const email = (await emails()).at(-1)
  const [insert, patch] = await callsFor(leadId)
  assert.equal(patch.op, 'patch')
  assert.equal(patch.sendUpdates, 'none')
  assert.deepEqual(patch.private, {
    ...insert.private,
    confirmMessageId: email.messageId,
    confirmThreadId: `mock-thread-${(await emails()).length}`,
    confirmSubject: email.subject,
  })
  const event = (await mock({})).body.events.find((e) => e.eventId === leadId.replace(/-/g, ''))
  assert.deepEqual(event.private, patch.private)
})

test('POST /api/book: if recording the confirmation fails, that is logged and the booking is still a 200', async (t) => {
  const error = t.mock.method(console, 'error', () => {})
  const leadId = await newLead()
  await mock({ properties: 'down' })
  let res
  try {
    res = await handle('POST', '/api/book', { leadId, start: await firstSlot() })
  } finally {
    await mock({ properties: 'up' })
  }
  assert.equal(res.status, 200)
  assert.ok(res.body.meetLink)
  assert.equal((await mock({})).body.leads.find((l) => l.id === leadId).booked, true)
  // Nothing else happens: Google is not asked to send its invite
  assert.deepEqual((await callsFor(leadId)).map((c) => c.op), ['insert'])
  const logged = error.mock.calls.map((c) => c.arguments[0])
  assert.ok(logged.some((m) => /confirmation was not recorded/.test(m)), logged.join('\n'))
})

test('POST /api/book: no confirmation sent, nothing recorded about it', async (t) => {
  t.mock.method(console, 'error', () => {})
  const leadId = await newLead()
  await mock({ mail: 'down' })
  try {
    assert.equal((await handle('POST', '/api/book', { leadId, start: await firstSlot() })).status, 200)
  } finally {
    await mock({ mail: 'up' })
  }
  const event = (await mock({})).body.events.find((e) => e.eventId === leadId.replace(/-/g, ''))
  assert.equal(event.private.confirmMessageId, undefined)
})

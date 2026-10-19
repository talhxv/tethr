// GET /api/reminders end to end against the in-memory mock (BOOKING_MOCK=1):
// the sweep's timing rules, the claim, threading, auth and test mode.
// Nothing here reaches Google or Gmail.
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.BOOKING_MOCK = '1'
for (const k of ['NOTION_TOKEN', 'VITE_NOTION_TOKEN', 'NOTION_LEADS_DB_ID', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'BOOKING_CALENDAR_ID', 'TURNSTILE_SECRET_KEY', 'VERCEL_ENV', 'NODE_ENV', 'BOOKING_EMAIL_FROM']) delete process.env[k]
const SECRET = 'test-cron-secret-0123456789abcdef'
process.env.CRON_SECRET = SECRET
const { handle } = await import('../lib/booking/handlers.js')
const mockBackend = await import('../lib/booking/mock.js')
const { authorized, skipReason, threadingOf } = await import('../lib/booking/reminders.js')

// Cloudflare's siteverify, for the one test that books through the form's path
const realFetch = globalThis.fetch
globalThis.fetch = async (url, init) => String(url).includes('/turnstile/v0/siteverify')
  ? new Response(JSON.stringify({ success: true }), { status: 200 })
  : realFetch(url, init)

const MIN = 60_000
const HOUR = 60 * MIN
const MEET = 'https://meet.google.com/abc-defg-hij'
const HOST = { email: 'calendar@example.com', displayName: '', responseStatus: 'accepted', organizer: true, self: true }

const mock = (body) => handle('POST', '/api/booking-mock', body)
const run = ({ auth = `Bearer ${SECRET}`, query = {} } = {}) =>
  handle('GET', '/api/reminders', null, { headers: auth === null ? {} : { authorization: auth }, query })
const state = async () => (await mock({})).body
const eventOf = async (eventId) => (await state()).events.find((e) => e.eventId === eventId)
const callsFor = async (eventId) => (await state()).calendarCalls.filter((c) => c.eventId === eventId)
const emailsTo = async (to) => (await state()).emails.filter((e) => e.to === to)
const quietly = async (fn) => {
  const quiet = console.error
  console.error = () => {}
  try { return await fn() } finally { console.error = quiet }
}

/* A booked call on the stand-in calendar, `minutes` from now, booked
   `bookedHoursBefore` hours before it starts. Each gets its own client
   address, so a test only looks at its own email. */
let n = 0
async function booking({ minutes = 60, bookedHoursBefore = 48, response = 'needsAction', props = {}, email, meetLink = MEET } = {}) {
  n++
  const eventId = `rem${n}t${Date.now().toString(36)}`
  const startMs = Date.now() + minutes * MIN
  const start = new Date(startMs).toISOString()
  const client = { email: email ?? `client${n}@acme-example.com`, displayName: 'Jane Doe', responseStatus: response, organizer: false, self: false }
  await mock({
    event: {
      eventId, start, end: new Date(startMs + 30 * MIN).toISOString(), created: new Date(startMs - bookedHoursBefore * HOUR).toISOString(), meetLink,
      attendees: [HOST, client],
      private: { tethrBooking: '1', zone: 'Asia/Karachi', clock: '12h', bookedStart: start, ...props },
    },
  })
  return { eventId, start, client }
}
const CONFIRMED = (overrides = {}) => ({
  confirmMessageId: '<confirm.abc.mgz1@tethrhq.com>', confirmThreadId: 'thread-abc',
  confirmSubject: "You're booked, Jane. Tuesday, October 20 at 3:00 PM", ...overrides,
})
const skippedFor = (body, eventId) => body.skipped.find((s) => s.eventId === eventId)?.reason

// ── The sweep ──

test('a due call is claimed before its reminder is sent, and sent once', async (t) => {
  const { eventId, client } = await booking({ minutes: 60 })
  const send = mockBackend.mail.send
  let claimAtSend
  t.mock.method(mockBackend.mail, 'send', async function (message) {
    if (message.to === client.email) claimAtSend = (await eventOf(eventId)).private.reminderSentAt
    return send.call(this, message)
  })

  const first = await run()
  assert.equal(first.status, 200)
  assert.ok(first.body.sent.includes(eventId))
  assert.match(claimAtSend, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  const calls = await callsFor(eventId)
  assert.deepEqual(calls.map((c) => [c.op, c.sendUpdates]), [['patch', 'none']])
  // The whole map goes with the claim
  assert.deepEqual(Object.keys(calls[0].private).sort(), ['bookedStart', 'clock', 'reminderSentAt', 'tethrBooking', 'zone'])

  const second = await run()
  assert.equal(second.status, 200)
  assert.equal(second.body.sent.includes(eventId), false)
  assert.equal(skippedFor(second.body, eventId), 'already_sent')
  assert.equal((await emailsTo(client.email)).length, 1)
  assert.equal((await callsFor(eventId)).length, 1)
})

test('the listing: the next two hours by end time, tagged, single events, soonest first', async () => {
  const before = Date.now()
  await run()
  const list = (await state()).calendarCalls.filter((c) => c.op === 'list').at(-1)
  assert.equal(Date.parse(list.timeMax) - Date.parse(list.timeMin), 120 * MIN)
  assert.ok(Date.parse(list.timeMin) >= before - 1000)
  assert.equal(list.singleEvents, true)
  assert.equal(list.orderBy, 'startTime')
  assert.equal(list.privateExtendedProperty, 'tethrBooking=1')
})

test('a call 2h30m away is not sent yet', async () => {
  const { eventId, client } = await booking({ minutes: 150 })
  const res = await run()
  assert.equal(res.body.sent.includes(eventId), false)
  assert.equal(skippedFor(res.body, eventId), undefined) // not even listed
  assert.equal((await emailsTo(client.email)).length, 0)
  assert.equal((await eventOf(eventId)).private.reminderSentAt, undefined)
})

test('a call 10 minutes away is skipped, and so is one already under way', async () => {
  const soon = await booking({ minutes: 10 })
  const started = await booking({ minutes: -5 })
  const res = await run()
  assert.equal(skippedFor(res.body, soon.eventId), 'starts_too_soon')
  assert.equal(skippedFor(res.body, started.eventId), 'starts_too_soon')
  assert.equal((await emailsTo(soon.client.email)).length, 0)
  assert.equal((await emailsTo(started.client.email)).length, 0)
  assert.deepEqual(await callsFor(soon.eventId), [])
  assert.deepEqual(await callsFor(started.eventId), [])
})

test('a call booked 6 hours before it starts gets no reminder', async () => {
  const { eventId, client } = await booking({ minutes: 60, bookedHoursBefore: 6 })
  const res = await run()
  assert.equal(skippedFor(res.body, eventId), 'short_notice')
  assert.equal((await emailsTo(client.email)).length, 0)
})

test('a client who declined gets no reminder', async () => {
  const { eventId, client } = await booking({ minutes: 60, response: 'declined' })
  const res = await run()
  assert.equal(skippedFor(res.body, eventId), 'declined')
  assert.equal((await emailsTo(client.email)).length, 0)
  assert.deepEqual(await callsFor(eventId), [])
})

test('a send that fails clears the claim, answers 502, and the next run sends it', async () => {
  const { eventId, client } = await booking({ minutes: 60 })
  await mock({ mail: 'down' })
  let failed
  try {
    failed = await quietly(() => run())
  } finally {
    await mock({ mail: 'up' })
  }
  assert.equal(failed.status, 502)
  assert.equal(skippedFor(failed.body, eventId), 'send_failed')
  const calls = await callsFor(eventId)
  assert.equal(calls.length, 2)
  assert.ok(calls[0].private.reminderSentAt)
  assert.equal(calls[1].private.reminderSentAt, '')
  assert.equal((await eventOf(eventId)).private.reminderSentAt, '')

  const retry = await run()
  assert.equal(retry.status, 200)
  assert.ok(retry.body.sent.includes(eventId))
  assert.equal((await emailsTo(client.email)).length, 1)
})

test('in the thread when the confirmation was recorded and the call has not moved', async () => {
  const { client } = await booking({ minutes: 60, props: CONFIRMED() })
  await run()
  const [email] = await emailsTo(client.email)
  assert.equal(email.threadId, 'thread-abc')
  assert.equal(email.inReplyTo, '<confirm.abc.mgz1@tethrhq.com>')
  assert.equal(email.references, '<confirm.abc.mgz1@tethrhq.com>')
  assert.equal(email.subject, "Re: You're booked, Jane. Tuesday, October 20 at 3:00 PM")
  assert.equal(email.invite, '')
  assert.match(email.text, /^See you at \d{1,2}:\d{2} [AP]M, Jane\./)
})

test('on its own when the confirmation was not recorded, or the call was moved', async () => {
  const unrecorded = await booking({ minutes: 60 })
  const partly = await booking({ minutes: 60, props: CONFIRMED({ confirmThreadId: '' }) })
  // Moved in Google Calendar: the start is no longer the one booked
  const moved = await booking({ minutes: 70, props: CONFIRMED({ bookedStart: new Date(Date.now() + 26 * HOUR).toISOString() }) })
  await run()
  for (const { client } of [unrecorded, partly, moved]) {
    const [email] = await emailsTo(client.email)
    assert.ok(email, client.email)
    assert.equal(email.threadId, '')
    assert.equal(email.inReplyTo, '')
    assert.equal(email.references, '')
    assert.match(email.subject, /^(Today|Tomorrow) at \d{1,2}:\d{2} [AP]M: your call with Tethr$/)
  }
})

test('the same instant written two ways is not a move', () => {
  const start = '2026-10-20T10:00:00.000Z'
  const event = { start, private: { ...CONFIRMED(), bookedStart: '2026-10-20T15:00:00+05:00' } }
  assert.equal(threadingOf(event).threadId, 'thread-abc')
  assert.equal(threadingOf({ ...event, start: '2026-10-20T10:30:00.000Z' }), null)
})

test('the timing rules at their edges', () => {
  const now = Date.parse('2026-10-20T08:00:00.000Z')
  const at = (minutes, extra = {}) => ({
    start: new Date(now + minutes * MIN).toISOString(), created: new Date(now - 48 * HOUR).toISOString(),
    attendees: [HOST, { email: 'jane@acme-example.com', responseStatus: 'accepted' }], private: {}, ...extra,
  })
  assert.equal(skipReason(at(15), now), 'starts_too_soon')
  assert.equal(skipReason(at(15.01), now), '')
  assert.equal(skipReason(at(120), now), '')
  assert.equal(skipReason(at(121), now), 'not_due_yet')
  assert.equal(skipReason(at(60, { private: { reminderSentAt: '2026-10-20T07:50:00.000Z' } }), now), 'already_sent')
  assert.equal(skipReason(at(60, { private: { reminderSentAt: '' } }), now), '')
  // Exactly 12 hours' notice is enough; a minute less is not
  assert.equal(skipReason(at(60, { created: new Date(now + 60 * MIN - 12 * HOUR).toISOString() }), now), '')
  assert.equal(skipReason(at(60, { created: new Date(now + 61 * MIN - 12 * HOUR).toISOString() }), now), 'short_notice')
  assert.equal(skipReason(at(60, { attendees: [HOST] }), now), 'no_client')
})

test('events without the tag are never touched', async () => {
  n++
  const start = new Date(Date.now() + 60 * MIN).toISOString()
  await mock({ event: { eventId: `untagged${n}`, start, attendees: [HOST, { email: 'old@acme-example.com', responseStatus: 'accepted' }], private: {} } })
  const res = await run()
  assert.equal(skippedFor(res.body, `untagged${n}`), undefined)
  assert.equal(res.body.sent.includes(`untagged${n}`), false)
  assert.equal((await emailsTo('old@acme-example.com')).length, 0)
})

test('the answer names no client', async () => {
  await booking({ minutes: 60, props: CONFIRMED() })
  await booking({ minutes: 60, response: 'declined' })
  const res = await run()
  assert.deepEqual(Object.keys(res.body).sort(), ['checked', 'sent', 'skipped'])
  assert.ok(res.body.checked >= 2)
  const text = JSON.stringify(res.body)
  assert.equal(text.includes('@'), false, text)
  assert.equal(text.includes('Jane'), false, text)
})

// ── Auth ──

test('auth: 503 without CRON_SECRET, 401 without the right token, 200 with it', async () => {
  delete process.env.CRON_SECRET
  try {
    const off = await quietly(() => run())
    assert.equal(off.status, 503)
    assert.deepEqual(off.body, { reason: 'reminders_unavailable' })
  } finally {
    process.env.CRON_SECRET = SECRET
  }
  for (const auth of [null, '', 'Bearer wrong', `Bearer ${SECRET}x`, SECRET, `bearer ${SECRET}`, `Basic ${SECRET}`]) {
    const res = await run({ auth })
    assert.equal(res.status, 401, String(auth))
    assert.deepEqual(res.body, { error: 'unauthorized' })
  }
  assert.equal((await run()).status, 200)
  // The header as Node's raw headers object may spell it
  assert.equal((await handle('GET', '/api/reminders', null, { headers: { Authorization: `Bearer ${SECRET}` } })).status, 200)
})

test('auth: 503 when there is no mail to send with', async () => {
  await mock({ mail: 'off' })
  try {
    assert.equal((await quietly(() => run())).status, 503)
  } finally {
    await mock({ mail: 'on' })
  }
})

test('authorized: exact match only, and never without a secret', () => {
  assert.equal(authorized(`Bearer ${SECRET}`, SECRET), true)
  assert.equal(authorized(`Bearer ${SECRET}`, ''), false)
  assert.equal(authorized('Bearer ', ''), false)
  assert.equal(authorized(undefined, SECRET), false)
  assert.equal(authorized(`Bearer ${SECRET} `, SECRET), false)
})

test('other methods are a 405', async () => {
  assert.equal((await handle('POST', '/api/reminders', {}, { headers: { authorization: `Bearer ${SECRET}` } })).status, 405)
})

test('the calendar being down is a 503', async () => {
  await mock({ calendar: 'down' })
  try {
    const res = await quietly(() => run())
    assert.equal(res.status, 503)
    assert.deepEqual(res.body, { reason: 'calendar_unavailable' })
  } finally {
    await mock({ calendar: 'up' })
  }
})

// ── Test mode ──

test('test mode sends the soonest matching call now, without claiming it', async () => {
  const email = `owner${Date.now()}@acme-example.com`
  // Days away and already claimed: test mode ignores both
  const soonest = await booking({ minutes: 3 * 24 * 60, email, props: { ...CONFIRMED(), reminderSentAt: '2026-10-01T00:00:00.000Z' } })
  const later = await booking({ minutes: 5 * 24 * 60, email })
  const res = await run({ query: { test: email.toUpperCase() } })
  assert.equal(res.status, 200)
  assert.deepEqual(res.body.sent, [soonest.eventId])
  assert.equal(JSON.stringify(res.body).includes('@'), false)

  const sent = await emailsTo(email)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].threadId, 'thread-abc')
  assert.equal(sent[0].subject, `Re: ${CONFIRMED().confirmSubject}`)
  assert.deepEqual(await callsFor(soonest.eventId), [])
  assert.deepEqual(await callsFor(later.eventId), [])
  assert.equal((await eventOf(soonest.eventId)).private.reminderSentAt, '2026-10-01T00:00:00.000Z')
})

test('test mode: 404 for an address with no booked call; the same auth', async () => {
  const res = await run({ query: { test: 'nobody@nowhere-example.com' } })
  assert.equal(res.status, 404)
  assert.deepEqual(res.body, { reason: 'no_matching_event' })
  assert.equal((await run({ query: { test: '' } })).status, 404)
  assert.equal((await run({ auth: 'Bearer wrong', query: { test: 'nobody@nowhere-example.com' } })).status, 401)
})

test('end to end: a call booked on the form is reminded in its confirmation\'s thread', async () => {
  const lead = {
    name: 'Grace Hopper', title: 'CTO', company: 'Hopper Labs', email: 'grace@hopper-labs-example.com',
    challenge: 'Hiring takes too long', headcount: '1', timeline: 'ASAP', elapsedMs: 30_000, book_ref: '', captchaToken: 'pass',
  }
  const { leadId } = (await handle('POST', '/api/lead', lead)).body
  const start = (await handle('GET', '/api/availability')).body.days[0].slots[0]
  assert.equal((await handle('POST', '/api/book', { leadId, start, zone: 'Europe/London', hour12: false })).status, 200)
  const [confirmation] = await emailsTo(lead.email)

  const res = await run({ query: { test: lead.email } })
  assert.equal(res.status, 200)
  const [, reminder] = await emailsTo(lead.email)
  assert.equal(reminder.subject, `Re: ${confirmation.subject}`)
  assert.equal(reminder.inReplyTo, confirmation.messageId)
  assert.equal(reminder.references, confirmation.messageId)
  assert.match(reminder.threadId, /^mock-thread-/)
  assert.equal(reminder.invite, '')
  // The zone and clock the client booked with
  assert.match(reminder.text, /^See you at \d{2}:\d{2}, Grace\./)
  assert.match(reminder.text, /London/)
})

// ── The claim holds ──

test('a call another run claimed after this one listed it: 412, claimed_elsewhere, nothing sent, not a failure', async (t) => {
  const { eventId, client } = await booking({ minutes: 60 })
  const list = mockBackend.calendar.listBookings
  // The other host's claim lands between this run's listing and its own claim
  t.mock.method(mockBackend.calendar, 'listBookings', async function (range) {
    const events = await list.call(this, range)
    const listed = events.find((e) => e.eventId === eventId)
    if (listed) await mockBackend.calendar.patchPrivate({ eventId, properties: { ...listed.private, reminderSentAt: '2026-10-20T07:59:00.000Z' }, etag: listed.etag })
    return events
  })
  const res = await run()
  assert.equal(res.status, 200)
  assert.equal(skippedFor(res.body, eventId), 'claimed_elsewhere')
  assert.equal(res.body.sent.includes(eventId), false)
  assert.equal((await emailsTo(client.email)).length, 0)
  const calls = await callsFor(eventId)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].refused, 412)
  assert.equal(calls[1].ifMatch, calls[0].ifMatch) // both claimed against the etag that was listed
  // The other host's claim stands
  assert.equal((await eventOf(eventId)).private.reminderSentAt, '2026-10-20T07:59:00.000Z')
})

test('every write gives the event a new etag, and the claim is sent against the listed one', async () => {
  const { eventId } = await booking({ minutes: 60 })
  const before = (await eventOf(eventId)).etag
  await run()
  const [claim] = await callsFor(eventId)
  assert.equal(claim.ifMatch, before)
  assert.notEqual((await eventOf(eventId)).etag, before)
})

test('a claim that does not stick is claim_failed: nothing sent, logged, 502', async (t) => {
  const error = t.mock.method(console, 'error', () => {})
  const { eventId, client } = await booking({ minutes: 60 })
  await mock({ properties: 'ignored' })
  let res
  try {
    res = await run()
  } finally {
    await mock({ properties: 'up' })
  }
  assert.equal(res.status, 502)
  assert.equal(skippedFor(res.body, eventId), 'claim_failed')
  assert.equal((await emailsTo(client.email)).length, 0)
  const logged = error.mock.calls.map((c) => c.arguments[0])
  assert.ok(logged.some((m) => new RegExp(`${eventId} claim did not stick`).test(m)), logged.join('\n'))

  // Once claims stick again, the next run sends it, once
  const retry = await run()
  assert.ok(retry.body.sent.includes(eventId))
  assert.equal((await emailsTo(client.email)).length, 1)
})

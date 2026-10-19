// The Calendar writes lib/booking/google.js makes, against a stubbed fetch:
// nothing here reaches Google.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'

const ENV = { GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', GOOGLE_REFRESH_TOKEN: 'test-refresh', BOOKING_CALENDAR_ID: 'hr@tethrhq.com' }
const savedEnv = Object.fromEntries(Object.keys(ENV).map((k) => [k, process.env[k]]))
Object.assign(process.env, ENV)
const { createEvent, sendGoogleInvite, patchPrivate, listBookings } = await import('../lib/booking/google.js')

const realFetch = globalThis.fetch
const calls = []
let answer = () => ({})
// The status Google answers the next calendar call with
let status = 200
globalThis.fetch = async (url, init = {}) => {
  if (String(url) === 'https://oauth2.googleapis.com/token') {
    return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }), { status: 200 })
  }
  if (String(url).startsWith('https://www.googleapis.com/calendar/v3/')) {
    const u = new URL(url)
    const body = init.body ? JSON.parse(init.body) : undefined
    calls.push({ method: init.method ?? 'GET', path: u.pathname, query: Object.fromEntries(u.searchParams), body, headers: { ...init.headers } })
    const code = status
    status = 200
    return new Response(JSON.stringify(code === 200 ? answer(body) : { error: { code, message: 'Precondition Failed' } }), { status: code })
  }
  throw new Error(`Unexpected request to ${url}`)
}
after(() => {
  globalThis.fetch = realFetch
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

const LEAD = { id: 'ABCD-1234', name: 'Jane Doe', email: 'jane@acme-example.com', company: 'Acme' }
const START = '2026-10-21T10:00:00.000Z'
const END = '2026-10-21T10:30:00.000Z'

// What Google answers an insert with, trimmed to the fields that matter
const created = (body) => ({
  id: body.id, iCalUID: `${body.id}@google.com`, sequence: 0, status: 'confirmed',
  summary: body.summary, description: body.description,
  start: { dateTime: '2026-10-21T15:00:00+05:00' }, end: { dateTime: '2026-10-21T15:30:00+05:00' },
  organizer: { email: 'hr@tethrhq.com', self: true },
  attendees: [
    { email: 'hr@tethrhq.com', organizer: true, self: true, responseStatus: 'accepted' },
    { email: 'jane@acme-example.com', displayName: 'Jane Doe', responseStatus: 'needsAction' },
  ],
  conferenceData: { entryPoints: [{ entryPointType: 'phone', uri: 'tel:+1-555' }, { entryPointType: 'video', uri: 'https://meet.google.com/abc-defg-hij' }] },
  ...(body.extendedProperties && { extendedProperties: body.extendedProperties }),
})

test('createEvent: sendUpdates goes on the insert as given, and the result carries what the invite needs', async () => {
  for (const sendUpdates of ['none', 'all']) {
    calls.length = 0
    answer = created
    const event = await createEvent({ lead: LEAD, start: START, end: END, sendUpdates })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].method, 'POST')
    assert.equal(calls[0].path, '/calendar/v3/calendars/hr%40tethrhq.com/events')
    assert.deepEqual(calls[0].query, { conferenceDataVersion: '1', sendUpdates })
    assert.deepEqual(calls[0].body.attendees, [{ email: 'jane@acme-example.com', displayName: 'Jane Doe' }])

    assert.deepEqual(event, {
      eventId: 'abcd1234',
      start: START,
      end: END,
      // No hangoutLink: the video entry point stands in
      meetLink: 'https://meet.google.com/abc-defg-hij',
      iCalUID: 'abcd1234@google.com',
      sequence: 0,
      organizer: { email: 'hr@tethrhq.com', displayName: '' },
      summary: 'Intro call: Acme and Tethr',
      description: calls[0].body.description,
      location: '',
      attendees: [
        { email: 'hr@tethrhq.com', displayName: '', responseStatus: 'accepted' },
        { email: 'jane@acme-example.com', displayName: 'Jane Doe', responseStatus: 'needsAction' },
      ],
      private: { tethrBooking: '1', zone: '', clock: '12h', bookedStart: START },
    })
  }
})

test('createEvent: the insert carries the reminder\'s private properties', async () => {
  calls.length = 0
  answer = created
  const event = await createEvent({ lead: LEAD, start: START, end: END, sendUpdates: 'none', zone: 'America/New_York', hour12: false })
  const expected = { tethrBooking: '1', zone: 'America/New_York', clock: '24h', bookedStart: START }
  assert.deepEqual(calls[0].body.extendedProperties, { private: expected })
  assert.deepEqual(event.private, expected)

  calls.length = 0
  await createEvent({ lead: LEAD, start: '2026-10-21T15:00:00+05:00', end: END, sendUpdates: 'none', zone: 'Asia/Karachi' })
  // bookedStart is always ISO in UTC, and the clock defaults to 12-hour
  assert.deepEqual(calls[0].body.extendedProperties.private, { tethrBooking: '1', zone: 'Asia/Karachi', clock: '12h', bookedStart: START })
})

test('patchPrivate: the whole map in one PATCH, guests not told', async () => {
  calls.length = 0
  answer = () => ({})
  const properties = { tethrBooking: '1', zone: 'Asia/Karachi', clock: '12h', bookedStart: START, reminderSentAt: '2026-10-21T08:00:00.000Z' }
  await patchPrivate({ eventId: 'abcd1234', properties })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].method, 'PATCH')
  assert.equal(calls[0].path, '/calendar/v3/calendars/hr%40tethrhq.com/events/abcd1234')
  assert.deepEqual(calls[0].query, { sendUpdates: 'none' })
  assert.deepEqual(calls[0].body, { extendedProperties: { private: properties } })
  // No etag given, no If-Match
  assert.equal(calls[0].headers['If-Match'], undefined)
})

test('patchPrivate: with an etag the write is conditional, and the stored map comes back', async () => {
  calls.length = 0
  const properties = { tethrBooking: '1', bookedStart: START, reminderSentAt: '2026-10-21T08:00:00.000Z' }
  answer = (body) => ({ id: 'abcd1234', etag: '"etag-2"', extendedProperties: body.extendedProperties })
  const result = await patchPrivate({ eventId: 'abcd1234', properties, etag: '"etag-1"' })
  assert.equal(calls[0].headers['If-Match'], '"etag-1"')
  assert.equal(calls[0].headers.Authorization, 'Bearer test-token')
  assert.equal(calls[0].headers['Content-Type'], 'application/json')
  assert.deepEqual(calls[0].query, { sendUpdates: 'none' })
  assert.deepEqual(result, { private: properties, etag: '"etag-2"' })

  // Changed since that etag was read: Google's 412 reaches the caller as err.status
  status = 412
  await assert.rejects(patchPrivate({ eventId: 'abcd1234', properties, etag: '"etag-1"' }), (err) => err.status === 412)
})

test('listBookings: tagged single events between two instants, soonest first, every page, cancelled and all-day left out', async () => {
  calls.length = 0
  const item = (id, extra = {}) => ({
    id, etag: `"etag-${id}"`, status: 'confirmed', created: '2026-10-19T08:00:00.000Z',
    start: { dateTime: '2026-10-21T15:00:00+05:00' }, end: { dateTime: '2026-10-21T15:30:00+05:00' },
    hangoutLink: 'https://meet.google.com/abc-defg-hij',
    attendees: [
      { email: 'hr@tethrhq.com', organizer: true, self: true, responseStatus: 'accepted' },
      { email: 'jane@acme-example.com', displayName: 'Jane Doe', responseStatus: 'declined' },
    ],
    extendedProperties: { private: { tethrBooking: '1', zone: 'Asia/Karachi' } },
    ...extra,
  })
  const pages = [
    { items: [item('one'), item('gone', { status: 'cancelled' })], nextPageToken: 'p2' },
    { items: [item('allday', { start: { date: '2026-10-21' }, end: { date: '2026-10-22' } }), item('two')] },
  ]
  answer = () => pages[calls.length - 1]
  const from = Date.parse('2026-10-21T08:00:00Z')
  const events = await listBookings({ from, to: from + 120 * 60_000 })

  assert.equal(calls.length, 2)
  assert.equal(calls[0].path, '/calendar/v3/calendars/hr%40tethrhq.com/events')
  assert.deepEqual(calls[0].query, {
    timeMin: '2026-10-21T08:00:00.000Z', timeMax: '2026-10-21T10:00:00.000Z', singleEvents: 'true', orderBy: 'startTime',
    privateExtendedProperty: 'tethrBooking=1', maxResults: '250',
  })
  assert.equal(calls[1].query.pageToken, 'p2')
  assert.deepEqual(events.map((e) => e.eventId), ['one', 'two'])
  assert.deepEqual(events[0], {
    eventId: 'one', etag: '"etag-one"', start: '2026-10-21T10:00:00.000Z', end: '2026-10-21T10:30:00.000Z', created: '2026-10-19T08:00:00.000Z',
    meetLink: 'https://meet.google.com/abc-defg-hij',
    attendees: [
      { email: 'hr@tethrhq.com', displayName: '', responseStatus: 'accepted', organizer: true, self: true },
      { email: 'jane@acme-example.com', displayName: 'Jane Doe', responseStatus: 'declined', organizer: false, self: false },
    ],
    private: { tethrBooking: '1', zone: 'Asia/Karachi' },
  })
})

test('listBookings: the tag filter is URL-encoded in the request', async () => {
  const seen = []
  const stub = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://www.googleapis.com/calendar/v3/')) seen.push(String(url))
    return stub(url, init)
  }
  answer = () => ({ items: [] })
  try {
    await listBookings({ from: 0, to: 1 })
  } finally {
    globalThis.fetch = stub
  }
  assert.match(seen[0], /[?&]privateExtendedProperty=tethrBooking%3D1(&|$)/)
})

test('createEvent: refuses to guess sendUpdates', async () => {
  calls.length = 0
  await assert.rejects(createEvent({ lead: LEAD, start: START, end: END }), /sendUpdates/)
  assert.equal(calls.length, 0)
})

test('sendGoogleInvite: the client off quietly, then the insert\'s attendees back with sendUpdates all', async () => {
  calls.length = 0
  answer = () => ({})
  await sendGoogleInvite({ eventId: 'abcd1234', lead: LEAD })
  assert.deepEqual(calls.map((c) => [c.method, c.path, c.query.sendUpdates]), [
    ['PATCH', '/calendar/v3/calendars/hr%40tethrhq.com/events/abcd1234', 'none'],
    ['PATCH', '/calendar/v3/calendars/hr%40tethrhq.com/events/abcd1234', 'all'],
  ])
  assert.deepEqual(calls[0].body, { attendees: [] })
  assert.deepEqual(calls[1].body, { attendees: [{ email: 'jane@acme-example.com', displayName: 'Jane Doe' }] })
})

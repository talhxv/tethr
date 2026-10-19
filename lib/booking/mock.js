// In-memory stand-ins for Notion and Google Calendar, used only when
// BOOKING_MOCK=1. Nothing leaves the process and nothing survives a restart.
import { randomUUID } from 'node:crypto'
import { eventText, guestsOf, bookingProperties, BOOKING_TAG } from './google.js'

const HOUR = 3_600_000
// The stand-in calendar's owner: the organizer of every event it creates
const HOST = 'calendar@example.com'

const state = {
  leads: new Map(),
  // A few existing "meetings" so the picker has gaps like a real calendar
  busy: [26, 29.5, 50, 75].map((h) => {
    const start = Math.ceil(Date.now() / HOUR) * HOUR + h * HOUR
    return { start, end: start + HOUR }
  }),
  leadsDown: false,
  calendarDown: false,
  markFailures: 0,
  captchaOff: false,
  emails: [],
  mailDown: false,
  mailOff: false,
  // Every call to the stand-in calendar, in order. Writes are
  // { op: 'insert' | 'patch', eventId, sendUpdates, attendees | private };
  // listings { op: 'list', timeMin, timeMax, singleEvents, orderBy, privateExtendedProperty }
  calendarCalls: [],
  patchDown: false,
  propertiesDown: false,
  // Patches answer success but change nothing, as a claim that does not stick
  propertiesIgnored: false,
  etags: 0,
  // The booked calls, as listBookings answers them, by event id
  events: new Map(),
}

const copy = (value) => structuredClone(value)

/* Puts an event on the stand-in calendar as it is, for the reminder tests
   and for trying the sweep by hand: { eventId, start, end, created,
   meetLink, attendees [{ email, displayName, responseStatus, organizer,
   self }], private, status }. Missing fields get a 30-minute call booked a
   day ahead with an untagged map. */
export function addEvent(event) {
  const start = event.start ?? new Date(Date.now() + HOUR).toISOString()
  const stored = {
    eventId: event.eventId ?? randomUUID().replace(/-/g, ''),
    start,
    end: event.end ?? new Date(Date.parse(start) + HOUR / 2).toISOString(),
    created: event.created ?? new Date(Date.parse(start) - 24 * HOUR).toISOString(),
    meetLink: event.meetLink ?? '',
    attendees: event.attendees ?? [{ email: HOST, displayName: '', responseStatus: 'accepted', organizer: true, self: true }],
    private: { ...event.private },
    status: event.status ?? 'confirmed',
    // A new one on every write, as Google's
    etag: `"mock-${++state.etags}"`,
  }
  state.events.set(stored.eventId, stored)
  return copy(stored)
}

// True when a test has asked for a server with no captcha secret
export const captchaOff = () => state.captchaOff
// True when a test has asked for a server with no mail configured
export const mailOff = () => state.mailOff

export const leads = {
  async createLead(lead, { verified = true } = {}) {
    if (state.leadsDown) throw new Error('Mock: lead store is down')
    const id = randomUUID()
    state.leads.set(id, { id, ...lead, booked: false, unverified: !verified })
    return id
  },
  async getLead(id) {
    if (state.leadsDown) throw new Error('Mock: lead store is down')
    return state.leads.get(id) ?? null
  },
  async markBooked(id, booking) {
    if (state.markFailures > 0) {
      state.markFailures--
      throw new Error('Mock: lead update failed')
    }
    Object.assign(state.leads.get(id), { booked: true, booking })
  },
}

export const calendar = {
  async busy() {
    if (state.calendarDown) throw new Error('Mock: calendar is down')
    return state.busy
  },
  // Answers with the fields lib/booking/google.js reads off Google's event
  async createEvent({ lead, start, end, sendUpdates, zone, hour12 = true }) {
    if (state.calendarDown) throw new Error('Mock: calendar is down')
    const eventId = lead.id.replace(/-/g, '')
    const properties = bookingProperties({ start, zone, hour12 })
    state.calendarCalls.push({ op: 'insert', eventId, sendUpdates, attendees: guestsOf(lead), private: { ...properties } })
    state.busy.push({ start: Date.parse(start), end: Date.parse(end) })
    const meetLink = 'https://meet.google.com/mock-call-link'
    addEvent({
      eventId, start, end, created: new Date().toISOString(), meetLink, private: properties,
      attendees: [{ email: HOST, displayName: '', responseStatus: 'accepted', organizer: true, self: true }, ...guestsOf(lead).map((g) => ({ ...g, responseStatus: 'needsAction', organizer: false, self: false }))],
    })
    return {
      eventId, start, end, meetLink, private: { ...properties },
      iCalUID: `${eventId}@google.com`, sequence: 0,
      organizer: { email: HOST, displayName: '' },
      ...eventText({ lead, start, end }), location: '',
      attendees: [{ email: HOST, displayName: '', responseStatus: 'accepted' }, ...guestsOf(lead).map((g) => ({ ...g, responseStatus: 'needsAction' }))],
    }
  },
  // The two patches google.js makes, recorded and not acted on
  async sendGoogleInvite({ eventId, lead }) {
    if (state.patchDown) throw new Error('Mock: calendar update failed')
    const guests = guestsOf(lead)
    state.calendarCalls.push({ op: 'patch', eventId, sendUpdates: 'none', attendees: guests.filter((g) => g.email.toLowerCase() !== lead.email.toLowerCase()) })
    state.calendarCalls.push({ op: 'patch', eventId, sendUpdates: 'all', attendees: guests })
  },
  // Replaces the map, the stricter of the two ways Google could treat it.
  // With an etag that is no longer the event's, refused with 412 as Google does.
  async patchPrivate({ eventId, properties, etag = '' }) {
    if (state.propertiesDown) throw new Error('Mock: calendar update failed')
    const event = state.events.get(eventId)
    if (!event) throw new Error('Mock: no such event')
    if (etag && etag !== event.etag) {
      state.calendarCalls.push({ op: 'patch', eventId, sendUpdates: 'none', private: { ...properties }, ifMatch: etag, refused: 412 })
      throw Object.assign(new Error('Mock: Precondition Failed'), { status: 412 })
    }
    state.calendarCalls.push({ op: 'patch', eventId, sendUpdates: 'none', private: { ...properties }, ...(etag && { ifMatch: etag }) })
    if (!state.propertiesIgnored) {
      event.private = { ...properties }
      event.etag = `"mock-${++state.etags}"`
    }
    return { private: { ...event.private }, etag: event.etag }
  },
  // The events.list call reminders.js depends on: timeMin against the end,
  // timeMax against the start, tagged only, cancelled left out, soonest first
  async listBookings({ from, to }) {
    if (state.calendarDown) throw new Error('Mock: calendar is down')
    const timeMin = new Date(from).toISOString()
    const timeMax = new Date(to).toISOString()
    state.calendarCalls.push({ op: 'list', timeMin, timeMax, singleEvents: true, orderBy: 'startTime', privateExtendedProperty: `${BOOKING_TAG}=1` })
    return [...state.events.values()]
      .filter((e) => e.status !== 'cancelled' && e.private[BOOKING_TAG] === '1' && Date.parse(e.end) > Date.parse(timeMin) && Date.parse(e.start) < Date.parse(timeMax))
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .map(({ status, ...e }) => copy(e))
  },
}

export const mail = {
  async send(message) {
    if (state.mailDown) throw new Error('Mock: mail is down')
    state.emails.push({
      from: message.from, to: message.to, subject: message.subject, text: message.text, htmlBytes: Buffer.byteLength(message.html),
      inline: (message.inline ?? []).map((i) => i.cid), invite: message.invite ?? '',
      messageId: message.messageId ?? '', threadId: message.threadId ?? '', inReplyTo: message.inReplyTo ?? '', references: message.references ?? '',
    })
    return { id: `mock-${state.emails.length}`, threadId: message.threadId || `mock-thread-${state.emails.length}` }
  },
}

/* POST /api/booking-mock — test controls, routed only in mock mode.
   { calendar: 'down' | 'up' }   availability and booking fail / recover
   { leads: 'down' | 'up' }      saving a lead fails / recovers
   { take: '<ISO start>' }       someone else books that slot (30 minutes)
   { markFails: n }              the next n updates of a booked lead fail
   { captcha: 'off' | 'on' }     behave as a server with no TURNSTILE_SECRET_KEY / with one
   { mail: 'down' | 'up' }       the confirmation email fails / recovers
   { mail: 'off' | 'on' }        behave as a server with no mail configured / with it
   { patch: 'down' | 'up' }      having Google send its own invite fails / recovers
   { properties: 'down' | 'up' } writing an event's private properties fails / recovers
   { properties: 'ignored' }     such writes answer success but change nothing ('up' restores)
   { event: { ... } }            puts that event on the calendar (addEvent), for trying /api/reminders
   Answers with the current state, leads, the emails "sent", the calendar's
   events and every calendar call (calendarCalls) included. */
export function control(body = {}) {
  if (body.calendar) state.calendarDown = body.calendar === 'down'
  if (body.leads) state.leadsDown = body.leads === 'down'
  if (Number.isInteger(body.markFails)) state.markFailures = body.markFails
  if (body.captcha) state.captchaOff = body.captcha === 'off'
  if (body.mail === 'down' || body.mail === 'up') state.mailDown = body.mail === 'down'
  if (body.mail === 'off' || body.mail === 'on') state.mailOff = body.mail === 'off'
  if (body.patch) state.patchDown = body.patch === 'down'
  if (body.properties) {
    state.propertiesDown = body.properties === 'down'
    state.propertiesIgnored = body.properties === 'ignored'
  }
  if (body.event && typeof body.event === 'object') addEvent(body.event)
  if (body.take) {
    const start = Date.parse(body.take)
    if (Number.isFinite(start)) state.busy.push({ start, end: start + HOUR / 2 })
  }
  return { calendarDown: state.calendarDown, leadsDown: state.leadsDown, busy: state.busy.length, leads: [...state.leads.values()], emails: state.emails, events: [...state.events.values()].map(copy), calendarCalls: state.calendarCalls }
}

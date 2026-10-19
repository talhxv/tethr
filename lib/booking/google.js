// Google Calendar over plain REST. All authentication is inside
// getAccessToken() — swapping the OAuth refresh token for a service account
// with domain-wide delegation means replacing that one function.
import { googleConfig } from './config.js'

const CALENDAR = 'https://www.googleapis.com/calendar/v3'

function config() {
  const cfg = googleConfig()
  if (!cfg) throw new Error('Google Calendar is not configured: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN and BOOKING_CALENDAR_ID')
  return cfg
}

let cached = { token: null, expires: 0 }

export async function getAccessToken() {
  const cfg = config()
  if (cached.token && Date.now() < cached.expires) return cached.token

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json().catch(() => ({}))
  // Only Google's error code is surfaced — never the request or its secrets
  if (!res.ok || !data.access_token) throw new Error(`Google token refresh failed (${res.status} ${data.error ?? ''})`)

  cached = { token: data.access_token, expires: Date.now() + (Number(data.expires_in ?? 3600) - 60) * 1000 }
  return cached.token
}

async function calendar(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${CALENDAR}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await getAccessToken()}`, 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(`Google Calendar ${method} failed (${res.status}): ${data.error?.message ?? ''}`)
    err.status = res.status
    throw err
  }
  return data
}

// -> [{ start, end }] in ms: when the host calendar is busy between two instants
export async function busy(from, to) {
  const { calendarId } = config()
  const data = await calendar('/freeBusy', {
    method: 'POST',
    body: { timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(), items: [{ id: calendarId }] },
  })
  const cal = data.calendars?.[calendarId]
  if (!cal || cal.errors?.length) throw new Error(`Google free/busy failed for the booking calendar (${cal?.errors?.[0]?.reason ?? 'missing'})`)
  return cal.busy.map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }))
}

// The Meet link: hangoutLink, else the video entry point of the conference
export const meetUrlOf = (event) =>
  event.hangoutLink || event.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video')?.uri || ''

/* What /api/book needs from the created event: the booking itself, and what
   the confirmation email's calendar invite is built from (lib/booking/ics.js,
   inviteFromEvent) */
const eventResult = (event) => ({
  eventId: event.id,
  start: new Date(event.start.dateTime).toISOString(),
  end: new Date(event.end.dateTime).toISOString(),
  meetLink: meetUrlOf(event),
  iCalUID: event.iCalUID ?? '',
  sequence: event.sequence ?? 0,
  organizer: { email: event.organizer?.email ?? '', displayName: event.organizer?.displayName ?? '' },
  summary: event.summary ?? '',
  description: event.description ?? '',
  location: event.location ?? '',
  attendees: (event.attendees ?? []).map((a) => ({ email: a.email, displayName: a.displayName ?? '', responseStatus: a.responseStatus ?? 'needsAction' })),
  private: { ...event.extendedProperties?.private },
})

/* The reminder's state, kept on the event in extendedProperties.private,
   which only the calendar's owner can see (lib/booking/reminders.js reads
   and patches it). Set at insert: the tag the sweep lists by, the zone and
   clock the confirmation showed the time in, and the start it was booked
   for, so a call moved in Google Calendar is told apart. */
export const BOOKING_TAG = 'tethrBooking'
export const bookingProperties = ({ start, zone, hour12 = true }) => ({
  [BOOKING_TAG]: '1',
  zone: String(zone ?? ''),
  clock: hour12 === false ? '24h' : '12h',
  bookedStart: new Date(start).toISOString(),
})

// The guests the event is created with: the client, and only the client
export const guestsOf = (lead) => [{ email: lead.email, displayName: lead.name }]

/* The text the client reads in their calendar (and in the invite the
   confirmation email carries): shared with the stand-in in mock.js, so mock
   mode shows the same event */
export function eventText({ lead, start, end }) {
  const minutes = Math.round((Date.parse(end) - Date.parse(start)) / 60_000)
  const firstName = lead.name.split(/\s+/)[0]
  return {
    summary: `Intro call: ${lead.company || lead.name} and Tethr`,
    description: [
      `Hi ${firstName},`,
      `This is a ${minutes}-minute intro call with Tethr. We'll talk through the roles you're hiring for and how we work.`,
      'The video link is in this invite. Need to reschedule? Reply to this invite and we\'ll find a new time.',
    ].join('\n\n'),
  }
}

const eventIdOf = (lead) => lead.id.replace(/-/g, '').toLowerCase()

/* Creates the call with the client as attendee and a Meet link. sendUpdates
   is 'none' when the confirmation email will carry the invite, so the client
   gets that email and nothing from Google; 'all' has Google send its own
   invite. The summary and description are what the client reads in their
   calendar. The host's context goes in `source`, which Google shows only to
   the event's creator. Its private extended properties carry what the
   reminder needs (bookingProperties): zone and hour12 are the ones the
   confirmation shows the time in.
   The event id is derived from the lead id, so a repeated request for the
   same lead can never create a second event: Google answers 409 and the
   existing event is returned instead. */
export async function createEvent({ lead, start, end, sendUpdates, zone, hour12 = true }) {
  if (!['all', 'none'].includes(sendUpdates)) throw new Error(`createEvent needs sendUpdates 'all' or 'none', not ${sendUpdates}`)
  const { calendarId } = config()
  const cal = encodeURIComponent(calendarId)
  const id = eventIdOf(lead)

  try {
    return eventResult(await calendar(`/calendars/${cal}/events?conferenceDataVersion=1&sendUpdates=${sendUpdates}`, {
      method: 'POST',
      body: {
        id,
        ...eventText({ lead, start, end }),
        ...(lead.url && { source: { title: `Lead: ${[lead.name, lead.title, lead.company].filter(Boolean).join(', ')}`.slice(0, 200), url: lead.url } }),
        start: { dateTime: new Date(start).toISOString() },
        end: { dateTime: new Date(end).toISOString() },
        attendees: guestsOf(lead),
        conferenceData: { createRequest: { requestId: id, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
        extendedProperties: { private: bookingProperties({ start, zone, hour12 }) },
      },
    }))
  } catch (err) {
    if (err.status !== 409) throw err
    const existing = await calendar(`/calendars/${cal}/events/${id}`)
    if (existing.status === 'cancelled') throw new Error('The calendar event for this lead was cancelled')
    return eventResult(existing)
  }
}

/* For when the confirmation email could not be sent after a sendUpdates=none
   insert: has Google send its own invite after all, so the client is never
   left with no email. Google only mails a guest when they are added, so the
   client is taken off quietly and put back with sendUpdates=all, the same
   attendee list the event was created with. */
export async function sendGoogleInvite({ eventId, lead }) {
  const { calendarId } = config()
  const path = `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1`
  const guests = guestsOf(lead)
  const client = String(lead.email).toLowerCase()
  await calendar(`${path}&sendUpdates=none`, { method: 'PATCH', body: { attendees: guests.filter((g) => g.email.toLowerCase() !== client) } })
  await calendar(`${path}&sendUpdates=all`, { method: 'PATCH', body: { attendees: guests } })
}

/* Writes the event's private extended properties. `properties` is the whole
   map, the keys already there and the changes, so the result is the same
   whether Google merges the map or replaces it. Guests are never told
   (sendUpdates=none). With an etag the write is sent with If-Match, and
   Google refuses it with 412 (err.status) when the event has changed since
   that etag was read. -> { private, etag } as Google stored them. */
export async function patchPrivate({ eventId, properties, etag = '' }) {
  const { calendarId } = config()
  const updated = await calendar(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`, {
    method: 'PATCH',
    headers: etag ? { 'If-Match': etag } : {},
    body: { extendedProperties: { private: { ...properties } } },
  })
  return { private: { ...updated.extendedProperties?.private }, etag: updated.etag ?? '' }
}

// One listed event, as lib/booking/reminders.js reads it
const listedEvent = (event) => ({
  eventId: event.id,
  etag: event.etag ?? '',
  start: event.start?.dateTime ? new Date(event.start.dateTime).toISOString() : '',
  end: event.end?.dateTime ? new Date(event.end.dateTime).toISOString() : '',
  created: event.created ?? '',
  meetLink: meetUrlOf(event),
  attendees: (event.attendees ?? []).map((a) => ({
    email: a.email ?? '', displayName: a.displayName ?? '', responseStatus: a.responseStatus ?? 'needsAction',
    organizer: a.organizer === true, self: a.self === true,
  })),
  private: { ...event.extendedProperties?.private },
})

/* -> the booked calls (events tagged at insert) that end after `from` and
   start before `to`, soonest first, as listedEvent. Google's timeMin is
   compared with an event's end, so a call already under way is listed too.
   Cancelled events are not listed. */
export async function listBookings({ from, to }) {
  const { calendarId } = config()
  const events = []
  let pageToken = ''
  do {
    const query = new URLSearchParams({
      timeMin: new Date(from).toISOString(),
      timeMax: new Date(to).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      privateExtendedProperty: `${BOOKING_TAG}=1`,
      maxResults: '250',
      ...(pageToken ? { pageToken } : {}),
    })
    const data = await calendar(`/calendars/${encodeURIComponent(calendarId)}/events?${query}`)
    events.push(...(data.items ?? []).filter((e) => e.status !== 'cancelled' && e.start?.dateTime).map(listedEvent))
    pageToken = data.nextPageToken ?? ''
  } while (pageToken)
  return events
}

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

async function calendar(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${CALENDAR}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await getAccessToken()}`, 'Content-Type': 'application/json' },
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

const eventResult = (event) => ({
  eventId: event.id,
  start: new Date(event.start.dateTime).toISOString(),
  end: new Date(event.end.dateTime).toISOString(),
  meetLink: event.hangoutLink ?? '',
})

/* Creates the call with the client as attendee and a Meet link; Google sends
   its own invite email (sendUpdates=all). The summary and description are
   what the client reads in that email and in their calendar. The host's
   context goes in `source`, which Google shows only to the event's creator.
   The event id is derived from the lead id, so a repeated request for the
   same lead can never create a second event: Google answers 409 and the
   existing event is returned instead. */
export async function createEvent({ lead, start, end }) {
  const { calendarId } = config()
  const cal = encodeURIComponent(calendarId)
  const id = lead.id.replace(/-/g, '').toLowerCase()
  const minutes = Math.round((Date.parse(end) - Date.parse(start)) / 60_000)
  const firstName = lead.name.split(/\s+/)[0]

  try {
    return eventResult(await calendar(`/calendars/${cal}/events?conferenceDataVersion=1&sendUpdates=all`, {
      method: 'POST',
      body: {
        id,
        summary: `Intro call: ${lead.company || lead.name} and Tethr`,
        description: [
          `Hi ${firstName},`,
          `This is a ${minutes}-minute intro call with Tethr. We'll ask about the roles you want to fill and explain how we work.`,
          'The video link is in this invite. If the time no longer suits you, reply to this invite and we\'ll find another.',
        ].join('\n\n'),
        ...(lead.url && { source: { title: `Lead: ${[lead.name, lead.title, lead.company].filter(Boolean).join(', ')}`.slice(0, 200), url: lead.url } }),
        start: { dateTime: new Date(start).toISOString() },
        end: { dateTime: new Date(end).toISOString() },
        attendees: [{ email: lead.email, displayName: lead.name }],
        conferenceData: { createRequest: { requestId: id, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      },
    }))
  } catch (err) {
    if (err.status !== 409) throw err
    const existing = await calendar(`/calendars/${cal}/events/${id}`)
    if (existing.status === 'cancelled') throw new Error('The calendar event for this lead was cancelled')
    return eventResult(existing)
  }
}

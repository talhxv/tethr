// The booking API, once. api/*.js (Vercel), server.js (Docker) and the Vite
// dev middleware are thin wrappers that pass a method, path and parsed body
// to handle() and write back the { status, body } it returns.
import { randomUUID } from 'node:crypto'
import { bookingRules, isMock, notionConfig, googleConfig } from './config.js'
import { validateLead, isSpam } from './lead.js'
import { generateSlots, groupByHostDay } from './slots.js'
import * as notionLeads from './notion.js'
import * as googleCalendar from './google.js'
import * as mock from './mock.js'

const MIN = 60_000
const DAY = 24 * 60 * MIN

const json = (status, body) => ({ status, body })
const CALENDAR_UNAVAILABLE = json(503, { reason: 'calendar_unavailable' })

// Without BOOKING_MOCK=1 a missing backend is null, and every caller below
// turns that into an error — never a quiet success
const backends = () => isMock()
  ? { leads: mock.leads, calendar: mock.calendar }
  : { leads: notionConfig() ? notionLeads : null, calendar: googleConfig() ? googleCalendar : null }

const validId = (id) => isMock() ? typeof id === 'string' && id.length <= 64 : notionLeads.isNotionId(id)

// Messages only: these never contain a token, and neither do the bodies above
const logError = (what, err) => console.error(`[booking] ${what}:`, err?.message ?? err)

async function postLead(body) {
  // Bots get the same answer a person would, and nothing is stored
  if (isSpam(body)) return json(201, { leadId: randomUUID() })

  const { lead, errors } = validateLead(body)
  if (Object.keys(errors).length) return json(400, { error: 'invalid', fields: errors })

  const { leads } = backends()
  if (!leads) {
    logError('lead not saved', 'Notion is not configured (NOTION_TOKEN / NOTION_LEADS_DB_ID)')
    return json(502, { error: 'lead_not_saved' })
  }
  try {
    return json(201, { leadId: await leads.createLead(lead) })
  } catch (err) {
    logError('lead not saved', err)
    return json(502, { error: 'lead_not_saved' })
  }
}

async function getAvailability() {
  const { calendar } = backends()
  const rules = bookingRules()
  if (!calendar) {
    logError('availability', 'Google Calendar is not configured')
    return CALENDAR_UNAVAILABLE
  }
  try {
    const now = Date.now()
    const busy = await calendar.busy(now, now + (rules.horizonDays + 2) * DAY)
    const slots = generateSlots({ now, busy, rules })
    return json(200, { timezone: rules.timezone, slotMinutes: rules.slotMinutes, days: groupByHostDay(slots, rules.timezone) })
  } catch (err) {
    logError('availability', err)
    return CALENDAR_UNAVAILABLE
  }
}

async function postBook(body) {
  const leadId = body?.leadId
  const start = typeof body?.start === 'string' ? Date.parse(body.start) : NaN
  if (!validId(leadId) || !Number.isFinite(start)) return json(400, { error: 'invalid' })

  const { leads, calendar } = backends()
  if (!leads) {
    logError('booking', 'Notion is not configured (NOTION_TOKEN / NOTION_LEADS_DB_ID)')
    return json(502, { error: 'lead_unavailable' })
  }

  let lead
  try {
    lead = await leads.getLead(leadId)
  } catch (err) {
    logError('booking: lead lookup', err)
    return json(502, { error: 'lead_unavailable' })
  }
  if (!lead || !lead.email) return json(404, { reason: 'lead_not_found' })
  if (lead.booked) return json(409, { reason: 'already_booked' })

  if (!calendar) {
    logError('booking', 'Google Calendar is not configured')
    return CALENDAR_UNAVAILABLE
  }

  const rules = bookingRules()
  const end = start + rules.slotMinutes * MIN
  let event
  try {
    // The slot has to be one the rules would offer right now, against the
    // calendar as it stands — not just one the browser was shown earlier
    const now = Date.now()
    const busy = await calendar.busy(now, now + (rules.horizonDays + 2) * DAY)
    if (!generateSlots({ now, busy, rules }).includes(start)) return json(409, { reason: 'slot_taken' })

    event = await calendar.createEvent({ lead, start: new Date(start).toISOString(), end: new Date(end).toISOString() })
  } catch (err) {
    logError('booking: calendar', err)
    return CALENDAR_UNAVAILABLE
  }

  // A booked call whose row still says "New" is the row someone chases by
  // email by mistake, so the update gets a second try
  try {
    await leads.markBooked(lead.id, event).catch(async () => {
      await new Promise((r) => setTimeout(r, 400))
      return leads.markBooked(lead.id, event)
    })
  } catch (err) {
    // The call exists and the invite has gone out, so the client is booked.
    // Only the Notion row is behind; say so loudly for whoever reads the logs.
    logError(`booking: event ${event.eventId} created but the Notion row was not updated`, err)
  }
  return json(200, { start: event.start, end: event.end, meetLink: event.meetLink })
}

const ROUTES = {
  'POST /api/lead': postLead,
  'GET /api/availability': getAvailability,
  'POST /api/book': postBook,
}

export const BOOKING_PATHS = ['/api/lead', '/api/availability', '/api/book', '/api/booking-mock']

export async function handle(method, path, body) {
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = null }
  }
  if (path === '/api/booking-mock') {
    return isMock() && method === 'POST' ? json(200, mock.control(body ?? {})) : json(404, { error: 'not_found' })
  }
  const route = ROUTES[`${method} ${path}`]
  if (route) return route(body)
  return BOOKING_PATHS.includes(path) ? json(405, { error: 'method_not_allowed' }) : json(404, { error: 'not_found' })
}

// For the Vercel functions and Express, whose res objects share this shape
export async function respond(req, res, path) {
  const { status, body } = await handle(req.method, path, req.body)
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(body)
}

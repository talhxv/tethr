// The booking API, once. api/*.js (Vercel), server.js (Docker) and the Vite
// dev middleware are thin wrappers that pass a method, path, parsed body and
// the request's headers and query to handle() and write back the
// { status, body } it returns.
import { randomUUID } from 'node:crypto'
import { bookingRules, isMock, notionConfig, googleConfig, captchaSecret, emailConfig, timezone, cronSecret } from './config.js'
import { validateLead, isSpam } from './lead.js'
import { CAPTCHA_FIELD } from './captcha.js'
import { verifyCaptcha } from './turnstile.js'
import { generateSlots, groupByHostDay } from './slots.js'
import * as notionLeads from './notion.js'
import * as googleCalendar from './google.js'
import { bookingConfirmationEmail } from './email.js'
import { inviteFromEvent } from './ics.js'
import * as gmail from './mail.js'
import { newMessageId } from './mail.js'
import { authorized, embeddedImages, sweep, sendTest } from './reminders.js'
import * as mock from './mock.js'

const MIN = 60_000
const DAY = 24 * 60 * MIN

const json = (status, body) => ({ status, body })
const CALENDAR_UNAVAILABLE = json(503, { reason: 'calendar_unavailable' })

// Without BOOKING_MOCK=1 a missing backend is null, and every caller below
// turns that into an error — never a quiet success
const backends = () => isMock()
  ? { leads: mock.leads, calendar: mock.calendar, mail: mock.mailOff() ? null : mock.mail }
  : { leads: notionConfig() ? notionLeads : null, calendar: googleConfig() ? googleCalendar : null, mail: googleConfig() ? gmail : null }

const validId = (id) => isMock() ? typeof id === 'string' && id.length <= 64 : notionLeads.isNotionId(id)

// Messages only: these never contain a token, and neither do the bodies above
const logError = (what, err) => console.error(`[booking] ${what}:`, err?.message ?? err)

async function postLead(body) {
  // Bots get the same answer a person would, and nothing is stored
  if (isSpam(body)) return json(201, { leadId: randomUUID(), verified: true })

  const { lead, errors } = validateLead(body)
  if (Object.keys(errors).length) return json(400, { error: 'invalid', fields: errors })

  const { leads } = backends()
  if (!leads) {
    logError('lead not saved', 'Notion is not configured (NOTION_TOKEN / NOTION_LEADS_DB_ID)')
    return json(502, { error: 'lead_not_saved' })
  }

  // The captcha never decides whether a lead is kept, only whether it may go
  // on to book: a failed or missing check is saved as "Unverified"
  const check = await verifyCaptcha(body?.[CAPTCHA_FIELD], { secret: isMock() && mock.captchaOff() ? '' : captchaSecret() })
  if (!check.verified) logError('captcha', `lead saved as unverified (${[check.reason, ...(check.codes ?? [])].join(', ')})`)

  try {
    return json(201, { leadId: await leads.createLead(lead, { verified: check.verified }), verified: check.verified })
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

/* The confirmation email is the only email the client gets: it carries the
   calendar invite, built from the event Google created. -> what the
   reminder needs to answer it, { messageId, threadId, subject }, or null
   when it was not sent. A failure is logged and never changes the answer
   the client gets. */
async function sendConfirmation({ mail, lead, event, zone, hour12 }) {
  if (!mail) return null
  const { from, replyTo, siteUrl } = emailConfig()
  try {
    const { subject, html, text, inline } = bookingConfirmationEmail({ lead, start: event.start, end: event.end, meetLink: event.meetLink, zone, hour12, siteUrl, replyTo, inlineImages: true })
    // Our own Message-ID, so the reminder can reply to it
    const messageId = newMessageId('confirm', event.eventId, from)
    // The images travel inside the message, so they show without the site being deployed and without the reader allowing remote images
    const sent = await mail.send({ from, to: lead.email, subject, html, text, inline: embeddedImages(inline), invite: inviteFromEvent(event), messageId })
    if (!sent?.id) throw new Error('the mail backend did not send it')
    return { messageId, threadId: sent.threadId ?? '', subject }
  } catch (err) {
    logError(err?.status === 403
      ? 'confirmation email not sent: the Google token cannot send mail (run scripts/google-oauth-token.mjs again and replace GOOGLE_REFRESH_TOKEN)'
      : 'confirmation email not sent', err)
    return null
  }
}

// Keeps what the reminder's reply needs on the event. A failure only means
// the reminder goes out as an email of its own, so it is logged and that is all.
async function recordConfirmation({ calendar, event, confirmation }) {
  try {
    await calendar.patchPrivate({
      eventId: event.eventId,
      properties: { ...event.private, confirmMessageId: confirmation.messageId, confirmThreadId: confirmation.threadId, confirmSubject: confirmation.subject },
    })
  } catch (err) {
    logError(`booking: event ${event.eventId} confirmed, but the confirmation was not recorded on it (the reminder will not be in its thread)`, err)
  }
}

// When the confirmation could not go out after a quiet insert, Google sends
// its own invite instead, so the client never ends up with no email at all
async function inviteFromGoogle({ calendar, lead, event }) {
  try {
    await calendar.sendGoogleInvite({ eventId: event.eventId, lead })
  } catch (err) {
    logError(`booking: event ${event.eventId} created but the client got no email (neither the confirmation nor Google's invite)`, err)
  }
}

async function postBook(body) {
  const leadId = body?.leadId
  const start = typeof body?.start === 'string' ? Date.parse(body.start) : NaN
  if (!validId(leadId) || !Number.isFinite(start)) return json(400, { error: 'invalid' })

  const { leads, calendar, mail } = backends()
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
  // Saved without passing the captcha: a person follows up, no invite goes out
  if (lead.unverified) return json(403, { reason: 'unverified' })
  if (lead.booked) return json(409, { reason: 'already_booked' })

  if (!calendar) {
    logError('booking', 'Google Calendar is not configured')
    return CALENDAR_UNAVAILABLE
  }

  const rules = bookingRules()
  const zone = timezone(typeof body?.zone === 'string' ? body.zone : '', rules.timezone)
  const hour12 = body?.hour12 !== false
  const end = start + rules.slotMinutes * MIN
  // Google stays quiet only when our own email will carry the invite
  const sendUpdates = mail ? 'none' : 'all'
  let event
  try {
    // The slot has to be one the rules would offer right now, against the
    // calendar as it stands — not just one the browser was shown earlier
    const now = Date.now()
    const busy = await calendar.busy(now, now + (rules.horizonDays + 2) * DAY)
    if (!generateSlots({ now, busy, rules }).includes(start)) return json(409, { reason: 'slot_taken' })

    event = await calendar.createEvent({ lead, start: new Date(start).toISOString(), end: new Date(end).toISOString(), sendUpdates, zone, hour12 })
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
    // The call exists, so the client is booked.
    // Only the Notion row is behind; say so loudly for whoever reads the logs.
    logError(`booking: event ${event.eventId} created but the Notion row was not updated`, err)
  }
  const confirmation = await sendConfirmation({ mail, lead, event, zone, hour12 })
  if (confirmation) await recordConfirmation({ calendar, event, confirmation })
  else if (sendUpdates === 'none') await inviteFromGoogle({ calendar, lead, event })
  return json(200, { start: event.start, end: event.end, meetLink: event.meetLink })
}

// Node lower-cases header names; any other spelling is matched too
const headerOf = (headers, name) => {
  const key = Object.keys(headers ?? {}).find((k) => k.toLowerCase() === name)
  const value = key === undefined ? undefined : headers[key]
  return Array.isArray(value) ? value[0] : value
}

/* GET /api/reminders: the reminder sweep (lib/booking/reminders.js), called
   every 10 minutes by cron-job.org with Authorization: Bearer $CRON_SECRET.
   ?test=<email> sends that client's reminder now, without claiming it.
   The answer names no client, because the pinger stores it. */
async function getReminders(body, { headers, query }) {
  const { calendar, mail } = backends()
  const secret = cronSecret()
  if (!secret || !calendar || !mail) {
    logError('reminders', `not set up: ${[!secret && 'CRON_SECRET', !calendar && 'Google Calendar', !mail && 'mail'].filter(Boolean).join(', ')} missing`)
    return json(503, { reason: 'reminders_unavailable' })
  }
  if (!authorized(headerOf(headers, 'authorization'), secret)) return json(401, { error: 'unauthorized' })

  const { from, replyTo, siteUrl } = emailConfig()
  const sender = { from, replyTo, siteUrl, hostZone: bookingRules().timezone }
  try {
    if (query?.test !== undefined) {
      const result = await sendTest({ calendar, mail, sender, email: query.test })
      if (!result) return json(404, { reason: 'no_matching_event' })
      const { failed, ...answer } = result
      return json(failed ? 502 : 200, answer)
    }
    // A failed claim or send answers 502, so the pinger's failure alert fires; the next run retries it
    const { failed, ...answer } = await sweep({ calendar, mail, sender })
    return json(failed ? 502 : 200, answer)
  } catch (err) {
    logError('reminders: calendar', err)
    return CALENDAR_UNAVAILABLE
  }
}

const ROUTES = {
  'POST /api/lead': postLead,
  'GET /api/availability': getAvailability,
  'POST /api/book': postBook,
  'GET /api/reminders': getReminders,
}

export const BOOKING_PATHS = ['/api/lead', '/api/availability', '/api/book', '/api/reminders', '/api/booking-mock']

/* request is { headers, query }: Node's lower-cased headers and the parsed
   query string. Only /api/reminders reads them. */
export async function handle(method, path, body, request = {}) {
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = null }
  }
  if (path === '/api/booking-mock') {
    return isMock() && method === 'POST' ? json(200, mock.control(body ?? {})) : json(404, { error: 'not_found' })
  }
  const route = ROUTES[`${method} ${path}`]
  if (route) return route(body, { headers: request.headers ?? {}, query: request.query ?? {} })
  return BOOKING_PATHS.includes(path) ? json(405, { error: 'method_not_allowed' }) : json(404, { error: 'not_found' })
}

// For the Vercel functions and Express, whose res objects share this shape
export async function respond(req, res, path) {
  const query = req.query ?? Object.fromEntries(new URL(req.url ?? '/', 'http://localhost').searchParams)
  const { status, body } = await handle(req.method, path, req.body, { headers: req.headers, query })
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(body)
}

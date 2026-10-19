// The reminder email two hours before each booked call, sent by a sweep that
// an outside pinger (cron-job.org) runs every 10 minutes through
// GET /api/reminders (lib/booking/handlers.js).
//
// Google Calendar is the source of truth: a call cancelled there is no longer
// listed, a call moved there is reminded at its new time, and a client who
// declined gets nothing. All of the reminder's state is on the event, in its
// private extended properties (only the calendar's owner sees them):
//
//   tethrBooking: '1'         set at insert; the sweep lists by it
//   zone, clock               the time display the confirmation used
//   bookedStart               the start it was booked for
//   confirmMessageId, confirmThreadId, confirmSubject
//                             set once the confirmation is sent, for the reply
//   reminderSentAt            the claim: an ISO time, '' again after a failed send
//
// The claim is written with If-Match on the etag the event was listed with,
// so when two runs (or two deployments pinged by mistake) list the same call,
// only the first claim lands; the other is refused with 412 and sends nothing.
// A claim is also read back from Google's answer before anything is sent.
// Every patch sends the whole map, so it works whether Google merges or
// replaces it. Calendar and mail are passed in: the real ones
// (google.js, mail.js) or the stand-ins in mock.js.

import { createHash, timingSafeEqual } from 'node:crypto'
import { bookingReminderEmail } from './email.js'
import { EMAIL_IMAGES } from './email-images.js'
import { timezone } from './config.js'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export const REMINDER_RULES = {
  // Sent when the call starts at most this far ahead...
  aheadMinutes: 120,
  // ...and more than this: any later and it would arrive as the call starts
  floorMinutes: 15,
  // A call booked closer to its start than this has a fresh confirmation
  shortNoticeHours: 12,
  // How far ahead test mode looks for the owner's test booking
  testDays: 30,
}

const logError = (what, err) => console.error(`[booking] ${what}:`, err?.message ?? err)

/* True when the Authorization header is exactly "Bearer <secret>". Both
   sides are hashed first, so the comparison takes the same time whatever
   the header holds, its length included. No secret: never authorized. */
export function authorized(header, secret) {
  if (!secret) return false
  const digest = (value) => createHash('sha256').update(String(value ?? '')).digest()
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`))
}

// The client: the one guest who is neither the organizer nor the calendar's owner
export const clientOf = (event) => (event.attendees ?? []).find((a) => !a.organizer && !a.self) ?? null

/* -> why a listed event gets no reminder on this run, or '' when it is due.
   All times are compared as instants. */
export function skipReason(event, now, rules = REMINDER_RULES) {
  const start = Date.parse(event.start)
  // Listed by its end, so a call under way (or about to start) shows up too
  if (!Number.isFinite(start) || start <= now + rules.floorMinutes * MIN) return 'starts_too_soon'
  if (start > now + rules.aheadMinutes * MIN) return 'not_due_yet'
  if (event.private?.reminderSentAt) return 'already_sent'
  const created = Date.parse(event.created)
  if (Number.isFinite(created) && start - created < rules.shortNoticeHours * HOUR) return 'short_notice'
  const client = clientOf(event)
  if (!client?.email) return 'no_client'
  if (client.responseStatus === 'declined') return 'declined'
  return ''
}

/* The reply's threading, when the confirmation went out and the call is
   still at the time it confirmed; null sends the reminder on its own */
export function threadingOf(event) {
  const p = event.private ?? {}
  const unmoved = Boolean(p.bookedStart) && Date.parse(p.bookedStart) === Date.parse(event.start)
  if (!(p.confirmMessageId && p.confirmThreadId && p.confirmSubject && unmoved)) return null
  return { threadId: p.confirmThreadId, inReplyTo: p.confirmMessageId, references: p.confirmMessageId, subject: `Re: ${p.confirmSubject}` }
}

// The images an email's html shows by cid:, as mail.send attaches them
export const embeddedImages = (inline) =>
  inline.map(({ cid, file }) => ({ cid, filename: file, contentType: 'image/png', base64: EMAIL_IMAGES[file] }))

/* -> the message for mail.send. sender { from, replyTo, siteUrl, hostZone }:
   hostZone stands in for a zone the event does not carry (or one this
   runtime does not know). */
export function reminderMessage(event, { from = '', replyTo = '', siteUrl, hostZone }, now = Date.now()) {
  const client = clientOf(event)
  const p = event.private ?? {}
  const email = bookingReminderEmail({
    name: client?.displayName ?? '',
    start: event.start,
    end: event.end,
    meetLink: event.meetLink,
    zone: timezone(p.zone, hostZone),
    hour12: p.clock !== '24h',
    now,
    ...(siteUrl ? { siteUrl } : {}),
    inlineImages: true,
  })
  const thread = threadingOf(event)
  return {
    from, to: client.email, replyTo,
    subject: thread?.subject ?? email.subject,
    html: email.html,
    text: email.text,
    inline: embeddedImages(email.inline),
    ...(thread && { threadId: thread.threadId, inReplyTo: thread.inReplyTo, references: thread.references }),
  }
}

async function deliver(mail, message) {
  const sent = await mail.send(message)
  if (!sent?.id) throw new Error('the mail backend did not send it')
}

/* One run: lists the booked calls ending after now and starting within the
   next two hours, and sends each one that is due its reminder, once.
   -> { checked, sent: [eventId], skipped: [{ eventId, reason }], failed }
   failed is true when a claim or a send went wrong (a retry follows on the
   next run). The result names no client. Throws when the calendar can't be
   listed. */
export async function sweep({ calendar, mail, sender, now = Date.now(), rules = REMINDER_RULES }) {
  const events = await calendar.listBookings({ from: now, to: now + rules.aheadMinutes * MIN })
  const sent = []
  const skipped = []
  let failed = false

  for (const event of events) {
    const { eventId } = event
    const reason = skipReason(event, now, rules)
    if (reason) {
      skipped.push({ eventId, reason })
      continue
    }

    let message
    try {
      message = reminderMessage(event, sender, now)
    } catch (err) {
      logError(`reminder: event ${eventId} could not be written`, err)
      skipped.push({ eventId, reason: 'unreadable_event' })
      continue
    }

    // Claimed before it is sent, and only if the event is still as listed
    const stamp = new Date(now).toISOString()
    let claimed
    try {
      claimed = await calendar.patchPrivate({ eventId, properties: { ...event.private, reminderSentAt: stamp }, etag: event.etag })
    } catch (err) {
      if (err?.status === 412) {
        // Changed since it was listed: another run got there first. Not a failure.
        skipped.push({ eventId, reason: 'claimed_elsewhere' })
        continue
      }
      logError(`reminder: event ${eventId} could not be claimed, not sent`, err)
      skipped.push({ eventId, reason: 'claim_failed' })
      failed = true
      continue
    }
    // A claim that did not stick would have every run send it again
    if (claimed?.private?.reminderSentAt !== stamp) {
      logError(`reminder: event ${eventId} claim did not stick, not sent`, `reminderSentAt reads ${JSON.stringify(claimed?.private?.reminderSentAt ?? null)}, not ${stamp}`)
      skipped.push({ eventId, reason: 'claim_failed' })
      failed = true
      continue
    }

    try {
      await deliver(mail, message)
      sent.push(eventId)
    } catch (err) {
      logError(`reminder not sent for event ${eventId}`, err)
      skipped.push({ eventId, reason: 'send_failed' })
      failed = true
      // Unclaimed, so the next run tries again
      try {
        await calendar.patchPrivate({ eventId, properties: { ...event.private, reminderSentAt: '' } })
      } catch (patchErr) {
        logError(`reminder: event ${eventId} is still claimed after a failed send, so it will not be retried`, patchErr)
      }
    }
  }

  return { checked: events.length, sent, skipped, failed }
}

/* Test mode: sends the reminder for the soonest booked call in the next 30
   days whose client has this email address (any case), now, whatever its
   timing and claim. reminderSentAt is left as it is.
   -> null when no call matches, else the sweep's shape. */
export async function sendTest({ calendar, mail, sender, email, now = Date.now(), rules = REMINDER_RULES }) {
  const target = String(email ?? '').trim().toLowerCase()
  const events = await calendar.listBookings({ from: now, to: now + rules.testDays * DAY })
  const event = target ? events.find((e) => String(clientOf(e)?.email ?? '').toLowerCase() === target) : null
  if (!event) return null
  try {
    await deliver(mail, reminderMessage(event, sender, now))
    return { checked: events.length, sent: [event.eventId], skipped: [], failed: false }
  } catch (err) {
    logError(`test reminder not sent for event ${event.eventId}`, err)
    return { checked: events.length, sent: [], skipped: [{ eventId: event.eventId, reason: 'send_failed' }], failed: true }
  }
}

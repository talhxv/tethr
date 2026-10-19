// Every booking rule lives here, each with an env override, so changing the
// hours (or anything else) is a deployment setting rather than a code change.

import { TURNSTILE_SITE_KEY, TURNSTILE_TEST_SITE_KEY } from './captcha.js'
import { EMAIL_RE } from './lead.js'

const int = (value, fallback, { min = 0, max = Infinity } = {}) => {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback
}

// "09:00" -> minutes after midnight
const clock = (value, fallback) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim())
  if (!m) return fallback
  const minutes = Number(m[1]) * 60 + Number(m[2])
  return minutes >= 0 && minutes <= 24 * 60 ? minutes : fallback
}

// "1,2,3,4,5" -> [1, 2, 3, 4, 5]   (0 = Sunday … 6 = Saturday)
const weekdays = (value, fallback) => {
  if (!value) return fallback
  const days = String(value).split(',').map((d) => Number.parseInt(d, 10)).filter((d) => d >= 0 && d <= 6)
  return days.length ? [...new Set(days)] : fallback
}

export const timezone = (value, fallback) => {
  if (!value) return fallback
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return value
  } catch {
    return fallback
  }
}

export function bookingRules(env = process.env) {
  return {
    timezone:       timezone(env.BOOKING_TIMEZONE, 'Asia/Karachi'),
    days:           weekdays(env.BOOKING_DAYS, [1, 2, 3, 4, 5]),
    dayStart:       clock(env.BOOKING_START, 9 * 60),
    dayEnd:         clock(env.BOOKING_END, 23 * 60),
    slotMinutes:    int(env.BOOKING_SLOT_MINUTES, 30, { min: 5, max: 480 }),
    bufferMinutes:  int(env.BOOKING_BUFFER_MINUTES, 15, { max: 240 }),
    minNoticeHours: int(env.BOOKING_MIN_NOTICE_HOURS, 12, { max: 24 * 30 }),
    horizonDays:    int(env.BOOKING_HORIZON_DAYS, 14, { min: 1, max: 90 }),
  }
}

// Mock mode is opt-in and never honoured in production (the Docker image sets
// NODE_ENV=production; Vercel sets VERCEL_ENV), where it would drop real leads
// into memory
export const isMock = (env = process.env) =>
  env.BOOKING_MOCK === '1' && env.NODE_ENV !== 'production' && env.VERCEL_ENV !== 'production'

// Cloudflare's published test secret that accepts any token. Mock mode
// always uses it so the captcha path runs end to end without real keys.
const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA'

/* Mock mode uses Cloudflare's test pair on both sides and ignores the real
   keys, even when .env has them: the form sends test-key tokens there, and a
   real secret would turn every one of them down. */

// '' means there is no secret on this server
export const captchaSecret = (env = process.env) =>
  isMock(env) ? TURNSTILE_TEST_SECRET : env.TURNSTILE_SECRET_KEY || ''

// The site key this build's form sends tokens with. '' means the form has no
// widget and can't send a token at all.
export const captchaSiteKey = (env = process.env) =>
  isMock(env) ? TURNSTILE_TEST_SITE_KEY : TURNSTILE_SITE_KEY

export function notionConfig(env = process.env) {
  // NOTION_TOKEN is preferred; VITE_NOTION_TOKEN is the name the rest of the
  // site already uses for the same integration
  const token = env.NOTION_TOKEN || env.VITE_NOTION_TOKEN
  const leadsDbId = env.NOTION_LEADS_DB_ID
  return token && leadsDbId ? { token, leadsDbId } : null
}

export function googleConfig(env = process.env) {
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret, GOOGLE_REFRESH_TOKEN: refreshToken, BOOKING_CALENDAR_ID: calendarId } = env
  return clientId && clientSecret && refreshToken && calendarId ? { clientId, clientSecret, refreshToken, calendarId } : null
}

/* Who the confirmation email is from, and where its links and images point.
   from is BOOKING_EMAIL_FROM ("Tethr <hr@tethrhq.com>"); without it, "Tethr <calendar id>" when the calendar id is an email address; otherwise '' and Gmail uses the account's own address. replyTo is the bare address inside from, '' when there is none. */
export function emailConfig(env = process.env) {
  const calendarId = env.BOOKING_CALENDAR_ID ?? ''
  const from = env.BOOKING_EMAIL_FROM || (EMAIL_RE.test(calendarId) ? `Tethr <${calendarId}>` : '')
  const replyTo = /<([^>]+)>/.exec(from)?.[1] ?? (EMAIL_RE.test(from) ? from : '')
  const siteUrl = (env.SITE_URL || 'https://tethrhq.com').replace(/\/+$/, '')
  return { from, replyTo, siteUrl }
}

// The shared secret GET /api/reminders is called with (Authorization: Bearer
// <it>), the name Vercel Cron uses. '' means reminders are not set up here.
export const cronSecret = (env = process.env) => env.CRON_SECRET || ''

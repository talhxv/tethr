// Every booking rule lives here, each with an env override, so changing the
// hours (or anything else) is a deployment setting rather than a code change.

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

const timezone = (value, fallback) => {
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

// Lead rules, shared by the browser form (src/components/book-call.js) and
// POST /api/lead so the two can't drift. Pure — no secrets, no I/O.

// Placeholder set, to be confirmed. Each becomes a select option in Notion.
export const CHALLENGES = [
  'Finding qualified candidates',
  'Hiring takes too long',
  'Cost of hiring',
  'Retention and turnover',
  'Payroll and compliance across borders',
  'Something else',
]

export const HEADCOUNTS = ['1', '2-5', '6-10', '10+']
export const TIMELINES  = ['ASAP', '<1 month', 'Not Defined']

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Personal and throwaway mailbox providers. The form is for companies, so an
// address at one of these is turned down and the visitor is asked for a work one.
export const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'yahoo.ca', 'yahoo.com.au', 'yahoo.fr', 'yahoo.de', 'yahoo.es', 'yahoo.it', 'ymail.com', 'rocketmail.com',
  'outlook.com', 'outlook.fr', 'outlook.de', 'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.de', 'hotmail.it', 'live.com', 'live.co.uk', 'live.fr', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'aim.com',
  'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.net', 'gmx.de', 'web.de', 'mail.com', 'email.com', 'zohomail.com',
  'yandex.com', 'yandex.ru', 'mail.ru', 'inbox.ru', 'qq.com', '163.com', '126.com', 'sina.com', 'naver.com', 'daum.net', 'rediffmail.com',
  'hey.com', 'fastmail.com', 'tutanota.com', 'tuta.io', 'tuta.com', 'duck.com', 'hushmail.com',
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'yopmail.com', 'sharklasers.com', 'trashmail.com', 'getnada.com', 'dispostable.com',
])

// A small synchronous string hash (cyrb53). Not for security: it only keeps
// the exception addresses below out of the site's public bundle.
export function emailKey(email) {
  const s = String(email ?? '').trim().toLowerCase()
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

// Addresses let through although they are at a personal provider: the
// owner's own test addresses, kept as emailKey() values
export const EMAIL_EXCEPTION_KEYS = new Set([1546084995356827, 3061722937667734])

// True for an address a company would use
export function isCompanyEmail(email) {
  const address = String(email ?? '').trim().toLowerCase()
  const domain = address.slice(address.lastIndexOf('@') + 1)
  return EMAIL_EXCEPTION_KEYS.has(emailKey(address)) || !PERSONAL_EMAIL_DOMAINS.has(domain)
}

export const MAX_LENGTH = { name: 120, title: 120, company: 160, email: 254 }

// Bots fill every input and submit at once; people do neither
export const HONEYPOT_FIELD = 'book_ref'
export const MIN_FILL_MS = 2500

const tooLong = (field, v) => v.length > MAX_LENGTH[field] ? `Keep this under ${MAX_LENGTH[field]} characters.` : ''

// Each returns '' when the value is fine, otherwise the message to show
export const VALIDATORS = {
  name:      v => v ? tooLong('name', v) : 'Enter your name.',
  title:     v => v ? tooLong('title', v) : 'Enter your title.',
  company:   v => v ? tooLong('company', v) : 'Enter your company name.',
  email:     v => !v ? 'Enter your email address.' : !EMAIL_RE.test(v) ? 'Enter a valid email address.' : !isCompanyEmail(v) ? 'Use your work email address.' : tooLong('email', v),
  challenge: v => CHALLENGES.includes(v) ? '' : 'Select a challenge.',
  headcount: v => HEADCOUNTS.includes(v) ? '' : 'Choose how many to hire.',
  timeline:  v => TIMELINES.includes(v) ? '' : 'Choose a timeline.',
}

export const LEAD_FIELDS = Object.keys(VALIDATORS)

// -> { lead, errors }: lead holds the trimmed fields; errors maps field name
// to message and is empty when the lead is valid
export function validateLead(body) {
  const lead = {}
  const errors = {}
  for (const field of LEAD_FIELDS) {
    const raw = body?.[field]
    lead[field] = typeof raw === 'string' ? raw.trim() : ''
    const message = VALIDATORS[field](lead[field])
    if (message) errors[field] = message
  }
  return { lead, errors }
}

// True for a submission that should be dropped without saying why
export function isSpam(body) {
  if (typeof body?.[HONEYPOT_FIELD] === 'string' && body[HONEYPOT_FIELD] !== '') return true
  if (body?.[HONEYPOT_FIELD] != null && typeof body[HONEYPOT_FIELD] !== 'string') return true
  const elapsed = Number(body?.elapsedMs)
  return !Number.isFinite(elapsed) || elapsed < MIN_FILL_MS
}

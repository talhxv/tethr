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
  email:     v => !v ? 'Enter your email address.' : !EMAIL_RE.test(v) ? 'Enter a valid email address.' : tooLong('email', v),
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

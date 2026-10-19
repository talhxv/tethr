// Mail over the Gmail REST API, sent as the account getAccessToken()
// authenticates: the calendar owner. The refresh token needs the gmail.send
// scope (scripts/google-oauth-token.mjs asks for it).
import { randomBytes } from 'node:crypto'
import { getAccessToken } from './google.js'

const SEND = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
const TIMEOUT_MS = 8000
const CRLF = '\r\n'
// 39 bytes are 52 base64 characters, a 64-character encoded word: under
// RFC 2047's limit of 75, and the line stays under 76 after "Subject: "
const WORD_BYTES = 39

/* The subject as RFC 2047 base64 words, one per folded line. It is always
   encoded, so whatever it holds (a name with a line break in it, say) can
   never start a header of its own. Words are cut between characters, never
   inside one. */
function encodeSubject(subject) {
  const words = []
  let word = ''
  for (const ch of String(subject ?? '')) {
    if (word && Buffer.byteLength(word + ch) > WORD_BYTES) {
      words.push(word)
      word = ''
    }
    word += ch
  }
  if (word) words.push(word)
  return words.map((w) => `=?UTF-8?B?${Buffer.from(w).toString('base64')}?=`).join(`${CRLF} `)
}

// These go into the headers as they are, so a line break must never get in
function address(name, value) {
  const v = String(value ?? '')
  if (/[\r\n]/.test(v)) throw new Error(`Mail header "${name}" must not contain a line break`)
  return v
}

// <local@domain>, or with several allowed, a space-separated list of them
const MESSAGE_ID = /^<[^<>\s@]+@[^<>\s@]+>$/
function messageIds(name, value, { one = false } = {}) {
  const v = String(value ?? '').trim()
  if (!v) return ''
  const ids = one ? [v] : v.split(/\s+/)
  if (!ids.every((id) => MESSAGE_ID.test(id))) throw new Error(`Mail header "${name}" must be ${one ? 'a message id' : 'message ids'} in angle brackets`)
  return ids.join(' ')
}

/* A Message-ID of our own: <kind.eventId.base36 time@domain of From>, so
   the reminder can answer the confirmation by it. Without an address in
   from, the domain is tethrhq.com. */
export function newMessageId(kind, eventId, from = '', now = Date.now()) {
  const domain = /@([^\s<>@]+?)>?\s*$/.exec(String(from))?.[1] || 'tethrhq.com'
  const safe = (v) => String(v).replace(/[^A-Za-z0-9_-]/g, '')
  return `<${safe(kind)}.${safe(eventId)}.${Number(now).toString(36)}@${domain}>`
}

const base64Lines = (content) => Buffer.from(String(content ?? '')).toString('base64').match(/.{1,76}/g) ?? []

const part = (type, content) => [
  `Content-Type: ${type}; charset=UTF-8`,
  'Content-Transfer-Encoding: base64',
  '',
  ...base64Lines(content),
]

/* The calendar invite, twice over, the way Google Calendar's own invitation
   emails carry it: a text/calendar alternative, which Gmail, Outlook and
   Apple Mail turn into their RSVP card, and the same text as invite.ics for
   every other client */
const calendarPart = (ics) => [
  'Content-Type: text/calendar; charset="UTF-8"; method=REQUEST',
  'Content-Transfer-Encoding: base64',
  '',
  ...base64Lines(ics),
]
const icsAttachment = (ics) => [
  'Content-Type: application/ics; name="invite.ics"',
  'Content-Disposition: attachment; filename="invite.ics"',
  'Content-Transfer-Encoding: base64',
  '',
  ...base64Lines(ics),
]

// Random, so nothing in the content can contain it and end a part early
const newBoundary = () => `tethr_${randomBytes(18).toString('hex')}`

// These sit inside quotes or angle brackets in a header of the image's part
function token(name, value) {
  const v = String(value ?? '')
  if (/[\r\n"<>]/.test(v)) throw new Error(`Inline image ${name} must not contain a line break, a quote or an angle bracket`)
  return v
}

function image({ cid, filename, contentType, base64 }) {
  cid = token('cid', cid)
  filename = token('filename', filename)
  contentType = token('contentType', contentType)
  const data = String(base64 ?? '').replace(/\s+/g, '')
  if (!data) throw new Error(`Inline image "${filename}" has no data`)
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error(`Inline image "${filename}" is not base64`)
  return [
    `Content-Type: ${contentType}; name="${filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-ID: <${cid}>`,
    `Content-Disposition: inline; filename="${filename}"`,
    '',
    ...data.match(/.{1,76}/g),
  ]
}

// The HTML and the images it shows by cid: URL, as one part
function related(html, inline) {
  const boundary = newBoundary()
  return [
    `Content-Type: multipart/related; type="text/html"; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    ...part('text/html', html),
    ...inline.flatMap((item) => [`--${boundary}`, ...image(item)]),
    `--${boundary}--`,
  ]
}

/* -> the whole RFC 822 message: plain text first, HTML second.
   inline is the images embedded in the message, each
   { cid, filename, contentType, base64 }; the HTML shows one with
   src="cid:<cid>". With any, the HTML part becomes a multipart/related
   holding the HTML and then one part per image. With none, the message is
   the two plain parts.
   invite is an iCalendar REQUEST (lib/booking/ics.js). With one, the
   multipart/alternative gains a third, text/calendar part and goes inside a
   multipart/mixed whose second part is the same invite as invite.ics:

     multipart/mixed
     ├─ multipart/alternative
     │   ├─ text/plain
     │   ├─ text/html (or the multipart/related holding it and the images)
     │   └─ text/calendar; method=REQUEST
     └─ application/ics  invite.ics
   messageId, inReplyTo and references are message ids in angle brackets
   (references may hold several, space-separated); each header is left out
   when its value is empty. A reply in a thread sets inReplyTo and
   references to the message it answers. */
export function buildMime({ from = '', to, replyTo = '', subject, html, text, inline = [], invite = '', messageId = '', inReplyTo = '', references = '' }) {
  from = address('From', from)
  to = address('To', to)
  replyTo = address('Reply-To', replyTo)
  messageId = messageIds('Message-ID', messageId, { one: true })
  inReplyTo = messageIds('In-Reply-To', inReplyTo, { one: true })
  references = messageIds('References', references)
  const boundary = newBoundary()

  const alternative = [
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    ...part('text/plain', text),
    `--${boundary}`,
    ...(inline?.length ? related(html, inline) : part('text/html', html)),
    ...(invite ? [`--${boundary}`, ...calendarPart(invite)] : []),
    `--${boundary}--`,
  ]

  let body = alternative
  if (invite) {
    const mixed = newBoundary()
    body = [
      `Content-Type: multipart/mixed; boundary="${mixed}"`,
      '',
      `--${mixed}`,
      ...alternative,
      `--${mixed}`,
      ...icsAttachment(invite),
      `--${mixed}--`,
    ]
  }

  return [
    ...(from ? [`From: ${from}`] : []),
    `To: ${to}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${encodeSubject(subject)}`,
    ...(messageId ? [`Message-ID: ${messageId}`] : []),
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
    ...(references ? [`References: ${references}`] : []),
    'MIME-Version: 1.0',
    ...body,
    '',
  ].join(CRLF)
}

/* Sends one message (the fields of buildMime) -> { id, threadId }.
   threadId, when given, files it in that Gmail thread of the sender's; the
   recipient's client threads it by In-Reply-To, References and subject. */
export async function send(message) {
  const token = await getAccessToken()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(SEND, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: Buffer.from(buildMime(message)).toString('base64url'), ...(message.threadId ? { threadId: String(message.threadId) } : {}) }),
      signal: controller.signal,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      // Only Google's own words are surfaced — never the token or the message
      const err = new Error(`Gmail send failed (${res.status}): ${data.error?.message ?? ''}`)
      err.status = res.status
      err.reason = data.error?.errors?.[0]?.reason ?? data.error?.status ?? ''
      throw err
    }
    return { id: data.id, threadId: data.threadId ?? '' }
  } finally {
    clearTimeout(timer)
  }
}

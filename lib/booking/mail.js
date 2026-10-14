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

const part = (type, content) => [
  `Content-Type: ${type}; charset=UTF-8`,
  'Content-Transfer-Encoding: base64',
  '',
  ...(Buffer.from(String(content ?? '')).toString('base64').match(/.{1,76}/g) ?? []),
]

// -> the whole RFC 822 message: plain text first, HTML second
export function buildMime({ from = '', to, replyTo = '', subject, html, text }) {
  from = address('From', from)
  to = address('To', to)
  replyTo = address('Reply-To', replyTo)
  // Random, so nothing in the content can contain it and end a part early
  const boundary = `tethr_${randomBytes(18).toString('hex')}`

  return [
    ...(from ? [`From: ${from}`] : []),
    `To: ${to}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    ...part('text/plain', text),
    `--${boundary}`,
    ...part('text/html', html),
    `--${boundary}--`,
    '',
  ].join(CRLF)
}

// Sends one message (the fields of buildMime) -> { id }
export async function send(message) {
  const token = await getAccessToken()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(SEND, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: Buffer.from(buildMime(message)).toString('base64url') }),
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
    return { id: data.id }
  } finally {
    clearTimeout(timer)
  }
}

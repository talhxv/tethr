// The MIME message byte for byte, and the Gmail call against a stubbed fetch:
// nothing here reaches Google.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'

const ENV = { GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', GOOGLE_REFRESH_TOKEN: 'test-refresh', BOOKING_CALENDAR_ID: 'host@example.com' }
const savedEnv = Object.fromEntries(Object.keys(ENV).map((k) => [k, process.env[k]]))
Object.assign(process.env, ENV)
const { buildMime, send } = await import('../lib/booking/mail.js')

// Google's token endpoint and Gmail's send, stood in for. `gmail` is what the
// next send is answered with; `sent` collects what was asked.
const realFetch = globalThis.fetch
const sent = []
let gmail = { status: 200, body: { id: 'msg-1' } }
globalThis.fetch = async (url, init) => {
  if (String(url) === 'https://oauth2.googleapis.com/token') {
    return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }), { status: 200 })
  }
  if (String(url).startsWith('https://gmail.googleapis.com/')) {
    sent.push({ url: String(url), init })
    return new Response(JSON.stringify(gmail.body), { status: gmail.status })
  }
  throw new Error(`Unexpected request to ${url}`)
}

after(() => {
  globalThis.fetch = realFetch
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

const MESSAGE = {
  from: 'Tethr <hello@tethrhq.com>', to: 'ada@techcorp.com', replyTo: 'talha@tethrhq.com',
  subject: 'Your call with Tethr', text: 'See you Thursday.', html: '<p>See you Thursday.</p>',
}
const WORD = /=\?UTF-8\?B\?([A-Za-z0-9+/=]*)\?=/g

// -> { headers: [[name, value]] with folded lines joined, raw, body }
function parse(mime) {
  const split = mime.indexOf('\r\n\r\n')
  const raw = mime.slice(0, split)
  const headers = raw.replace(/\r\n[ \t]/g, ' ').split('\r\n').map((line) => {
    const colon = line.indexOf(':')
    return [line.slice(0, colon), line.slice(colon + 1).trim()]
  })
  return { headers, raw, body: mime.slice(split + 4) }
}
const header = (mime, name) => parse(mime).headers.find(([n]) => n === name)?.[1]
// Each word is decoded on its own, so a character split across two would show
const subjectOf = (mime) => [...header(mime, 'Subject').matchAll(WORD)].map((m) => Buffer.from(m[1], 'base64').toString()).join('')

// -> [{ type, encoding, lines, content }] for the two parts
function parts(mime) {
  const boundary = /boundary="([^"]+)"/.exec(header(mime, 'Content-Type'))[1]
  const pieces = parse(mime).body.split(`--${boundary}`)
  assert.equal(pieces.at(-1), '--\r\n')
  return pieces.slice(1, -1).map((piece) => {
    const [head, encoded] = piece.replace(/^\r\n/, '').split('\r\n\r\n')
    const lines = encoded.split('\r\n').filter(Boolean)
    return {
      type: /^Content-Type: (.+)$/m.exec(head)[1].trim(),
      encoding: /^Content-Transfer-Encoding: (.+)$/m.exec(head)[1].trim(),
      lines,
      content: Buffer.from(lines.join(''), 'base64').toString(),
    }
  })
}

test('buildMime: headers in order, CRLF line endings', () => {
  const mime = buildMime(MESSAGE)
  assert.deepEqual(parse(mime).headers.map(([n]) => n), ['From', 'To', 'Reply-To', 'Subject', 'MIME-Version', 'Content-Type'])
  assert.equal(header(mime, 'From'), 'Tethr <hello@tethrhq.com>')
  assert.equal(header(mime, 'To'), 'ada@techcorp.com')
  assert.equal(header(mime, 'Reply-To'), 'talha@tethrhq.com')
  assert.equal(header(mime, 'MIME-Version'), '1.0')
  assert.match(header(mime, 'Content-Type'), /^multipart\/alternative; boundary="[^"]+"$/)
  assert.equal(mime.replace(/\r\n/g, '').includes('\n'), false)
  assert.equal(mime.replace(/\r\n/g, '').includes('\r'), false)
})

test('buildMime: From and Reply-To are left out when empty', () => {
  const mime = buildMime({ to: MESSAGE.to, subject: MESSAGE.subject, text: MESSAGE.text, html: MESSAGE.html })
  assert.deepEqual(parse(mime).headers.map(([n]) => n), ['To', 'Subject', 'MIME-Version', 'Content-Type'])
})

test('buildMime: the subject is always encoded and decodes back', () => {
  for (const subject of ['Your call with Tethr', "You're booked, Zoë. Thursday", 'こんにちは 👋 Zoë']) {
    const mime = buildMime({ ...MESSAGE, subject })
    assert.match(header(mime, 'Subject'), /^=\?UTF-8\?B\?/)
    assert.equal(subjectOf(mime), subject)
  }
})

test('buildMime: a long subject is folded into words of at most 75 characters', () => {
  const subject = "You're booked, Zoë. Thursday 15 October at 3:30 pm — an intro call with Tethr about the roles you're hiring for 🎉 ".repeat(3)
  const mime = buildMime({ ...MESSAGE, subject })
  const words = header(mime, 'Subject').split(' ')
  assert.ok(words.length > 1)
  for (const word of words) {
    assert.match(word, /^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/)
    assert.ok(word.length <= 75, `${word.length} characters`)
  }
  const lines = parse(mime).raw.split('\r\n').filter((line) => line.includes('=?UTF-8?B?'))
  assert.equal(lines.length, words.length)
  for (const line of lines) assert.ok(line.length <= 76, `${line.length} characters`)
  assert.equal(subjectOf(mime), subject)
  assert.equal(subjectOf(mime).includes('�'), false)
})

test('buildMime: a line break in the subject cannot add a header', () => {
  const subject = "You're booked, Ada\r\nBcc: x@y.z"
  const mime = buildMime({ ...MESSAGE, subject })
  assert.equal(/^Bcc:/im.test(mime), false)
  assert.deepEqual(parse(mime).headers.map(([n]) => n), ['From', 'To', 'Reply-To', 'Subject', 'MIME-Version', 'Content-Type'])
  assert.equal(subjectOf(mime), subject)
})

test('buildMime: a line break in from, to or replyTo throws', () => {
  for (const field of ['from', 'to', 'replyTo']) {
    for (const br of ['\r\n', '\n', '\r']) {
      assert.throws(() => buildMime({ ...MESSAGE, [field]: `a@b.c${br}Bcc: x@y.z` }), /line break/)
    }
  }
})

test('buildMime: text then html, base64 in lines of at most 76 characters', () => {
  const text = 'Hi Zoë,\n\nYour intro call with Tethr is booked. '.repeat(20)
  const html = `<p>Hi Zoë,</p>${'<p>Your intro call with Tethr is booked. ✓</p>'.repeat(20)}`
  const [plain, rich] = parts(buildMime({ ...MESSAGE, text, html }))

  assert.equal(plain.type, 'text/plain; charset=UTF-8')
  assert.equal(rich.type, 'text/html; charset=UTF-8')
  assert.equal(plain.content, text)
  assert.equal(rich.content, html)
  for (const p of [plain, rich]) {
    assert.equal(p.encoding, 'base64')
    assert.ok(p.lines.length > 1)
    for (const line of p.lines) assert.ok(line.length <= 76, `${line.length} characters`)
  }
})

test('buildMime: the boundary is new for every message', () => {
  const boundary = (mime) => /boundary="([^"]+)"/.exec(header(mime, 'Content-Type'))[1]
  assert.notEqual(boundary(buildMime(MESSAGE)), boundary(buildMime(MESSAGE)))
})

test('send: posts the message to Gmail as base64url and returns its id', async () => {
  sent.length = 0
  gmail = { status: 200, body: { id: 'msg-1' } }
  const subject = "You're booked, Zoë. Thursday"
  assert.deepEqual(await send({ ...MESSAGE, subject }), { id: 'msg-1' })

  assert.equal(sent.length, 1)
  const [{ url, init }] = sent
  assert.equal(url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send')
  assert.equal(init.method, 'POST')
  assert.equal(init.headers.Authorization, 'Bearer test-token')
  assert.equal(init.headers['Content-Type'], 'application/json')
  assert.ok(init.signal instanceof AbortSignal)

  const { raw } = JSON.parse(init.body)
  assert.match(raw, /^[A-Za-z0-9_-]+$/) // no +, / or =
  const mime = Buffer.from(raw, 'base64url').toString()
  assert.equal(header(mime, 'To'), 'ada@techcorp.com')
  assert.equal(subjectOf(mime), subject)
})

test('send: a refusal carries the status and reason, never the token', async () => {
  gmail = {
    status: 403,
    body: { error: { code: 403, message: 'Request had insufficient authentication scopes.', status: 'PERMISSION_DENIED', errors: [{ reason: 'insufficientPermissions' }] } },
  }
  await assert.rejects(send(MESSAGE), (err) => {
    assert.equal(err.message, 'Gmail send failed (403): Request had insufficient authentication scopes.')
    assert.equal(err.status, 403)
    assert.equal(err.reason, 'insufficientPermissions')
    assert.equal(err.message.includes('test-token'), false)
    assert.equal(err.message.includes(MESSAGE.text), false)
    return true
  })

  gmail = { status: 401, body: { error: { code: 401, message: 'Invalid Credentials', status: 'UNAUTHENTICATED' } } }
  await assert.rejects(send(MESSAGE), (err) => err.status === 401 && err.reason === 'UNAUTHENTICATED')

  gmail = { status: 500, body: {} }
  await assert.rejects(send(MESSAGE), (err) => err.message === 'Gmail send failed (500): ' && err.reason === '')
})

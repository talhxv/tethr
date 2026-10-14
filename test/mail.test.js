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

// Two small "images": any bytes do, the second long enough to wrap
const LOGO = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 3, 250, 251, 252, 253, 254, 255])
const ART = Buffer.from(Array.from({ length: 400 }, (_, i) => (i * 37) % 256))
const INLINE = [
  { cid: 'logo@email.tethrhq.com', filename: 'logo.png', contentType: 'image/png', base64: LOGO.toString('base64') },
  // Given already wrapped, as a file read from disk might be
  { cid: 'art@email.tethrhq.com', filename: 'wordmark-art.png', contentType: 'image/png', base64: ART.toString('base64').match(/.{1,60}/g).join('\n') },
]
const boundaryOf = (contentType) => /boundary="([^"]+)"/.exec(contentType)[1]

// -> [{ head: { name: value }, names, body }] for the parts between `boundary`
function split(body, boundary) {
  const pieces = body.split(`--${boundary}`)
  assert.match(pieces.at(-1), /^--(\r\n)?$/)
  return pieces.slice(1, -1).map((piece) => {
    const trimmed = piece.replace(/^\r\n/, '').replace(/\r\n$/, '')
    const at = trimmed.indexOf('\r\n\r\n')
    const lines = trimmed.slice(0, at).split('\r\n').map((line) => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1).trim()])
    return { head: Object.fromEntries(lines), names: lines.map(([n]) => n), body: trimmed.slice(at + 4) }
  })
}
const decode = (body) => Buffer.from(body.replace(/\r\n/g, ''), 'base64')

test('buildMime: without inline images there is no multipart/related', () => {
  for (const message of [MESSAGE, { ...MESSAGE, inline: [] }, { ...MESSAGE, inline: undefined }]) {
    const mime = buildMime(message)
    assert.equal(mime.includes('multipart/related'), false)
    assert.equal(mime.includes('Content-ID'), false)
    assert.deepEqual(parts(mime).map((p) => p.type), ['text/plain; charset=UTF-8', 'text/html; charset=UTF-8'])
  }
})

test('buildMime: inline images go in a multipart/related with the html', () => {
  const mime = buildMime({ ...MESSAGE, inline: INLINE })
  assert.match(header(mime, 'Content-Type'), /^multipart\/alternative; boundary="[^"]+"$/)
  const outer = boundaryOf(header(mime, 'Content-Type'))

  const top = split(parse(mime).body, outer)
  assert.equal(top.length, 2)
  assert.equal(top[0].head['Content-Type'], 'text/plain; charset=UTF-8')
  assert.equal(decode(top[0].body).toString(), MESSAGE.text)
  assert.match(top[1].head['Content-Type'], /^multipart\/related; type="text\/html"; boundary="[^"]+"$/)
  assert.deepEqual(top[1].names, ['Content-Type'])

  const inner = boundaryOf(top[1].head['Content-Type'])
  assert.notEqual(inner, outer)

  const [html, ...images] = split(top[1].body, inner)
  assert.equal(html.head['Content-Type'], 'text/html; charset=UTF-8')
  assert.equal(decode(html.body).toString(), MESSAGE.html)

  assert.equal(images.length, 2)
  for (const [i, bytes] of [LOGO, ART].entries()) {
    const { cid, filename } = INLINE[i]
    assert.deepEqual(images[i].names, ['Content-Type', 'Content-Transfer-Encoding', 'Content-ID', 'Content-Disposition'])
    assert.equal(images[i].head['Content-Type'], `image/png; name="${filename}"`)
    assert.equal(images[i].head['Content-Transfer-Encoding'], 'base64')
    assert.equal(images[i].head['Content-ID'], `<${cid}>`)
    assert.equal(images[i].head['Content-Disposition'], `inline; filename="${filename}"`)
    assert.deepEqual(decode(images[i].body), bytes)
  }
  assert.ok(images[1].body.split('\r\n').length > 1)

  for (const line of parse(mime).body.split('\r\n')) {
    if (/^[A-Za-z0-9+/=]+$/.test(line)) assert.ok(line.length <= 76, `${line.length} characters`)
  }
  assert.equal(mime.replace(/\r\n/g, '').includes('\n'), false)
})

test('buildMime: an inline image that could break its headers throws', () => {
  const [logo] = INLINE
  for (const field of ['cid', 'filename', 'contentType']) {
    for (const bad of ['a\r\nBcc: x@y.z', 'a\nb', 'a\rb', 'a"b', 'a<b', 'a>b']) {
      assert.throws(() => buildMime({ ...MESSAGE, inline: [{ ...logo, [field]: bad }] }), /must not contain/, `${field}: ${JSON.stringify(bad)}`)
    }
  }
  for (const base64 of ['', ' \r\n ', undefined]) {
    assert.throws(() => buildMime({ ...MESSAGE, inline: [{ ...logo, base64 }] }), /no data/)
  }
  assert.throws(() => buildMime({ ...MESSAGE, inline: [{ ...logo, base64: 'not base64!' }] }), /not base64/)
})

test('send: inline images are passed through to the message', async () => {
  sent.length = 0
  gmail = { status: 200, body: { id: 'msg-2' } }
  assert.deepEqual(await send({ ...MESSAGE, inline: INLINE }), { id: 'msg-2' })

  const mime = Buffer.from(JSON.parse(sent[0].init.body).raw, 'base64url').toString()
  assert.ok(mime.includes('multipart/related; type="text/html"'))
  assert.ok(mime.includes('Content-ID: <logo@email.tethrhq.com>'))
  assert.ok(mime.includes('Content-ID: <art@email.tethrhq.com>'))
})

// The template, the generated images and the MIME builder together, joined
// the way lib/booking/handlers.js joins them
const { readFileSync } = await import('node:fs')
const { bookingConfirmationEmail } = await import('../lib/booking/email.js')
const { EMAIL_IMAGES } = await import('../lib/booking/email-images.js')

test('the real confirmation email builds into one message with its eight images', (t) => {
  const start = '2026-10-22T14:30:00.000Z'
  const { subject, html, text, inline } = bookingConfirmationEmail({
    lead: { name: 'Sarah Chen', headcount: '2-5' },
    start,
    end: new Date(Date.parse(start) + 30 * 60_000).toISOString(),
    zone: 'America/New_York',
    hour12: true,
    meetLink: 'https://meet.google.com/qkz-wvhd-ntp',
    replyTo: 'hr@tethrhq.com',
    inlineImages: true,
  })
  const mime = buildMime({
    from: MESSAGE.from, to: MESSAGE.to, subject, html, text,
    inline: inline.map(({ cid, file }) => ({ cid, filename: file, contentType: 'image/png', base64: EMAIL_IMAGES[file] })),
  })
  assert.equal(mime.match(/^Content-ID:/gm).length, 8)

  const [, related] = split(parse(mime).body, boundaryOf(header(mime, 'Content-Type')))
  const [htmlPart, ...images] = split(related.body, boundaryOf(related.head['Content-Type']))
  assert.equal(decode(htmlPart.body).toString(), html)
  assert.equal(images.length, 8)

  for (const [i, { cid, file }] of inline.entries()) {
    assert.equal(images[i].head['Content-ID'], `<${cid}>`)
    assert.deepEqual(decode(images[i].body), readFileSync(new URL(`../public/email/${file}`, import.meta.url)), file)
  }

  const referenced = [...html.matchAll(/src="cid:([^"]+)"/g)].map((m) => m[1])
  assert.ok(referenced.length > 0)
  const attached = new Set(images.map((p) => p.head['Content-ID']))
  for (const cid of referenced) assert.ok(attached.has(`<${cid}>`), `no part for cid:${cid}`)

  const bytes = Buffer.byteLength(mime)
  t.diagnostic(`message size: ${bytes} bytes`)
  assert.ok(bytes < 150_000, `${bytes} bytes`)
})

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
let gmail = { status: 200, body: { id: 'msg-1', threadId: 'thread-1' } }
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

test('send: posts the message to Gmail as base64url and returns its id and thread', async () => {
  sent.length = 0
  gmail = { status: 200, body: { id: 'msg-1', threadId: 'thread-1' } }
  const subject = "You're booked, Zoë. Thursday"
  assert.deepEqual(await send({ ...MESSAGE, subject }), { id: 'msg-1', threadId: 'thread-1' })

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
  gmail = { status: 200, body: { id: 'msg-2', threadId: 'thread-2' } }
  assert.deepEqual(await send({ ...MESSAGE, inline: INLINE }), { id: 'msg-2', threadId: 'thread-2' })

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

// ── The calendar invite ──
const { buildInvite } = await import('../lib/booking/ics.js')
const INVITE = buildInvite({
  uid: 'abc123@google.com', start: '2026-10-21T10:00:00Z', end: '2026-10-21T10:30:00Z', now: '2026-10-20T00:00:00Z',
  summary: 'Intro call: Acme and Tethr', description: 'Hi Jane — see you then, café at 3.', meetUrl: 'https://meet.google.com/abc-defg-hij',
  organizer: { email: 'hr@tethrhq.com', name: 'Tethr' },
  attendees: [{ email: 'hr@tethrhq.com', name: 'Tethr', partstat: 'ACCEPTED' }, { email: 'jane@acme-example.com', name: 'Jane Doe', partstat: 'NEEDS-ACTION' }],
})

/* The message as a tree, every multipart split on its own boundary:
   -> { type, head: { name: value }, names, children } for a multipart,
      { type, head, names, body } for a leaf */
function tree(headText, bodyText) {
  const lines = headText.replace(/\r\n[ \t]/g, ' ').split('\r\n')
  const pairs = lines.map((line) => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1).trim()])
  const head = Object.fromEntries(pairs)
  const type = head['Content-Type'].split(';')[0].trim()
  if (!type.startsWith('multipart/')) return { type, head, names: pairs.map(([n]) => n), body: bodyText }
  const boundary = boundaryOf(head['Content-Type'])
  const pieces = bodyText.split(`--${boundary}`)
  assert.match(pieces.at(-1), /^--(\r\n)?$/, `${type} is closed`)
  const children = pieces.slice(1, -1).map((piece) => {
    const trimmed = piece.replace(/^\r\n/, '').replace(/\r\n$/, '')
    const at = trimmed.indexOf('\r\n\r\n')
    return tree(trimmed.slice(0, at), trimmed.slice(at + 4))
  })
  return { type, head, names: pairs.map(([n]) => n), children }
}
const messageTree = (mime) => {
  const at = mime.indexOf('\r\n\r\n')
  const top = mime.slice(0, at).replace(/\r\n[ \t]/g, ' ').split('\r\n').filter((l) => l.startsWith('Content-Type:')).join('\r\n')
  return tree(top, mime.slice(at + 4))
}
// -> 'multipart/mixed(multipart/alternative(text/plain,…),application/ics)'
const shape = (node) => node.children ? `${node.type}(${node.children.map(shape).join(',')})` : node.type

test('buildMime: with an invite the message is the tree Google Calendar\'s own invites use', () => {
  const mime = buildMime({ ...MESSAGE, inline: INLINE, invite: INVITE })
  assert.deepEqual(parse(mime).headers.map(([n]) => n), ['From', 'To', 'Reply-To', 'Subject', 'MIME-Version', 'Content-Type'])
  const root = messageTree(mime)
  assert.equal(shape(root), 'multipart/mixed(multipart/alternative(text/plain,multipart/related(text/html,image/png,image/png),text/calendar),application/ics)')

  const [alternative, attachment] = root.children
  const [plain, related, calendar] = alternative.children
  assert.equal(decode(plain.body).toString(), MESSAGE.text)
  assert.equal(decode(related.children[0].body).toString(), MESSAGE.html)
  assert.deepEqual(related.children.slice(1).map((p) => p.head['Content-ID']), ['<logo@email.tethrhq.com>', '<art@email.tethrhq.com>'])
  assert.deepEqual(decode(related.children[2].body), ART)

  assert.equal(calendar.head['Content-Type'], 'text/calendar; charset="UTF-8"; method=REQUEST')
  assert.equal(calendar.head['Content-Transfer-Encoding'], 'base64')
  assert.equal(decode(calendar.body).toString(), INVITE)

  assert.equal(attachment.head['Content-Type'], 'application/ics; name="invite.ics"')
  assert.equal(attachment.head['Content-Disposition'], 'attachment; filename="invite.ics"')
  assert.equal(attachment.head['Content-Transfer-Encoding'], 'base64')
  assert.equal(decode(attachment.body).toString(), INVITE)

  // Three boundaries, none the same
  assert.equal(new Set([root, alternative, related].map((n) => boundaryOf(n.head['Content-Type']))).size, 3)
  for (const line of parse(mime).body.split('\r\n')) {
    if (/^[A-Za-z0-9+/=]+$/.test(line)) assert.ok(line.length <= 76, `${line.length} characters`)
  }
  assert.equal(mime.replace(/\r\n/g, '').includes('\n'), false)
})

test('buildMime: an invite without inline images keeps the plain html part', () => {
  const root = messageTree(buildMime({ ...MESSAGE, invite: INVITE }))
  assert.equal(shape(root), 'multipart/mixed(multipart/alternative(text/plain,text/html,text/calendar),application/ics)')
})

test('buildMime: no invite, no calendar parts: the message is as it was', () => {
  const mime = buildMime({ ...MESSAGE, inline: INLINE })
  assert.equal(shape(messageTree(mime)), 'multipart/alternative(text/plain,multipart/related(text/html,image/png,image/png))')
  assert.equal(mime.includes('text/calendar'), false)
  assert.equal(mime.includes('invite.ics'), false)
})

test('send: the invite is passed through to the message', async () => {
  // Registered after a top-level await, so this can run after the after() above has put the environment back
  const saved = { ...process.env }
  const stub = globalThis.fetch
  Object.assign(process.env, ENV)
  globalThis.fetch = async (url, init) => {
    if (String(url) === 'https://oauth2.googleapis.com/token') return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }), { status: 200 })
    if (String(url).startsWith('https://gmail.googleapis.com/')) {
      sent.push({ url: String(url), init })
      return new Response(JSON.stringify({ id: 'msg-3', threadId: 'thread-3' }), { status: 200 })
    }
    throw new Error(`Unexpected request to ${url}`)
  }
  sent.length = 0
  try {
    assert.deepEqual(await send({ ...MESSAGE, inline: INLINE, invite: INVITE }), { id: 'msg-3', threadId: 'thread-3' })
  } finally {
    globalThis.fetch = stub
    for (const k of Object.keys(ENV)) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  }
  const mime = Buffer.from(JSON.parse(sent[0].init.body).raw, 'base64url').toString()
  const calendar = messageTree(mime).children[0].children[2]
  assert.equal(decode(calendar.body).toString(), INVITE)
})

test('the real confirmation email with its invite: eight images, the html, and the calendar parts', () => {
  const start = '2026-10-22T14:30:00.000Z'
  const { subject, html, text, inline } = bookingConfirmationEmail({
    lead: { name: 'Sarah Chen', headcount: '2-5' }, start, end: new Date(Date.parse(start) + 30 * 60_000).toISOString(),
    zone: 'America/New_York', hour12: true, meetLink: 'https://meet.google.com/qkz-wvhd-ntp', replyTo: 'hr@tethrhq.com', inlineImages: true,
  })
  const mime = buildMime({
    from: MESSAGE.from, to: MESSAGE.to, subject, html, text, invite: INVITE,
    inline: inline.map(({ cid, file }) => ({ cid, filename: file, contentType: 'image/png', base64: EMAIL_IMAGES[file] })),
  })
  const root = messageTree(mime)
  assert.equal(shape(root), `multipart/mixed(multipart/alternative(text/plain,multipart/related(text/html${',image/png'.repeat(8)}),text/calendar),application/ics)`)
  const [htmlPart, ...images] = root.children[0].children[1].children
  assert.equal(decode(htmlPart.body).toString(), html)
  assert.deepEqual(images.map((p) => p.head['Content-ID']), inline.map(({ cid }) => `<${cid}>`))
  assert.equal(decode(root.children[0].children[2].body).toString(), INVITE)
  assert.equal(decode(root.children[1].body).toString(), INVITE)
})

// ── Threading: the confirmation's own Message-ID, the reminder's reply ──
const { newMessageId } = await import('../lib/booking/mail.js')
const { bookingReminderEmail } = await import('../lib/booking/email.js')

test('newMessageId: <kind.eventId.base36 time@domain of From>', () => {
  const now = Date.parse('2026-10-20T08:00:00Z')
  assert.equal(newMessageId('confirm', 'abcd1234', 'Tethr <hr@tethrhq.com>', now), `<confirm.abcd1234.${now.toString(36)}@tethrhq.com>`)
  assert.equal(newMessageId('confirm', 'abcd1234', 'hr@example.org', now), `<confirm.abcd1234.${now.toString(36)}@example.org>`)
  // No address to take a domain from
  assert.equal(newMessageId('confirm', 'abcd1234', '', now), `<confirm.abcd1234.${now.toString(36)}@tethrhq.com>`)
  // Nothing in the event id can break out of the brackets
  assert.match(newMessageId('confirm', 'ab<cd>@x y', 'hr@tethrhq.com', now), /^<confirm\.abcdxy\.[0-9a-z]+@tethrhq\.com>$/)
})

test('buildMime: Message-ID, In-Reply-To and References after the subject, only when given', () => {
  const id = '<confirm.abcd1234.mgz1@tethrhq.com>'
  const mime = buildMime({ ...MESSAGE, messageId: '<reminder.1@tethrhq.com>', inReplyTo: id, references: id })
  assert.deepEqual(parse(mime).headers.map(([n]) => n), ['From', 'To', 'Reply-To', 'Subject', 'Message-ID', 'In-Reply-To', 'References', 'MIME-Version', 'Content-Type'])
  assert.equal(header(mime, 'Message-ID'), '<reminder.1@tethrhq.com>')
  assert.equal(header(mime, 'In-Reply-To'), id)
  assert.equal(header(mime, 'References'), id)
  assert.deepEqual(parse(buildMime({ ...MESSAGE, messageId: id })).headers.map(([n]) => n), ['From', 'To', 'Reply-To', 'Subject', 'Message-ID', 'MIME-Version', 'Content-Type'])
})

test('buildMime: a message id that is not one throws, so it cannot add a header', () => {
  for (const bad of ['no-brackets@x.com', '<a@b.com>\r\nBcc: x@y.com', '<two words@x.com>', '<nodomain>']) {
    assert.throws(() => buildMime({ ...MESSAGE, messageId: bad }), /Message-ID/, JSON.stringify(bad))
    assert.throws(() => buildMime({ ...MESSAGE, inReplyTo: bad }), /In-Reply-To/, JSON.stringify(bad))
  }
  assert.throws(() => buildMime({ ...MESSAGE, references: '<a@b.com> <c@d.com>\r\nBcc: x@y.com' }), /References/)
  assert.equal(header(buildMime({ ...MESSAGE, references: '<a@b.com> <c@d.com>' }), 'References'), '<a@b.com> <c@d.com>')
})

test('send: a threadId goes in Gmail\'s request beside the raw message; none, no field', async () => {
  // Registered after a top-level await, so it sets up its own stand-in (see the invite test above)
  const saved = { ...process.env }
  const stub = globalThis.fetch
  Object.assign(process.env, ENV)
  const bodies = []
  globalThis.fetch = async (url, init) => {
    if (String(url) === 'https://oauth2.googleapis.com/token') return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }), { status: 200 })
    if (String(url).startsWith('https://gmail.googleapis.com/')) {
      const body = JSON.parse(init.body)
      bodies.push(body)
      return new Response(JSON.stringify({ id: 'msg-4', threadId: body.threadId ?? 'thread-new' }), { status: 200 })
    }
    throw new Error(`Unexpected request to ${url}`)
  }
  try {
    assert.deepEqual(await send({ ...MESSAGE, threadId: 'thread-9', inReplyTo: '<c.1@tethrhq.com>', references: '<c.1@tethrhq.com>' }), { id: 'msg-4', threadId: 'thread-9' })
    assert.deepEqual(await send(MESSAGE), { id: 'msg-4', threadId: 'thread-new' })
  } finally {
    globalThis.fetch = stub
    for (const k of Object.keys(ENV)) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  }
  assert.deepEqual(Object.keys(bodies[0]).sort(), ['raw', 'threadId'])
  assert.equal(bodies[0].threadId, 'thread-9')
  assert.equal(header(Buffer.from(bodies[0].raw, 'base64url').toString(), 'In-Reply-To'), '<c.1@tethrhq.com>')
  assert.deepEqual(Object.keys(bodies[1]), ['raw'])
})

test('the real reminder builds into a reply with no calendar parts and only the images it shows', () => {
  const start = '2026-10-20T10:00:00.000Z'
  const { html, text, inline } = bookingReminderEmail({
    name: 'Jane Doe', start, end: '2026-10-20T10:30:00.000Z', zone: 'Asia/Karachi', hour12: true,
    meetLink: 'https://meet.google.com/abc-defg-hij', now: '2026-10-20T08:00:00.000Z', inlineImages: true,
  })
  const id = '<confirm.abcd1234.mgz1@tethrhq.com>'
  const mime = buildMime({
    from: MESSAGE.from, to: 'jane@acme-example.com', replyTo: 'hr@tethrhq.com', subject: "Re: You're booked, Jane. Tuesday, October 20 at 3:00 PM",
    html, text, inReplyTo: id, references: id,
    inline: inline.map(({ cid, file }) => ({ cid, filename: file, contentType: 'image/png', base64: EMAIL_IMAGES[file] })),
  })
  assert.equal(shape(messageTree(mime)), `multipart/alternative(text/plain,multipart/related(text/html${',image/png'.repeat(7)}))`)
  assert.equal(mime.includes('text/calendar'), false)
  assert.equal(mime.includes('invite.ics'), false)
  assert.equal(mime.includes('application/ics'), false)
  assert.equal(inline.some(({ file }) => file === 'booked.png'), false)
  assert.equal(subjectOf(mime), "Re: You're booked, Jane. Tuesday, October 20 at 3:00 PM")
  assert.equal(header(mime, 'In-Reply-To'), id)
})

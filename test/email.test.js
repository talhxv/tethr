import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { bookingConfirmationEmail, INLINE_IMAGE_FILES } from '../lib/booking/email.js'
import { EMAIL_IMAGES } from '../lib/booking/email-images.js'

const MEET = 'https://meet.google.com/qkz-wvhd-ntp'

// Sarah books 10:30 in New York on Thursday 22 October, half an hour
const SAMPLE = {
  lead: { name: 'Sarah Chen', headcount: '2-5' },
  start: '2026-10-22T14:30:00.000Z',
  end: '2026-10-22T15:00:00.000Z',
  zone: 'America/New_York',
  hour12: true,
  meetLink: MEET,
  replyTo: 'hr@tethrhq.com',
}
const email = (over = {}) => bookingConfirmationEmail({ ...SAMPLE, ...over })
const count = (s, needle) => s.split(needle).length - 1

test('the subject and preheader name the client, the day and the time', () => {
  const { subject, preheader, html } = email()
  assert.equal(subject, "You're booked, Sarah. Thursday, October 22 at 10:30 AM")
  assert.equal(preheader, '30 minutes on Google Meet with Tethr. Your join link is inside.')
  assert.ok(html.includes("<title>You're booked, Sarah. Thursday, October 22 at 10:30 AM</title>"))
  assert.ok(html.includes(`>${preheader}</div>`))
  assert.equal(email({ meetLink: '' }).preheader, '30 minutes with Tethr. The video link is in your calendar invite.')
})

test('the html carries the receipt and the join button', () => {
  const { html } = email()
  assert.ok(html.includes('Thursday, October 22 <span style="white-space:nowrap">at 10:30 AM</span>'))
  assert.ok(html.includes('Eastern Time (New York), GMT-4'))
  assert.ok(html.includes('30 minutes'))
  assert.ok(html.includes(`href="${MEET}"`))
  assert.ok(html.includes('>meet.google.com/qkz-wvhd-ntp</a>'))
  assert.ok(html.includes('Join on Google Meet'))
  assert.ok(html.includes("You're booked, Sarah.</h1>"))
  assert.ok(html.includes('Copyright &copy; 2026 Tethr'))
})

test('a 24-hour client gets a 24-hour time', () => {
  const { subject, html } = email({ hour12: false })
  assert.equal(subject, "You're booked, Sarah. Thursday, October 22 at 10:30")
  assert.ok(html.includes('at 10:30</span>'))
  assert.ok(!html.includes('10:30 AM'))
  // Half past midnight is 00:30, not 24:30
  assert.ok(email({ hour12: false, start: '2026-10-22T04:30:00.000Z', end: '2026-10-22T05:00:00.000Z' }).subject.endsWith(' at 00:30'))
  assert.ok(email({ start: '2026-10-22T19:00:00.000Z', end: '2026-10-22T19:30:00.000Z' }).subject.endsWith(' at 3:00 PM'))
})

test('the time follows the client zone, across midnight and the clock change', () => {
  const karachi = email({ zone: 'Asia/Karachi', start: '2026-10-22T19:30:00.000Z', end: '2026-10-22T20:15:00.000Z' })
  assert.equal(karachi.subject, "You're booked, Sarah. Friday, October 23 at 12:30 AM")
  assert.ok(karachi.html.includes('45 minutes'))
  assert.ok(karachi.html.includes('45 MIN'))
  const winter = email({ start: '2026-11-05T15:30:00.000Z', end: '2026-11-05T16:00:00.000Z' })
  assert.ok(winter.html.includes('Eastern Time (New York), GMT-5'))
  assert.ok(winter.subject.endsWith('Thursday, November 5 at 10:30 AM'))
})

test('without a meet link there is no button and the call is in the invite', () => {
  for (const meetLink of ['', undefined, 'http://meet.google.com/abc']) {
    const { html, text } = email({ meetLink })
    assert.ok(!html.includes('Join on Google Meet'))
    assert.ok(!html.includes('meet.google.com'))
    assert.ok(html.includes('Video call'))
    assert.ok(html.includes('Details are in your calendar invite'))
    assert.ok(text.includes('Where: Video call. Details are in your calendar invite.'))
  }
})

test('the reschedule link needs an address to write to', () => {
  const withReply = email().html
  assert.ok(withReply.includes('href="mailto:hr@tethrhq.com?subject=Reschedule%20my%20intro%20call"'))
  assert.ok(withReply.includes('>RESCHEDULE</a>'))
  const without = email({ replyTo: '' }).html
  assert.ok(!without.includes('RESCHEDULE'))
  assert.ok(!without.includes('mailto:'))
})

test('whatever the client typed is escaped', () => {
  const { html, subject } = email({ lead: { name: '<b>Ann</b> "Q" O\'Hara', headcount: '<i>9</i>' } })
  assert.ok(subject.startsWith("You're booked, <b>Ann</b>."))
  assert.ok(!html.includes('<b>'))
  assert.ok(!html.includes('<i>'))
  assert.ok(html.includes("You're booked, &lt;b&gt;Ann&lt;/b&gt;."))
  assert.ok(html.includes('&lt;i&gt;9&lt;/i&gt;'))
  const quoted = email({ meetLink: 'https://meet.google.com/a"><script>x</script>', replyTo: 'a"b@x.co' }).html
  assert.ok(!quoted.includes('<script>'))
  assert.ok(!quoted.includes('a"b@x.co'))
})

test('a meet link that is not https never reaches the html', () => {
  const { html, text } = email({ meetLink: 'javascript:alert(1)' })
  assert.ok(!html.includes('javascript:'))
  assert.ok(!html.includes('alert(1)'))
  assert.ok(!text.includes('javascript:'))
  assert.ok(!html.includes('Join on Google Meet'))
})

test('step 01 speaks to the headcount', () => {
  const one = email({ lead: { name: 'Sarah Chen', headcount: '1' } })
  assert.ok(one.html.includes("The role you're hiring for, and what's been hard about filling it."))
  assert.ok(one.text.includes("The role you're hiring for, and what's been hard about filling it."))
  for (const headcount of ['2-5', '6-10', '10+']) {
    const some = email({ lead: { name: 'Sarah Chen', headcount } })
    assert.ok(some.html.includes(`The ${headcount} roles you're hiring for, and what's been hard about filling them.`), headcount)
    assert.ok(some.text.includes(`The ${headcount} roles you're hiring for, and what's been hard about filling them.`), headcount)
  }
  const none = email({ lead: { name: 'Sarah Chen', headcount: '' } })
  assert.ok(none.html.includes("The roles you're hiring for, and what's been hard about filling them."))
  assert.ok(none.text.includes("The roles you're hiring for, and what's been hard about filling them."))
})

test('the html keeps to what mail clients render', () => {
  const { html } = email()
  assert.equal(count(html, 'rgba('), 1)
  assert.ok(html.includes('box-shadow:0 8px 24px rgba(43,68,255,0.28)'))
  assert.equal(count(email({ meetLink: '' }).html, 'rgba('), 0)
  for (const banned of [/display:\s*(inline-)?(flex|grid)/, /[;"\s]position:/, /[;"\s]float:/]) assert.doesNotMatch(html, banned)
  assert.equal(count(html, '<style'), 1)
  assert.ok(html.includes('<html lang="en">'))
  assert.ok(html.includes('<meta name="color-scheme" content="light only">'))
  assert.ok(html.includes('<!--[if mso]><table role="presentation" width="600" align="center"'))
  for (const table of html.match(/<table\b[^>]*>/g)) assert.ok(table.includes('role="presentation"'), table)
})

test('every image has its size and an absolute address', () => {
  for (const html of [email().html, email({ siteUrl: 'https://staging.tethrhq.com/' }).html]) {
    const imgs = html.match(/<img\b[^>]*>/g)
    assert.equal(imgs.length, 8) // logo, booked, white logo, four socials, wordmark
    for (const tag of imgs) {
      assert.match(tag, /\swidth="\d+"/, tag)
      assert.match(tag, /\sheight="\d+"/, tag)
      assert.match(tag, /\ssrc="https:\/\/[^"]+\/email\/[a-z-]+\.png"/, tag)
      assert.match(tag, /\salt="[^"]*"/, tag)
      assert.ok(tag.includes('display:block;border:0'), tag)
    }
  }
  assert.deepEqual(email().inline, [])
  const staging = email({ siteUrl: 'https://staging.tethrhq.com/' }).html
  assert.ok(staging.includes('src="https://staging.tethrhq.com/email/logo.png"'))
  assert.ok(staging.includes('url(https://staging.tethrhq.com/email/chain-corner.png)'))
  assert.ok(staging.includes('href="https://staging.tethrhq.com/book"'))
})

test('with inline images every <img> points at an embedded image', () => {
  const siteUrl = 'https://staging.tethrhq.com'
  for (const meetLink of [MEET, '']) {
    const { html, inline } = email({ inlineImages: true, siteUrl, meetLink })
    assert.equal(inline.length, 8)
    assert.deepEqual(inline.map(i => i.file), INLINE_IMAGE_FILES) // document order, no duplicates
    assert.deepEqual(inline[0], { cid: 'logo@email.tethrhq.com', file: 'logo.png' })
    for (const { cid, file } of inline) assert.equal(cid, `${file.slice(0, -4)}@email.tethrhq.com`)
    const imgs = html.match(/<img\b[^>]*>/g)
    assert.equal(imgs.length, 8)
    for (const tag of imgs) {
      const src = tag.match(/\ssrc="([^"]*)"/)[1]
      assert.ok(src.startsWith('cid:'), src)
      assert.ok(!src.includes('http'), src)
      assert.ok(inline.some(i => src === `cid:${i.cid}`), src)
      assert.match(tag, /\swidth="\d+"/, tag)
      assert.match(tag, /\sheight="\d+"/, tag)
    }
    // Backgrounds cannot be embedded, so they stay on the site
    assert.ok(html.includes(`${siteUrl}/email/chain-corner.png`))
    assert.ok(html.includes(`${siteUrl}/email/tether.png`))
  }
  // Nothing else moves: the two renders differ only in the eight src values
  const cidToUrl = (html) => html.replace(/cid:([a-z-]+)@email\.tethrhq\.com/g, 'https://tethrhq.com/email/$1.png')
  assert.equal(cidToUrl(email({ inlineImages: true }).html), email().html)
})

test('the generated image module matches the PNGs on disk', () => {
  assert.deepEqual(Object.keys(EMAIL_IMAGES), INLINE_IMAGE_FILES)
  for (const file of INLINE_IMAGE_FILES) {
    const bytes = Buffer.from(EMAIL_IMAGES[file], 'base64')
    assert.deepEqual([...bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], file)
    assert.ok(bytes.equals(readFileSync(new URL(`../public/email/${file}`, import.meta.url))), `${file} is stale: run node scripts/build-email-images.mjs`)
  }
})

test('apostrophes are straight everywhere, as on the site', () => {
  for (const mail of [email(), email({ meetLink: '' }), email({ lead: { name: 'Sarah Chen', headcount: '1' } })]) {
    for (const part of ['subject', 'preheader', 'html', 'text']) {
      assert.doesNotMatch(mail[part], /[‘’]|&[lr]squo;|&#821[67];|&#x201[89];|&#39;|&apos;/i, part)
    }
  }
})

test('with images blocked the alt text is styled, not a default blue link', () => {
  const { html } = email()
  const tag = (file) => html.match(new RegExp(`<a [^>]*>\\s*<img\\b[^>]*${file}[^>]*>|<img\\b[^>]*${file}[^>]*>`))[0]
  const logo = tag('/logo\\.png')
  assert.ok(logo.includes('font-weight:800'), logo)
  assert.ok(logo.includes('font-size:18px'), logo)
  assert.ok(logo.includes('color:#0755E9'), logo)
  assert.ok(logo.includes('text-decoration:none'), logo)
  assert.ok(tag('logo-white\\.png').includes('font-weight:800;color:#ffffff'))
  for (const name of ['linkedin', 'facebook', 'instagram', 'x']) {
    const social = tag(`social-${name}\\.png`)
    assert.ok(social.includes('font-size:11px;color:#ffffff'), social)
    assert.ok(social.includes('text-decoration:none'), social)
  }
  assert.ok(html.includes('font-size:12px;line-height:12px;vertical-align:middle;letter-spacing:0;color:#1F8F5C;">&#9679;'))
  assert.ok(html.includes('.closing-em{font-size:30px!important}'))
  assert.ok(html.includes('<em class="closing-em"'))
})

test('the html stays under the size Gmail clips at', () => {
  assert.ok(Buffer.byteLength(email().html) < 100_000)
})

test('the text version says the same things', () => {
  const { text } = email()
  for (const line of [
    "You're booked, Sarah.",
    'Your intro call with Tethr is on the calendar.',
    'When: Thursday, October 22 at 10:30 AM (Eastern Time (New York), GMT-4)',
    'Length: 30 minutes',
    `Where: Google Meet, ${MEET}`,
    'Accept the calendar invite to confirm.',
    'Need a new time? Just reply to this email.',
    "WHAT WE'LL COVER",
    "01 YOUR ROLES. The 2-5 roles you're hiring for, and what's been hard about filling them.",
    '02 HOW WE WORK. Source, screen, shortlist. You only meet the few worth your time.',
    "03 YOUR START. Start with one role. No contract required until you're ready.",
    "You're getting this email because you booked a call at tethrhq.com/book.",
  ]) assert.ok(text.split('\n').includes(line), line)
  assert.ok(!text.includes('<'))
})

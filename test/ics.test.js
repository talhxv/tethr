// The calendar invite the confirmation email carries (lib/booking/ics.js)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildInvite, inviteFromEvent } from '../lib/booking/ics.js'

const BASE = {
  uid: 'abc123@google.com',
  sequence: 0,
  start: '2026-10-21T14:00:00+05:00',
  end: '2026-10-21T14:30:00+05:00',
  now: '2026-10-20T08:15:30.123Z',
  summary: 'Intro call: Acme and Tethr',
  description: 'Hi Jane,\n\nSee you then.',
  location: 'https://meet.google.com/abc-defg-hij',
  meetUrl: 'https://meet.google.com/abc-defg-hij',
  organizer: { email: 'hr@tethrhq.com', name: 'Tethr' },
  attendees: [
    { email: 'hr@tethrhq.com', name: 'Tethr', partstat: 'ACCEPTED' },
    { email: 'jane@acme-example.com', name: 'Jane Doe', partstat: 'NEEDS-ACTION' },
  ],
}

// Folded lines joined back, then split: -> the logical lines
const unfold = (ics) => ics.replace(/\r\n /g, '')
const logical = (ics) => unfold(ics).split('\r\n').slice(0, -1)
const value = (ics, name) => logical(ics).find((l) => l.startsWith(`${name}:`) || l.startsWith(`${name};`))

test('buildInvite: the lines, in order', () => {
  assert.deepEqual(logical(buildInvite(BASE)), [
    'BEGIN:VCALENDAR',
    'PRODID:-//Tethr//Book a Call//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    'UID:abc123@google.com',
    'SEQUENCE:0',
    'DTSTAMP:20261020T081530Z',
    'DTSTART:20261021T090000Z',
    'DTEND:20261021T093000Z',
    'SUMMARY:Intro call: Acme and Tethr',
    'DESCRIPTION:Hi Jane\\,\\n\\nSee you then.',
    'LOCATION:https://meet.google.com/abc-defg-hij',
    'ORGANIZER;CN="Tethr":mailto:hr@tethrhq.com',
    'ATTENDEE;CN="Tethr";CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:hr@tethrhq.com',
    'ATTENDEE;CN="Jane Doe";CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:jane@acme-example.com',
    'X-GOOGLE-CONFERENCE:https://meet.google.com/abc-defg-hij',
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ])
})

test('buildInvite: METHOD:REQUEST, and Dates work as well as ISO strings', () => {
  const ics = buildInvite({ ...BASE, start: new Date('2026-10-21T09:00:00Z'), end: new Date('2026-10-21T09:30:00Z'), now: new Date('2026-10-20T08:15:30Z') })
  assert.equal(value(ics, 'METHOD'), 'METHOD:REQUEST')
  assert.equal(value(ics, 'DTSTART'), 'DTSTART:20261021T090000Z')
  assert.equal(value(ics, 'DTEND'), 'DTEND:20261021T093000Z')
  assert.equal(value(ics, 'DTSTAMP'), 'DTSTAMP:20261020T081530Z')
})

test('buildInvite: an offset time comes out in UTC', () => {
  assert.equal(value(buildInvite({ ...BASE, start: '2026-10-21T14:00:00+05:00' }), 'DTSTART'), 'DTSTART:20261021T090000Z')
})

test('buildInvite: empty description, location and Meet URL are left out', () => {
  const lines = logical(buildInvite({ ...BASE, description: '', location: undefined, meetUrl: '' }))
  for (const name of ['DESCRIPTION', 'LOCATION', 'X-GOOGLE-CONFERENCE']) {
    assert.equal(lines.some((l) => l.startsWith(name)), false, name)
  }
})

test('buildInvite: backslash, semicolon, comma and line breaks are escaped in SUMMARY and DESCRIPTION', () => {
  const ics = buildInvite({ ...BASE, summary: 'A\\B; C, D', description: 'one\r\ntwo\nthree\rfour; a\\b, c' })
  assert.equal(value(ics, 'SUMMARY'), 'SUMMARY:A\\\\B\\; C\\, D')
  assert.equal(value(ics, 'DESCRIPTION'), 'DESCRIPTION:one\\ntwo\\nthree\\nfour\\; a\\\\b\\, c')
})

test('buildInvite: CN is quoted, and quotes and line breaks are taken out of it', () => {
  const ics = buildInvite({
    ...BASE,
    organizer: { email: 'hr@tethrhq.com', name: 'Tethr "HQ"' },
    attendees: [{ email: 'jane@acme-example.com', name: 'Jane Doe, Acme\r\nX-EVIL:1', partstat: 'NEEDS-ACTION' }],
  })
  assert.equal(value(ics, 'ORGANIZER'), 'ORGANIZER;CN="Tethr HQ":mailto:hr@tethrhq.com')
  assert.equal(value(ics, 'ATTENDEE'), 'ATTENDEE;CN="Jane Doe, AcmeX-EVIL:1";CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:jane@acme-example.com')
  assert.equal(logical(ics).some((l) => l.startsWith('X-EVIL')), false)
})

test('buildInvite: an attendee with no name has no CN; attendees are deduped by email, any case', () => {
  const ics = buildInvite({
    ...BASE,
    attendees: [
      { email: 'Jane@Acme-Example.com', partstat: 'TENTATIVE' },
      { email: 'jane@acme-example.com', name: 'Jane Doe', partstat: 'DECLINED' },
    ],
  })
  const attendees = logical(ics).filter((l) => l.startsWith('ATTENDEE'))
  assert.deepEqual(attendees, ['ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=TENTATIVE;RSVP=FALSE:mailto:Jane@Acme-Example.com'])
})

test('buildInvite: a long line folds at 75 UTF-8 bytes, never inside a character, and unfolds back exactly', () => {
  const description = 'Your intro call with Tethr — we will talk about the roles you are hiring for, café hours, and how we work 🎉. '.repeat(2)
  assert.ok(description.length >= 200, `${description.length}`)
  const ics = buildInvite({ ...BASE, description })
  const physical = ics.split('\r\n').slice(0, -1)
  for (const line of physical) {
    assert.ok(Buffer.byteLength(line) <= 75, `${Buffer.byteLength(line)} bytes: ${line}`)
    assert.equal(line.includes('�'), false)
    // A lone surrogate would mean a character was cut in two
    assert.equal(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(line), false, line)
  }
  const at = physical.findIndex((l) => l.startsWith('DESCRIPTION:'))
  assert.ok(physical[at + 1].startsWith(' '), 'the description is folded')
  // Removing each CRLF + space gives back the line as it was before folding
  assert.equal(value(ics, 'DESCRIPTION'), `DESCRIPTION:${description.replace(/,/g, '\\,')}`)
})

test('buildInvite: ends with CRLF and has no bare LF or CR', () => {
  const ics = buildInvite({ ...BASE, description: 'a\nb\rc\r\nd' })
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'))
  assert.equal(ics.replace(/\r\n/g, '').includes('\n'), false)
  assert.equal(ics.replace(/\r\n/g, '').includes('\r'), false)
})

// The event as lib/booking/google.js returns it
const EVENT = {
  eventId: 'abc123',
  iCalUID: 'abc123@google.com',
  sequence: 0,
  start: '2026-10-21T10:00:00.000Z',
  end: '2026-10-21T10:30:00.000Z',
  meetLink: 'https://meet.google.com/abc-defg-hij',
  organizer: { email: 'hr@tethrhq.com', displayName: '' },
  summary: 'Intro call: Acme and Tethr',
  description: 'Hi Jane,',
  location: '',
  attendees: [{ email: 'jane@acme-example.com', displayName: 'Jane Doe', responseStatus: 'needsAction' }],
}

test('inviteFromEvent: uid, Meet line, location, organizer added as accepted', () => {
  const ics = inviteFromEvent(EVENT, { now: '2026-10-20T00:00:00Z' })
  assert.equal(value(ics, 'UID'), 'UID:abc123@google.com')
  assert.equal(value(ics, 'SEQUENCE'), 'SEQUENCE:0')
  assert.equal(value(ics, 'DESCRIPTION'), 'DESCRIPTION:Hi Jane\\,\\n\\nJoin with Google Meet: https://meet.google.com/abc-defg-hij')
  assert.equal(value(ics, 'LOCATION'), 'LOCATION:https://meet.google.com/abc-defg-hij')
  assert.equal(value(ics, 'X-GOOGLE-CONFERENCE'), 'X-GOOGLE-CONFERENCE:https://meet.google.com/abc-defg-hij')
  assert.equal(value(ics, 'ORGANIZER'), 'ORGANIZER;CN="Tethr":mailto:hr@tethrhq.com')
  assert.deepEqual(logical(ics).filter((l) => l.startsWith('ATTENDEE')), [
    'ATTENDEE;CN="Tethr";CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:hr@tethrhq.com',
    'ATTENDEE;CN="Jane Doe";CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:jane@acme-example.com',
  ])
})

test('inviteFromEvent: an organizer Google listed appears once, as accepted; response statuses map across', () => {
  const ics = inviteFromEvent({
    ...EVENT,
    location: 'Room 1',
    organizer: { email: 'hr@tethrhq.com', displayName: 'Tethr HR' },
    attendees: [
      { email: 'HR@tethrhq.com', displayName: '', responseStatus: 'needsAction' },
      { email: 'a@x.com', displayName: 'A', responseStatus: 'accepted' },
      { email: 'b@x.com', displayName: 'B', responseStatus: 'declined' },
      { email: 'c@x.com', displayName: 'C', responseStatus: 'tentative' },
      { email: 'd@x.com', displayName: 'D' },
    ],
  })
  assert.equal(value(ics, 'LOCATION'), 'LOCATION:Room 1')
  const partstats = logical(ics).filter((l) => l.startsWith('ATTENDEE')).map((l) => /PARTSTAT=([A-Z-]+)/.exec(l)[1])
  assert.deepEqual(partstats, ['ACCEPTED', 'ACCEPTED', 'DECLINED', 'TENTATIVE', 'NEEDS-ACTION'])
  assert.equal(logical(ics).filter((l) => /mailto:hr@tethrhq\.com$/i.test(l) && l.startsWith('ATTENDEE')).length, 1)
  assert.equal(value(ics, 'ORGANIZER'), 'ORGANIZER;CN="Tethr HR":mailto:hr@tethrhq.com')
})

test('inviteFromEvent: with no Meet link there is no Meet line', () => {
  const ics = inviteFromEvent({ ...EVENT, meetLink: '' })
  assert.equal(value(ics, 'DESCRIPTION'), 'DESCRIPTION:Hi Jane\\,')
  assert.equal(value(ics, 'LOCATION'), undefined)
  assert.equal(value(ics, 'X-GOOGLE-CONFERENCE'), undefined)
})

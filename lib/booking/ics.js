// The calendar invite the confirmation email carries: an iCalendar REQUEST
// (RFC 5545 / RFC 5546) for the event Google created. It reuses the event's
// iCalUID, so a client that RSVPs from the card in their inbox answers the
// Google event itself. Pure: no I/O, no env.

const CRLF = '\r\n'
const PARTSTATS = new Set(['NEEDS-ACTION', 'ACCEPTED', 'DECLINED', 'TENTATIVE'])

// Date or ISO string -> 20261021T090000Z
const utc = (value) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

// TEXT values: backslash first, so the escapes added after it stay single
const text = (value) => String(value ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r\n|\r|\n/g, '\\n')

// A quoted parameter value can hold anything but a quote or a line break
const param = (value) => `"${String(value ?? '').replace(/["\r\n]/g, '')}"`

// A mailto: value goes in as it is, so it must not be able to end the line
const address = (value) => String(value ?? '').replace(/[\r\n]/g, '')

/* Lines longer than 75 octets are folded: the first piece holds at most 75
   UTF-8 bytes, each continuation a space and at most 74. Pieces are cut
   between code points, never inside one. */
function fold(line) {
  if (Buffer.byteLength(line) <= 75) return line
  const pieces = []
  let piece = ''
  let bytes = 0
  for (const ch of line) {
    const size = Buffer.byteLength(ch)
    if (bytes + size > (pieces.length ? 74 : 75)) {
      pieces.push(piece)
      piece = ''
      bytes = 0
    }
    piece += ch
    bytes += size
  }
  pieces.push(piece)
  return pieces.join(`${CRLF} `)
}

/* -> the .ics text, CRLF after every line.
   start, end, now: Date or ISO string. organizer { email, name };
   attendees [{ email, name, partstat }], partstat one of NEEDS-ACTION,
   ACCEPTED, DECLINED, TENTATIVE. An attendee listed twice (any case) is kept
   once. */
export function buildInvite({ uid, sequence = 0, start, end, summary, description, location, meetUrl, organizer, attendees = [], now = new Date() }) {
  const seen = new Set()
  const people = attendees.filter((a) => {
    const key = String(a?.email ?? '').toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  const lines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Tethr//Book a Call//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${address(uid)}`,
    `SEQUENCE:${Number.parseInt(sequence, 10) || 0}`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(start)}`,
    `DTEND:${utc(end)}`,
    `SUMMARY:${text(summary)}`,
    ...(description ? [`DESCRIPTION:${text(description)}`] : []),
    ...(location ? [`LOCATION:${text(location)}`] : []),
    `ORGANIZER;CN=${param(organizer?.name)}:mailto:${address(organizer?.email)}`,
    ...people.map((a) => {
      const partstat = PARTSTATS.has(a.partstat) ? a.partstat : 'NEEDS-ACTION'
      const cn = a.name ? `;CN=${param(a.name)}` : ''
      return `ATTENDEE${cn};CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=${partstat};RSVP=${partstat === 'NEEDS-ACTION' ? 'TRUE' : 'FALSE'}:mailto:${address(a.email)}`
    }),
    ...(meetUrl ? [`X-GOOGLE-CONFERENCE:${address(meetUrl)}`] : []),
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join(CRLF) + CRLF
}

const RESPONSE = { needsAction: 'NEEDS-ACTION', accepted: 'ACCEPTED', declined: 'DECLINED', tentative: 'TENTATIVE' }

/* The invite for an event as lib/booking/google.js (or its stand-in in
   mock.js) returns it: { iCalUID, sequence, start, end, summary, description,
   location, meetLink, organizer { email, displayName },
   attendees [{ email, displayName, responseStatus }] }. The organizer is
   listed once, as accepted, whether or not Google listed it. */
export function inviteFromEvent(event, { now } = {}) {
  const meetUrl = event.meetLink || ''
  const organizer = { email: event.organizer?.email ?? '', name: event.organizer?.displayName || 'Tethr' }
  const host = organizer.email.toLowerCase()
  const listed = (event.attendees ?? []).map((a) => ({
    email: a.email,
    name: a.displayName || (String(a.email).toLowerCase() === host ? organizer.name : ''),
    partstat: String(a.email).toLowerCase() === host ? 'ACCEPTED' : RESPONSE[a.responseStatus] ?? 'NEEDS-ACTION',
  }))
  const attendees = listed.some((a) => String(a.email).toLowerCase() === host)
    ? listed
    : [{ email: organizer.email, name: organizer.name, partstat: 'ACCEPTED' }, ...listed]

  return buildInvite({
    uid: event.iCalUID,
    sequence: event.sequence ?? 0,
    start: event.start,
    end: event.end,
    summary: event.summary,
    description: [event.description, meetUrl && `Join with Google Meet: ${meetUrl}`].filter(Boolean).join('\n\n'),
    location: event.location || meetUrl,
    meetUrl,
    organizer,
    attendees,
    ...(now ? { now } : {}),
  })
}

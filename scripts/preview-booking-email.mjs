// Prints the booking confirmation email for a sample booking, to look at in
// a browser or paste into a mail tester. Nothing is sent.
//
//   node scripts/preview-booking-email.mjs > preview.html
//   node scripts/preview-booking-email.mjs --site http://localhost:5173 > preview.html
//   node scripts/preview-booking-email.mjs --no-meet > preview.html
//   node scripts/preview-booking-email.mjs --text
//
// --site <url>  where the images in /email/ are loaded from (default https://tethrhq.com)
// --no-meet     the booking has no Google Meet link
// --text        print the plain-text version instead of the HTML

import { bookingConfirmationEmail } from '../lib/booking/email.js'

const args = process.argv.slice(2)
const siteAt = args.indexOf('--site')
const siteUrl = siteAt >= 0 ? args[siteAt + 1] : undefined
if (siteAt >= 0 && !siteUrl) {
  console.error('--site needs a URL, e.g. --site http://localhost:5173')
  process.exit(1)
}

const start = '2026-10-22T14:30:00.000Z'
const email = bookingConfirmationEmail({
  lead: { name: 'Sarah Chen', headcount: '2-5' },
  start,
  end: new Date(Date.parse(start) + 30 * 60_000).toISOString(),
  zone: 'America/New_York',
  hour12: true,
  meetLink: args.includes('--no-meet') ? '' : 'https://meet.google.com/qkz-wvhd-ntp',
  replyTo: 'hr@tethrhq.com',
  ...(siteUrl ? { siteUrl } : {}),
})

process.stdout.write(args.includes('--text') ? email.text : email.html)

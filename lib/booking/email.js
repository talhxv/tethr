// The confirmation email a client gets after booking a call on /book: the
// subject, the inbox preview line, the HTML and a plain-text twin. Pure —
// Intl only, no secrets, no I/O — so node's test runner and the preview
// script both import it. Sending it is lib/booking/mail.js's job.
//
// The HTML is written for Gmail, Apple Mail and Outlook desktop: tables for
// layout, every style inline, images by absolute URL from <site>/email/. The
// one <style> block only holds a reset and the phone overrides, and the
// email still reads right without it.

import { friendlyZone } from './zones.js'

const SANS = "'Manrope',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const MONO = "Consolas,'SF Mono',Menlo,Monaco,'Courier New',monospace"
const SERIF = "'Instrument Serif',Georgia,'Times New Roman',serif"

const INK = '#001131'
const MUTED = '#667083'
const RULE = '#D6D9DE'
const BLUE = '#2B44FF'
const NAVY = '#001B4D'

const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@1&family=Manrope:wght@400;500;600;700;800&display=swap'

// The <img> files, in the order the email shows them. With inlineImages the
// sender attaches each one under a Content-ID; the two background images
// (chain-corner.png, tether.png) always load from the site.
export const INLINE_IMAGE_FILES = [
  'logo.png', 'booked.png', 'logo-white.png',
  'social-linkedin.png', 'social-facebook.png', 'social-instagram.png', 'social-x.png',
  'wordmark-art.png',
]
const CID_DOMAIN = 'email.tethrhq.com'

const SOCIALS = [
  ['LinkedIn', 'social-linkedin.png', 'https://www.linkedin.com/company/tethrhq'],
  ['Facebook', 'social-facebook.png', 'https://www.facebook.com/tethrhq'],
  ['Instagram', 'social-instagram.png', 'https://www.instagram.com/tethrhq'],
  ['X', 'social-x.png', 'https://twitter.com/tethrhq'],
]

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// Newer ICU puts a narrow no-break space before AM/PM
const plainSpaces = (s) => s.replace(/[  ]/g, ' ')

const TABLE = 'role="presentation" cellpadding="0" cellspacing="0" border="0"'

// Vertical space as a table row, the only kind Outlook keeps to the pixel
const gap = (px) =>
  `<table ${TABLE} width="100%" style="width:100%;"><tr><td height="${px}" style="height:${px}px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr></table>`

// Step 01 speaks to how many roles the lead said they are hiring for
function rolesLine(headcount) {
  if (headcount === '1') return "The role you're hiring for, and what's been hard about filling it."
  if (headcount) return `The ${headcount} roles you're hiring for, and what's been hard about filling them.`
  return "The roles you're hiring for, and what's been hard about filling them."
}

const HOW_LINE = 'Source, screen, shortlist. You only meet the few worth your time.'
const START_LINE = 'Start with one role. No contract required until you\'re ready.'

/* The confirmation for one booking.
   lead { name, headcount }, start and end as ISO strings, zone an IANA id.
   -> { subject, preheader, html, text, inline }
   A meetLink that is not https:// is treated as no link at all.
   inlineImages points every <img> at an embedded image (cid:logo@email.tethrhq.com)
   instead of the site, and inline then lists what the sender has to attach,
   in document order: [{ cid: 'logo@email.tethrhq.com', file: 'logo.png' }].
   Without it inline is []. */
export function bookingConfirmationEmail({
  lead, start, end, meetLink = '', zone, hour12 = true, siteUrl = 'https://tethrhq.com', replyTo = '',
  inlineImages = false,
}) {
  const startMs = Date.parse(start)
  const firstName = String(lead?.name ?? '').trim().split(/\s+/)[0]
  const headcount = String(lead?.headcount ?? '')
  const date = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'long', month: 'long', day: 'numeric' }).format(startMs)
  // hourCycle rather than hour12: false, which prints midnight as 24:00
  const time = plainSpaces(new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hour: 'numeric', minute: '2-digit', ...(hour12 ? { hour12: true } : { hourCycle: 'h23' }),
  }).format(startMs))
  const zoneLabel = friendlyZone(zone, startMs).label
  const minutes = Math.round((Date.parse(end) - startMs) / 60_000)
  const year = new Date(startMs).getUTCFullYear()
  const link = String(meetLink).startsWith('https://') ? String(meetLink) : ''
  const site = String(siteUrl).replace(/\/+$/, '')

  const headline = firstName ? `You're booked, ${firstName}.` : "You're booked."
  const subject = `${headline} ${date} at ${time}`
  const preheader = link
    ? `${minutes} minutes on Google Meet with Tethr. Your join link is inside.`
    : `${minutes} minutes with Tethr. The video link is in your calendar invite.`
  const roles = rolesLine(headcount)

  // Our own copy keeps its plain ASCII apostrophe; only what came from outside is escaped
  const headlineHtml = firstName ? `You're booked, ${esc(firstName)}.` : headline
  const subjectHtml = `${headlineHtml} ${esc(date)} at ${esc(time)}`

  const img = (file) => `${esc(site)}/email/${file}`
  const cidOf = (file) => `${file.replace(/\.png$/, '')}@${CID_DOMAIN}`
  const src = (file) => inlineImages ? `cid:${cidOf(file)}` : img(file)

  const receiptRow = (label, main, note, last) => {
    const edge = `border-top:1.5px dashed ${RULE};${last ? `border-bottom:1.5px dashed ${RULE};` : ''}`
    return `<tr>
<td width="76" valign="top" style="width:76px;padding:13px 0 13px 2px;${edge}font-family:${MONO};font-size:11px;line-height:22px;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};">${label}</td>
<td valign="top" style="padding:13px 2px 13px 12px;${edge}">
<div style="font-family:${SANS};font-weight:600;font-size:15px;line-height:22px;color:${INK};">${main}</div>${note ? `
<div style="font-family:${SANS};font-weight:500;font-size:13px;line-height:19px;color:${MUTED};">${note}</div>` : ''}
</td>
</tr>`
  }

  const whereRow = link
    ? receiptRow('Where', 'Google Meet',
      `<a href="${esc(link)}" style="color:${BLUE};font-weight:600;text-decoration:none;">${esc(link.slice('https://'.length))}</a>`, true)
    : receiptRow('Where', 'Video call', 'Details are in your calendar invite', true)

  const button = link ? `<table ${TABLE} width="100%" style="width:100%;border-collapse:separate;"><tr>
<td align="center" bgcolor="${BLUE}" style="background-color:${BLUE};border-radius:12px;mso-padding-alt:15px 24px;box-shadow:0 8px 24px rgba(43,68,255,0.28);"><a href="${esc(link)}" style="display:block;padding:15px 24px;font-family:${SANS};font-weight:700;font-size:15.5px;line-height:20px;color:#ffffff;text-decoration:none;border-radius:12px;">Join on Google Meet&nbsp;&nbsp;&rarr;</a></td>
</tr></table>
${gap(18)}` : ''

  const reschedule = replyTo ? `${gap(18)}
<a href="mailto:${esc(replyTo)}?subject=Reschedule%20my%20intro%20call" style="display:inline-block;padding:4px 2px;border-bottom:1.5px dashed #BFC4CC;font-family:${MONO};font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${MUTED};text-decoration:none;">RESCHEDULE</a>` : ''

  const step = (number, tag, line, last) => `<tr>
<td width="34" valign="top" style="width:34px;${last ? '' : `background-image:url(${img('tether.png')});background-repeat:repeat-y;background-position:center top;`}">
<table ${TABLE} style="border-collapse:separate;"><tr><td width="34" height="34" align="center" valign="middle" bgcolor="#F3F5FA" style="width:34px;height:34px;box-sizing:border-box;background-color:#F3F5FA;border:1.5px solid ${RULE};border-radius:17px;font-family:${SANS};font-weight:700;font-size:12px;color:${MUTED};">${number}</td></tr></table>
</td>
<td valign="top" style="padding:9px 0 ${last ? 0 : '24px'} 16px;">
<div style="font-family:${MONO};font-size:12px;font-weight:bold;letter-spacing:.18em;text-transform:uppercase;color:${INK};line-height:13px;">${tag}</div>
${gap(6)}
<div style="font-family:${SANS};font-size:14px;line-height:1.55;color:${MUTED};">${line}</div>
</td>
</tr>`

  const socials = SOCIALS.map(([name, file, href], i) =>
    `<td style="padding:0 0 0 ${i ? 14 : 0}px;"><a href="${href}" style="display:block;text-decoration:none;"><img src="${src(file)}" width="22" height="22" alt="${name}" style="display:block;border:0;font-family:${SANS};font-size:11px;color:#ffffff;"></a></td>`).join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<meta name="x-apple-disable-message-reformatting">
<title>${subjectHtml}</title>
<link href="${FONTS_URL.replace(/&/g, '&amp;')}" rel="stylesheet">
<style>
body{margin:0;padding:0}
img{border:0}
table{border-collapse:collapse}
@media (max-width:620px){
.card{border-radius:22px!important}
.card-cell{padding:36px 20px 28px!important;border-radius:22px!important;background-size:99px 211px!important}
.h1{font-size:28px!important}
.booked{width:128px!important;height:auto!important}
.side{padding-left:8px!important;padding-right:8px!important}
.h2{font-size:22px!important}
.footer{border-radius:22px!important}
.footer-cell{padding:28px 20px 0!important}
.closing{font-size:27px!important}
.closing-em{font-size:30px!important}
}
</style>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(preheader)}</div>
<table ${TABLE} width="100%" bgcolor="#ffffff" style="width:100%;background-color:#ffffff;"><tr><td style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table ${TABLE} width="100%" align="center" style="width:100%;max-width:600px;margin:0 auto;">

<tr><td class="side" style="padding:0 6.67%;mso-padding-alt:0 40px;">
<table ${TABLE} width="100%" style="width:100%;"><tr>
<td align="left" valign="middle" style="text-align:left;"><a href="${esc(site)}" style="display:inline-block;text-decoration:none;"><img src="${src('logo.png')}" width="103" height="28" alt="Tethr" style="display:block;border:0;font-family:${SANS};font-size:18px;font-weight:800;color:#0755E9;"></a></td>
<td align="right" valign="middle" style="text-align:right;font-family:${MONO};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};">FOR TALENT. BY TALENT.</td>
</tr></table>
</td></tr>

<tr><td style="padding:0;">${gap(22)}</td></tr>

<tr><td style="padding:0;">
<table ${TABLE} width="100%" class="card" style="width:100%;border-collapse:separate;background-color:#ffffff;border:1px solid #E6E7EA;border-radius:28px;"><tr>
<td class="card-cell" align="center" style="text-align:center;padding:48px 6.67% 34px;mso-padding-alt:48px 40px 34px 40px;border-radius:28px;background-image:url(${img('chain-corner.png')});background-repeat:no-repeat;background-position:right top;background-size:160px 340px;">
<table ${TABLE} align="center" style="margin:0 auto;"><tr><td style="padding:0;"><img class="booked" src="${src('booked.png')}" width="152" height="63" alt="" style="display:block;border:0;"></td></tr></table>
${gap(17)}
<table ${TABLE} align="center" style="margin:0 auto;border-collapse:separate;"><tr><td bgcolor="#A6F2CC" style="background-color:#A6F2CC;border-radius:999px;padding:6px 12px;font-family:${MONO};font-size:11px;letter-spacing:.14em;color:#0B4F33;"><span style="font-size:12px;line-height:12px;vertical-align:middle;letter-spacing:0;color:#1F8F5C;">&#9679;</span><span style="display:inline-block;width:8px;font-size:8px;letter-spacing:0;">&nbsp;</span>CALL BOOKED</td></tr></table>
${gap(18)}
<h1 class="h1" style="margin:0;font-family:${SANS};font-weight:800;font-size:34px;line-height:1.1;letter-spacing:-1px;color:${INK};">${headlineHtml}</h1>
${gap(10)}
<p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.6;color:${MUTED};">Your intro call with Tethr is on the calendar.</p>
${gap(28)}
<table ${TABLE} width="100%" style="width:100%;text-align:left;border-collapse:separate;">
${receiptRow('When', `${esc(date)} <span style="white-space:nowrap">at ${esc(time)}</span>`, esc(zoneLabel), false)}
${receiptRow('Length', `${minutes} minutes`, '', false)}
${whereRow}
</table>
${gap(24)}
${button}<p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.6;color:${MUTED};">Accept the calendar invite to confirm.</p>
<p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.6;color:${MUTED};">Need a new time? Just reply to this email.</p>
${reschedule}
</td>
</tr></table>
</td></tr>

<tr><td style="padding:0;">${gap(44)}</td></tr>

<tr><td class="side" style="padding:0 6.67%;mso-padding-alt:0 40px;text-align:left;">
<table ${TABLE}><tr>
<td valign="middle" style="font-family:${MONO};font-size:13px;letter-spacing:.08em;color:#908F92;">${minutes} MIN</td>
<td valign="middle" style="padding:0 12px;"><table ${TABLE}><tr><td width="64" height="3" bgcolor="#0755E9" style="width:64px;height:3px;background-color:#0755E9;font-size:0;line-height:0;">&nbsp;</td></tr></table></td>
<td valign="middle" style="font-family:${MONO};font-size:13px;font-weight:bold;letter-spacing:.08em;color:#08060d;">INTRO CALL</td>
</tr></table>
${gap(22)}
<h2 class="h2" style="margin:0;font-family:${SANS};font-weight:800;font-size:24px;line-height:1.1;letter-spacing:.01em;color:${INK};">WHAT WE'LL COVER</h2>
${gap(8)}
<p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.6;color:${MUTED};">No prep needed. Just bring the role.</p>
${gap(26)}
<table ${TABLE} width="100%" style="width:100%;">
${step('01', 'YOUR ROLES', rolesLine(esc(headcount)), false)}
${step('02', 'HOW WE WORK', HOW_LINE, false)}
${step('03', 'YOUR START', START_LINE, true)}
</table>
</td></tr>

<tr><td style="padding:0;">${gap(44)}</td></tr>

<tr><td style="padding:0;">
<table ${TABLE} width="100%" class="footer" bgcolor="${NAVY}" style="width:100%;border-collapse:separate;background-color:${NAVY};border-radius:28px;"><tr>
<td class="footer-cell" style="padding:36px 6.67% 0;mso-padding-alt:36px 40px 0 40px;color:#ffffff;text-align:left;">
<table ${TABLE} width="100%" style="width:100%;"><tr>
<td align="left" valign="middle" style="text-align:left;"><img src="${src('logo-white.png')}" width="121" height="31" alt="Tethr" style="display:block;border:0;font-family:${SANS};font-size:18px;font-weight:800;color:#ffffff;"></td>
<td align="right" valign="middle" style="text-align:right;"><table ${TABLE} align="right"><tr>
${socials}
</tr></table></td>
</tr></table>
${gap(32)}
<p class="closing" style="margin:0;font-family:${SANS};font-weight:400;font-size:32px;line-height:1.1;letter-spacing:-1.2px;color:#ffffff;">Let's <em class="closing-em" style="font-family:${SERIF};font-style:italic;font-size:36px;letter-spacing:-0.5px;color:#8FB2FF;">tethr</em> something real.</p>
${gap(32)}
<p style="margin:0;font-family:${SANS};font-size:13px;color:#ffffff;">remote first</p>
${gap(7)}
<table ${TABLE}><tr><td width="220" height="1" bgcolor="#BFC6D2" style="width:220px;height:1px;background-color:#BFC6D2;font-size:0;line-height:0;">&nbsp;</td></tr></table>
${gap(7)}
<p style="margin:0;font-family:${SANS};font-size:12px;color:#ffffff;">All rights reserved. Copyright &copy; ${year} Tethr, pvt ltd</p>
${gap(14)}
<p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:#808DA6;">You're getting this email because you booked a call at <a href="${esc(site)}/book" style="color:#808DA6;text-decoration:none;">tethrhq.com/book</a>.</p>
${gap(32)}
<img src="${src('wordmark-art.png')}" width="395" height="96" alt="" style="display:block;border:0;margin:0 auto;width:76%;max-width:395px;height:auto;">
</td>
</tr></table>
</td></tr>

</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body>
</html>
`

  const text = [
    headline,
    'Your intro call with Tethr is on the calendar.',
    '',
    `When: ${date} at ${time} (${zoneLabel})`,
    `Length: ${minutes} minutes`,
    link ? `Where: Google Meet, ${link}` : 'Where: Video call. Details are in your calendar invite.',
    '',
    'Accept the calendar invite to confirm.',
    'Need a new time? Just reply to this email.',
    '',
    "WHAT WE'LL COVER",
    'No prep needed. Just bring the role.',
    '',
    `01 YOUR ROLES. ${roles}`,
    `02 HOW WE WORK. ${HOW_LINE}`,
    `03 YOUR START. ${START_LINE}`,
    '',
    "You're getting this email because you booked a call at tethrhq.com/book.",
    '',
  ].join('\n')

  const inline = inlineImages
    ? [...new Set([...html.matchAll(/<img\b[^>]*\ssrc="cid:([^"@]+)@/g)].map(m => `${m[1]}.png`))].map(file => ({ cid: cidOf(file), file }))
    : []

  return { subject, preheader, html, text, inline }
}

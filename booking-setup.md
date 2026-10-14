# Tethr Book a Call — Leads + Booking (Notion + Google Calendar)

`/book` form → **`POST /api/lead`** writes the lead to Notion → the card shows
open times from **Google Calendar** → client picks one → **`POST /api/book`**
creates the event (Google emails the invite, with a Meet link) and attaches the
slot to the same Notion row. The client also gets a branded confirmation
email, sent through the Gmail API as the calendar owner, in addition to
Google's own invite.

No third-party form or scheduler. No new npm packages: plain `fetch`.

## This deployment

| Decision | Value |
|---|---|
| Leads database | "Book a Call Leads", under the Notion page **KB - Hiring**, id `3f336375-1b29-813d-8270-d3075740ab2c` (created with `scripts/create-leads-db.mjs`) |
| Notion integration | **Tethr Careers Sync**, the token already in `VITE_NOTION_TOKEN` |
| Calendar | the main calendar of the account behind `hr@tethrhq.com` |
| Google access | one-time OAuth sign-in by that account (refresh token), not a service account |
| Bookable hours | Monday to Friday, 09:00 to 23:00 Pakistan time (`Asia/Karachi`) |
| Other rules | 30-minute calls, 15 minutes clear either side, 12 hours' notice, 14 days ahead |
| Staging | Vercel, which deploys `main` as its **Production** environment |
| Production | the Docker host (`docker-compose.yml`) |

---

## Architecture

```
/book (site)
   │ submit
   ▼
POST /api/lead ──► Notion: new row, Status = "New"        ✗ rejected → nothing saved, retry
   │                                                       ✗ captcha not passed → saved as "Unverified", no picker
   │ 201 { leadId }
   ▼
GET /api/availability ──► Google free/busy + the rules     ✗ 503 → "we'll email you" (lead is saved)
   │ client picks a slot
   ▼
POST /api/book ──► Google: event + Meet + invite email     ✗ 409 slot_taken → pick another
               ├─► Notion: Status = "Call booked", Call time, Meeting link, Calendar event ID
               └─► Gmail: branded confirmation email to the client   ✗ not sent → logged, still booked
   ▼
"You're booked"
```

All logic is in `lib/booking/`. The three entry points only forward to it:
`api/lead.js`, `api/availability.js`, `api/book.js` (Vercel), `server.js`
(Docker), and the `booking-api` middleware in `vite.config.js` (dev/preview).

| File | What it holds |
|---|---|
| `lib/booking/config.js` | Every rule and env var |
| `lib/booking/lead.js` | Field validation + anti-spam (also imported by the form) |
| `lib/booking/slots.js` | Slot generation — pure, tested |
| `lib/booking/notion.js` | Leads database reads/writes |
| `lib/booking/google.js` | `getAccessToken()`, free/busy, event creation |
| `lib/booking/email.js` | The confirmation email template — pure, tested |
| `lib/booking/mail.js` | Builds the MIME message and sends it through the Gmail API |
| `lib/booking/captcha.js` | The captcha's public site key (also imported by the form) |
| `lib/booking/turnstile.js` | Checks a captcha token with Cloudflare |
| `lib/booking/mock.js` | In-memory stand-ins for `BOOKING_MOCK=1` |
| `lib/booking/handlers.js` | The three endpoints |

---

## 1. Environment variables

Server-side only. None start with `VITE_`, so none reach the browser bundle.

| Variable | Required | What it is for |
|---|---|---|
| `NOTION_TOKEN` | yes* | Notion integration token. *Falls back to the existing `VITE_NOTION_TOKEN`, so it can be left unset if that integration can see the leads database. |
| `NOTION_LEADS_DB_ID` | yes | The leads database (step 2). |
| `GOOGLE_CLIENT_ID` | for booking | OAuth client (step 3). |
| `GOOGLE_CLIENT_SECRET` | for booking | OAuth client secret. |
| `GOOGLE_REFRESH_TOKEN` | for booking | Calendar owner's refresh token (step 3). |
| `BOOKING_CALENDAR_ID` | for booking | Calendar to read and book on. The owner's email address for their main calendar. |
| `BOOKING_EMAIL_FROM` | no | Sender of the confirmation email. Default `Tethr <BOOKING_CALENDAR_ID>`. |
| `SITE_URL` | no | Where the confirmation email's images and links point. Default `https://tethrhq.com`. |
| `BOOKING_TIMEZONE` | no | Host timezone. Default `Asia/Karachi`. |
| `BOOKING_DAYS` | no | Working days, `0` = Sunday. Default `1,2,3,4,5`. |
| `BOOKING_START` / `BOOKING_END` | no | Working hours in host time. Default `09:00` / `23:00`. |
| `BOOKING_SLOT_MINUTES` | no | Call length. Default `30`. |
| `BOOKING_BUFFER_MINUTES` | no | Clear time either side of existing events. Default `15`. |
| `BOOKING_MIN_NOTICE_HOURS` | no | Earliest bookable time from now. Default `12`. |
| `BOOKING_HORIZON_DAYS` | no | How far ahead. Default `14`. |
| `TURNSTILE_SECRET_KEY` | for the captcha | Cloudflare Turnstile secret (step 4). Enforced only together with the site key in `lib/booking/captcha.js`; with either missing, every lead is treated as verified and the server says so once in its log. |
| `BOOKING_MOCK` | dev only | `1` = fake Notion and Google in memory, and Cloudflare's test captcha keys. Ignored when `NODE_ENV` or `VERCEL_ENV` is `production`. |

Without the Notion pair, `/api/lead` answers 502 and the form shows "Not
sent". Without the Google four, leads still save and the card falls back to
"we'll reach you at <email>".

## 2. The Notion leads database

Property names must match exactly:

| Property | Type | Notes |
|---|---|---|
| Name | Title | |
| Position / Title | Text | |
| Company | Text | |
| Email | Email | |
| Challenge | Select | options appear as leads arrive; only the list in `lib/booking/lead.js` is accepted |
| Headcount | Select | `1`, `2-5`, `6-10`, `10+` |
| Timeline | Select | `ASAP`, `<1 month`, `Not Defined` |
| Status | Select | `New`, `Call booked`, `Unverified` (saved without passing the captcha; cannot book) |
| Call time | Date | start and end of the booked call |
| Meeting link | URL | the Meet link |
| Calendar event ID | Text | |
| Submitted | Created time | |

This is already done for this deployment (see the table at the top). The
live database was created before `Unverified` existed and needs no change:
Notion adds a select option the first time a row is written with it.

To create it again somewhere else:

1. Pick (or make) the Notion page it should live under and share that page
   with the integration: page menu → **Connections** → add **Tethr Careers
   Sync** (or whichever integration `NOTION_TOKEN` belongs to).
2. Copy the page id (the 32 characters at the end of its URL) and run:

   ```bash
   NOTION_TOKEN=secret_xxx node scripts/create-leads-db.mjs <parent-page-id>
   ```

3. Put the printed id in `NOTION_LEADS_DB_ID`.

The integration needs **Insert content**, **Update content** and **Read
content** capabilities. Building the database by hand works too, as long as
the names and types above match.

## 3. Google Calendar

1. In [Google Cloud Console], create (or pick) a project and enable the
   **Google Calendar API** and the **Gmail API**.
2. **OAuth consent screen**: user type **Internal** if the calendar owner is
   in your Google Workspace. If it has to be **External**, publish it to
   production — refresh tokens for an app left in "Testing" expire after 7 days.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
   Add `http://localhost:53682/callback` as an authorised redirect URI. Note
   the client id and secret.
4. On the calendar owner's machine, signed in as them:

   ```bash
   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/google-oauth-token.mjs
   ```

   Open the printed URL, approve, and copy the refresh token from the terminal.

   In this repo, once the client id and secret are in `.env`, this does the same:

   ```bash
   node --env-file=.env scripts/google-oauth-token.mjs
   ```

   The refresh token then goes in three places as `GOOGLE_REFRESH_TOKEN`: the
   local `.env`, Vercel, and the Docker host's `.env`.
5. Set `BOOKING_CALENDAR_ID` to the owner's email address (or the id of a
   secondary calendar from its settings page). Here: `hr@tethrhq.com`.

Scopes requested: `calendar.events`, `calendar.freebusy` and `gmail.send`.

A deployment set up before the confirmation email existed has a refresh
token without `gmail.send`. Enable the Gmail API in the same Cloud project,
run the token script again (step 4) and replace `GOOGLE_REFRESH_TOKEN` in all
three places. Until then bookings work as before and the server logs
`confirmation email not sent`.

**Service account instead?** With domain-wide delegation, only
`getAccessToken()` in `lib/booking/google.js` changes: sign a JWT with the
service account key (`node:crypto`), impersonating the calendar owner, and
exchange it at the same token endpoint. Nothing else calls Google's auth.

[Google Cloud Console]: https://console.cloud.google.com/

## 4. The captcha (Cloudflare Turnstile)

The form asks Turnstile for a token when the visitor submits, and
`POST /api/lead` checks it with Cloudflare. The check decides what a lead may
do, never whether it is kept:

- Token verified: the lead is saved as `New` and goes on to pick a time.
- Token missing, rejected, or Cloudflare unreachable from the server: the
  lead is still saved, as `Unverified`, and the card ends on "Details
  received, no call booked yet". `POST /api/book` refuses such a lead, so no
  invite goes out and no slot is taken. A person follows up by email.

So a visitor whose ad blocker or firewall blocks Cloudflare still reaches
you; they just can't book online. Look for `Unverified` rows in Notion.

Setting it up:

1. In the [Cloudflare dashboard] (a free account is enough), open
   **Turnstile** and **Add widget**.
2. Hostnames: `tethrhq.com`, `tethr-ruby.vercel.app` and `localhost`.
   Widget mode: **Managed**.
3. Cloudflare shows two keys:
   - **Site key**: public. It is `TURNSTILE_SITE_KEY` in
     `lib/booking/captcha.js` (already set for this deployment). If that
     constant is ever empty the form shows no widget and sends no token.
   - **Secret key**: goes in `TURNSTILE_SECRET_KEY` on the server (section 5),
     never in the code.

The order doesn't matter: the captcha is enforced only when the server has
the secret and the deployed build has the site key. With either one missing
nothing is enforced, every lead is treated as verified, and the server says
which is missing once in its log.

If the log shows `captcha: Cloudflare refused TURNSTILE_SECRET_KEY`, the
secret on that server is wrong (mistyped, cut short, or from another widget).
Bookings keep working, because leads are treated as verified meanwhile, but
the captcha is protecting nothing until the setting is corrected. The line is
logged on every submit until then.

The widget is invisible unless Cloudflare decides the visitor has to do
something; then it appears just above the form's button. Its script is loaded
from `challenges.cloudflare.com` the first time the visitor touches the form,
not on page load.

[Cloudflare dashboard]: https://dash.cloudflare.com/

## 5. Where to set them

**Vercel (staging)** — Project → Settings → Environment Variables. On this
project Vercel deploys `main` as its **Production** environment, and that
deployment is what we call staging. So `NOTION_LEADS_DB_ID`, the Google
four and `TURNSTILE_SECRET_KEY` go in Vercel's **Production** environment (add them to Preview as well if
branch previews should work), plus any `BOOKING_*` rule you want to change.
Redeploy. Never set `BOOKING_MOCK` there.

**Docker (the real production site)** — the names are already passed through
in `docker-compose.yml`; put the values in the `.env` beside it and
`docker compose up -d --build`. The runtime image copies `lib/` alongside
`server.js`.

**Local** — add them to `.env`, or run with no credentials at all:

```bash
BOOKING_MOCK=1 pnpm dev
```

Without `BOOKING_MOCK=1`, `pnpm dev` uses whatever is in `.env`, so a
submitted form writes a real row to the leads database.

Mock mode also answers `POST /api/booking-mock` (dev server and `server.js`
only; there is no Vercel function for it) for forcing the failure paths:
`{ "calendar": "down" }`, `{ "leads": "down" }` (`"up"` to recover),
`{ "take": "<slot ISO start>" }` to have someone else book a slot, and
`{ "markFails": 2 }` to fail the Notion update after a booking, and
`{ "captcha": "off" }` (`"on"` to restore) to behave like a server with no
`TURNSTILE_SECRET_KEY`, and `{ "mail": "down" }` (`"up"` to recover) to fail
the confirmation email.

Mock mode never sends mail. It records each message instead, and the answer
of `/api/booking-mock` lists them under `emails`.

In mock mode the dev server checks tokens against Cloudflare's always-pass
test secret and the form uses the matching test site key, so the whole path
runs (it needs the network). The real keys are ignored there, including a
`TURNSTILE_SECRET_KEY` in `.env`. Add `?turnstile=<site key>` to `/book` to try
Cloudflare's other test keys: `2x00000000000000000000AB` always fails,
`3x00000000000000000000FF` forces the visible challenge, and an empty value
sends no token.

## 6. The API

| Endpoint | Success | Failures |
|---|---|---|
| `POST /api/lead` `{ name, title, company, email, challenge, headcount, timeline, book_ref, elapsedMs, captchaToken }` | `201 { leadId, verified }` | `400 { error: 'invalid', fields }` · `502 { error: 'lead_not_saved' }` |
| `GET /api/availability` | `200 { timezone, slotMinutes, days: [{ date, slots: [ISO] }] }` | `503 { reason: 'calendar_unavailable' }` |
| `POST /api/book` `{ leadId, start, zone, hour12 }` | `200 { start, end, meetLink }` | `400` · `404 { reason: 'lead_not_found' }` · `403 { reason: 'unverified' }` · `409 { reason: 'already_booked' \| 'slot_taken' }` · `502 { error: 'lead_unavailable' }` · `503 { reason: 'calendar_unavailable' }` |

- **Spam.** `book_ref` is a hidden field that must stay empty, and
  `elapsedMs` (page load to submit) must be at least 2.5 seconds. A submission
  failing either gets a normal-looking `201` and is not stored.
- **Captcha.** `captchaToken` is the Turnstile token (section 4). `verified`
  is `false` when the lead was saved as `Unverified`; the form then skips the
  time picker, and `/api/book` answers `403 unverified` for that lead. Bad
  input and bots are decided first, so Cloudflare is only asked about leads
  that would otherwise be saved.
- **Zone and clock.** `zone` is the IANA zone the client picked and `hour12`
  their clock style. Both are optional and default to the host zone and a
  12-hour clock. They only decide how the confirmation email shows the time.
- **Attendee.** The invite and the confirmation email go to the email on the
  Notion row; `/api/book` ignores any email in the request.
- **One event per lead.** The Google event id is the Notion page id, so a
  repeated request cannot create a second event.
- **The invite.** The event is titled "Intro call: <company> and Tethr" and
  its description is written to the client. The lead's name, title, company
  and a link to the Notion row are in the event's `source`, which Google
  shows only to the calendar owner.
- **The confirmation email.** It holds the booked time in the client's zone,
  the call's length, the Meet link and what the call covers. Its images are
  the PNGs in `public/email/`, loaded from `SITE_URL`, so they must be
  deployed for them to show. `node scripts/preview-booking-email.mjs > preview.html`
  renders a sample. A failure to send never fails the booking: the client is
  still booked and the server logs `confirmation email not sent`.
- **If the Notion update fails after the event is created**, it is retried
  once. If that fails too, the client is
  still told they are booked (they are) and the server logs
  `[booking] booking: event <id> created but the Notion row was not updated`.

## 7. Tests

```bash
pnpm test
```

Node's built-in runner, no dependencies: slot generation (notice, horizon,
buffers, weekends, day boundaries, Asia/Karachi, America/New_York across both
clock changes), lead validation and anti-spam, the three endpoints against
the mock, and the confirmation email: its template, the MIME builder and the
send path.

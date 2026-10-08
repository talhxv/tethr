# Tethr Book a Call — Leads + Booking (Notion + Google Calendar)

`/book` form → **`POST /api/lead`** writes the lead to Notion → the card shows
open times from **Google Calendar** → client picks one → **`POST /api/book`**
creates the event (Google emails the invite, with a Meet link) and attaches the
slot to the same Notion row.

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
   │ 201 { leadId }
   ▼
GET /api/availability ──► Google free/busy + the rules     ✗ 503 → "we'll email you" (lead is saved)
   │ client picks a slot
   ▼
POST /api/book ──► Google: event + Meet + invite email     ✗ 409 slot_taken → pick another
               └─► Notion: Status = "Call booked", Call time, Meeting link, Calendar event ID
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
| `BOOKING_TIMEZONE` | no | Host timezone. Default `Asia/Karachi`. |
| `BOOKING_DAYS` | no | Working days, `0` = Sunday. Default `1,2,3,4,5`. |
| `BOOKING_START` / `BOOKING_END` | no | Working hours in host time. Default `09:00` / `23:00`. |
| `BOOKING_SLOT_MINUTES` | no | Call length. Default `30`. |
| `BOOKING_BUFFER_MINUTES` | no | Clear time either side of existing events. Default `15`. |
| `BOOKING_MIN_NOTICE_HOURS` | no | Earliest bookable time from now. Default `12`. |
| `BOOKING_HORIZON_DAYS` | no | How far ahead. Default `14`. |
| `BOOKING_MOCK` | dev only | `1` = fake Notion and Google in memory. Ignored when `NODE_ENV` or `VERCEL_ENV` is `production`. |

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
| Status | Select | `New`, `Call booked` |
| Call time | Date | start and end of the booked call |
| Meeting link | URL | the Meet link |
| Calendar event ID | Text | |
| Submitted | Created time | |

This is already done for this deployment (see the table at the top). To
create it again somewhere else:

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
   **Google Calendar API**.
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

Scopes requested: `calendar.events` and `calendar.freebusy`.

**Service account instead?** With domain-wide delegation, only
`getAccessToken()` in `lib/booking/google.js` changes: sign a JWT with the
service account key (`node:crypto`), impersonating the calendar owner, and
exchange it at the same token endpoint. Nothing else calls Google's auth.

[Google Cloud Console]: https://console.cloud.google.com/

## 4. Where to set them

**Vercel (staging)** — Project → Settings → Environment Variables. On this
project Vercel deploys `main` as its **Production** environment, and that
deployment is what we call staging. So `NOTION_LEADS_DB_ID` and the Google
four go in Vercel's **Production** environment (add them to Preview as well if
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
`{ "markFails": 2 }` to fail the Notion update after a booking.

## 5. The API

| Endpoint | Success | Failures |
|---|---|---|
| `POST /api/lead` `{ name, title, company, email, challenge, headcount, timeline, book_ref, elapsedMs }` | `201 { leadId }` | `400 { error: 'invalid', fields }` · `502 { error: 'lead_not_saved' }` |
| `GET /api/availability` | `200 { timezone, slotMinutes, days: [{ date, slots: [ISO] }] }` | `503 { reason: 'calendar_unavailable' }` |
| `POST /api/book` `{ leadId, start }` | `200 { start, end, meetLink }` | `400` · `404 { reason: 'lead_not_found' }` · `409 { reason: 'already_booked' \| 'slot_taken' }` · `502 { error: 'lead_unavailable' }` · `503 { reason: 'calendar_unavailable' }` |

- **Spam.** `book_ref` is a hidden field that must stay empty, and
  `elapsedMs` (page load to submit) must be at least 2.5 seconds. A submission
  failing either gets a normal-looking `201` and is not stored.
- **Attendee.** The invite goes to the email on the Notion row; `/api/book`
  ignores any email in the request.
- **One event per lead.** The Google event id is the Notion page id, so a
  repeated request cannot create a second event.
- **The invite.** The event is titled "Intro call: <company> and Tethr" and
  its description is written to the client. The lead's name, title, company
  and a link to the Notion row are in the event's `source`, which Google
  shows only to the calendar owner.
- **If the Notion update fails after the event is created**, it is retried
  once. If that fails too, the client is
  still told they are booked (they are) and the server logs
  `[booking] booking: event <id> created but the Notion row was not updated`.

## 6. Tests

```bash
pnpm test
```

Node's built-in runner, no dependencies: slot generation (notice, horizon,
buffers, weekends, day boundaries, Asia/Karachi, America/New_York across both
clock changes), lead validation and anti-spam, and the three endpoints against
the mock.

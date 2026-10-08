// Runs Google's consent flow once, on this machine, for the person whose
// calendar takes the bookings, and prints the refresh token.
//
//   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/google-oauth-token.mjs
//
// The OAuth client must be of type "Web application" with
// http://localhost:53682/callback as an authorised redirect URI (or type
// "Desktop app", which allows any localhost port). See booking-setup.md.
import http from 'node:http'
import { randomBytes } from 'node:crypto'

const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret } = process.env
const PORT = Number(process.env.OAUTH_PORT ?? 53682)
const REDIRECT = `http://localhost:${PORT}/callback`
// Read free/busy, and create events on calendars the account can write to
const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.freebusy']

if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first.')
  process.exit(1)
}

const state = randomBytes(16).toString('hex')
const consent = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: clientId,
  redirect_uri: REDIRECT,
  response_type: 'code',
  scope: SCOPES.join(' '),
  // offline + consent: Google only returns a refresh token on a fresh consent
  access_type: 'offline',
  prompt: 'consent',
  state,
})

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT)
  if (url.pathname !== '/callback') return res.writeHead(404).end()

  const finish = (status, text) => {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(text)
    server.close()
  }
  if (url.searchParams.get('state') !== state) return finish(400, 'State mismatch. Run the script again.')
  if (url.searchParams.get('error')) {
    console.error(`Google returned: ${url.searchParams.get('error')}`)
    return finish(400, 'Consent was not given. You can close this tab.')
  }

  const token = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: url.searchParams.get('code') ?? '',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT,
      grant_type: 'authorization_code',
    }),
  })
  const data = await token.json().catch(() => ({}))
  if (!token.ok || !data.refresh_token) {
    console.error(`No refresh token (${token.status} ${data.error ?? ''}). If this account consented before, remove the app at myaccount.google.com/permissions and run again.`)
    return finish(500, 'No refresh token was returned. See the terminal.')
  }

  console.log('\nKeep this secret. Set it as GOOGLE_REFRESH_TOKEN:\n')
  console.log(data.refresh_token)
  finish(200, 'Done. The refresh token is in your terminal. You can close this tab.')
})

server.listen(PORT, 'localhost', () => {
  console.log('Open this URL in a browser signed in as the calendar owner:\n')
  console.log(consent)
})

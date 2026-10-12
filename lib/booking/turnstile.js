// Checks a Cloudflare Turnstile token with Cloudflare. Server-side only.
// The answer decides what a lead may do, never whether it is kept: an
// unverified lead is still saved, it just can't book a call.
import { captchaSecret, captchaSiteKey } from './config.js'

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const MAX_TOKEN_LENGTH = 2048 // Cloudflare's stated limit

// Cloudflare's codes for a secret it doesn't recognise: our setting, not the visitor
const SECRET_REFUSED = ['invalid-input-secret', 'missing-input-secret']

let saidNoSecret = false
let saidNoSiteKey = false

/* -> { verified, reason, codes? }
   reason is one of:
     not_enforced   no secret on this server, or no site key in this build
                    (so the form can't send a token); every lead counts as
                    verified
     misconfigured  Cloudflare refused our secret. Also verified: a wrong
                    setting must not stop every booking. Logged each time.
     ok             Cloudflare accepted the token
     missing_token  the form sent none (widget blocked, failed, or skipped)
     rejected       Cloudflare turned the token down (codes says why; a spent
                    or expired token is "timeout-or-duplicate")
     timeout        Cloudflare didn't answer in time
     unreachable    the request to Cloudflare failed
   Neither the secret nor the token is ever logged or returned. */
export async function verifyCaptcha(token, { secret = captchaSecret(), siteKey = captchaSiteKey(), fetchImpl = fetch, timeoutMs = 4000 } = {}) {
  if (!secret) {
    if (!saidNoSecret) {
      saidNoSecret = true
      console.warn('[booking] captcha: TURNSTILE_SECRET_KEY is not set, so the captcha is not enforced and every lead is treated as verified')
    }
    return { verified: true, reason: 'not_enforced' }
  }
  // Without a site key the form shows no widget, so no real visitor could
  // pass. The constant ships with this code; a bot can't empty it.
  if (!siteKey) {
    if (!saidNoSiteKey) {
      saidNoSiteKey = true
      console.warn('[booking] captcha: TURNSTILE_SECRET_KEY is set but TURNSTILE_SITE_KEY in lib/booking/captcha.js is empty, so the form cannot send a token; the captcha is not enforced and every lead is treated as verified')
    }
    return { verified: true, reason: 'not_enforced' }
  }
  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN_LENGTH) return { verified: false, reason: 'missing_token' }

  try {
    const res = await fetchImpl(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }).toString(),
      signal: AbortSignal.timeout(timeoutMs),
    })
    // Cloudflare answers a secret it doesn't recognise with a 400 that still
    // carries the codes, so read the body before judging the status
    const data = await res.json().catch(() => null)
    const codes = Array.isArray(data?.['error-codes']) ? data['error-codes'].map(String) : []
    const refused = codes.find((c) => SECRET_REFUSED.includes(c))
    if (refused) {
      console.error(`[booking] captcha: Cloudflare refused TURNSTILE_SECRET_KEY (${refused}). The captcha is NOT protecting the form until that setting is corrected; leads are being treated as verified meanwhile`)
      return { verified: true, reason: 'misconfigured', codes }
    }
    if (!res.ok || !data) return { verified: false, reason: 'unreachable', ...(res.ok ? {} : { codes: [`http-${res.status}`] }) }
    if (data.success === true) return { verified: true, reason: 'ok' }
    return { verified: false, reason: 'rejected', codes }
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError'
    return { verified: false, reason: timedOut ? 'timeout' : 'unreachable' }
  }
}

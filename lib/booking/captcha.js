// Cloudflare Turnstile, the public half: imported by the /book form and by
// the server, so nothing secret belongs here. The secret half is
// TURNSTILE_SECRET_KEY, read in config.js and used only by turnstile.js.

// The widget's site key from the Cloudflare dashboard. It is public by
// design. If this is ever empty the form shows no widget, sends no token,
// and the server stops enforcing.
export const TURNSTILE_SITE_KEY = '0x4AAAAAAFVCJjakjjSa9tlo'

// Cloudflare's published always-pass test key; the form uses it when the dev
// server runs with BOOKING_MOCK=1
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'

// The field of POST /api/lead that carries the widget's token
export const CAPTCHA_FIELD = 'captchaToken'

/* How long the form waits for a token. After a widget error the form runs
   the widget again, up to a point.
     CAPTCHA_RETRY_INTERVAL_MS  the pause before each retry
     CAPTCHA_MAX_ERRORS         errors in one submit before the form gives up
     CAPTCHA_WAIT_MS            the whole wait, however it is going */
export const CAPTCHA_RETRY_INTERVAL_MS = 2000
export const CAPTCHA_MAX_ERRORS = 3
export const CAPTCHA_WAIT_MS = 10000

/* Widget error codes a retry cannot fix, from Cloudflare's client-side error
   table (the rows marked "Retry: No"): the site key or hostname is refused,
   the visitor's clock is wrong, or the browser is unsupported. Every other
   code, known or not, is worth another attempt. */
const FINAL_CAPTCHA_ERRORS = [
  '110100', // invalid sitekey
  '110110', // sitekey not found
  '110200', // domain not authorized
  '110500', // unsupported browser (from earlier Cloudflare docs; not in the current table)
  '110510', // inconsistent user agent (as above)
  '200100', // clock or cache problem
  '400020', // invalid sitekey
  '400021', // sitekey domain mismatch
  '400070', // sitekey disabled
]

export const captchaErrorIsFinal = (code) => FINAL_CAPTCHA_ERRORS.includes(String(code ?? '').trim())

// After the errors-th error of one submit, with this code: stop waiting?
export const captchaGivesUp = (code, errors) => captchaErrorIsFinal(code) || errors >= CAPTCHA_MAX_ERRORS

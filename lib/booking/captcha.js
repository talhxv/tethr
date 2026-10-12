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

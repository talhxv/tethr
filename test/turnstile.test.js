// verifyCaptcha against stand-ins for Cloudflare's siteverify. No network.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyCaptcha } from '../lib/booking/turnstile.js'
import { captchaSecret, captchaSiteKey } from '../lib/booking/config.js'
import {
  TURNSTILE_SITE_KEY, CAPTCHA_MAX_ERRORS, CAPTCHA_RETRY_INTERVAL_MS, CAPTCHA_WAIT_MS,
  captchaErrorIsFinal, captchaGivesUp,
} from '../lib/booking/captcha.js'

const SECRET = 'test-secret-not-real'
// A server that enforces: it has a secret, and its build has a site key
const ON = { secret: SECRET, siteKey: 'test-site-key' }
const answer = (body, status = 200) => async () => new Response(JSON.stringify(body), { status })

test('a token Cloudflare accepts is verified, and the request is the documented form post', async () => {
  let seen
  const fetchImpl = async (url, init) => { seen = { url, init }; return new Response(JSON.stringify({ success: true }), { status: 200 }) }
  assert.deepEqual(await verifyCaptcha('good-token', { ...ON, fetchImpl }), { verified: true, reason: 'ok' })
  assert.equal(seen.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify')
  assert.equal(seen.init.method, 'POST')
  assert.equal(seen.init.headers['Content-Type'], 'application/x-www-form-urlencoded')
  const sent = new URLSearchParams(seen.init.body)
  assert.equal(sent.get('secret'), SECRET)
  assert.equal(sent.get('response'), 'good-token')
  assert.ok(seen.init.signal instanceof AbortSignal)
})

test('a token Cloudflare turns down is not verified, with its codes', async () => {
  assert.deepEqual(
    await verifyCaptcha('bad-token', { ...ON, fetchImpl: answer({ success: false, 'error-codes': ['invalid-input-response'] }) }),
    { verified: false, reason: 'rejected', codes: ['invalid-input-response'] })
})

test('a token that was already spent is rejected', async () => {
  assert.deepEqual(
    await verifyCaptcha('spent-token', { ...ON, fetchImpl: answer({ success: false, 'error-codes': ['timeout-or-duplicate'] }) }),
    { verified: false, reason: 'rejected', codes: ['timeout-or-duplicate'] })
})

test('no token, an empty one or an oversized one never reaches Cloudflare', async () => {
  let calls = 0
  const fetchImpl = async () => { calls++; return new Response('{}') }
  for (const token of [undefined, null, '', 42, {}, 'x'.repeat(2049)]) {
    assert.deepEqual(await verifyCaptcha(token, { ...ON, fetchImpl }), { verified: false, reason: 'missing_token' })
  }
  assert.equal(calls, 0)
})

test('a network error is unreachable, not a crash', async () => {
  const fetchImpl = async () => { throw new TypeError('fetch failed') }
  assert.deepEqual(await verifyCaptcha('token', { ...ON, fetchImpl }), { verified: false, reason: 'unreachable' })
})

test('a bad status or a body that is not JSON is unreachable', async () => {
  assert.deepEqual(await verifyCaptcha('token', { ...ON, fetchImpl: answer({}, 503) }), { verified: false, reason: 'unreachable', codes: ['http-503'] })
  assert.deepEqual(await verifyCaptcha('token', { ...ON, fetchImpl: async () => new Response('<html>', { status: 200 }) }), { verified: false, reason: 'unreachable' })
})

test('a slow Cloudflare times out', async () => {
  // Never answers; gives up only when the abort signal fires
  const fetchImpl = (url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)))
  // AbortSignal.timeout's timer doesn't hold the process open, and here
  // nothing else does (a server always has its listener)
  const keepAlive = setTimeout(() => {}, 5000)
  const started = Date.now()
  try {
    assert.deepEqual(await verifyCaptcha('token', { ...ON, fetchImpl, timeoutMs: 60 }), { verified: false, reason: 'timeout' })
    assert.ok(Date.now() - started < 2000)
  } finally {
    clearTimeout(keepAlive)
  }
})

test('with no secret nothing is enforced: every lead is verified and Cloudflare is not called', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {})
  let calls = 0
  const fetchImpl = async () => { calls++; return new Response('{}') }
  assert.deepEqual(await verifyCaptcha(undefined, { ...ON, secret: '', fetchImpl }), { verified: true, reason: 'not_enforced' })
  assert.deepEqual(await verifyCaptcha('anything', { ...ON, secret: '', fetchImpl }), { verified: true, reason: 'not_enforced' })
  assert.equal(calls, 0)
  // Said once, plainly, and never again
  assert.equal(warn.mock.callCount(), 1)
  assert.match(warn.mock.calls[0].arguments[0], /TURNSTILE_SECRET_KEY is not set/)
})

test('a secret with no site key in the build is not enforced either: no visitor could send a token', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {})
  let calls = 0
  const fetchImpl = async () => { calls++; return new Response('{}') }
  assert.deepEqual(await verifyCaptcha(undefined, { secret: SECRET, siteKey: '', fetchImpl }), { verified: true, reason: 'not_enforced' })
  assert.deepEqual(await verifyCaptcha('a-token', { secret: SECRET, siteKey: '', fetchImpl }), { verified: true, reason: 'not_enforced' })
  assert.equal(calls, 0)
  assert.equal(warn.mock.callCount(), 1)
  assert.match(warn.mock.calls[0].arguments[0], /TURNSTILE_SECRET_KEY is set but TURNSTILE_SITE_KEY .* is empty/)
  assert.ok(!warn.mock.calls[0].arguments[0].includes(SECRET))
})

test('a secret Cloudflare refuses is our mistake, not the visitor: verified, and logged every time', async (t) => {
  const error = t.mock.method(console, 'error', () => {})
  for (const code of ['invalid-input-secret', 'missing-input-secret']) {
    assert.deepEqual(
      await verifyCaptcha('a-token', { ...ON, fetchImpl: answer({ success: false, 'error-codes': [code] }) }),
      { verified: true, reason: 'misconfigured', codes: [code] })
  }
  // What Cloudflare really sends for a wrong secret: the code, on a 400
  assert.deepEqual(
    await verifyCaptcha('a-token', { ...ON, fetchImpl: answer({ success: false, 'error-codes': ['invalid-input-secret'] }, 400) }),
    { verified: true, reason: 'misconfigured', codes: ['invalid-input-secret'] })
  assert.equal(error.mock.callCount(), 3)
  const line = error.mock.calls[0].arguments[0]
  assert.match(line, /Cloudflare refused TURNSTILE_SECRET_KEY \(invalid-input-secret\)/)
  assert.ok(!line.includes(SECRET) && !line.includes('a-token'))
})

test('an ordinary rejection is still about the visitor: not verified', async (t) => {
  const error = t.mock.method(console, 'error', () => {})
  for (const codes of [['invalid-input-response'], ['timeout-or-duplicate'], ['bad-request'], []]) {
    const res = await verifyCaptcha('a-token', { ...ON, fetchImpl: answer({ success: false, 'error-codes': codes }) })
    assert.deepEqual(res, { verified: false, reason: 'rejected', codes })
  }
  assert.equal(error.mock.callCount(), 0)
})

test('nothing a caller can see carries the secret or the token', async () => {
  const outcomes = [
    await verifyCaptcha('the-token', { ...ON, fetchImpl: answer({ success: true }) }),
    await verifyCaptcha('the-token', { ...ON, fetchImpl: answer({ success: false, 'error-codes': ['invalid-input-secret'] }) }),
    await verifyCaptcha('the-token', { ...ON, fetchImpl: async () => { throw new Error(`boom ${SECRET} the-token`) } }),
  ]
  for (const o of outcomes) {
    assert.ok(!JSON.stringify(o).includes(SECRET))
    assert.ok(!JSON.stringify(o).includes('the-token'))
  }
})

test('the secret comes from TURNSTILE_SECRET_KEY; mock mode always uses the test secret, production never does', () => {
  assert.equal(captchaSecret({}), '')
  assert.equal(captchaSecret({ TURNSTILE_SECRET_KEY: 'real' }), 'real')
  assert.equal(captchaSecret({ BOOKING_MOCK: '1' }), '1x0000000000000000000000000000000AA')
  // A real secret in .env must not leak into the mock: the form sends
  // test-key tokens there, which a real secret rejects
  assert.equal(captchaSecret({ BOOKING_MOCK: '1', TURNSTILE_SECRET_KEY: 'real' }), '1x0000000000000000000000000000000AA')
  assert.equal(captchaSecret({ BOOKING_MOCK: '1', NODE_ENV: 'production' }), '')
  assert.equal(captchaSecret({ BOOKING_MOCK: '1', VERCEL_ENV: 'production' }), '')
  assert.equal(captchaSecret({ BOOKING_MOCK: '1', NODE_ENV: 'production', TURNSTILE_SECRET_KEY: 'real' }), 'real')
})

test('the site key is the constant in captcha.js; mock mode always uses the test key, production never does', () => {
  assert.equal(captchaSiteKey({}), TURNSTILE_SITE_KEY)
  assert.equal(captchaSiteKey({ BOOKING_MOCK: '1' }), '1x00000000000000000000AA')
  assert.equal(captchaSiteKey({ BOOKING_MOCK: '1', NODE_ENV: 'production' }), TURNSTILE_SITE_KEY)
})

test('the form retries a widget error unless the code is one a retry cannot fix', () => {
  // Cloudflare's "Retry: No" rows: site key, hostname, clock, browser
  for (const code of ['110100', '110110', '110200', '110500', '110510', '200100', '400020', '400021', '400070', 400020]) {
    assert.equal(captchaErrorIsFinal(code), true, String(code))
    assert.equal(captchaGivesUp(code, 1), true, String(code))
  }
  // Challenge failures, timeouts, a frame that didn't load, and codes nobody has listed
  for (const code of ['300010', '600010', '110600', '110620', '200500', '999999', '', undefined, null]) {
    assert.equal(captchaErrorIsFinal(code), false, String(code))
    assert.equal(captchaGivesUp(code, 1), false, String(code))
    assert.equal(captchaGivesUp(code, CAPTCHA_MAX_ERRORS - 1), false, String(code))
    assert.equal(captchaGivesUp(code, CAPTCHA_MAX_ERRORS), true, String(code))
  }
})

test('the retries fit inside the wait, and the wait is one a visitor will sit through', () => {
  assert.equal(CAPTCHA_MAX_ERRORS, 3)
  assert.ok((CAPTCHA_MAX_ERRORS - 1) * CAPTCHA_RETRY_INTERVAL_MS < CAPTCHA_WAIT_MS)
  assert.ok(CAPTCHA_WAIT_MS <= 12000)
})

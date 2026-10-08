import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateLead, isSpam, HONEYPOT_FIELD, MIN_FILL_MS, MAX_LENGTH, CHALLENGES } from '../lib/booking/lead.js'

const GOOD = {
  name: 'Ada Lovelace', title: 'VP Engineering', company: 'TechCorp LLC', email: 'ada@techcorp.com',
  challenge: 'Hiring takes too long', headcount: '2-5', timeline: 'ASAP',
}

test('a complete lead passes and comes back trimmed', () => {
  const { lead, errors } = validateLead({ ...GOOD, name: '  Ada Lovelace  ', extra: 'ignored' })
  assert.deepEqual(errors, {})
  assert.deepEqual(lead, GOOD)
})

test('every field is required', () => {
  const { errors } = validateLead({})
  assert.deepEqual(Object.keys(errors).sort(), Object.keys(GOOD).sort())
  assert.equal(errors.name, 'Enter your name.')
  assert.deepEqual(Object.keys(validateLead(null).errors).length, 7)
  assert.equal(validateLead({ ...GOOD, company: '   ' }).errors.company, 'Enter your company name.')
})

test('non-string values count as missing', () => {
  const { errors } = validateLead({ ...GOOD, name: { a: 1 }, email: ['x@y.zz'] })
  assert.ok(errors.name && errors.email)
})

test('email format', () => {
  for (const bad of ['nope', 'a@b', 'a b@c.com', '@c.com', 'a@.']) {
    assert.equal(validateLead({ ...GOOD, email: bad }).errors.email, 'Enter a valid email address.', bad)
  }
  assert.equal(validateLead({ ...GOOD, email: 'first.last+tag@sub.example.co' }).errors.email, undefined)
})

test('challenge, headcount and timeline must come from their fixed sets', () => {
  assert.equal(validateLead({ ...GOOD, challenge: 'Anything I like' }).errors.challenge, 'Select a challenge.')
  for (const challenge of CHALLENGES) assert.deepEqual(validateLead({ ...GOOD, challenge }).errors, {})
  assert.ok(validateLead({ ...GOOD, headcount: '3' }).errors.headcount)
  assert.ok(validateLead({ ...GOOD, timeline: 'Soon' }).errors.timeline)
  for (const headcount of ['1', '2-5', '6-10', '10+']) assert.deepEqual(validateLead({ ...GOOD, headcount }).errors, {})
  for (const timeline of ['ASAP', '<1 month', 'Not Defined']) assert.deepEqual(validateLead({ ...GOOD, timeline }).errors, {})
})

test('length caps', () => {
  for (const field of Object.keys(MAX_LENGTH)) {
    const at = field === 'email' ? 'a'.repeat(MAX_LENGTH.email - 6) + '@b.com' : 'x'.repeat(MAX_LENGTH[field])
    assert.equal(validateLead({ ...GOOD, [field]: at }).errors[field], undefined, `${field} at the cap`)
    assert.ok(validateLead({ ...GOOD, [field]: 'y' + at }).errors[field], `${field} over the cap`)
  }
})

test('spam: a filled honeypot is dropped', () => {
  assert.equal(isSpam({ ...GOOD, elapsedMs: 60_000, [HONEYPOT_FIELD]: '' }), false)
  assert.equal(isSpam({ ...GOOD, elapsedMs: 60_000 }), false)
  assert.equal(isSpam({ ...GOOD, elapsedMs: 60_000, [HONEYPOT_FIELD]: 'http://spam.example' }), true)
  assert.equal(isSpam({ ...GOOD, elapsedMs: 60_000, [HONEYPOT_FIELD]: ['x'] }), true)
})

test('spam: submitted faster than a person could, or without a time at all', () => {
  assert.equal(isSpam({ ...GOOD, elapsedMs: MIN_FILL_MS - 1 }), true)
  assert.equal(isSpam({ ...GOOD, elapsedMs: MIN_FILL_MS }), false)
  assert.equal(isSpam({ ...GOOD }), true)
  assert.equal(isSpam({ ...GOOD, elapsedMs: 'soon' }), true)
  assert.equal(isSpam(null), true)
})

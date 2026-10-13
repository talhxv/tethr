import stackSource    from '../assets/hiringsource.svg'
import stackScreen    from '../assets/hiringscreen.svg'
import stackShortlist from '../assets/hiringshortlist.svg'
import chainOutline from '../assets/chainoutlinevector.svg'
import arrowRight from '../assets/arrowright.svg'
// The same rules POST /api/lead applies
import { VALIDATORS, CHALLENGES, HEADCOUNTS, TIMELINES, HONEYPOT_FIELD } from '../../lib/booking/lead.js'
// Zone naming and slot grouping, tested in test/zones.test.js
import { friendlyZone, zoneAbbreviation, offsetMinutes, standardOffsetMinutes, groupByZoneDay, groupByPartOfDay, railFor, listZones } from '../../lib/booking/zones.js'
import { landDots, COLS, ROWS, lonToCol, latToRow } from '../lib/dot-world.js'
import {
  TURNSTILE_SITE_KEY, TURNSTILE_TEST_SITE_KEY, CAPTCHA_FIELD,
  CAPTCHA_RETRY_INTERVAL_MS, CAPTCHA_WAIT_MS, captchaGivesUp,
} from '../../lib/booking/captcha.js'

/* The captcha's site key for this page. Empty means no widget and no token.
   On the dev server's in-memory mock (vite.config.js sets __BOOKING_MOCK__)
   it is Cloudflare's always-pass test key, and ?turnstile=<key> swaps in
   another test key, or none, to try the other paths. */
/* global __BOOKING_MOCK__ */
const ON_MOCK = typeof __BOOKING_MOCK__ !== 'undefined' && __BOOKING_MOCK__
const SITE_KEY = ON_MOCK
  ? new URLSearchParams(window.location.search).get('turnstile') ?? TURNSTILE_TEST_SITE_KEY
  : TURNSTILE_SITE_KEY
const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

// Same funnel as the homepage hiring section's step 02 diagram
const STEPS = [
  { num: '01', tag: 'Source',    text: 'We map the market\'s top talent for your role' },
  { num: '02', tag: 'Screen',    text: 'Skills, communication, and fit, tested by us' },
  { num: '03', tag: 'Shortlist', text: 'You only meet the few worth your time' },
]

const TEXT_FIELDS = [
  { name: 'name',    label: 'Name',             type: 'text',  placeholder: 'First and last name', autocomplete: 'name' },
  { name: 'title',   label: 'Position / Title', type: 'text',  placeholder: 'e.g. VP Engineering', autocomplete: 'organization-title' },
  { name: 'company', label: 'Company Name',     type: 'text',  placeholder: 'e.g. TechCorp LLC',   autocomplete: 'organization' },
  { name: 'email',   label: 'Email Address',    type: 'email', placeholder: 'you@company.com',     autocomplete: 'email' },
]

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/* The end-state mark: the complete chain link from navbarchainlink.svg, its
   two links and connector bar split into separate paths so they can close
   and lock. Booked = locked, with the sent badge. Not booked = the links
   held apart on a dashed tether, no badge. */
const MARK = `
      <span class="book-mark" aria-hidden="true">
        <svg class="book-mark__svg" viewBox="-2.2 -1 18.3 6.4" fill="currentColor">
          <line class="book-mark__tether" x1="4.4" y1="2.21" x2="9.5" y2="2.21" />
          <path class="book-mark__link book-mark__link--l" d="M4.75195 0C5.67337 0.000126237 6.46188 0.565786 6.79199 1.36816H5.59766C5.39561 1.17821 5.12443 1.06055 4.8252 1.06055H2.13281C1.50968 1.06055 1.00433 1.56545 1.00391 2.18848C1.00393 2.81185 1.50943 3.31738 2.13281 3.31738H4.8252C5.08614 3.31738 5.3254 3.22783 5.5166 3.0791H6.77734C6.43908 3.86349 5.66021 4.41296 4.75195 4.41309H2.20605C0.987671 4.41292 2.22361e-05 3.42447 0 2.20605C0.00032914 0.987899 0.98786 0.000160668 2.20605 0H4.75195Z"/>
          <path class="book-mark__link book-mark__link--r" d="M11.7109 0C12.9289 0.000371713 13.9166 0.98805 13.917 2.20605C13.9169 3.42426 12.9291 4.41271 11.7109 4.41309H9.16504C8.25683 4.41296 7.47794 3.86347 7.13965 3.0791H8.39941C8.59073 3.22806 8.83054 3.31738 9.0918 3.31738H11.7852C12.408 3.31695 12.9128 2.81231 12.9131 2.18945C12.9129 1.56649 12.4081 1.06098 11.7852 1.06055H9.0918C8.79262 1.06055 8.52137 1.17815 8.31934 1.36816H7.125C7.45512 0.56579 8.24364 0.000123454 9.16504 0H11.7109Z"/>
          <path class="book-mark__bar" d="M4.46582 2.2063C4.46582 1.9626 4.66338 1.76505 4.90708 1.76505H9.31967C9.56337 1.76505 9.76093 1.9626 9.76093 2.2063C9.76093 2.45 9.56337 2.64756 9.31967 2.64756H4.90708C4.66338 2.64756 4.46582 2.45 4.46582 2.2063Z"/>
        </svg>
        <span class="book-mark__badge">
          <svg viewBox="0 0 16 16" fill="none"><path d="M4 8.4l2.7 2.7L12 5.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      </span>`

const errorSlot = (name) => `<p class="book-error" id="book-${name}-error" aria-live="polite"></p>`

// Timeline rail pieces: the outer options sit in equal side cells with a
// tether each, which keeps the middle node on the field's centre line
const TETHER = '<span class="book-time__tether" aria-hidden="true"></span>'

const timelineOpt = (t) => `
          <label class="book-time__opt">
            <input type="radio" name="timeline" value="${esc(t)}" required />
            <span class="book-time__node" aria-hidden="true"></span>
            <span class="book-time__label">${esc(t)}</span>
          </label>`

const api = (path, body) => fetch(path, body ? {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
} : { headers: { Accept: 'application/json' } })

/* Saves the lead. Takes { name, title, company, email, challenge, headcount,
   timeline } plus the anti-spam fields and the captcha token, resolves with
   { id, verified }, and rejects on any failure. verified is false when the
   lead was saved but didn't pass the captcha, so it can't go on to book. A
   rejection carries `fields` ({ name: message }) when the server turned the
   input down. */
export async function submitLead(data) {
  const res = await api('/api/lead', data)
  const body = await res.json().catch(() => ({}))
  if (res.status === 201 && body.leadId) return { id: body.leadId, verified: body.verified !== false }
  throw Object.assign(new Error('Lead not saved'), { fields: res.status === 400 ? body.fields : undefined })
}

// -> { slots: [ms], hostZone }: every open slot as an instant, plus the zone
// Tethr's calendar runs in; throws when the calendar can't be read
async function loadSlots() {
  const res = await api('/api/availability')
  if (!res.ok) throw new Error('Calendar unavailable')
  const { days = [], timezone } = await res.json()
  const slots = days.flatMap(d => d.slots).map(iso => Date.parse(iso)).filter(Number.isFinite).sort((a, b) => a - b)
  return { slots, hostZone: timezone }
}

// The zone the browser reports; the visitor can change it in the picker
const DETECTED_ZONE = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
})()

// 12- or 24-hour to suit the visitor; the words stay English like the page
const HOUR12 = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12

// Formatters for one zone: { time, dow, day, full }
const zoneFormats = new Map()
function fmtIn(zone) {
  if (!zoneFormats.has(zone)) {
    const fmt = (opts) => new Intl.DateTimeFormat('en-US', { ...opts, timeZone: zone })
    zoneFormats.set(zone, {
      time: fmt({ hour: 'numeric', minute: '2-digit', hour12: HOUR12 }),
      dow:  fmt({ weekday: 'short' }),
      day:  fmt({ month: 'short', day: 'numeric' }),
      full: fmt({ weekday: 'long', month: 'long', day: 'numeric' }),
    })
  }
  return zoneFormats.get(zone)
}

/* The zone chooser's picture: the world as dots, the visitor's band and
   Tethr's band lit, a tether arc between them. It only confirms the choice
   made on the rail; it is not a control. */
const DOTS = landDots()
const CELL = 10

function worldMap(zone, hostZone) {
  // 4 minutes of clock per degree; the standard offset, because daylight
  // saving would shift a zone 15° east of where it is
  const bandCol = (tz) => lonToCol(standardOffsetMinutes(tz) / 4)
  const you = bandCol(zone)
  const host = bandCol(hostZone)
  const apart = Math.abs(you - host) >= 1
  const x = (col) => (col + 0.5) * CELL
  // Sit each marker on land in its band where it can, near 35°N
  const home = latToRow(35)
  const rowFor = (col) => {
    const rows = DOTS.filter(([c]) => c === Math.round(col)).map(([, r]) => r)
    return rows.length ? rows.reduce((a, b) => Math.abs(b - home) < Math.abs(a - home) ? b : a) : Math.round(home)
  }
  const y = (col) => (rowFor(col) + 0.5) * CELL
  const dots = DOTS.map(([c, r]) => {
    const cls = Math.abs(c - you) < 1 ? ' class="is-you"' : Math.abs(c - host) < 1 ? ' class="is-host"' : ''
    return `<circle${cls} cx="${x(c)}" cy="${(r + 0.5) * CELL}" r="2.6"/>`
  }).join('')
  const lift = Math.max(8, Math.min(y(you), y(host)) - 22 - Math.abs(you - host) * 1.4)
  const label = (col, text, anchorY) => `<text x="${Math.max(18, Math.min(COLS * CELL - 18, x(col)))}" y="${anchorY}" text-anchor="middle">${text}</text>`
  return `
    <svg viewBox="0 0 ${COLS * CELL} ${ROWS * CELL}" role="presentation">
      <g class="book-zmap__dots">${dots}</g>
      ${apart ? `<path class="book-zmap__arc" d="M${x(you)} ${y(you)} Q${(x(you) + x(host)) / 2} ${lift} ${x(host)} ${y(host)}"/>` : ''}
      ${apart ? `<circle class="book-zmap__host" cx="${x(host)}" cy="${y(host)}" r="5"/>${label(host, 'TETHR', y(host) + 17)}` : ''}
      <circle class="book-zmap__you" cx="${x(you)}" cy="${y(you)}" r="5"/>
      ${label(you, apart ? 'YOU' : 'YOU · TETHR', y(you) + 17)}
    </svg>`
}

export const html = `
<section class="book-section" id="book">

  <div class="book-intro">
    <div class="section-label">
      <span class="section-label__num">00</span>
      <span class="section-label__line"></span>
      <span class="section-label__title">HIRING</span>
    </div>
    <h1 class="book-headline">Let's get started</h1>
    <p class="book-sub">Start with one role. No contract required until you're ready.</p>
  </div>

  <div class="book-card">
    <span class="book-card__chain-clip" aria-hidden="true">
      <img src="${chainOutline}" class="book-card__chain" alt="" />
    </span>

    <form class="book-form" id="bookForm" novalidate>
      <div class="book-hp" aria-hidden="true">
        <label for="book-ref">Leave this field empty</label>
        <input id="book-ref" name="${HONEYPOT_FIELD}" type="text" tabindex="-1" autocomplete="off" />
      </div>
      <h2 class="book-card__title">Book a Call</h2>
      <p class="book-card__sub">Takes about a minute. Then pick a time that works for you.</p>

      ${TEXT_FIELDS.map(f => `
      <div class="book-field" data-field="${f.name}">
        <label class="book-label" for="book-${f.name}">${f.label}</label>
        <input class="book-input" id="book-${f.name}" name="${f.name}" type="${f.type}" placeholder="${f.placeholder}" autocomplete="${f.autocomplete}" required />
        ${errorSlot(f.name)}
      </div>`).join('')}

      <div class="book-field" data-field="challenge">
        <label class="book-label" for="book-challenge">What's the hardest part of hiring right now?</label>
        <select class="book-input book-select" id="book-challenge" name="challenge" required>
          <option value="" disabled selected>Select a challenge...</option>
          ${CHALLENGES.map(c => `<option>${c}</option>`).join('')}
        </select>
        ${errorSlot('challenge')}
      </div>

      <fieldset class="book-field book-fieldset" data-field="headcount">
        <legend class="book-label">How many people are you looking to hire?</legend>
        <div class="book-seg">
          ${HEADCOUNTS.map(h => `
          <label class="book-seg__opt">
            <input type="radio" name="headcount" value="${h}" required />
            <span>${h}</span>
          </label>`).join('')}
        </div>
        ${errorSlot('headcount')}
      </fieldset>

      <fieldset class="book-field book-fieldset" data-field="timeline">
        <legend class="book-label">How soon are you looking to hire?</legend>
        <div class="book-time">
          <div class="book-time__side">${timelineOpt(TIMELINES[0])}${TETHER}</div>
          ${timelineOpt(TIMELINES[1])}
          <div class="book-time__side">${TETHER}${timelineOpt(TIMELINES[2])}</div>
        </div>
        ${errorSlot('timeline')}
      </fieldset>

      <div class="book-submit-wrap">
        <!-- Cloudflare Turnstile. Out of sight unless it needs the visitor to
             do something; then it sits just above the button, over the form -->
        <div class="book-captcha" id="bookCaptcha">
          <p class="book-captcha__label" id="bookCaptchaLabel" role="status"></p>
          <div id="bookCaptchaWidget"></div>
        </div>
        <p class="book-error book-error--form" id="bookFormError" role="alert"></p>
        <button type="submit" class="book-submit" id="bookSubmit">
          <span id="bookSubmitText">Book a call</span>
          <img src="${arrowRight}" class="book-submit__arrow" alt="" aria-hidden="true" />
        </button>
      </div>
    </form>

    <form class="book-pick" id="bookPick" novalidate hidden>
      <h2 class="book-card__title" id="bookPickTitle" tabindex="-1">Pick a time</h2>
      <p class="book-card__sub">Your details are in. Choose a slot for the call.</p>

      <div class="book-zone">
        <p class="book-pick__status" id="bookPickStatus" role="status"></p>
        <button type="button" class="book-quiet" id="bookZoneChange" aria-expanded="false" aria-controls="bookZonePanel" hidden>Change</button>
      </div>

      <div class="book-pick__body" id="bookPickBody" hidden>
        <div class="book-pick__times" id="bookPickTimes">
          <fieldset class="book-field book-fieldset">
            <legend class="book-label">Day</legend>
            <div class="book-days" id="bookDays"></div>
          </fieldset>

          <div class="book-field book-slots-field" role="radiogroup" aria-labelledby="bookSlotsLabel">
            <p class="book-label" id="bookSlotsLabel">Time</p>
            <div class="book-slots-scroll" id="bookSlots"></div>
          </div>
        </div>

        <!-- Takes the place of the days and times while it is open -->
        <div class="book-zone-panel" id="bookZonePanel" hidden>
          <div class="book-zone-common" id="bookZoneCommon">
            <div class="book-zmap" id="bookZoneMap" aria-hidden="true"></div>
            <fieldset class="book-field book-fieldset">
              <legend class="book-label">Your time zone</legend>
              <div class="book-zrail" id="bookZoneRail"></div>
            </fieldset>
          </div>

          <div class="book-zsearch" id="bookZoneSearch" hidden>
            <label class="book-label" for="bookZoneInput">Search every time zone</label>
            <input class="book-input" id="bookZoneInput" type="search" placeholder="City or zone, like Toronto or EST" autocomplete="off" spellcheck="false" />
            <p class="book-sr" id="bookZoneCount" role="status"></p>
            <ul class="book-zlist" id="bookZoneList"></ul>
          </div>

          <button type="button" class="book-quiet" id="bookZoneOther" aria-expanded="false" aria-controls="bookZoneSearch">Other time zone</button>
        </div>

        <div class="book-submit-wrap">
          <p class="book-error book-error--form" id="bookPickError" role="alert"></p>
          <button type="submit" class="book-submit" id="bookConfirm">
            <span id="bookConfirmText">Confirm time</span>
            <img src="${arrowRight}" class="book-submit__arrow" alt="" aria-hidden="true" />
          </button>
          <button type="button" class="book-submit" id="bookZoneDone" hidden>
            <span>Show times</span>
            <img src="${arrowRight}" class="book-submit__arrow" alt="" aria-hidden="true" />
          </button>
        </div>
      </div>

      <button type="button" class="book-quiet" id="bookEmailInstead">Email me instead</button>
    </form>

    <div class="book-done" id="bookDone" hidden>${MARK}
      <p class="book-done__state" id="bookDoneState"></p>
      <h2 class="book-card__title" id="bookDoneTitle" tabindex="-1">Thanks.</h2>
      <p class="book-card__sub" id="bookDoneSub"></p>
      <dl class="book-receipt" id="bookReceipt" hidden></dl>
      <p class="book-done__next" id="bookDoneNext" hidden></p>
      <a class="book-quiet" href="/" data-transition>Back to homepage</a>
    </div>
  </div>

  <div class="book-how">
    <div class="book-stack-fit">
      <div class="hiring-stack book-stack" aria-hidden="true">
        <div class="hiring-layer hiring-layer--base"><img src="${stackSource}" alt="" /></div>
        <div class="hiring-layer hiring-layer--mid1"><img src="${stackScreen}" alt="" /></div>
        <div class="hiring-layer hiring-layer--mid2"><img src="${stackShortlist}" alt="" /></div>
      </div>
    </div>

    <ol class="book-rail">
      ${STEPS.map(s => `
      <li class="book-rail__step">
        <span class="book-rail__num">${s.num}</span>
        <span class="book-rail__tag">${s.tag}</span>
        <p class="book-rail__text">${s.text}</p>
      </li>`).join('')}
    </ol>
  </div>

</section>
`

export function init() {
  const form = document.getElementById('bookForm')
  if (!form) return
  const loadedAt   = performance.now()
  const card       = form.closest('.book-card')
  const done       = document.getElementById('bookDone')
  const submitBtn  = document.getElementById('bookSubmit')
  const submitText = document.getElementById('bookSubmitText')
  const formError  = document.getElementById('bookFormError')
  const names = Object.keys(VALIDATORS)

  function readData() {
    const fd = new FormData(form)
    return Object.fromEntries(names.map(n => [n, String(fd.get(n) ?? '').trim()]))
  }

  function setError(name, msg) {
    const field = form.querySelector(`[data-field="${name}"]`)
    const slot  = document.getElementById(`book-${name}-error`)
    field.classList.toggle('has-error', !!msg)
    slot.textContent = msg
    // Text inputs and the select carry the state themselves; radio groups
    // carry it on their fieldset
    const target = field.matches('fieldset') ? field : field.querySelector('.book-input')
    if (msg) {
      target.setAttribute('aria-describedby', slot.id)
      if (!field.matches('fieldset')) target.setAttribute('aria-invalid', 'true')
    } else {
      target.removeAttribute('aria-describedby')
      target.removeAttribute('aria-invalid')
    }
    return !msg
  }

  const validate = (name, data = readData()) => setError(name, VALIDATORS[name](data[name]))

  // Quiet until a field has been left (or a submit attempted); after that
  // its error clears as soon as the value is fixed
  const touched = new Set()
  form.addEventListener('focusout', (e) => {
    const name = e.target.name
    if (!names.includes(name)) return
    // Arrowing between radios of one group isn't leaving the field
    if (e.relatedTarget && e.relatedTarget.name === name) return
    touched.add(name)
    validate(name)
  })
  const recheck = (e) => { if (touched.has(e.target.name)) validate(e.target.name) }
  form.addEventListener('input', recheck)
  form.addEventListener('change', recheck)

  // The card shows one view at a time: the form, the time picker, or a
  // confirmation. Each swap moves focus to the new view's heading (which
  // announces it) and brings it up clear of the navbar.
  function show(view, title) {
    // Hold the card's height across the swap on desktop so the left column
    // (laid out against it) doesn't jump
    if (!card.style.minHeight && window.matchMedia('(min-width: 901px)').matches) {
      const height = `${card.getBoundingClientRect().height}px`
      card.style.minHeight = height
      // The picker's times scroll inside this height rather than stretch it
      card.style.setProperty('--card-pin', height)
      card.classList.add('is-pinned')
    }
    for (const el of [form, pick, done]) el.hidden = el !== view
    title.focus({ preventScroll: true })
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    view.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  }

  let lead = null // { id, name, email } once saved

  /* state: 'booked' (an invite really has gone out) or 'pending' (details
     saved, nothing sent). rows: [label, value, note?] for the receipt. */
  function showDone({ state, label, heading, text, rows = [], next = '' }) {
    const title   = document.getElementById('bookDoneTitle')
    const receipt = document.getElementById('bookReceipt')
    const nextEl  = document.getElementById('bookDoneNext')
    done.dataset.state = state
    document.getElementById('bookDoneState').textContent = label
    title.textContent = heading
    document.getElementById('bookDoneSub').textContent = text
    receipt.innerHTML = rows.map(([k, v, note]) => `
      <div class="book-receipt__row">
        <dt>${esc(k)}</dt>
        <dd>${esc(v)}${note ? `<span class="book-receipt__note">${esc(note)}</span>` : ''}</dd>
      </div>`).join('')
    receipt.hidden = !rows.length
    nextEl.textContent = next
    nextEl.hidden = !next
    show(done, title)
  }

  // Every way out of the picker that isn't a booking ends here
  const emailInstead = (why = 'We have your details.') => showDone({
    state: 'pending',
    label: 'Details received · no call booked yet',
    heading: `Thanks, ${lead.name}.`,
    text: `${why} We'll reach you at ${lead.email} to set up the call.`,
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const data = readData()
    names.forEach(n => touched.add(n))
    const invalid = names.filter(n => !validate(n, data))
    if (invalid.length) {
      form.querySelector(`[name="${invalid[0]}"]`).focus()
      return
    }

    formError.textContent = ''
    submitBtn.disabled = true
    if (SITE_KEY) submitText.textContent = 'Checking…'
    const token = await captchaToken()
    submitText.textContent = 'Sending…'
    let id, verified
    try {
      ({ id, verified } = await submitLead({
        ...data,
        [HONEYPOT_FIELD]: form.elements[HONEYPOT_FIELD].value,
        elapsedMs: Math.round(performance.now() - loadedAt),
        [CAPTCHA_FIELD]: token,
      }))
    } catch (err) {
      // The server's own verdict on a field goes on that field
      const rejected = names.filter(n => err.fields?.[n])
      rejected.forEach(n => setError(n, err.fields[n]))
      if (rejected.length) form.querySelector(`[name="${rejected[0]}"]`).focus()
      else formError.textContent = 'Not sent. Please try again.'
      submitBtn.disabled = false
      submitText.textContent = 'Book a call'
      return
    }

    lead = { id, name: data.name.split(/\s+/)[0], email: data.email }
    // Saved, but the captcha didn't pass (blocked, failed, or unreachable):
    // no picker. A person at Tethr follows up instead.
    if (!verified) return emailInstead()
    show(pick, document.getElementById('bookPickTitle'))
    refreshTimes()
  })

  // ── Captcha ──
  const captchaBox   = document.getElementById('bookCaptcha')
  const captchaLabel = document.getElementById('bookCaptchaLabel')
  let turnstile = null   // promise of window.turnstile, or of null when it can't load
  let widgetId = null
  let settle = null      // ends the token request in flight
  let giveUp = null      // ends it with no token, and says why in the console
  let onCaptchaError = null
  let interactive = false

  // Not on first paint: the script loads when the visitor first touches the form
  function loadCaptcha() {
    if (!SITE_KEY) return Promise.resolve(null)
    turnstile ??= new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = TURNSTILE_SCRIPT
      script.async = true
      script.onload = () => resolve(window.turnstile ?? null)
      script.onerror = () => resolve(null) // blocked, or Cloudflare is down
      document.head.appendChild(script)
      setTimeout(() => resolve(null), 8000)
    })
    return turnstile
  }
  form.addEventListener('focusin', loadCaptcha, { once: true })
  form.addEventListener('pointerdown', loadCaptcha, { once: true })

  function showChallenge(on) {
    interactive = on
    captchaBox.classList.toggle('is-active', on)
    captchaLabel.textContent = on ? 'One quick check, then we\'ll send your details.' : ''
  }

  /* Asks Turnstile for a fresh token: they are single-use and short-lived, so
     one per submit. Resolves with '' whenever there is none to be had — the
     server then saves the lead as unverified rather than losing it. */
  async function captchaToken() {
    const ts = await loadCaptcha()
    if (!ts) return noToken('the Turnstile script did not load')
    return new Promise((resolve) => {
      let errors = 0
      let lastCode = ''
      // Give up if nothing comes back in time, unless the visitor has been
      // handed a challenge: then Turnstile's own timeout ends the wait
      const timer = setTimeout(() => {
        if (!interactive) giveUp?.(lastCode ? `timed out after error ${lastCode}` : 'timed out')
      }, CAPTCHA_WAIT_MS)
      let retryTimer = 0
      settle = (token = '') => {
        clearTimeout(timer)
        clearTimeout(retryTimer)
        settle = giveUp = null
        showChallenge(false)
        resolve(typeof token === 'string' ? token : '')
      }
      giveUp = (why) => {
        settle()
        noToken(why)
        // Stop the widget retrying behind a form that has moved on
        try { ts.reset(widgetId) } catch { /* nothing to stop */ }
      }
      try {
        if (widgetId === null) {
          widgetId = ts.render('#bookCaptchaWidget', {
            sitekey: SITE_KEY,
            appearance: 'interaction-only',
            execution: 'execute',
            // The standard widget is 300px wide; the card is narrower than that on small phones
            size: window.matchMedia('(max-width: 370px)').matches ? 'compact' : 'normal',
            // Retries are run from here: with execution 'execute' the
            // widget's own retry doesn't start a new attempt by itself
            retry: 'never',
            callback: (token) => settle?.(token),
            // true = handled here; Turnstile then doesn't log an error of its own
            'error-callback': (code) => { onCaptchaError?.(code); return true },
            'expired-callback': () => giveUp?.('token expired'),
            'timeout-callback': () => giveUp?.('challenge not solved in time'),
            'unsupported-callback': () => giveUp?.('unsupported browser'),
            'before-interactive-callback': () => showChallenge(true),
            'after-interactive-callback': () => showChallenge(false),
          })
        } else {
          ts.reset(widgetId)
        }
        // After the reset, so an error from the last submit's widget isn't counted
        onCaptchaError = (code) => {
          if (!giveUp) return
          errors++
          lastCode = String(code ?? 'unknown')
          if (captchaGivesUp(code, errors)) return giveUp(`error ${lastCode}${errors > 1 ? ` after ${errors} attempts` : ''}`)
          // One error is often a blip, so try again unless the code is one a
          // retry can't fix
          retryTimer = setTimeout(() => {
            try { ts.reset(widgetId); ts.execute(widgetId) } catch { giveUp?.(`could not retry after error ${lastCode}`) }
          }, CAPTCHA_RETRY_INTERVAL_MS)
        }
        ts.execute(widgetId)
      } catch {
        giveUp?.('the widget could not start')
      }
    })
  }

  // Why a lead went in unverified, for whoever reads the visitor's console.
  // Never the token: there isn't one.
  function noToken(why) {
    console.warn(`[book] captcha: no token, so this lead is saved as unverified (${why})`)
    return ''
  }

  // ── Pick a time ──
  const pick        = document.getElementById('bookPick')
  const pickBody    = document.getElementById('bookPickBody')
  const pickTimes   = document.getElementById('bookPickTimes')
  const pickStatus  = document.getElementById('bookPickStatus')
  const pickError   = document.getElementById('bookPickError')
  const dayList     = document.getElementById('bookDays')
  const slotList    = document.getElementById('bookSlots')
  const confirmBtn  = document.getElementById('bookConfirm')
  const confirmText = document.getElementById('bookConfirmText')
  const zoneChange  = document.getElementById('bookZoneChange')
  const zonePanel   = document.getElementById('bookZonePanel')
  const zoneCommon  = document.getElementById('bookZoneCommon')
  const zoneMap     = document.getElementById('bookZoneMap')
  const zoneRail    = document.getElementById('bookZoneRail')
  const zoneOther   = document.getElementById('bookZoneOther')
  const zoneSearch  = document.getElementById('bookZoneSearch')
  const zoneInput   = document.getElementById('bookZoneInput')
  const zoneList    = document.getElementById('bookZoneList')
  const zoneCount   = document.getElementById('bookZoneCount')
  const zoneDone    = document.getElementById('bookZoneDone')

  let zone = DETECTED_ZONE   // every day, time and the receipt is shown in this
  let hostZone = 'Asia/Karachi'
  let slots = []             // open slots, ms instants
  let days = []              // slots grouped by `zone`'s calendar days
  let nightOpen = false

  const chosen = (name) => pick.querySelector(`[name="${name}"]:checked`)?.value
  const chosenSlot = () => Date.parse(chosen('slot') ?? '')

  // One day's times in clock order. The early-morning and late-evening hours
  // (before 07:00 and from 22:00 in the chosen zone) wait behind a link,
  // unless they are all the day has or one of them is the chosen time
  function renderSlots(keep = chosenSlot()) {
    const day = days.find(d => d.key === chosen('day'))
    const f = fmtIn(zone)
    document.getElementById('bookSlotsLabel').textContent = `Time on ${f.full.format(day.slots[0])}`
    const parts = groupByPartOfDay(day.slots, zone)
    const daytime = parts.filter(p => !p.folded)
    const folded = parts.filter(p => p.folded)
    const showFolded = !daytime.length || nightOpen || folded.some(p => p.slots.includes(keep))
    const chip = (t) => `
        <label class="book-seg__opt">
          <input type="radio" name="slot" value="${new Date(t).toISOString()}"${t === keep ? ' checked' : ''} required />
          <span>${esc(f.time.format(t))}</span>
        </label>`
    const group = (p) => `
      <div class="book-part${p.folded ? ' book-part--folded' : ''}" role="group" aria-label="${p.label}">
        <p class="book-part__label" aria-hidden="true">${p.label}</p>
        <div class="book-slots">${p.slots.map(chip).join('')}</div>
      </div>`
    const count = folded.reduce((n, p) => n + p.slots.length, 0)
    slotList.innerHTML = parts.filter(p => !p.folded || showFolded).map(group).join('') + (folded.length && daytime.length ? `
      <button type="button" class="book-quiet book-part__more" id="bookNightToggle" aria-expanded="${showFolded}">${showFolded ? 'Hide early and late times' : `Show ${count} early and late ${count === 1 ? 'time' : 'times'}`}</button>` : '')
  }

  // Regroups the slots by the chosen zone's days and redraws, holding on to
  // the chosen time (the same instant) and otherwise the chosen day
  function renderTimes() {
    const keepSlot = chosenSlot()
    const keepDay = chosen('day')
    days = groupByZoneDay(slots, zone)
    const f = fmtIn(zone)
    const current = days.find(d => d.slots.includes(keepSlot)) ?? days.find(d => d.key === keepDay) ?? days[0]
    dayList.innerHTML = days.map(d => `
      <label class="book-seg__opt book-day">
        <input type="radio" name="day" value="${d.key}" aria-label="${esc(f.full.format(d.slots[0]))}"${d === current ? ' checked' : ''} />
        <span><i class="book-day__dow">${esc(f.dow.format(d.slots[0]))}</i><b class="book-day__date">${esc(f.day.format(d.slots[0]))}</b></span>
      </label>`).join('')
    renderSlots(keepSlot)
    // One span, so the line wraps as text; the offset never splits at its sign
    const z = friendlyZone(zone)
    pickStatus.innerHTML = `<span>Times in ${esc(z.label.slice(0, -z.offset.length))}<span class="book-nowrap">${esc(z.offset)}</span></span>`
  }

  // Loads (or reloads) the open times
  async function refreshTimes() {
    confirmBtn.disabled = true
    if (!slots.length) pickStatus.textContent = 'Finding open times…'
    try {
      const loaded = await loadSlots()
      slots = loaded.slots
      if (loaded.hostZone) hostZone = loaded.hostZone
    } catch {
      return emailInstead('We have your details, but our calendar isn\'t loading right now.')
    }
    if (!slots.length) return emailInstead('We have your details, but there are no open times in the next two weeks.')

    renderTimes()
    zoneChange.hidden = false
    pickBody.hidden = false
    confirmBtn.disabled = false
  }

  pick.addEventListener('change', (e) => {
    pickError.textContent = ''
    if (e.target.name === 'day') { nightOpen = false; renderSlots() }
    if (e.target.name === 'zone') setZone(e.target.value)
  })

  // The radios are 1px and hidden, so the browser won't scroll a chip or a
  // rail node into view when the keyboard reaches it; do it for the label
  pick.addEventListener('focusin', (e) => {
    if (e.target.type === 'radio') e.target.closest('label').scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })

  slotList.addEventListener('click', (e) => {
    if (e.target.id !== 'bookNightToggle') return
    nightOpen = e.target.getAttribute('aria-expanded') !== 'true'
    renderSlots()
    // Opening lands on the first of the revealed times; closing stays on the link
    const first = nightOpen && slotList.querySelector('.book-part--folded input')
    ;(first || document.getElementById('bookNightToggle'))?.focus()
  })

  // ── Time zone ──
  const horizon = () => [Date.now(), slots.at(-1) ?? Date.now()]

  function renderRail() {
    const { zones, selected } = railFor(zone, ...horizon())
    const now = Date.now()
    zoneRail.innerHTML = zones.map((z, i) => `
      <label class="book-time__opt book-zrail__opt">
        <input type="radio" name="zone" value="${esc(z.id)}"${i === selected ? ' checked' : ''} />
        <span class="book-time__node" aria-hidden="true"></span>
        <span class="book-zrail__name">${esc(z.short)}</span>
        <span class="book-zrail__now">${esc(fmtIn(z.id).time.format(now))}</span>
      </label>`).join('')
    zoneRail.querySelector(':checked')?.closest('label').scrollIntoView({ block: 'nearest', inline: 'center' })
  }

  function setZone(next) {
    zone = next
    nightOpen = false
    renderTimes()
    zoneMap.innerHTML = worldMap(zone, hostZone)
  }

  // Every zone, named once, for the search: [{ id, city, name, offset, hay }]
  let allZones = null
  function zoneIndex() {
    if (allZones) return allZones
    const now = Date.now()
    const year = new Date(now).getUTCFullYear()
    allZones = listZones().map(id => {
      const z = friendlyZone(id, now)
      // Both halves of the year, so "EST" finds New York in July too
      const abbr = `${zoneAbbreviation(id, Date.UTC(year, 0, 15))} ${zoneAbbreviation(id, Date.UTC(year, 6, 15))}`
      return { id, ...z, minutes: offsetMinutes(id, now), hay: `${id} ${z.city} ${z.name} ${abbr} ${z.offset}`.toLowerCase().replace(/_/g, ' ') }
    }).sort((a, b) => a.minutes - b.minutes || a.city.localeCompare(b.city))
    return allZones
  }

  const SEARCH_LIMIT = 60
  function renderSearch() {
    const words = zoneInput.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const now = Date.now()
    let hits = zoneIndex().filter(z => words.every(w => z.hay.includes(w)))
    if (!words.length) {
      // Nothing typed yet: start at the visitor's own zone and run east, wrapping round
      const here = offsetMinutes(zone, now)
      const east = (z) => (z.minutes - here + 1440) % 1440
      hits = [...hits].sort((a, b) => (b.id === zone) - (a.id === zone) || east(a) - east(b) || a.city.localeCompare(b.city))
    }
    zoneList.innerHTML = hits.slice(0, SEARCH_LIMIT).map(z => `
      <li>
        <button type="button" class="book-zlist__opt" data-zone="${esc(z.id)}"${z.id === zone ? ' aria-current="true"' : ''}>
          <span class="book-zlist__city">${esc(z.city)}</span>
          <span class="book-zlist__name">${esc([z.name, z.offset].filter(Boolean).join(', '))}</span>
          <span class="book-zlist__now">${esc(fmtIn(z.id).time.format(now))}</span>
        </button>
      </li>`).join('')
    zoneCount.textContent = !hits.length ? 'No time zones match.'
      : hits.length > SEARCH_LIMIT ? `${hits.length} time zones. Showing the first ${SEARCH_LIMIT}; keep typing to narrow them.`
      : `${hits.length} time ${hits.length === 1 ? 'zone' : 'zones'}.`
    zoneCount.classList.toggle('book-sr', hits.length > 0 && hits.length <= SEARCH_LIMIT)
  }

  function showSearch(open) {
    zoneSearch.hidden = !open
    zoneCommon.hidden = open
    zoneOther.setAttribute('aria-expanded', String(open))
    zoneOther.textContent = open ? 'Back to common zones' : 'Other time zone'
    if (open) {
      zoneInput.value = ''
      renderSearch()
      zoneInput.focus()
    } else {
      renderRail()
    }
  }

  // The chooser takes the place of the days and times, so the card keeps its height
  function showChooser(open) {
    zonePanel.hidden = !open
    pickTimes.hidden = open
    confirmBtn.hidden = open
    zoneDone.hidden = !open
    zoneChange.setAttribute('aria-expanded', String(open))
    pickError.textContent = ''
    if (open) {
      showSearch(false)
      zoneMap.innerHTML = worldMap(zone, hostZone)
      zoneRail.querySelector(':checked')?.focus()
    } else {
      zoneChange.focus()
    }
  }

  zoneChange.addEventListener('click', () => showChooser(zonePanel.hidden))
  zoneDone.addEventListener('click', () => showChooser(false))
  zoneOther.addEventListener('click', () => showSearch(zoneSearch.hidden))
  zoneInput.addEventListener('input', renderSearch)

  zoneList.addEventListener('click', (e) => {
    const id = e.target.closest('[data-zone]')?.dataset.zone
    if (!id) return
    setZone(id)
    showSearch(false)
    zoneRail.querySelector(':checked')?.focus()
  })

  zonePanel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (zoneSearch.hidden) showChooser(false)
      else { showSearch(false); zoneOther.focus() }
    }
    // Up and down walk the results, from the search box and back to it
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !zoneSearch.hidden && (e.target === zoneInput || e.target.dataset.zone)) {
      const stops = [zoneInput, ...zoneList.querySelectorAll('[data-zone]')]
      const next = stops[stops.indexOf(e.target) + (e.key === 'ArrowDown' ? 1 : -1)]
      if (next) { e.preventDefault(); next.focus() }
    }
    // Enter in the search takes the first match rather than submitting the form
    if (e.key === 'Enter' && e.target === zoneInput) {
      e.preventDefault()
      zoneList.querySelector('[data-zone]')?.click()
    }
  })

  document.getElementById('bookEmailInstead').addEventListener('click', () => emailInstead())

  pick.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (!zonePanel.hidden) return showChooser(false)
    const start = chosen('slot')
    if (!start) {
      pickError.textContent = 'Choose a time.'
      slotList.querySelector('input')?.focus()
      return
    }

    pickError.textContent = ''
    confirmBtn.disabled = true
    confirmText.textContent = 'Booking…'
    let res, body
    try {
      res = await api('/api/book', { leadId: lead.id, start })
      body = await res.json().catch(() => ({}))
    } catch {
      res = null
    }
    confirmText.textContent = 'Confirm time'

    if (res?.ok) {
      const at = new Date(body.start)
      const minutes = Math.round((new Date(body.end) - at) / 60000)
      const f = fmtIn(zone)
      return showDone({
        state: 'booked',
        label: 'Invite sent',
        heading: `You're booked, ${lead.name}.`,
        text: 'Your intro call with Tethr is on the calendar.',
        rows: [
          ['When', `${f.full.format(at)} at ${f.time.format(at)}`, friendlyZone(zone, at.getTime()).label],
          ...(minutes > 0 ? [['Length', `${minutes} minutes`]] : []),
          // Only name Google Meet when the booking came back with a link
          body.meetLink ? ['Where', 'Google Meet', 'The link is in your invite'] : ['Where', 'Video call', 'Details are in your invite'],
          ['Invite', `Sent to ${lead.email}`],
        ],
        next: 'Accept the calendar invite to confirm. Need to reschedule? Reply to the invite and we\'ll find a new time.',
      })
    }
    if (res?.status === 409 && body.reason === 'slot_taken') {
      await refreshTimes()
      if (pick.hidden) return
      pickError.textContent = 'That time was just taken. Pick another.'
      return slotList.querySelector('input')?.focus()
    }
    if (res?.status === 409 && body.reason === 'already_booked') {
      return showDone({
        state: 'booked',
        label: 'Already booked',
        heading: `You're booked, ${lead.name}.`,
        text: 'You already have a call with us.',
        rows: [
          ['Where', 'Video call', 'Details are in your invite'],
          ['Invite', `In your inbox at ${lead.email}`],
        ],
        next: 'Need to reschedule? Reply to the invite and we\'ll find a new time.',
      })
    }
    emailInstead('We have your details, but we couldn\'t book that time.')
  })
}

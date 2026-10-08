import { toBlue } from '../lib/svg-tint.js'
import _base from '../assets/talentcardone.svg?raw'
import _mid  from '../assets/midlayer.svg?raw'
import chainOutline from '../assets/chainoutlinevector.svg'
import arrowRight from '../assets/arrowright.svg'
// The same rules POST /api/lead applies
import { VALIDATORS, CHALLENGES, HEADCOUNTS, TIMELINES, HONEYPOT_FIELD } from '../../lib/booking/lead.js'

const BASE = toBlue(_base)
const MID  = toBlue(_mid)

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
   timeline } plus the anti-spam fields, resolves with the lead's id, and
   rejects on any failure. A rejection carries `fields` ({ name: message })
   when the server turned the input down. */
export async function submitLead(data) {
  const res = await api('/api/lead', data)
  const body = await res.json().catch(() => ({}))
  if (res.status === 201 && body.leadId) return body.leadId
  throw Object.assign(new Error('Lead not saved'), { fields: res.status === 400 ? body.fields : undefined })
}

// -> [{ key, date, slots: [Date] }] grouped by the visitor's own calendar
// days; throws when the calendar can't be read
async function loadDays() {
  const res = await api('/api/availability')
  if (!res.ok) throw new Error('Calendar unavailable')
  const { days = [] } = await res.json()
  const byDay = new Map()
  for (const iso of days.flatMap(d => d.slots).sort()) {
    const date = new Date(iso)
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    if (!byDay.has(key)) byDay.set(key, { key, date, slots: [] })
    byDay.get(key).slots.push(date)
  }
  return [...byDay.values()]
}

// 12- or 24-hour to suit the visitor; the words stay English like the page
const HOUR12 = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12
const fmt = (opts) => new Intl.DateTimeFormat('en-US', opts)
const FMT_TIME = fmt({ hour: 'numeric', minute: '2-digit', hour12: HOUR12 })
const FMT_DOW  = fmt({ weekday: 'short' })
const FMT_DAY  = fmt({ month: 'short', day: 'numeric' })
const FMT_FULL = fmt({ weekday: 'long', month: 'long', day: 'numeric' })

// "Asia/Karachi (GMT+5)"
function zoneName() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  let offset = ''
  try {
    offset = fmt({ timeZoneName: 'shortOffset' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value ?? ''
  } catch { /* older engines: the zone name alone */ }
  return [zone.replace(/_/g, ' '), offset && `(${offset})`].filter(Boolean).join(' ') || 'your local time'
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

      <p class="book-pick__status" id="bookPickStatus" role="status"></p>

      <div id="bookPickBody" hidden>
        <fieldset class="book-field book-fieldset">
          <legend class="book-label">Day</legend>
          <div class="book-days" id="bookDays"></div>
        </fieldset>

        <fieldset class="book-field book-fieldset">
          <legend class="book-label" id="bookSlotsLabel">Time</legend>
          <div class="book-slots" id="bookSlots"></div>
        </fieldset>

        <div class="book-submit-wrap">
          <p class="book-error book-error--form" id="bookPickError" role="alert"></p>
          <button type="submit" class="book-submit" id="bookConfirm">
            <span id="bookConfirmText">Confirm time</span>
            <img src="${arrowRight}" class="book-submit__arrow" alt="" aria-hidden="true" />
          </button>
        </div>
      </div>

      <button type="button" class="book-quiet" id="bookEmailInstead">Email me instead</button>
    </form>

    <div class="book-done" id="bookDone" hidden>
      <span class="book-done__link" aria-hidden="true">
        <svg viewBox="0 0 56 26" fill="none">
          <rect x="1.25" y="1.25" width="32" height="23.5" rx="11.75" stroke="currentColor" stroke-width="2.5"/>
          <rect x="22.75" y="1.25" width="32" height="23.5" rx="11.75" stroke="currentColor" stroke-width="2.5"/>
        </svg>
      </span>
      <h2 class="book-card__title" id="bookDoneTitle" tabindex="-1">Thanks.</h2>
      <p class="book-card__sub" id="bookDoneSub"></p>
    </div>
  </div>

  <div class="book-how">
    <div class="hiring-stack book-stack" aria-hidden="true">
      <div class="hiring-layer hiring-layer--base">${BASE}</div>
      <div class="hiring-layer hiring-layer--mid1">${MID}</div>
      <div class="hiring-layer hiring-layer--mid2">${MID}</div>
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
      card.style.minHeight = `${card.getBoundingClientRect().height}px`
    }
    for (const el of [form, pick, done]) el.hidden = el !== view
    title.focus({ preventScroll: true })
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    view.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  }

  let lead = null // { id, name, email } once saved

  function showDone(heading, text) {
    const title = document.getElementById('bookDoneTitle')
    title.textContent = heading
    document.getElementById('bookDoneSub').textContent = text
    show(done, title)
  }

  // Every way out of the picker that isn't a booking ends here
  const emailInstead = (why = 'We have your details.') =>
    showDone(`Thanks, ${lead.name}.`, `${why} We'll reach you at ${lead.email} to set up the call.`)

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
    submitText.textContent = 'Sending…'
    let id
    try {
      id = await submitLead({
        ...data,
        [HONEYPOT_FIELD]: form.elements[HONEYPOT_FIELD].value,
        elapsedMs: Math.round(performance.now() - loadedAt),
      })
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
    show(pick, document.getElementById('bookPickTitle'))
    refreshTimes()
  })

  // ── Pick a time ──
  const pick        = document.getElementById('bookPick')
  const pickBody    = document.getElementById('bookPickBody')
  const pickStatus  = document.getElementById('bookPickStatus')
  const pickError   = document.getElementById('bookPickError')
  const dayList     = document.getElementById('bookDays')
  const slotList    = document.getElementById('bookSlots')
  const confirmBtn  = document.getElementById('bookConfirm')
  const confirmText = document.getElementById('bookConfirmText')
  let days = []

  const chosen = (name) => pick.querySelector(`[name="${name}"]:checked`)?.value

  function renderSlots() {
    const day = days.find(d => d.key === chosen('day'))
    document.getElementById('bookSlotsLabel').textContent = `Time on ${FMT_FULL.format(day.date)}`
    slotList.innerHTML = day.slots.map(t => `
      <label class="book-seg__opt">
        <input type="radio" name="slot" value="${t.toISOString()}" required />
        <span>${esc(FMT_TIME.format(t))}</span>
      </label>`).join('')
  }

  // Loads (or reloads) the open times, keeping the chosen day if it survives
  async function refreshTimes() {
    const keep = chosen('day')
    confirmBtn.disabled = true
    if (!days.length) pickStatus.textContent = 'Finding open times…'
    try {
      days = await loadDays()
    } catch {
      return emailInstead('We have your details, but our calendar isn\'t loading right now.')
    }
    if (!days.length) return emailInstead('We have your details, but there are no open times in the next two weeks.')

    const current = days.find(d => d.key === keep) ?? days[0]
    dayList.innerHTML = days.map(d => `
      <label class="book-seg__opt book-day">
        <input type="radio" name="day" value="${d.key}" aria-label="${esc(FMT_FULL.format(d.date))}"${d === current ? ' checked' : ''} />
        <span><i class="book-day__dow">${esc(FMT_DOW.format(d.date))}</i><b class="book-day__date">${esc(FMT_DAY.format(d.date))}</b></span>
      </label>`).join('')
    renderSlots()
    pickStatus.textContent = `Times in ${zoneName()}`
    pickBody.hidden = false
    confirmBtn.disabled = false
  }

  pick.addEventListener('change', (e) => {
    pickError.textContent = ''
    if (e.target.name === 'day') renderSlots()
  })

  document.getElementById('bookEmailInstead').addEventListener('click', () => emailInstead())

  pick.addEventListener('submit', async (e) => {
    e.preventDefault()
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
      return showDone(`You're booked, ${lead.name}.`,
        `${FMT_FULL.format(at)} at ${FMT_TIME.format(at)}, ${zoneName()}. The calendar invite is on its way to ${lead.email}.`)
    }
    if (res?.status === 409 && body.reason === 'slot_taken') {
      await refreshTimes()
      if (pick.hidden) return
      pickError.textContent = 'That time was just taken. Pick another.'
      return slotList.querySelector('input')?.focus()
    }
    if (res?.status === 409 && body.reason === 'already_booked') {
      return showDone(`You're booked, ${lead.name}.`, `You already have a call with us. The calendar invite is in your inbox at ${lead.email}.`)
    }
    emailInstead('We have your details, but we couldn\'t book that time.')
  })
}

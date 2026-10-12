import stackSource    from '../assets/hiringsource.svg'
import stackScreen    from '../assets/hiringscreen.svg'
import stackShortlist from '../assets/hiringshortlist.svg'
import chainOutline from '../assets/chainoutlinevector.svg'
import arrowRight from '../assets/arrowright.svg'
// The same rules POST /api/lead applies
import { VALIDATORS, CHALLENGES, HEADCOUNTS, TIMELINES, HONEYPOT_FIELD } from '../../lib/booking/lead.js'

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
      card.style.minHeight = `${card.getBoundingClientRect().height}px`
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
      const minutes = Math.round((new Date(body.end) - at) / 60000)
      return showDone({
        state: 'booked',
        label: 'Invite sent',
        heading: `You're booked, ${lead.name}.`,
        text: 'Your intro call with Tethr is on the calendar.',
        rows: [
          ['When', `${FMT_FULL.format(at)} at ${FMT_TIME.format(at)}`, zoneName()],
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

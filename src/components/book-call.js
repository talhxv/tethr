import { toBlue } from '../lib/svg-tint.js'
import _base from '../assets/talentcardone.svg?raw'
import _mid  from '../assets/midlayer.svg?raw'
import chainOutline from '../assets/chainoutlinevector.svg'
import arrowRight from '../assets/arrowright.svg'

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

// Placeholder set — to be confirmed
const CHALLENGES = [
  'Finding qualified candidates',
  'Hiring takes too long',
  'Cost of hiring',
  'Retention and turnover',
  'Payroll and compliance across borders',
  'Something else',
]

const HEADCOUNTS = ['1', '2-5', '6-10', '10+']
const TIMELINES  = ['ASAP', '<1 month', 'Not Defined']

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const VALIDATORS = {
  name:      v => v ? '' : 'Enter your name.',
  title:     v => v ? '' : 'Enter your title.',
  company:   v => v ? '' : 'Enter your company name.',
  email:     v => !v ? 'Enter your email address.' : EMAIL_RE.test(v) ? '' : 'Enter a valid email address.',
  challenge: v => v ? '' : 'Select a challenge.',
  headcount: v => v ? '' : 'Choose how many to hire.',
  timeline:  v => v ? '' : 'Choose a timeline.',
}

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

/* Lead submission — stub. Receives the plain lead object
   { name, title, company, email, challenge, headcount, timeline }
   and resolves on success / rejects on failure. Swap the body for the
   real POST once the destination is decided. */
export async function submitLead(data) {
  void data
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
    submitText.textContent = 'Booking…'
    try {
      await submitLead(data)
    } catch {
      formError.textContent = 'Not sent. Please try again.'
      submitBtn.disabled = false
      submitText.textContent = 'Book a call'
      return
    }

    const title = document.getElementById('bookDoneTitle')
    title.textContent = `Thanks, ${data.name.split(/\s+/)[0]}.`
    document.getElementById('bookDoneSub').textContent =
      `We have your details. We'll reach you at ${data.email} to set up the call.`
    // Hold the card's height across the swap on desktop so the left column
    // (laid out against it) doesn't jump
    const card = form.closest('.book-card')
    if (window.matchMedia('(min-width: 901px)').matches) card.style.minHeight = `${card.offsetHeight}px`
    form.hidden = true
    done.hidden = false
    // The submit button sits at the bottom of the card — bring the
    // confirmation up into view rather than leaving the reader below it
    title.focus({ preventScroll: true })
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    done.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
  })
}

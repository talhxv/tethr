import { exciteNavbar } from './navbar.js'
import { fetchJobs } from '../lib/notion.js'
import chainBg from '../assets/fullylinkedvectorchainbluephone.svg'

// Talent pool / open-application form — same one linked from the open
// positions page's "Don't see a fit?" footer note.
const TALENT_POOL_FORM_ID  = 'Y5vkxd'
const TALENT_POOL_FORM_URL = `https://tally.so/r/${TALENT_POOL_FORM_ID}`

// Client / "hire talent" lead form. Create it at tally.so (company name,
// what you need staffed, contact info), then paste the form id here — the
// part after /r/ in the form URL (e.g. tally.so/r/wAbCdE -> 'wAbCdE').
const CLIENT_FORM_ID  = 'GxjYve'
const CLIENT_FORM_URL = `https://tally.so/r/${CLIENT_FORM_ID}`

const STATES = ['root', 'join', 'hire']

const arrow = `
  <div class="op-row__arrow apply-choice__arrow" aria-hidden="true">
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
      <path d="M3.75 14.25L14.25 3.75M14.25 3.75H6.75M14.25 3.75V11.25" stroke="#2B44FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>`

// Chain glyphs in the hero art's own vocabulary (stroked stadium rects).
// Single link: Tethr as one entity reaching out to hire on your behalf.
// Two joined links: there's a live role to link yourself into.
// Solid + dashed: we hold your place until the next link exists.
const singleLinkGlyph = `
  <span class="apply-choice__link" aria-hidden="true">
    <svg viewBox="0 0 56 26" fill="none">
      <rect x="12.25" y="1.25" width="32" height="23.5" rx="11.75" stroke="currentColor" stroke-width="2.5"/>
    </svg>
  </span>`

const linkedGlyph = `
  <span class="apply-choice__link" aria-hidden="true">
    <svg viewBox="0 0 56 26" fill="none">
      <rect x="1.25" y="1.25" width="32" height="23.5" rx="11.75" stroke="currentColor" stroke-width="2.5"/>
      <rect x="22.75" y="1.25" width="32" height="23.5" rx="11.75" stroke="currentColor" stroke-width="2.5"/>
    </svg>
  </span>`

const awaitingGlyph = `
  <span class="apply-choice__link" aria-hidden="true">
    <svg viewBox="0 0 56 26" fill="none">
      <rect x="1.25" y="1.25" width="32" height="23.5" rx="11.75" stroke="currentColor" stroke-width="2.5"/>
      <rect x="22.75" y="1.25" width="32" height="23.5" rx="11.75" stroke="currentColor" stroke-width="2.5" stroke-dasharray="5 5" opacity="0.45"/>
    </svg>
  </span>`

const backLink = `
  <div class="padded apply-choice__back-wrap">
    <a href="/apply" class="op-detail__back apply-choice__back" data-back-root>
      <span class="op-detail__back-circle" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      Back
    </a>
  </div>`

function rootHtml() {
  return `
  <div class="apply-hero padded">
    <div class="apply-hero__text">
      <h1 class="apply-hero__headline">Work with <em class="apply-hero__em">us.</em></h1>
      <p class="apply-hero__sub">Tell us which side of the table you're on and we'll take it from there.</p>
    </div>
  </div>

  <div class="apply-choices padded">
    <a class="apply-choice" href="/apply#hire" data-goto="hire" style="animation-delay:120ms">
      ${singleLinkGlyph}
      <div class="apply-choice__text">
        <h2 class="apply-choice__title">Hire talent</h2>
        <p class="apply-choice__sub">Bring Tethr in to source, pay, and manage the people your team needs.</p>
      </div>
      ${arrow}
    </a>
    <a class="apply-choice" href="/apply#join" data-goto="join" style="animation-delay:220ms">
      ${linkedGlyph}
      <div class="apply-choice__text">
        <h2 class="apply-choice__title">Join Tethr</h2>
        <p class="apply-choice__sub">Apply for a role that's live right now, or get on our radar for the next one.</p>
      </div>
      ${arrow}
    </a>
  </div>`
}

function joinHtml() {
  return `
  ${backLink}
  <div class="apply-hero padded">
    <div class="apply-hero__text">
      <h1 class="apply-hero__headline">Two ways <em class="apply-hero__em">in.</em></h1>
      <p class="apply-hero__sub">Apply to a role that's live right now, or put yourself on our radar for whatever opens next.</p>
    </div>
    <!-- Fades in once Notion answers; stays empty (not broken) if it doesn't -->
    <div class="apply-hero__count" id="applyCount" aria-hidden="true">
      <span class="op-count__num"></span>
      <span class="op-count__label">roles open<br>right now</span>
    </div>
  </div>

  <div class="apply-choices padded">
    <a class="apply-choice" href="/positions" data-transition style="animation-delay:120ms">
      ${linkedGlyph}
      <div class="apply-choice__text">
        <h2 class="apply-choice__title">Apply for an open position</h2>
        <p class="apply-choice__sub">Browse the roles we're hiring for right now and apply directly.</p>
      </div>
      ${arrow}
    </a>
    <a class="apply-choice" href="${TALENT_POOL_FORM_URL}?position=${encodeURIComponent('Talent pool')}" target="_blank" rel="noopener" style="animation-delay:220ms">
      ${awaitingGlyph}
      <div class="apply-choice__text">
        <h2 class="apply-choice__title">Join the talent pool</h2>
        <p class="apply-choice__sub">No matching role yet? Introduce yourself once and we'll reach out when one fits.</p>
      </div>
      ${arrow}
    </a>
  </div>`
}

function hireHtml() {
  return `
  ${backLink}
  <div class="apply-hero padded">
    <div class="apply-hero__text">
      <h1 class="apply-hero__headline">Hire <em class="apply-hero__em">talent.</em></h1>
      <p class="apply-hero__sub">We source and vet the people, then handle payroll, contracts, and compliance — you just point us at what you need.</p>
    </div>
  </div>

  <div class="apply-choices padded">
    <a class="apply-choice" href="${CLIENT_FORM_URL}" target="_blank" rel="noopener" style="animation-delay:120ms">
      ${singleLinkGlyph}
      <div class="apply-choice__text">
        <h2 class="apply-choice__title">Tell us what you need</h2>
        <p class="apply-choice__sub">A few questions about your team and the role — takes two minutes.</p>
      </div>
      ${arrow}
    </a>
  </div>`
}

function renderState(state) {
  if (state === 'hire') return hireHtml()
  if (state === 'join') return joinHtml()
  return rootHtml()
}

function stateFromHash() {
  const h = window.location.hash.replace('#', '')
  return STATES.includes(h) ? h : 'root'
}

export const html = `
<section class="op-section apply-section" id="apply">

  <!-- Same corner chains as the positions page — one careers family -->
  <img src="${chainBg}" class="op-chain op-chain--tr" alt="" aria-hidden="true" />
  <img src="${chainBg}" class="op-chain op-chain--bl" alt="" aria-hidden="true" />

  <div class="op-header padded">
    <div class="section-label">
      <span class="section-label__num">00</span>
      <span class="section-label__line"></span>
      <span class="section-label__title">APPLY</span>
    </div>
  </div>

  <div id="applyStage">${renderState(stateFromHash())}</div>

</section>
`

export function init() {
  const stage = document.getElementById('applyStage')

  function wireStage(state) {
    // Hovering a choice excites the navbar, same as the apply buttons do
    stage.querySelectorAll('.apply-choice').forEach(choice => {
      choice.addEventListener('mouseenter', () => exciteNavbar(true))
      choice.addEventListener('mouseleave', () => exciteNavbar(false))
    })

    // Root-level choices swap panels in place instead of a hard navigation
    stage.querySelectorAll('[data-goto]').forEach(link => {
      link.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return
        e.preventDefault()
        history.pushState({}, '', `#${link.dataset.goto}`)
        transitionTo(link.dataset.goto)
      })
    })

    stage.querySelector('[data-back-root]')?.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return
      e.preventDefault()
      history.pushState({}, '', '/apply')
      transitionTo('root')
    })

    // Live count of open roles, in the positions-page count grammar. The slot
    // is reserved in the layout, so nothing shifts when it lands — and a
    // failed or empty fetch just leaves the hero as it was.
    if (state === 'join') {
      fetchJobs()
        .then(jobs => {
          if (!jobs.length) return
          const count = document.getElementById('applyCount')
          count.querySelector('.op-count__num').textContent = jobs.length
          count.setAttribute('aria-hidden', 'false')
          count.classList.add('is-in')
        })
        .catch(() => {})
    }
  }

  function transitionTo(state) {
    exciteNavbar(false) // a hovered choice can be swapped away without its mouseleave
    const leaving = [...stage.children]
    leaving.forEach((el, i) => {
      el.style.animationDelay = `${i * 30}ms`
      el.classList.add('op-leaving')
    })
    setTimeout(() => {
      stage.innerHTML = renderState(state)
      wireStage(state)
      window.scrollTo({ top: 0, behavior: 'auto' })
    }, leaving.length * 30 + 240)
  }

  window.addEventListener('popstate', () => transitionTo(stateFromHash()))

  wireStage(stateFromHash())
}

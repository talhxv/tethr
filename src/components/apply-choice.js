import { exciteNavbar } from './navbar.js'
import { fetchJobs } from '../lib/notion.js'
import chainBg from '../assets/fullylinkedvectorchainbluephone.svg'

// Talent pool / open-application form — same one linked from the open
// positions page's "Don't see a fit?" footer note.
const TALLY_FORM_ID  = 'Y5vkxd'
const TALLY_FORM_URL = `https://tally.so/r/${TALLY_FORM_ID}`

const arrow = `
  <div class="op-row__arrow apply-choice__arrow" aria-hidden="true">
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
      <path d="M3.75 14.25L14.25 3.75M14.25 3.75H6.75M14.25 3.75V11.25" stroke="#2B44FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>`

// Chain glyphs in the hero art's own vocabulary (stroked stadium rects).
// Open positions: two joined links — there's a live role to link into.
// Talent pool: one solid link, the next one dashed — we hold your place
// until the role that fits shows up.
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
    <a class="apply-choice" href="${TALLY_FORM_URL}?position=${encodeURIComponent('Talent pool')}" target="_blank" rel="noopener" style="animation-delay:220ms">
      ${awaitingGlyph}
      <div class="apply-choice__text">
        <h2 class="apply-choice__title">Join the talent pool</h2>
        <p class="apply-choice__sub">No matching role yet? Introduce yourself once and we'll reach out when one fits.</p>
      </div>
      ${arrow}
    </a>
  </div>

</section>
`

export function init() {
  // Hovering a choice excites the navbar, same as the apply buttons do
  document.querySelectorAll('.apply-choice').forEach(choice => {
    choice.addEventListener('mouseenter', () => exciteNavbar(true))
    choice.addEventListener('mouseleave', () => exciteNavbar(false))
  })

  // Live count of open roles, in the positions-page count grammar. The slot
  // is reserved in the layout, so nothing shifts when it lands — and a
  // failed or empty fetch just leaves the hero as it was.
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

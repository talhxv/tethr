import { exciteNavbar } from './navbar.js'
import chainBg from '../assets/fullylinkedvectorchainbluephone.svg'

// Old /apply#hire links (the former in-page "hire" panel) now live at /book
if (window.location.hash === '#hire') window.location.replace('/book')

const arrow = `
  <div class="op-row__arrow apply-choice__arrow" aria-hidden="true">
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
      <path d="M3.75 14.25L14.25 3.75M14.25 3.75H6.75M14.25 3.75V11.25" stroke="#2B44FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>`

// Chain glyphs in the hero art's own vocabulary (stroked stadium rects).
// Single link: Tethr as one entity reaching out to hire on your behalf.
// Two joined links: there's a live role to link yourself into.
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

function rootHtml() {
  return `
  <div class="apply-hero padded">
    <div class="apply-hero__text">
      <h1 class="apply-hero__headline">Work with <em class="apply-hero__em">us.</em></h1>
      <p class="apply-hero__sub">Tell us which side of the table you're on and we'll take it from there.</p>
    </div>
  </div>

  <div class="apply-choices padded">
    <a class="apply-choice" href="/book" data-transition style="animation-delay:120ms">
      ${singleLinkGlyph}
      <div class="apply-choice__text">
        <h2 class="apply-choice__title">Hire talent</h2>
        <p class="apply-choice__sub">Bring Tethr in to source, pay, and manage the people your team needs.</p>
      </div>
      ${arrow}
    </a>
    <a class="apply-choice" href="/positions" data-transition style="animation-delay:220ms">
      ${linkedGlyph}
      <div class="apply-choice__text">
        <h2 class="apply-choice__title">Join Tethr</h2>
        <p class="apply-choice__sub">Browse the roles we're hiring for right now — no fit yet? Send an open application straight from there.</p>
      </div>
      ${arrow}
    </a>
  </div>`
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

  ${rootHtml()}

</section>
`

export function init() {
  // Hovering a choice excites the navbar, same as the apply buttons do
  document.querySelectorAll('.apply-choice').forEach(choice => {
    choice.addEventListener('mouseenter', () => exciteNavbar(true))
    choice.addEventListener('mouseleave', () => exciteNavbar(false))
  })
}

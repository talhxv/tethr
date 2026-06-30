import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import clutchLogo from '../assets/CluchblueLogo.svg'
import trustpilotRaw from '../assets/trustpilotlonglogo.svg?raw'

gsap.registerPlugin(ScrollTrigger)

// Trustpilot lockup kept native — black wordmark + recognizable brand-green
// star. Only the bogus width/height are stripped so the inline SVG scales by
// its viewBox under CSS control.
const trustpilot = trustpilotRaw
  .replace(/\swidth="2500"/, '')
  .replace(/\sheight="-437"/, '')

// ── Mobile chain rails — reuse the navbar's two chain-link paths, tiled
// horizontally as a repeating background (applied in init()). ──
const CHAIN_PATH_1 = 'M4.46582 2.2064C4.46582 1.9627 4.66338 1.76514 4.90708 1.76514H9.31967C9.56337 1.76514 9.76093 1.9627 9.76093 2.2064C9.76093 2.4501 9.56337 2.64765 9.31967 2.64765H4.90708C4.66338 2.64765 4.46582 2.4501 4.46582 2.2064Z'
const CHAIN_PATH_2 = 'M4.75195 0C5.67337 0.000126237 6.46188 0.565786 6.79199 1.36816H5.59766C5.39561 1.17821 5.12443 1.06055 4.8252 1.06055H2.13281C1.50968 1.06055 1.00433 1.56545 1.00391 2.18848C1.00393 2.81185 1.50943 3.31738 2.13281 3.31738H4.8252C5.08614 3.31738 5.3254 3.22783 5.5166 3.0791H6.77734C6.43908 3.86349 5.66021 4.41296 4.75195 4.41309H2.20605C0.987671 4.41292 2.22361e-05 3.42447 0 2.20605C0.00032914 0.987899 0.98786 0.000160668 2.20605 0H4.75195ZM11.7109 0C12.9289 0.000371713 13.9166 0.98805 13.917 2.20605C13.9169 3.42426 12.9291 4.41271 11.7109 4.41309H9.16504C8.25683 4.41296 7.47794 3.86347 7.13965 3.0791H8.39941C8.59073 3.22806 8.83054 3.31738 9.0918 3.31738H11.7852C12.408 3.31695 12.9128 2.81231 12.9131 2.18945C12.9129 1.56649 12.4081 1.06098 11.7852 1.06055H9.0918C8.79262 1.06055 8.52137 1.17815 8.31934 1.36816H7.125C7.45512 0.565789 8.24364 0.000123454 9.16504 0H11.7109Z'
const chainTile = `<svg xmlns="http://www.w3.org/2000/svg" width="13.917" height="4.42" viewBox="0 0 13.917 4.42"><path d="${CHAIN_PATH_2}" fill="#0755E9"/><path d="${CHAIN_PATH_1}" fill="#0755E9"/></svg>`
const chainBg = `url("data:image/svg+xml,${encodeURIComponent(chainTile)}")`

// One Clutch + Trustpilot pair; repeated to fill the marquee track.
const marqueePair = `
        <span class="trust__m-item"><img src="${clutchLogo}" alt="Clutch" class="trust__m-clutch" /></span>
        <span class="trust__m-item"><span class="trust__m-trustpilot" role="img" aria-label="Trustpilot">${trustpilot}</span></span>`
const marqueeHalf = marqueePair.repeat(4)

// Single-pass refraction lens — same convex displacement map as the services
// #liquid-lens (so the sphere genuinely bends whatever is behind it), but with
// ONE displacement pass instead of three R/G/B passes. That drops the chromatic
// aberration that turns into an ugly rainbow fringe over the cards' hard border.
const lensFilter = `
<svg style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">
  <defs>
    <filter id="trust-lens" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feImage x="0%" y="0%" width="100%" height="100%" preserveAspectRatio="none" result="map"
        href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cdefs%3E%3ClinearGradient id='lx' x1='0' y1='0' x2='1' y2='0'%3E%3Cstop offset='0' stop-color='%23ff0000'/%3E%3Cstop offset='1' stop-color='%23000000'/%3E%3C/linearGradient%3E%3ClinearGradient id='ly' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%2300ff00'/%3E%3Cstop offset='1' stop-color='%23000000'/%3E%3C/linearGradient%3E%3CradialGradient id='lc' cx='0.5' cy='0.5' r='0.5'%3E%3Cstop offset='0' stop-color='%237f7f7f'/%3E%3Cstop offset='0.42' stop-color='%237f7f7f'/%3E%3Cstop offset='1' stop-color='%237f7f7f' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='120' height='120' fill='url(%23lx)'/%3E%3Crect width='120' height='120' fill='url(%23ly)' style='mix-blend-mode:screen'/%3E%3Crect width='120' height='120' fill='url(%23lc)'/%3E%3C/svg%3E"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="30" xChannelSelector="R" yChannelSelector="G" result="disp"/>
      <feGaussianBlur in="disp" stdDeviation="0.45"/>
    </filter>
  </defs>
</svg>`

// Reuses the services sphere's body + specular glint/rim, with the lens layer
// driven by the single-pass #trust-lens filter above.
const sphere = (mod) => `
  <div class="trust__sphere trust__sphere--${mod} services__glass-sphere" role="presentation" aria-hidden="true">
    <div class="glass-sphere__lens"></div>
    <div class="glass-sphere__body"></div>
    <div class="glass-sphere__glint"></div>
    <div class="glass-sphere__rim"></div>
  </div>`

export const html = `
${lensFilter}
<section class="trust" id="trust">
  <div class="trust__inner">
    <div class="trust__label">
      <span class="trust__eyebrow">Recognised by</span>
      <span class="trust__sub">Trusted Review Platforms</span>
    </div>
    <div class="trust__cards">
      <div class="trust__card trust__card--clutch" data-trust-card>
        <div class="trust__card-inner">
          <img src="${clutchLogo}" alt="Clutch" class="trust__logo trust__logo--clutch" />
        </div>
        ${sphere('clutch')}
      </div>
      <div class="trust__card trust__card--trustpilot" data-trust-card>
        <div class="trust__card-inner">
          <span class="trust__logo trust__logo--trustpilot" aria-label="Trustpilot" role="img">${trustpilot}</span>
        </div>
        ${sphere('trustpilot')}
      </div>
    </div>
  </div>

  <!-- Mobile-only: centered label + a left-travelling logo marquee
       running between two static chain rails. -->
  <div class="trust__mobile">
    <div class="trust__m-head">
      <span class="trust__eyebrow">Recognised by</span>
    </div>
    <div class="trust__rail">
      <span class="trust__chain" aria-hidden="true"></span>
      <div class="trust__marquee">
        <div class="trust__track">${marqueeHalf}${marqueeHalf}</div>
      </div>
      <span class="trust__chain" aria-hidden="true"></span>
    </div>
  </div>
</section>
`

export function init() {
  const section = document.getElementById('trust')
  if (!section) return

  // Paint the mobile chain rails (also needed under reduced-motion).
  section.querySelectorAll('.trust__chain').forEach((el) => {
    el.style.backgroundImage = chainBg
  })

  const cards = gsap.utils.toArray('[data-trust-card]', section)
  if (!cards.length) return

  // Honour reduced-motion: leave the strip clean and static.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  // Reveal on enter, mirrored exit on the way down to the manifesto.
  // toggleActions 'reverse' replays the reveal backwards as the section leaves,
  // so the exit is a perfect mirror of the entrance — and it re-reveals when you
  // scroll back up.
  //
  // NB: animate TRANSFORM ONLY (no opacity). Dropping the card's opacity below 1
  // turns it into a "backdrop root", which cuts the sphere's liquid-glass lens
  // off from what's behind it — that's the glitch on the right bead during the
  // fade. Sliding + scaling keeps every ancestor at opacity 1, so the lens holds.
  gsap.fromTo(
    cards,
    { y: 44, scale: 0.9 },
    {
      y: 0,
      scale: 1,
      duration: 0.75,
      ease: 'power3.out',
      stagger: 0.12,
      scrollTrigger: {
        trigger: section,
        start: 'top 88%',
        end: 'bottom 12%',
        toggleActions: 'play reverse play reverse',
      },
    }
  )

  // Parallax drift — the two cards travel at slightly different rates as the
  // section passes through the viewport, so they ease apart. This is what turns
  // the staggered overlap into an intentional depth cue rather than a collision.
  // Driven on yPercent so it composes with the entrance tween's `y`.
  const drift = [-7, 8] // clutch rises, trustpilot sinks — gentle, so they stay overlapped
  cards.forEach((card, i) => {
    gsap.to(card, {
      yPercent: drift[i] ?? 0,
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    })
  })
}

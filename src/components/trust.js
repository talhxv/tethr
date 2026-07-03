import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import clutchLogo from '../assets/CluchblueLogo.svg'
import clutchRaw from '../assets/CluchblueLogo.svg?raw'
import trustpilotRaw from '../assets/trustpilotlonglogo.svg?raw'

gsap.registerPlugin(ScrollTrigger)

// Trustpilot lockup kept native — black wordmark + recognizable brand-green
// star. Only the bogus width/height are stripped so the inline SVG scales by
// its viewBox under CSS control.
const trustpilot = trustpilotRaw
  .replace(/\swidth="2500"/, '')
  .replace(/\sheight="-437"/, '')

// Ink (desktop) variants — flatten every fill to the heading ink so both logos
// carry identical visual weight and stay quiet next to the blue chain tether.
// The coloured versions above are kept for the mobile marquee.
const INK = '#08060d'
const clutchInk = clutchRaw
  .replace(/\swidth="232"/, '')
  .replace(/\sheight="62"/, '')
  .replace(/fill="#[0-9A-Fa-f]{3,6}"/g, `fill="${INK}"`)
const trustpilotInk = trustpilotRaw
  .replace(/\swidth="2500"/, '')
  .replace(/\sheight="-437"/, '')
  .replace('<svg ', `<svg fill="${INK}" `)
  .replace(/fill="#[0-9A-Fa-f]{3,6}"/gi, `fill="${INK}"`)

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

export const html = `
<section class="trust" id="trust">
  <!-- Desktop: one tether line — mono eyebrow, the brand chain rail drawing
       across to the proof, logos flattened to ink. -->
  <div class="trust__inner">
    <span class="trust__eyebrow">Recognised by</span>
    <span class="trust__tether" aria-hidden="true"></span>
    <div class="trust__logos">
      <span class="trust__logo trust__logo--clutch" role="img" aria-label="Clutch" data-trust-logo>${clutchInk}</span>
      <span class="trust__logo trust__logo--trustpilot" role="img" aria-label="Trustpilot" data-trust-logo>${trustpilotInk}</span>
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

  // Paint the chain rails — desktop tether + mobile marquee rails
  // (also needed under reduced-motion).
  section.querySelectorAll('.trust__chain, .trust__tether').forEach((el) => {
    el.style.backgroundImage = chainBg
  })

  // Run the mobile marquee only while the strip is meaningfully on screen.
  // The negative bottom margin keeps it still while it merely peeks over
  // the fold — the hero owns the landing viewport's motion.
  const track = section.querySelector('.trust__track')
  if (track) {
    new IntersectionObserver(([entry]) => {
      track.classList.toggle('is-running', entry.isIntersecting)
    }, { threshold: 0.6, rootMargin: '0px 0px -200px 0px' })
      .observe(track.closest('.trust__rail') || section)
  }

  const tether = section.querySelector('.trust__tether')
  const logos = gsap.utils.toArray('[data-trust-logo]', section)
  if (!logos.length) return

  // Honour reduced-motion: leave the strip clean and static.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  // One orchestrated moment: the chain draws left→right, tethering the label
  // to the proof, then the logos settle in. toggleActions 'reverse' replays it
  // backwards as the section leaves.
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top 88%',
      end: 'bottom 12%',
      toggleActions: 'play reverse play reverse',
    },
  })

  tl.from(tether, {
    clipPath: 'inset(0 100% 0 0)',
    duration: 0.9,
    ease: 'power2.inOut',
  }).from(
    logos,
    {
      autoAlpha: 0,
      y: 14,
      duration: 0.6,
      ease: 'power3.out',
      stagger: 0.12,
    },
    '-=0.3'
  )
}

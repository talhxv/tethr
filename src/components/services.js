import swirl from '../assets/swirlcomponent.svg'
import tethrEarth from '../assets/tethrearth.svg'
import settingsCog from '../assets/settingscog.svg'
import executionStack from '../assets/executionstack.svg'

const SERVICES = [
  {
    id: 'software',
    title: 'Software',
    sub: ['Design', 'Web Development', 'Mobile Apps', 'SaaS'],
    caption: 'Design, web, mobile, and SaaS — built end to end by your managed team.',
  },
  {
    id: 'automations',
    title: 'Automations',
    sub: ['Workflows', 'AI Integration', 'API Pipelines', 'No-Code'],
    caption: 'Workflows, AI integrations, and API pipelines that cut the manual work.',
  },
  {
    id: 'consulting',
    title: 'Consulting & Execution',
    sub: ['Strategy', 'Project Management', 'Go-to-Market', 'Advisory'],
    caption: 'Strategy, project management, and go-to-market, carried through to done.',
  },
]

const sphere = `
  <div class="services__sphere services__glass-sphere" role="presentation" aria-hidden="true">
    <div class="glass-sphere__lens"></div>
    <div class="glass-sphere__body"></div>
    <div class="glass-sphere__glint"></div>
    <div class="glass-sphere__rim"></div>
  </div>`

// Scene art per service — the compositions from the old cards, now living in
// one shared stage that crossfades as the index is browsed.
const SCENES = {
  software: `
    <img src="${swirl}" class="services__swirl" alt="" />
    <img src="${tethrEarth}" class="services__earth" alt="" />
    ${sphere}`,
  automations: `
    <img src="${swirl}" class="services__swirl services__swirl--auto" alt="" />
    <img src="${settingsCog}" class="services__cog" alt="" />
    ${sphere}`,
  consulting: `
    <img src="${swirl}" class="services__swirl services__swirl--consult" alt="" />
    <img src="${executionStack}" class="services__stack" alt="" />
    ${sphere}`,
}

const arrow = `
  <svg class="services__row-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7 17 17 7M8.5 7H17v8.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`

export const html = `
<!-- Liquid-glass lens filter — used via backdrop-filter so content BEHIND the sphere refracts.
     The feImage map encodes displacement direction: R = horizontal, G = vertical, neutral gray
     center fading to full shift at the rim (convex lens). Three passes at staggered scales
     produce the chromatic aberration fringe. Chromium-only; other browsers keep the frost. -->
<svg style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">
  <defs>
    <filter id="liquid-lens" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feImage x="0%" y="0%" width="100%" height="100%" preserveAspectRatio="none" result="map"
        href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cdefs%3E%3ClinearGradient id='lx' x1='0' y1='0' x2='1' y2='0'%3E%3Cstop offset='0' stop-color='%23ff0000'/%3E%3Cstop offset='1' stop-color='%23000000'/%3E%3C/linearGradient%3E%3ClinearGradient id='ly' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%2300ff00'/%3E%3Cstop offset='1' stop-color='%23000000'/%3E%3C/linearGradient%3E%3CradialGradient id='lc' cx='0.5' cy='0.5' r='0.5'%3E%3Cstop offset='0' stop-color='%237f7f7f'/%3E%3Cstop offset='0.62' stop-color='%237f7f7f'/%3E%3Cstop offset='1' stop-color='%237f7f7f' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='120' height='120' fill='url(%23lx)'/%3E%3Crect width='120' height='120' fill='url(%23ly)' style='mix-blend-mode:screen'/%3E%3Crect width='120' height='120' fill='url(%23lc)'/%3E%3C/svg%3E"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="54" xChannelSelector="R" yChannelSelector="G" result="dispR"/>
      <feColorMatrix in="dispR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="chanR"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="57" xChannelSelector="R" yChannelSelector="G" result="dispG"/>
      <feColorMatrix in="dispG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="chanG"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="60" xChannelSelector="R" yChannelSelector="G" result="dispB"/>
      <feColorMatrix in="dispB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="chanB"/>
      <feBlend in="chanR" in2="chanG" mode="screen" result="rg"/>
      <feBlend in="rg" in2="chanB" mode="screen"/>
    </filter>
    <!-- Recolors the white SVG line art to navy #001B4D, preserving alpha -->
    <filter id="ink-navy" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0.106  0 0 0 0 0.302  0 0 0 1 0"/>
    </filter>
  </defs>
</svg>

<div class="section-label section-label--spaced padded" id="services">
  <span class="section-label__num">03</span>
  <span class="section-label__line"></span>
  <span class="section-label__title">SERVICES</span>
</div>
<section class="services">
  <div class="services__layout">

    <!-- Preview — the active service's artwork, caption, and link -->
    <div class="services__preview">
      <div class="services__stage">
        ${SERVICES.map(
          (s, i) => `
        <div class="services__scene services__scene--${s.id}${i === 0 ? ' is-active' : ''}" data-scene="${s.id}" aria-hidden="true">${SCENES[s.id]}</div>`
        ).join('')}
      </div>
      <div class="services__captions">
        ${SERVICES.map(
          (s, i) => `
        <p class="services__caption${i === 0 ? ' is-active' : ''}" data-caption="${s.id}">${s.caption}</p>`
        ).join('')}
      </div>
    </div>

    <!-- Index — the services as a large type list; hover/tap drives the preview -->
    <ul class="services__index" role="list">
      ${SERVICES.map(
        (s, i) => `
      <li class="services__row${i === 0 ? ' is-active' : ''}" data-service="${s.id}">
        <button type="button" class="services__row-btn" aria-expanded="${i === 0}">
          <span class="services__row-title">${s.title}</span>
          ${arrow}
        </button>
        <div class="services__row-reveal">
          <p class="services__row-sub">${s.sub.join(' · ')}</p>
        </div>
      </li>`
      ).join('')}
    </ul>

  </div>
</section>
`

export function init() {
  const section = document.querySelector('.services')
  if (!section) return

  const rows = [...section.querySelectorAll('.services__row')]
  const scenes = [...section.querySelectorAll('.services__scene')]
  const captions = [...section.querySelectorAll('.services__caption')]

  function activate(id) {
    rows.forEach((row) => {
      const on = row.dataset.service === id
      row.classList.toggle('is-active', on)
      row.querySelector('.services__row-btn').setAttribute('aria-expanded', on)
    })
    scenes.forEach((s) => s.classList.toggle('is-active', s.dataset.scene === id))
    captions.forEach((c) => c.classList.toggle('is-active', c.dataset.caption === id))
  }

  rows.forEach((row) => {
    const id = row.dataset.service
    row.addEventListener('mouseenter', () => activate(id))
    row.querySelector('.services__row-btn').addEventListener('click', () => activate(id))
    row.querySelector('.services__row-btn').addEventListener('focus', () => activate(id))
  })

  // Fade the glass spheres in as the section enters view, so the backdrop-filter
  // lens's first (lazy) compile happens under cover of the fade rather than
  // popping in cold. rootMargin gives the filter a head start before it's seen.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            section.classList.add('is-inview')
            obs.disconnect()
          }
        })
      },
      { rootMargin: '0px 0px -15% 0px' }
    )
    io.observe(section)
  } else {
    section.classList.add('is-inview')
  }
}

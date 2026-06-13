import tethrLogo from '../assets/tethrlogo.svg'
import tethrFontLogo from '../assets/tethrfontlogo.svg'
import arrowSlantUp from '../assets/arrowslantup.svg'
import sticker from '../assets/sticker.svg'
import linkedin from '../assets/LinkedIN.svg'
import facebook from '../assets/Facebook.svg'
import instagram from '../assets/Instagram.svg'
import twitter from '../assets/Twitter.svg'

const NS = 'http://www.w3.org/2000/svg'

const CHAIN_PATH_1 = 'M4.46582 2.2064C4.46582 1.9627 4.66338 1.76514 4.90708 1.76514H9.31967C9.56337 1.76514 9.76093 1.9627 9.76093 2.2064C9.76093 2.4501 9.56337 2.64765 9.31967 2.64765H4.90708C4.66338 2.64765 4.46582 2.4501 4.46582 2.2064Z'
const CHAIN_PATH_2 = 'M4.75195 0C5.67337 0.000126237 6.46188 0.565786 6.79199 1.36816H5.59766C5.39561 1.17821 5.12443 1.06055 4.8252 1.06055H2.13281C1.50968 1.06055 1.00433 1.56545 1.00391 2.18848C1.00393 2.81185 1.50943 3.31738 2.13281 3.31738H4.8252C5.08614 3.31738 5.3254 3.22783 5.5166 3.0791H6.77734C6.43908 3.86349 5.66021 4.41296 4.75195 4.41309H2.20605C0.987671 4.41292 2.22361e-05 3.42447 0 2.20605C0.00032914 0.987899 0.98786 0.000160668 2.20605 0H4.75195ZM11.7109 0C12.9289 0.000371713 13.9166 0.98805 13.917 2.20605C13.9169 3.42426 12.9291 4.41271 11.7109 4.41309H9.16504C8.25683 4.41296 7.47794 3.86347 7.13965 3.0791H8.39941C8.59073 3.22806 8.83054 3.31738 9.0918 3.31738H11.7852C12.408 3.31695 12.9128 2.81231 12.9131 2.18945C12.9129 1.56649 12.4081 1.06098 11.7852 1.06055H9.0918C8.79262 1.06055 8.52137 1.17815 8.31934 1.36816H7.125C7.45512 0.565789 8.24364 0.000123454 9.16504 0H11.7109Z'

export const html = `
<div class="mobile-menu" id="mobileMenu" aria-hidden="true">
  <div class="mobile-menu__header">
    <a href="/" class="mobile-menu__logo">
      <img src="${tethrLogo}" class="mobile-menu__icon" alt="" aria-hidden="true" />
      <img src="${tethrFontLogo}" class="mobile-menu__wordmark" alt="Tethr" />
    </a>
    <button class="mobile-menu__close" id="mobileMenuClose" aria-label="Close menu">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <line x1="2" y1="2" x2="18" y2="18" stroke="#2B44FF" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="18" y1="2" x2="2" y2="18" stroke="#2B44FF" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </button>
  </div>

  <nav class="mobile-menu__links">
    <a href="#services" class="mobile-menu__link">Services</a>
    <a href="/positions.html" class="mobile-menu__link">Open Positions</a>
    <a href="#manifesto-track" class="mobile-menu__link">About Us</a>
  </nav>

  <div class="mobile-menu__footer">
    <div class="mobile-menu__socials">
      <a href="#" aria-label="LinkedIn"><img src="${linkedin}" alt="LinkedIn" /></a>
      <a href="#" aria-label="Facebook"><img src="${facebook}" alt="Facebook" /></a>
      <a href="#" aria-label="Instagram"><img src="${instagram}" alt="Instagram" /></a>
      <a href="#" aria-label="Twitter"><img src="${twitter}" alt="Twitter" /></a>
    </div>
    <div class="mobile-menu__footer-divider" aria-hidden="true"></div>
    <a href="#" class="mobile-menu__apply">Apply <img src="${arrowSlantUp}" alt="" aria-hidden="true" /></a>
  </div>
</div>

<nav class="navbar">
  <a href="/" class="navbar-logo-link" aria-label="Tethr home">
    <img src="${tethrLogo}" class="navbar-logo navbar-logo--img" alt="Tethr" />
    <img src="${tethrLogo}" class="navbar-logo--icon" alt="" aria-hidden="true" />
    <img src="${tethrFontLogo}" class="navbar-logo--wordmark" alt="Tethr" />
  </a>
  <div class="navbar-links">
    <a href="#services" class="navbar-link">Services</a>
    <a href="/positions.html" class="navbar-link">Open positions</a>
    <a href="#manifesto-track" class="navbar-link">About us</a>
  </div>
  <a href="#" class="navbar-apply">Apply <img src="${arrowSlantUp}" class="navbar-apply-arrow" aria-hidden="true" /></a>
  <button class="navbar-burger" aria-label="Menu">
    <svg width="26" height="13" viewBox="0 0 26 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="1.25" x2="26" y2="1.25" stroke="#2B44FF" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="8" y1="11.75" x2="26" y2="11.75" stroke="#2B44FF" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
  </button>
  <img src="${sticker}" class="navbar-sticker" aria-hidden="true" />
</nav>
`

export function init() {
  const nav = document.querySelector('.navbar')


  const SPEED_NORMAL = 22  // px/s
  const SPEED_HOVER  = 160 // px/s

  let speed = SPEED_NORMAL
  let rafId = null
  let lastTime = null
  let links = []
  let pathRef = null
  let totalLength = 0
  // Path geometry sampled at 1px steps — getPointAtLength is far too slow
  // to call per link per frame (~400 calls/frame tanked the whole page)
  let pointCache = []

  const applyBtn   = nav.querySelector('.navbar-apply')
  const burgerBtn  = nav.querySelector('.navbar-burger')
  const mobileMenu = document.getElementById('mobileMenu')
  const closeBtn   = document.getElementById('mobileMenuClose')

  // Move mobile menu out of .navbar-wrap so its z-index isn't capped by that stacking context
  document.body.appendChild(mobileMenu)

  burgerBtn.addEventListener('click', () => {
    mobileMenu.classList.add('open')
    document.body.style.overflow = 'hidden'
  })
  closeBtn.addEventListener('click', () => {
    mobileMenu.classList.remove('open')
    document.body.style.overflow = ''
  })
  mobileMenu.querySelectorAll('.mobile-menu__link').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('open')
      document.body.style.overflow = ''
    })
  })

  ;[applyBtn, burgerBtn].forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      speed = SPEED_HOVER
      nav.style.boxShadow = '0 0 12px 2px rgba(43,68,255,0.15)'
    })
    btn.addEventListener('mouseleave', () => {
      speed = SPEED_NORMAL
      nav.style.boxShadow = ''
    })
  })

  function tick(now) {
    if (lastTime !== null) {
      const dt = (now - lastTime) / 1000
      for (const link of links) {
        link.pos = (link.pos + speed * dt) % totalLength
        const p = pointCache[Math.floor(link.pos) % pointCache.length]
        link.g.setAttribute('transform', `translate(${p.x},${p.y}) rotate(${p.a})`)
      }
    }
    lastTime = now
    rafId = requestAnimationFrame(tick)
  }

  function buildPointCache() {
    pointCache = []
    const steps = Math.ceil(totalLength)
    for (let i = 0; i < steps; i++) {
      const p = pathRef.getPointAtLength(i)
      pointCache.push({ x: p.x, y: p.y, a: 0 })
    }
    for (let i = 0; i < steps; i++) {
      const p1 = pointCache[i]
      const p2 = pointCache[(i + 1) % steps]
      p1.a = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI
    }
  }

  function buildChainBorder() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    lastTime = null
    links = []

    const existing = nav.querySelector('.navbar-chain-svg')
    if (existing) existing.remove()

    const mobile = window.innerWidth <= 768

    /* On real mobile Safari, overflow:visible on SVG bleeds badly — skip chain */
    if (mobile) return
    const R = mobile ? 22 : 36
    const LINK_SPACING = mobile ? 9 : 13

    const { width, height } = nav.getBoundingClientRect()

    const svg = document.createElementNS(NS, 'svg')
    svg.classList.add('navbar-chain-svg')
    svg.setAttribute('width', width)
    svg.setAttribute('height', height)
    svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;overflow:visible'


    const motionPath = document.createElementNS(NS, 'path')
    motionPath.setAttribute('d', [
      `M ${R} 0`,
      `L ${width - R} 0`,
      `A ${R} ${R} 0 0 1 ${width} ${R}`,
      `L ${width} ${height - R}`,
      `A ${R} ${R} 0 0 1 ${width - R} ${height}`,
      `L ${R} ${height}`,
      `A ${R} ${R} 0 0 1 0 ${height - R}`,
      `L 0 ${R}`,
      `A ${R} ${R} 0 0 1 ${R} 0 Z`
    ].join(' '))
    motionPath.setAttribute('fill', 'none')
    motionPath.setAttribute('stroke', 'none')
    motionPath.style.visibility = 'hidden'
    svg.appendChild(motionPath)

    if (!mobile) {
      const bgPath = document.createElementNS(NS, 'path')
      bgPath.setAttribute('d', motionPath.getAttribute('d'))
      bgPath.setAttribute('fill', 'rgba(255,255,255,0)')
      svg.appendChild(bgPath)
    }

    nav.style.position = 'relative'
    nav.appendChild(svg)

    pathRef = motionPath
    totalLength = motionPath.getTotalLength()
    buildPointCache()
    const N = Math.floor(totalLength / LINK_SPACING)

    for (let i = 0; i < N; i++) {
      const g = document.createElementNS(NS, 'g')
      const inner = document.createElementNS(NS, 'g')
      inner.setAttribute('transform', 'translate(-7, -2.5)')
      ;[CHAIN_PATH_1, CHAIN_PATH_2].forEach(d => {
        const p = document.createElementNS(NS, 'path')
        p.setAttribute('d', d)
        p.setAttribute('fill', '#2B44FF')
        inner.appendChild(p)
      })
      g.appendChild(inner)
      svg.appendChild(g)
      links.push({ g, pos: (i / N) * totalLength })
    }

    rafId = requestAnimationFrame(tick)
  }

  buildChainBorder()

  let paused = false
  window.addEventListener('scroll', () => {
    const atTop = window.scrollY === 0
    if (!atTop && !paused) {
      paused = true
      if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    } else if (atTop && paused) {
      paused = false
      lastTime = null
      rafId = requestAnimationFrame(tick)
    }
  }, { passive: true })

  let resizeTimer
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(buildChainBorder, 150) })
}
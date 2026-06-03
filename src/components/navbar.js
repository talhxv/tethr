import tethrLogo from '../assets/tethrlogo.svg'
import arrowSlantUp from '../assets/arrowslantup.svg'
import sticker from '../assets/sticker.svg'

const NS = 'http://www.w3.org/2000/svg'

const CHAIN_PATH_1 = 'M4.46582 2.2064C4.46582 1.9627 4.66338 1.76514 4.90708 1.76514H9.31967C9.56337 1.76514 9.76093 1.9627 9.76093 2.2064C9.76093 2.4501 9.56337 2.64765 9.31967 2.64765H4.90708C4.66338 2.64765 4.46582 2.4501 4.46582 2.2064Z'
const CHAIN_PATH_2 = 'M4.75195 0C5.67337 0.000126237 6.46188 0.565786 6.79199 1.36816H5.59766C5.39561 1.17821 5.12443 1.06055 4.8252 1.06055H2.13281C1.50968 1.06055 1.00433 1.56545 1.00391 2.18848C1.00393 2.81185 1.50943 3.31738 2.13281 3.31738H4.8252C5.08614 3.31738 5.3254 3.22783 5.5166 3.0791H6.77734C6.43908 3.86349 5.66021 4.41296 4.75195 4.41309H2.20605C0.987671 4.41292 2.22361e-05 3.42447 0 2.20605C0.00032914 0.987899 0.98786 0.000160668 2.20605 0H4.75195ZM11.7109 0C12.9289 0.000371713 13.9166 0.98805 13.917 2.20605C13.9169 3.42426 12.9291 4.41271 11.7109 4.41309H9.16504C8.25683 4.41296 7.47794 3.86347 7.13965 3.0791H8.39941C8.59073 3.22806 8.83054 3.31738 9.0918 3.31738H11.7852C12.408 3.31695 12.9128 2.81231 12.9131 2.18945C12.9129 1.56649 12.4081 1.06098 11.7852 1.06055H9.0918C8.79262 1.06055 8.52137 1.17815 8.31934 1.36816H7.125C7.45512 0.565789 8.24364 0.000123454 9.16504 0H11.7109Z'

export const html = `
<nav class="navbar">
  <a href="/" class="navbar-logo-link" aria-label="Tethr home">
    <img src="${tethrLogo}" class="navbar-logo" alt="Tethr" />
  </a>
  <div class="navbar-links">
    <a href="#" class="navbar-link">Services</a>
    <a href="#" class="navbar-link">Open positions</a>
    <a href="#" class="navbar-link">About us</a>
  </div>
  <a href="#" class="navbar-apply">Apply <img src="${arrowSlantUp}" class="navbar-apply-arrow" aria-hidden="true" /></a>
  <img src="${sticker}" class="navbar-sticker" aria-hidden="true" />
</nav>
`

export function init() {
  const nav = document.querySelector('.navbar')

  const SPEED_NORMAL = 40  // px/s
  const SPEED_HOVER  = 160 // px/s

  let speed = SPEED_NORMAL
  let rafId = null
  let lastTime = null
  let links = []
  let pathRef = null
  let totalLength = 0

  nav.addEventListener('mouseenter', () => { speed = SPEED_HOVER })
  nav.addEventListener('mouseleave', () => { speed = SPEED_NORMAL })

  function tick(now) {
    if (lastTime !== null) {
      const dt = (now - lastTime) / 1000
      for (const link of links) {
        link.pos = (link.pos + speed * dt) % totalLength
        const p1 = pathRef.getPointAtLength(link.pos)
        const p2 = pathRef.getPointAtLength((link.pos + 1) % totalLength)
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI
        link.g.setAttribute('transform', `translate(${p1.x},${p1.y}) rotate(${angle})`)
      }
    }
    lastTime = now
    rafId = requestAnimationFrame(tick)
  }

  function buildChainBorder() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    lastTime = null
    links = []

    const existing = nav.querySelector('.navbar-chain-svg')
    if (existing) existing.remove()

    const mobile = window.innerWidth <= 768
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

    nav.style.position = 'relative'
    nav.appendChild(svg)

    pathRef = motionPath
    totalLength = motionPath.getTotalLength()
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
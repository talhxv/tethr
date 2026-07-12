import tethrLogo from '../assets/tethrlogo.svg'
import tethrLogoText from '../assets/tethrlogotext.svg'
import tethrEarth from '../assets/tethrearth.svg'
import tethrEnd from '../assets/tethrend.svg'
import linkedin from '../assets/LinkedIN.svg'
import facebook from '../assets/Facebook.svg'
import instagram from '../assets/Instagram.svg'
import twitter from '../assets/Twitter.svg'

export const html = `
<footer id="footer">
  <div class="footer-inner">
    <div class="footer-top">
      <div class="footer-lead">
        <a href="/" class="footer-logo" aria-label="Tethr home">
          <img src="${tethrLogo}" class="footer-logo__icon" alt="" />
          <img src="${tethrLogoText}" class="footer-logo__wordmark" alt="tethr" />
        </a>
        <div class="footer-info">
          <img src="${tethrEarth}" class="footer-globe" alt="" />
          <div class="footer-clock">
            <span class="footer-clock__label">UTC</span>
            <time class="footer-clock__time" id="footer-clock">—</time>
          </div>
          <div class="footer-meta">
            <p class="footer-meta__tagline">remote first</p>
            <div class="footer-meta__rule"></div>
            <p class="footer-meta__copy">All rights reserved. Copyright &copy; 2026 Tethr, pvt ltd</p>
          </div>
        </div>
      </div>

      <nav class="footer-nav" aria-label="Footer navigation">
      <div class="footer-nav__col">
        <span class="footer-nav__label">Quick Links</span>
        <a href="#" class="footer-nav__link">Apply</a>
        <a href="/#hiring" class="footer-nav__link">Work With Tethr</a>
        <a href="/#services" class="footer-nav__link">Services</a>
      </div>
      <div class="footer-nav__col">
        <span class="footer-nav__label">Company</span>
        <a href="/#manifesto-track" class="footer-nav__link">About Us</a>
        <a href="/positions.html" class="footer-nav__link">Open Positions</a>
      </div>
      <div class="footer-connect">
        <span class="footer-nav__label">Connect</span>
        <div class="footer-social-icons">
          <a href="https://www.linkedin.com/company/tethrhq" target="_blank" rel="noopener" aria-label="LinkedIn"><img src="${linkedin}" alt="LinkedIn" /></a>
          <a href="https://www.facebook.com/tethrhq" target="_blank" rel="noopener" aria-label="Facebook"><img src="${facebook}" alt="Facebook" /></a>
          <a href="https://www.instagram.com/tethrhq" target="_blank" rel="noopener" aria-label="Instagram"><img src="${instagram}" alt="Instagram" /></a>
          <a href="https://twitter.com/tethrhq" target="_blank" rel="noopener" aria-label="Twitter / X"><img src="${twitter}" alt="Twitter" /></a>
        </div>
      </div>
      </nav>
    </div>
  </div>

  <div class="footer-end" aria-hidden="true">
    <img src="${tethrEnd}" alt="" />
  </div>
</footer>
`

export function init() {
  /* Overscroll bounce / pinch-zoom-out reveals the canvas (html background)
     beyond the page's end — white by default, which amputates the cropped
     wordmark. Near the footer, tint the canvas navy so the void continues
     it; restore above so a top bounce still shows white behind the light
     page opening. (Elements can't paint into the void — canvas color is
     the only thing browsers render there.) */
  const canvas = document.documentElement
  function tintCanvas() {
    const nearEnd = window.innerHeight + window.scrollY >= canvas.scrollHeight - 320
    canvas.style.backgroundColor = nearEnd ? '#001B4D' : ''
  }
  window.addEventListener('scroll', tintCanvas, { passive: true })
  window.addEventListener('resize', tintCanvas, { passive: true })
  tintCanvas()

  let colon = true
  const el = document.getElementById('footer-clock')
  if (!el) return

  function tick() {
    const now = new Date()
    const h = now.getUTCHours()
    const m = String(now.getUTCMinutes()).padStart(2, '0')
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = String(h % 12 || 12).padStart(2, '0')
    el.textContent = h12 + (colon ? ':' : ' ') + m + ' ' + ampm
    colon = !colon
  }

  tick()
  setInterval(tick, 500)
}

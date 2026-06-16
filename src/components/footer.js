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

    <div class="footer-bottom"></div>

    <nav class="footer-nav" aria-label="Footer navigation">
      <div class="footer-nav__col">
        <span class="footer-nav__label">Quick Links</span>
        <a href="#" class="footer-nav__link">Apply</a>
        <a href="#" class="footer-nav__link">About Us</a>
        <a href="#" class="footer-nav__link">Open Positions</a>
        <a href="#" class="footer-nav__link">Services</a>
        <div class="footer-connect">
          <span class="footer-nav__label">Connect</span>
          <div class="footer-social-icons">
            <a href="#" aria-label="LinkedIn"><img src="${linkedin}" alt="LinkedIn" /></a>
            <a href="#" aria-label="Facebook"><img src="${facebook}" alt="Facebook" /></a>
            <a href="#" aria-label="Instagram"><img src="${instagram}" alt="Instagram" /></a>
            <a href="#" aria-label="Twitter / X"><img src="${twitter}" alt="Twitter" /></a>
          </div>
        </div>
      </div>
      <div class="footer-nav__col">
        <span class="footer-nav__label">Company</span>
        <a href="#" class="footer-nav__link">About Us</a>
        <a href="#" class="footer-nav__link">Open Positions</a>
      </div>
    </nav>
  </div>

  <div class="footer-end" aria-hidden="true">
    <img src="${tethrEnd}" alt="" />
  </div>
</footer>
`

export function init() {
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

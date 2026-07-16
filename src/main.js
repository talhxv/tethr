import './style.css'
import { scrollToHash, wirePageLeave } from './lib/page-transition.js'
import { html as navbarHtml, init as initNavbar } from './components/navbar.js'
import { html as heroHtml, init as initHero } from './components/hero.js'
// Trust strip (Recognised by / Clutch & Trustpilot) — unrendered for now, kept for later use.
// import { html as trustHtml, init as initTrust } from './components/trust.js'
import { html as manifestoHtml } from './components/manifesto.js'
import { initManifesto } from './components/manifesto-scroll.js'
import { html as hiringHtml, init as initHiring } from './components/hiring.js'
import { html as servicesHtml, init as initServices } from './components/services.js'
import { html as ctaHtml, init as initCta } from './components/cta.js'
import { html as footerHtml, init as initFooter } from './components/footer.js'

document.querySelector('#app').innerHTML = `
<div class="navbar-wrap">${navbarHtml}</div>
${heroHtml}
${manifestoHtml}
${hiringHtml}
${servicesHtml}
${ctaHtml}
${footerHtml}
`

initManifesto()
initNavbar()
initHero()
// initTrust()
initHiring()
initServices()
initFooter()
initCta()

scrollToHash()
wirePageLeave()

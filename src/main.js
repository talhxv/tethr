import './style.css'
import { initGridAlive } from './grid-alive.js'
import { html as navbarHtml, init as initNavbar } from './components/navbar.js'
import { html as heroHtml, init as initHero } from './components/hero.js'
import { html as manifestoHtml } from './components/manifesto.js'
import { initManifesto } from './components/manifesto-scroll.js'
import { html as hiringHtml, init as initHiring } from './components/hiring.js'
import { html as servicesHtml } from './components/services.js'
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

initGridAlive()
initManifesto()
initNavbar()
initHero()
initHiring()
initFooter()
initCta()

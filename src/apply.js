import './style.css'
import { wirePageLeave } from './lib/page-transition.js'
import { html as navbarHtml, init as initNavbar } from './components/navbar.js'
import { html as applyHtml, init as initApply } from './components/apply-choice.js'
import { html as footerHtml, init as initFooter } from './components/footer.js'

document.querySelector('#app').innerHTML = `
<div class="navbar-wrap">${navbarHtml}</div>
${applyHtml}
${footerHtml}
`

initNavbar()
initApply()
initFooter()

wirePageLeave()

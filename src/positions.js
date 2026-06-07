import './style.css'
import { html as navbarHtml, init as initNavbar } from './components/navbar.js'
import { html as positionsHtml, init as initPositions } from './components/open-positions.js'
import { html as footerHtml, init as initFooter } from './components/footer.js'

document.querySelector('#app').innerHTML = `
<div class="navbar-wrap">${navbarHtml}</div>
${positionsHtml}
${footerHtml}
`

initNavbar()
initPositions()
initFooter()

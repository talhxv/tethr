import './style.css'
import { wirePageLeave } from './lib/page-transition.js'
import { html as navbarHtml, init as initNavbar } from './components/navbar.js'
import { html as bookHtml, init as initBook } from './components/book-call.js'
import { html as footerHtml, init as initFooter } from './components/footer.js'

document.querySelector('#app').innerHTML = `
<div class="navbar-wrap">${navbarHtml}</div>
${bookHtml}
${footerHtml}
`

initNavbar()
initBook()
initFooter()

wirePageLeave()

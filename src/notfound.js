import './style.css'
import { html as notFoundHtml, init as initNotFound } from './components/not-found.js'
import { html as footerHtml, init as initFooter } from './components/footer.js'

document.querySelector('#app').innerHTML = `
<div class="nf-shell">
  ${notFoundHtml}
  ${footerHtml}
</div>
`

initNotFound()
initFooter()

import './style.css'
import { initGridAlive } from './grid-alive.js'
import { html as heroHtml, init as initHero } from './components/hero.js'
import { html as manifestoHtml } from './components/manifesto.js'
import { html as hiringHtml, init as initHiring } from './components/hiring.js'

document.querySelector('#app').innerHTML = `
${heroHtml}
${manifestoHtml}
${hiringHtml}
<section id="center">
</section>
`

initGridAlive()
initHero()
initHiring()

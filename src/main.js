import './style.css'
import chainLink from './assets/herochainlink.svg'
import { initGridAlive } from './grid-alive.js'

document.querySelector('#app').innerHTML = `
<section id="hero-bg">
  <div class="chain-wrap">
    <div class="grid-overlay"></div>
    <div class="radial-glow"></div>
    <img src="${chainLink}" class="hero-chain" alt="chain link" />
  </div>
  <div class="hero-text hero-text--top">
    <p>Company that</p>
    <p><span class="connects">connects.</span></p>
  </div>
  <div class="hero-text hero-text--bottom">
    <p>We <span class="accent">tethr</span> ambition</p>
    <p>to outcomes</p>
  </div>
</section>
<p class="hero-mobile-sub">We <span class="accent">tethr</span> ambitions into outcomes — one invoice, one partner, your team fully managed</p>
<div class="hero-headline">
  <p>One invoice. One partner. Your team in Pakistan, fully managed.</p>
</div>
<section id="center">
</section>
`

initGridAlive()

import './style.css'
import chainLink from './assets/chainlinkheroblue.svg'
import chainVector from './assets/chainlinkvector.svg'
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
    <p><span class="connects"><span class="connects-slot"><span class="connects-word">connects.</span></span></span></p>
  </div>
  <div class="hero-text hero-text--bottom">
    <p>We <span class="accent">tethr</span> ambition</p>
    <p>to outcomes</p>
  </div>
</section>
<p class="hero-mobile-sub">We <span class="accent">tethr</span> ambitions into outcomes — one invoice, one partner, your team fully managed</p>
<div class="hero-headline">
  <p>One invoice. One partner.</p>
  <p>Your team in Pakistan, fully managed.</p>
</div>
<div class="section-label">
  <span class="section-label__num">01</span>
  <span class="section-label__line"></span>
  <span class="section-label__title">MANIFESTO</span>
</div>
<div class="manifesto-banner">
  <div class="manifesto-banner__chain-wrap">
    <img src="${chainVector}" class="manifesto-banner__chain" alt="" />
  </div>
  <p class="manifesto-banner__text">For Talent. By Talent.</p>
</div>
<section id="center">
</section>
`

initGridAlive()

;(function slotCycle() {
  const words = ['connects.', 'nurtures.', 'performs.', 'delivers.', 'empowers.', 'scales.']
  const el = document.querySelector('.connects-word')
  if (!el) return

  const DISPLAY = 2000
  const TRANSITION = 300
  let index = 0

  function next() {
    index = (index + 1) % words.length

    el.classList.add('slot-exit')
    setTimeout(() => {
      el.textContent = words[index]
      el.classList.remove('slot-exit')
      el.classList.add('slot-enter')
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.classList.remove('slot-enter')
        el.classList.add('slot-active')
        setTimeout(() => {
          el.classList.remove('slot-active')
          setTimeout(next, DISPLAY)
        }, TRANSITION)
      }))
    }, TRANSITION)
  }

  setTimeout(next, DISPLAY)
})()

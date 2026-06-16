import swirl from '../assets/swirlcomponent.svg'
import swirlBlue from '../assets/swirlcomponent-blue.svg'
import arrowRight from '../assets/arrowright.svg'
import ctaBlur from '../assets/ctablur.svg'

export function init() {
  const section = document.querySelector('.cta')
  if (!section) return

  section.querySelectorAll('.cta__btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      // restart animation each hover by removing and re-adding the class
      section.classList.remove('cta--lit')
      void section.offsetWidth // force reflow
      section.classList.add('cta--lit')
    })
    btn.addEventListener('mouseleave', () => {
      section.classList.remove('cta--lit')
    })
  })
}

export const html = `
<div class="section-label section-label--spaced padded">
  <span class="section-label__num">04</span>
  <span class="section-label__line"></span>
  <span class="section-label__title">GET STARTED</span>
</div>
<section class="cta">
  <img src="${ctaBlur}" class="cta__blob" alt="" />
  <img src="${swirl}" class="cta__swirl" alt="" />
  <img src="${swirlBlue}" class="cta__swirl cta__swirl--blue" alt="" />
  <div class="cta__sphere services__glass-sphere" role="presentation" aria-hidden="true">
    <div class="glass-sphere__lens"></div>
    <div class="glass-sphere__body"></div>
    <div class="glass-sphere__glint"></div>
    <div class="glass-sphere__rim"></div>
  </div>
  <div class="cta__content">
    <h2 class="cta__heading">
      Let's <em class="cta__tethr">tethr</em><br>Something Real.
    </h2>
    <div class="cta__btns">
      <a href="#" class="cta__btn cta__btn--primary">Apply <img src="${arrowRight}" class="cta__arrow" alt="" /></a>
      <a href="#" class="cta__btn cta__btn--secondary">Hire Talent</a>
    </div>
  </div>
</section>
`

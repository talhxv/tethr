import swirl from '../assets/swirlcomponent.svg'
import sphere from '../assets/Sphere.svg'
import arrowRight from '../assets/arrowright.svg'

export const html = `
<div class="section-label section-label--spaced padded">
  <span class="section-label__num">03</span>
  <span class="section-label__line"></span>
  <span class="section-label__title">GET STARTED</span>
</div>
<section class="cta">
  <img src="${swirl}" class="cta__swirl" alt="" />
  <img src="${sphere}" class="cta__sphere" alt="" />
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

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
<!-- Text-tuned variant of #liquid-lens (services.js): this sphere sits on the
     heading, and letterforms need a wider undistorted center (74% vs 62%) and
     a much gentler shift (22-28 vs 54-60) to still read as letters through
     the glass. Same map construction and chromatic-fringe passes otherwise. -->
<svg style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">
  <defs>
    <filter id="liquid-lens-text" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feImage x="0%" y="0%" width="100%" height="100%" preserveAspectRatio="none" result="map"
        href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cdefs%3E%3ClinearGradient id='lx' x1='0' y1='0' x2='1' y2='0'%3E%3Cstop offset='0' stop-color='%23ff0000'/%3E%3Cstop offset='1' stop-color='%23000000'/%3E%3C/linearGradient%3E%3ClinearGradient id='ly' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%2300ff00'/%3E%3Cstop offset='1' stop-color='%23000000'/%3E%3C/linearGradient%3E%3CradialGradient id='lc' cx='0.5' cy='0.5' r='0.5'%3E%3Cstop offset='0' stop-color='%237f7f7f'/%3E%3Cstop offset='0.74' stop-color='%237f7f7f'/%3E%3Cstop offset='1' stop-color='%237f7f7f' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='120' height='120' fill='url(%23lx)'/%3E%3Crect width='120' height='120' fill='url(%23ly)' style='mix-blend-mode:screen'/%3E%3Crect width='120' height='120' fill='url(%23lc)'/%3E%3C/svg%3E"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="22" xChannelSelector="R" yChannelSelector="G" result="dispR"/>
      <feColorMatrix in="dispR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="chanR"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="25" xChannelSelector="R" yChannelSelector="G" result="dispG"/>
      <feColorMatrix in="dispG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="chanG"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="28" xChannelSelector="R" yChannelSelector="G" result="dispB"/>
      <feColorMatrix in="dispB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="chanB"/>
      <feBlend in="chanR" in2="chanG" mode="screen" result="rg"/>
      <feBlend in="rg" in2="chanB" mode="screen"/>
    </filter>
  </defs>
</svg>

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
      <a href="/apply#join" data-transition class="cta__btn cta__btn--primary">Apply <img src="${arrowRight}" class="cta__arrow" alt="" /></a>
      <a href="/apply#hire" data-transition class="cta__btn cta__btn--secondary">Hire Talent</a>
    </div>
  </div>
</section>
`

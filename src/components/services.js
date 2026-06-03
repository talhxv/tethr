import sphere from '../assets/Sphere.svg'
import swirl from '../assets/swirlcomponent.svg'
import setting from '../assets/setting.svg'
import executionstack from '../assets/executionstack.svg'

export const html = `
<section class="services">
  <div class="section-label section-label--spaced padded">
    <span class="section-label__num">01</span>
    <span class="section-label__line"></span>
    <span class="section-label__title">SERVICES</span>
  </div>

  <div class="services__grid">

    <div class="services__card">
      <span class="services__label">Software</span>
      <div class="services__rings">
        <div class="services__ring"></div>
        <div class="services__ring"></div>
        <div class="services__ring"></div>
      </div>
      <div class="services__globe-wrap">
        <div class="services__globe-grid">
          <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="60" r="58" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
            <ellipse cx="60" cy="60" rx="35" ry="58" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
            <ellipse cx="60" cy="60" rx="58" ry="20" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
            <line x1="2" y1="60" x2="118" y2="60" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
            <line x1="60" y1="2" x2="60" y2="118" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
          </svg>
        </div>
      </div>
      <img src="${sphere}" class="services__sphere" alt="" />
    </div>

    <div class="services__card services__card--mid">
      <span class="services__label">Automations</span>
      <div class="services__rings">
        <div class="services__ring"></div>
        <div class="services__ring"></div>
        <div class="services__ring"></div>
      </div>
      <img src="${setting}" class="services__icon services__icon--cog" alt="" />
      <img src="${sphere}" class="services__sphere services__sphere--mid" alt="" />
    </div>

    <div class="services__card">
      <span class="services__label services__label--br">Consulting &amp;<br>Execution</span>
      <div class="services__rings">
        <div class="services__ring"></div>
        <div class="services__ring"></div>
        <div class="services__ring"></div>
      </div>
      <img src="${executionstack}" class="services__icon services__icon--stack" alt="" />
      <img src="${sphere}" class="services__sphere services__sphere--right" alt="" />
    </div>

  </div>
</section>
`

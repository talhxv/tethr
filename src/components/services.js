import swirl from '../assets/swirlcomponent.svg'
import tethrEarth from '../assets/tethrearth.svg'
import settingsCog from '../assets/settingscog.svg'
import executionStack from '../assets/executionstack.svg'

export const html = `
<!-- Liquid-glass lens filter — used via backdrop-filter so content BEHIND the sphere refracts.
     The feImage map encodes displacement direction: R = horizontal, G = vertical, neutral gray
     center fading to full shift at the rim (convex lens). Three passes at staggered scales
     produce the chromatic aberration fringe. Chromium-only; other browsers keep the frost. -->
<svg style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">
  <defs>
    <filter id="liquid-lens" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feImage x="0%" y="0%" width="100%" height="100%" preserveAspectRatio="none" result="map"
        href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cdefs%3E%3ClinearGradient id='lx' x1='0' y1='0' x2='1' y2='0'%3E%3Cstop offset='0' stop-color='%23ff0000'/%3E%3Cstop offset='1' stop-color='%23000000'/%3E%3C/linearGradient%3E%3ClinearGradient id='ly' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%2300ff00'/%3E%3Cstop offset='1' stop-color='%23000000'/%3E%3C/linearGradient%3E%3CradialGradient id='lc' cx='0.5' cy='0.5' r='0.5'%3E%3Cstop offset='0' stop-color='%237f7f7f'/%3E%3Cstop offset='0.62' stop-color='%237f7f7f'/%3E%3Cstop offset='1' stop-color='%237f7f7f' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='120' height='120' fill='url(%23lx)'/%3E%3Crect width='120' height='120' fill='url(%23ly)' style='mix-blend-mode:screen'/%3E%3Crect width='120' height='120' fill='url(%23lc)'/%3E%3C/svg%3E"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="107" xChannelSelector="R" yChannelSelector="G" result="dispR"/>
      <feColorMatrix in="dispR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="chanR"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="110" xChannelSelector="R" yChannelSelector="G" result="dispG"/>
      <feColorMatrix in="dispG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="chanG"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="113" xChannelSelector="R" yChannelSelector="G" result="dispB"/>
      <feColorMatrix in="dispB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="chanB"/>
      <feBlend in="chanR" in2="chanG" mode="screen" result="rg"/>
      <feBlend in="rg" in2="chanB" mode="screen"/>
    </filter>
    <!-- Recolors the white SVG line art to navy #001B4D, preserving alpha -->
    <filter id="ink-navy" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0.106  0 0 0 0 0.302  0 0 0 1 0"/>
    </filter>
  </defs>
</svg>

<div class="section-label section-label--spaced padded" id="services">
  <span class="section-label__num">03</span>
  <span class="section-label__line"></span>
  <span class="section-label__title">SERVICES</span>
</div>
<section class="services">
  <div class="services__grid">
    <svg class="services__connector services__connector--top" viewBox="0 0 100 24" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="clip-top-left"><rect x="0" y="0" width="75" height="24"/></clipPath>
        <clipPath id="clip-top-right"><rect x="25" y="0" width="75" height="24"/></clipPath>
      </defs>
      <path class="conn-left" clip-path="url(#clip-top-left)" fill="#F1F5FD"
        d="M0 12 A12 12 0 0 1 12 0 L42 0 A9 8 0 0 0 58 0 L88 0 A12 12 0 0 1 100 12 A12 12 0 0 1 88 24 L58 24 A9 8 0 0 0 42 24 L12 24 A12 12 0 0 1 0 12 Z"/>
      <path class="conn-right" clip-path="url(#clip-top-right)" fill="#F1F5FD"
        d="M0 12 A12 12 0 0 1 12 0 L42 0 A9 8 0 0 0 58 0 L88 0 A12 12 0 0 1 100 12 A12 12 0 0 1 88 24 L58 24 A9 8 0 0 0 42 24 L12 24 A12 12 0 0 1 0 12 Z"/>
    </svg>
    <svg class="services__connector services__connector--bottom" viewBox="0 0 100 24" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="clip-bot-left"><rect x="0" y="0" width="75" height="24"/></clipPath>
        <clipPath id="clip-bot-right"><rect x="25" y="0" width="75" height="24"/></clipPath>
      </defs>
      <path class="conn-left" clip-path="url(#clip-bot-left)" fill="#F1F5FD"
        d="M0 12 A12 12 0 0 1 12 0 L42 0 A9 8 0 0 0 58 0 L88 0 A12 12 0 0 1 100 12 A12 12 0 0 1 88 24 L58 24 A9 8 0 0 0 42 24 L12 24 A12 12 0 0 1 0 12 Z"/>
      <path class="conn-right" clip-path="url(#clip-bot-right)" fill="#F1F5FD"
        d="M0 12 A12 12 0 0 1 12 0 L42 0 A9 8 0 0 0 58 0 L88 0 A12 12 0 0 1 100 12 A12 12 0 0 1 88 24 L58 24 A9 8 0 0 0 42 24 L12 24 A12 12 0 0 1 0 12 Z"/>
    </svg>
    <div class="services__card services__card--software">
      <img src="${swirl}" class="services__swirl services__asset" alt="" />
      <img src="${tethrEarth}" class="services__earth services__asset" alt="" />
      <div class="services__sphere services__asset services__glass-sphere" role="presentation">
        <div class="glass-sphere__lens"></div>
        <div class="glass-sphere__body"></div>
        <div class="glass-sphere__glint"></div>
        <div class="glass-sphere__rim"></div>
      </div>
      <h3 class="services__title">Software</h3>
      <div class="services__pills">
        <span class="services__pill services__pill--filled">Design</span>
        <span class="services__pill services__pill--outline">Web Development</span>
        <span class="services__pill services__pill--outline">Mobile Apps</span>
        <span class="services__pill services__pill--outline">SaaS</span>
      </div>
    </div>
    <div class="services__card services__card--automations">
      <img src="${swirl}" class="services__swirl services__swirl--auto services__asset" alt="" />
      <img src="${settingsCog}" class="services__cog services__asset" alt="" />
      <div class="services__sphere services__sphere--top services__asset services__glass-sphere" role="presentation">
        <div class="glass-sphere__lens"></div>
        <div class="glass-sphere__body"></div>
        <div class="glass-sphere__glint"></div>
        <div class="glass-sphere__rim"></div>
      </div>
      <h3 class="services__title">Automations</h3>
      <div class="services__pills">
        <span class="services__pill services__pill--filled">Workflows</span>
        <span class="services__pill services__pill--outline">AI Integration</span>
        <span class="services__pill services__pill--outline">API Pipelines</span>
        <span class="services__pill services__pill--outline">No-Code</span>
      </div>
    </div>
    <div class="services__card services__card--consulting">
      <img src="${swirl}" class="services__swirl services__swirl--consult services__asset" alt="" />
      <img src="${executionStack}" class="services__stack services__asset" alt="" />
      <div class="services__sphere services__sphere--top services__asset services__glass-sphere" role="presentation">
        <div class="glass-sphere__lens"></div>
        <div class="glass-sphere__body"></div>
        <div class="glass-sphere__glint"></div>
        <div class="glass-sphere__rim"></div>
      </div>
      <h3 class="services__title">Consulting &amp;<br>Execution</h3>
      <div class="services__pills">
        <span class="services__pill services__pill--filled">Strategy</span>
        <span class="services__pill services__pill--outline">Project Management</span>
        <span class="services__pill services__pill--outline">Go-to-Market</span>
        <span class="services__pill services__pill--outline">Advisory</span>
      </div>
    </div>
  </div>
</section>
`

import swirl from '../assets/swirlcomponent.svg'
import tethrEarth from '../assets/tethrearth.svg'
import sphere from '../assets/Sphere.svg'
import settingsCog from '../assets/settingscog.svg'
import executionStack from '../assets/executionstack.svg'

export const html = `
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
      <path class="conn-left" clip-path="url(#clip-top-left)" fill="#001B4D"
        d="M0 12 A12 12 0 0 1 12 0 L42 0 A9 8 0 0 0 58 0 L88 0 A12 12 0 0 1 100 12 A12 12 0 0 1 88 24 L58 24 A9 8 0 0 0 42 24 L12 24 A12 12 0 0 1 0 12 Z"/>
      <path class="conn-right" clip-path="url(#clip-top-right)" fill="#001B4D"
        d="M0 12 A12 12 0 0 1 12 0 L42 0 A9 8 0 0 0 58 0 L88 0 A12 12 0 0 1 100 12 A12 12 0 0 1 88 24 L58 24 A9 8 0 0 0 42 24 L12 24 A12 12 0 0 1 0 12 Z"/>
    </svg>
    <svg class="services__connector services__connector--bottom" viewBox="0 0 100 24" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="clip-bot-left"><rect x="0" y="0" width="75" height="24"/></clipPath>
        <clipPath id="clip-bot-right"><rect x="25" y="0" width="75" height="24"/></clipPath>
      </defs>
      <path class="conn-left" clip-path="url(#clip-bot-left)" fill="#001B4D"
        d="M0 12 A12 12 0 0 1 12 0 L42 0 A9 8 0 0 0 58 0 L88 0 A12 12 0 0 1 100 12 A12 12 0 0 1 88 24 L58 24 A9 8 0 0 0 42 24 L12 24 A12 12 0 0 1 0 12 Z"/>
      <path class="conn-right" clip-path="url(#clip-bot-right)" fill="#001B4D"
        d="M0 12 A12 12 0 0 1 12 0 L42 0 A9 8 0 0 0 58 0 L88 0 A12 12 0 0 1 100 12 A12 12 0 0 1 88 24 L58 24 A9 8 0 0 0 42 24 L12 24 A12 12 0 0 1 0 12 Z"/>
    </svg>
    <div class="services__card services__card--software">
      <img src="${swirl}" class="services__swirl services__asset" alt="" />
      <img src="${tethrEarth}" class="services__earth services__asset" alt="" />
      <img src="${sphere}" class="services__sphere services__asset" alt="" />
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
      <img src="${sphere}" class="services__sphere services__sphere--top services__asset" alt="" />
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
      <img src="${sphere}" class="services__sphere services__sphere--top services__asset" alt="" />
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

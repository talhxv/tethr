import gsap from 'gsap'
import talentCardOne  from '../assets/talentcardone.svg'
import talentCardTwo   from '../assets/talentcardtwo.svg'
import talentCardThree from '../assets/talentcardthree.svg'

const CARD2_ILL = `
<svg viewBox="0 0 260 230" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g opacity="0.12"><rect x="55" y="60" width="150" height="150" rx="3" fill="#1a1a1a" transform="rotate(45 130 135)"/></g>
  <rect x="60" y="65" width="140" height="140" rx="2" fill="#e2e2e0" stroke="#1a1a1a" stroke-width="1.5" transform="rotate(45 130 135)"/>
  <circle cx="130" cy="152" r="5.5" fill="#1a1a1a"/>
  <circle cx="106" cy="138" r="4" fill="#1a1a1a"/>
  <circle cx="154" cy="138" r="4" fill="#1a1a1a"/>
  <circle cx="116" cy="166" r="4" fill="#1a1a1a"/>
  <circle cx="144" cy="166" r="4" fill="#1a1a1a"/>
  <line x1="130" y1="152" x2="106" y2="138" stroke="#1a1a1a" stroke-width="1" opacity="0.35"/>
  <line x1="130" y1="152" x2="154" y2="138" stroke="#1a1a1a" stroke-width="1" opacity="0.35"/>
  <line x1="130" y1="152" x2="116" y2="166" stroke="#1a1a1a" stroke-width="1" opacity="0.35"/>
  <line x1="130" y1="152" x2="144" y2="166" stroke="#1a1a1a" stroke-width="1" opacity="0.35"/>
</svg>`

const CARD3_ILL = `
<svg viewBox="0 0 260 230" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g opacity="0.1"><rect x="45" y="148" width="170" height="38" rx="3" fill="#1a1a1a"/></g>
  <rect x="45" y="142" width="170" height="36" rx="3" fill="#d4d4d2" stroke="#1a1a1a" stroke-width="1.5"/>
  <g opacity="0.1"><rect x="45" y="106" width="170" height="38" rx="3" fill="#1a1a1a"/></g>
  <rect x="45" y="100" width="170" height="36" rx="3" fill="#dededd" stroke="#1a1a1a" stroke-width="1.5"/>
  <g opacity="0.08"><rect x="45" y="64" width="170" height="38" rx="3" fill="#1a1a1a"/></g>
  <rect x="45" y="58" width="170" height="36" rx="3" fill="#e8e8e6" stroke="#1a1a1a" stroke-width="1.5"/>
</svg>`

const TALENT_STEPS = [
  {
    num: '01', label: 'STEP / 01',
    headline: 'It begins with screening the <strong>best talent pool</strong>',
    desc: 'We map the top 5% of available talent in Pakistan before a single role is opened.',
    ill: `<img src="${talentCardOne}" class="hiring-vis__img" alt=""/>`,
  },
  {
    num: '02', label: 'STEP / 02',
    headline: 'We match you to <strong>the right company</strong>',
    desc: 'No cold applying. We make the introduction based on your skills and goals.',
    ill: `<img src="${talentCardTwo}" class="hiring-vis__img" alt=""/>`,
  },
  {
    num: '03', label: 'STEP / 03',
    headline: 'You start. We handle <strong>everything else</strong>',
    desc: 'Onboarding, payroll, compliance — one contract, zero overhead on your side.',
    ill: `<img src="${talentCardThree}" class="hiring-vis__img" alt=""/>`,
  },
]

const COMPANY_STEPS = [
  {
    num: '01', label: 'STEP / 01',
    headline: 'Tell us what <strong>you\'re building</strong>',
    desc: 'Share your role, team context, and timeline. No lengthy intake forms — a single call is enough.',
    ill: `<img src="${talentCardOne}" class="hiring-vis__img" alt=""/>`,
  },
  {
    num: '02', label: 'STEP / 02',
    headline: 'We source and <strong>vet for you</strong>',
    desc: 'Tethr handles the search, screening, and shortlisting. You only meet candidates worth your time.',
    ill: `<img src="${talentCardTwo}" class="hiring-vis__img" alt=""/>`,
  },
  {
    num: '03', label: 'STEP / 03',
    headline: 'One contract. <strong>Zero overhead.</strong>',
    desc: 'A single invoice covers sourcing, onboarding, payroll, and compliance — indefinitely.',
    ill: `<img src="${talentCardThree}" class="hiring-vis__img" alt=""/>`,
  },
]

function buildRows(steps, id) {
  return `
  <div class="hiring-rows" id="${id}">
    ${steps.map((s, i) => `
    <div class="hiring-row${i === 0 ? ' active' : ''}" data-row="${i}">

      <div class="hiring-row__bar"></div>

      <div class="hiring-row__text">
        <div class="hiring-row__body">
          <span class="hiring-row__label">${s.label}</span>
          <h2 class="hiring-row__headline">${s.headline}</h2>
          <p class="hiring-row__desc">${s.desc}</p>
        </div>
      </div>

      <div class="hiring-row__visual">
        <div class="hiring-visual-card">
          <div class="hiring-card__grid-bg"></div>
          <div class="hiring-vis__ill">${s.ill}</div>
          <span class="hiring-vis__num">${s.num}</span>
        </div>
      </div>

    </div>`).join('')}
  </div>`
}

export const html = `
<section class="hiring-section" id="hiring">

  <div class="section-label padded">
    <span class="section-label__num">02</span>
    <span class="section-label__line"></span>
    <span class="section-label__title">HIRING</span>
  </div>

  <div class="hiring-toggle-wrap">
    <div class="hiring-toggle" id="hiringToggle">
      <div class="hiring-toggle__pill"></div>
      <button class="hiring-toggle__btn active" data-side="talent">talent</button>
      <button class="hiring-toggle__btn" data-side="company">your company</button>
    </div>
  </div>

  ${buildRows(TALENT_STEPS,  'hiringTalent')}
  ${buildRows(COMPANY_STEPS, 'hiringCompany')}

</section>
`

function setupObserver(containerEl) {
  const rows = [...containerEl.querySelectorAll('.hiring-row')]

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        rows.forEach(r => r.classList.remove('active'))
        entry.target.classList.add('active')
      }
    })
  }, { rootMargin: '-38% 0px -38% 0px', threshold: 0 })

  rows.forEach(r => observer.observe(r))
  return observer
}

export function init() {
  const toggle    = document.getElementById('hiringToggle')
  const talentEl  = document.getElementById('hiringTalent')
  const companyEl = document.getElementById('hiringCompany')
  if (!toggle) return

  companyEl.style.display = 'none'

  setupObserver(talentEl)
  setupObserver(companyEl)

  const pill = toggle.querySelector('.hiring-toggle__pill')
  const btns = toggle.querySelectorAll('.hiring-toggle__btn')

  toggle.addEventListener('click', e => {
    const btn = e.target.closest('.hiring-toggle__btn')
    if (!btn || btn.classList.contains('active')) return
    btns.forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    const isTalent = btn.dataset.side === 'talent'
    pill.style.transform    = isTalent ? 'translateX(0)' : 'translateX(100%)'
    talentEl.style.display  = isTalent ? '' : 'none'
    companyEl.style.display = isTalent ? 'none' : ''
    // Ensure first row of newly shown tab is active
    const activeEl = isTalent ? talentEl : companyEl
    const rows = [...activeEl.querySelectorAll('.hiring-row')]
    rows.forEach((r, i) => r.classList.toggle('active', i === 0))
  })
}

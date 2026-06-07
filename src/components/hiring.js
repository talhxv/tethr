import gsap from 'gsap'
import _base from '../assets/talentcardone.svg?raw'
import _mid  from '../assets/midlayer.svg?raw'

function toBlue(svgRaw) {
  return svgRaw
    .replace(/rgba\(255,255,255,([^)]+)\)/g, (_, a) => `rgba(7,85,233,${a})`)
    .replace(/fill="white"/g,   'fill="#0755E9"')
    .replace(/stroke="white"/g, 'stroke="#0755E9"')
    .replace(/fill="#D9D9D9"/g, 'fill="rgba(7,85,233,0.10)"')
    .replace(/fill="#515050"/g, 'fill="rgba(7,85,233,0.18)"')
    .replace(/stroke="black"/g, 'stroke="rgba(7,85,233,0.5)"')
    .replace(/fill="black"/g,   'fill="#0755E9"')
}

const BASE = toBlue(_base)
const MID  = toBlue(_mid)

const STEPS = {
  talent: [
    { num: '01', headline: 'Screening the <strong>best talent pool</strong>', desc: 'We map the top 5% of available talent in Pakistan before a single role is opened.', tag: 'Talent Pool' },
    { num: '02', headline: 'Matched to <strong>the right company</strong>',   desc: 'No cold applying. We make the introduction based on your skills and goals.',            tag: 'Role Match' },
    { num: '03', headline: 'You start. We handle <strong>everything else</strong>', desc: 'Onboarding, payroll, compliance — one contract, zero overhead on your side.',     tag: 'Onboarded'  },
  ],
  company: [
    { num: '01', headline: 'Tell us what <strong>you\'re building</strong>',  desc: 'Share your role, team context, and timeline. One call is enough.',                    tag: 'Brief'    },
    { num: '02', headline: 'We source and <strong>vet for you</strong>',      desc: 'Tethr handles search, screening, and shortlisting. You only meet candidates worth your time.', tag: 'Vetted'   },
    { num: '03', headline: 'One contract. <strong>Zero overhead.</strong>',   desc: 'A single invoice covers sourcing, onboarding, payroll, and compliance — indefinitely.',  tag: 'Deployed' },
  ],
}

export const html = `
<section class="hiring-section" id="hiring">

  <div class="section-label padded">
    <span class="section-label__num">02</span>
    <span class="section-label__line"></span>
    <span class="section-label__title">HIRING</span>
  </div>

  <div class="hiring-track" id="hiringTrack">
    <div class="hiring-sticky" id="hiringSticky">

      <div class="hiring-toggle-wrap">
        <div class="hiring-toggle" id="hiringToggle">
          <div class="hiring-toggle__pill"></div>
          <button class="hiring-toggle__btn active" data-side="talent">talent</button>
          <button class="hiring-toggle__btn" data-side="company">your company</button>
        </div>
      </div>

      <svg class="hiring-lines" id="hiringLinesSvg" aria-hidden="true"></svg>

      <!-- Step 01 — left upper -->
      <div class="hiring-step hiring-step--01" data-idx="0">
        <span class="hiring-step__label">STEP / 01</span>
        <h3 class="hiring-step__headline" id="hHead0"></h3>
        <p class="hiring-step__desc" id="hDesc0"></p>
      </div>

      <!-- Step 03 — left lower -->
      <div class="hiring-step hiring-step--03" data-idx="2">
        <span class="hiring-step__label">STEP / 03</span>
        <h3 class="hiring-step__headline" id="hHead2"></h3>
        <p class="hiring-step__desc" id="hDesc2"></p>
      </div>

      <!-- Center stack -->
      <div class="hiring-center" id="hiringCenter">
        <div class="hiring-stack-num" id="hiringBigNum">01</div>
        <div class="hiring-stack" id="hiringStack">
          <div class="hiring-layer hiring-layer--base" id="hL1">${BASE}</div>
          <div class="hiring-layer hiring-layer--mid1" id="hL2">${MID}</div>
          <div class="hiring-layer hiring-layer--mid2" id="hL3">${MID}</div>
        </div>
        <div class="hiring-stack-tag" id="hiringStackTag"></div>
      </div>

      <!-- Mobile step description (hidden on desktop) -->
      <div class="hiring-mobile-text" id="hiringMobileText">
        <span class="hiring-step__label" id="hMobileLabel"></span>
        <h3 class="hiring-step__headline" id="hMobileHead"></h3>
        <p class="hiring-step__desc" id="hMobileDesc"></p>
      </div>

      <!-- Step 02 — right middle -->
      <div class="hiring-step hiring-step--02" data-idx="1">
        <span class="hiring-step__label">STEP / 02</span>
        <h3 class="hiring-step__headline" id="hHead1"></h3>
        <p class="hiring-step__desc" id="hDesc1"></p>
      </div>

    </div>
  </div>

</section>
`

function populate(steps) {
  steps.forEach((s, i) => {
    const h = document.getElementById(`hHead${i}`)
    const d = document.getElementById(`hDesc${i}`)
    const t = document.getElementById(`hTag${i}`)
    if (h) h.innerHTML = s.headline
    if (d) d.textContent = s.desc
    if (t) t.textContent = s.tag
  })
}

let lineEls = []

function drawLines() {
  const sticky = document.getElementById('hiringSticky')
  const stack  = document.getElementById('hiringStack')
  const svg    = document.getElementById('hiringLinesSvg')
  if (!sticky || !stack || !svg) return

  const sR  = sticky.getBoundingClientRect()
  const stR = stack.getBoundingClientRect()
  const cx  = stR.left - sR.left + stR.width  / 2
  const cy  = stR.top  - sR.top  + stR.height / 2

  svg.setAttribute('width',   sR.width)
  svg.setAttribute('height',  sR.height)
  svg.setAttribute('viewBox', `0 0 ${sR.width} ${sR.height}`)
  svg.innerHTML = ''
  lineEls = []

  const defs = [
    { sel: '.hiring-step--01', edge: 'right' },
    { sel: '.hiring-step--02', edge: 'left'  },
    { sel: '.hiring-step--03', edge: 'right' },
  ]

  defs.forEach(({ sel, edge }) => {
    const el = document.querySelector(sel)
    if (!el) return
    const r  = el.getBoundingClientRect()
    const tx = edge === 'right' ? r.right - sR.left : r.left - sR.left
    const ty = r.top - sR.top + r.height / 2

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('x1', cx)
    line.setAttribute('y1', cy)
    line.setAttribute('x2', tx)
    line.setAttribute('y2', ty)
    line.setAttribute('stroke', 'rgba(0,17,49,0.1)')
    line.setAttribute('stroke-width', '1')
    line.setAttribute('stroke-dasharray', '3 6')
    svg.appendChild(line)
    lineEls.push(line)
  })
}

export function init() {
  const toggle = document.getElementById('hiringToggle')
  const track  = document.getElementById('hiringTrack')
  const sticky = document.getElementById('hiringSticky')
  if (!toggle || !track || !sticky) return

  /* State */
  const stackTag      = document.getElementById('hiringStackTag')
  const mobileLabel   = document.getElementById('hMobileLabel')
  const mobileHead    = document.getElementById('hMobileHead')
  const mobileDesc    = document.getElementById('hMobileDesc')
  let currentSteps    = STEPS.talent
  let currentStep     = 0

  function updateTag(step) {
    if (stackTag) stackTag.textContent = currentSteps[step]?.tag ?? ''
  }

  function updateMobile(step) {
    const s = currentSteps[step]
    if (!s) return
    if (mobileLabel) mobileLabel.textContent = `STEP / 0${step + 1}`
    if (mobileHead)  mobileHead.innerHTML    = s.headline
    if (mobileDesc)  mobileDesc.textContent  = s.desc
  }

  populate(STEPS.talent)
  setTimeout(() => {
    drawLines()
    if (lineEls[0]) {
      lineEls[0].setAttribute('stroke', 'rgba(7,85,233,0.6)')
      lineEls[0].setAttribute('stroke-width', '1.5')
    }
  }, 120)
  window.addEventListener('resize', drawLines)

  /* Toggle */
  const pill = toggle.querySelector('.hiring-toggle__pill')
  const btns = toggle.querySelectorAll('.hiring-toggle__btn')
  toggle.addEventListener('click', e => {
    const btn = e.target.closest('.hiring-toggle__btn')
    if (!btn || btn.classList.contains('active')) return
    btns.forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    const side = btn.dataset.side
    currentSteps = STEPS[side]
    pill.style.transform = side === 'talent' ? 'translateX(0)' : 'translateX(100%)'
    populate(STEPS[side])
    updateTag(currentStep)
    updateMobile(currentStep)
  })

  /* Elements */
  const l1     = document.getElementById('hL1')
  const l2     = document.getElementById('hL2')
  const l3     = document.getElementById('hL3')
  const bigNum = document.getElementById('hiringBigNum')
  const s01    = document.querySelector('.hiring-step--01')
  const s02    = document.querySelector('.hiring-step--02')
  const s03    = document.querySelector('.hiring-step--03')
  const allSteps = [s01, s02, s03]

  /* Make steps clickable — resets auto timer on manual click */
  allSteps.forEach((el, i) => {
    if (!el) return
    el.style.cursor = 'pointer'
    el.addEventListener('click', () => {
      stopAuto()
      currentStep = -1
      showStep(i)
      startAuto()
    })
  })

  /* Initial state — base visible, mid layers above waiting to drop down */
  gsap.set(l1, { opacity: 1 })
  gsap.set(l2, { y: -80, opacity: 0 })
  gsap.set(l3, { y: -80, opacity: 0 })
  if (s02) s02.style.opacity = '0.25'
  if (s03) s03.style.opacity = '0.25'
  updateTag(0)
  updateMobile(0)

  function showStep(step) {
    if (step === currentStep) return
    currentStep = step

    if (bigNum) bigNum.textContent = ['01', '02', '03'][step]
    updateTag(step)
    updateMobile(step)
    allSteps.forEach((el, i) => {
      if (el) el.style.opacity = i === step ? '1' : '0.25'
    })
    lineEls.forEach((line, i) => {
      line.setAttribute('stroke', i === step ? 'rgba(7,85,233,0.6)' : 'rgba(0,17,49,0.1)')
      line.setAttribute('stroke-width', i === step ? '1.5' : '1')
    })

    /* Physically slide mid layers up into the stack */
    if (step >= 1) {
      gsap.to(l2, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' })
    } else {
      gsap.to(l2, { y: -80, opacity: 0, duration: 0.35, ease: 'power2.in' })
    }
    if (step >= 2) {
      gsap.to(l3, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' })
    } else {
      gsap.to(l3, { y: -80, opacity: 0, duration: 0.35, ease: 'power2.in' })
    }
  }

  const section = document.getElementById('hiring')

  /* Auto-advance steps while section is in view — no scroll-jacking */
  const STEP_DURATION = 1800
  let autoTimer = null

  function startAuto() {
    if (autoTimer) return
    autoTimer = setInterval(() => {
      const next = (currentStep + 1) % 3
      currentStep = -1
      showStep(next)
    }, STEP_DURATION)
  }

  function stopAuto() {
    clearInterval(autoTimer)
    autoTimer = null
  }

  const observer = new IntersectionObserver(
    ([entry]) => { entry.isIntersecting ? startAuto() : stopAuto() },
    { threshold: 0.4 }
  )
  observer.observe(section)
}

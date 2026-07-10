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

const STEPS = [
  { num: '01', tag: 'Brief',    headline: 'Tell us what <strong>you\'re building</strong>',  desc: 'Share your role, team context, and timeline. One call is enough.' },
  { num: '02', tag: 'Vetted',   headline: 'We source and <strong>vet for you</strong>',      desc: 'Tethr handles search, screening, and shortlisting. You only meet candidates worth your time.' },
  { num: '03', tag: 'Deployed', headline: 'One contract. <strong>Zero overhead.</strong>',   desc: 'A single invoice covers sourcing, onboarding, payroll, and compliance — indefinitely.' },
]

/* The isometric stack is step 02's funnel diagram — it lives in a glass
   panel that blooms out of that step on hover (inline card on mobile).
   Numbered 2.x so it reads as step 02's internals. Listed top layer first
   so labels pair with layers without leader lines crossing. */
const SUBSTEPS = [
  { num: '2.3', tag: 'Shortlist', text: 'You only meet the few worth your time', layer: 2 },
  { num: '2.2', tag: 'Screen',    text: 'Skills, communication, and fit — tested by us', layer: 1 },
  { num: '2.1', tag: 'Source',    text: 'We map the market\'s top talent for your role', layer: 0 },
]

export const html = `
<section class="hiring-section" id="hiring">

  <div class="section-label padded">
    <span class="section-label__num">02</span>
    <span class="section-label__line"></span>
    <span class="section-label__title">WORK WITH TETHR</span>
  </div>

  <div class="hiring-content padded">

    <h2 class="problem-headline hiring-headline" id="hiringHeadline">
      Three steps. <strong>We handle the rest.</strong>
    </h2>

    <div class="hiring-steps" id="hiringSteps">
      <div class="hiring-steps__line" id="hiringStepsLine"></div>

      <!-- Tether — dashed leader from the step 02 pill up to the panel's
           underside; same grammar as the callout leader lines inside it -->
      <svg class="hiring-tether" id="hiringTether" aria-hidden="true">
        <line id="hiringTetherLine" stroke="rgba(7,85,233,0.5)" stroke-width="1.2" stroke-dasharray="3 6" stroke-linecap="round" />
      </svg>
      ${STEPS.map((s, i) => `
      <div class="hiring-step" data-idx="${i}">
        <span class="hiring-step__tag">
          <span class="hiring-step__tag-num">${s.num}</span>
          <span class="hiring-step__tag-line"></span>
          ${s.tag}
        </span>
        <h3 class="hiring-step__headline">${s.headline}</h3>
        <p class="hiring-step__desc">${s.desc}</p>
      </div>`).join('')}

      <!-- Step 02's funnel diagram — hidden until its step is hovered
           (desktop), always-open inline card after step 02 (mobile) -->
      <div class="hiring-annot-panel" id="hiringPanel">
        <div class="hiring-stack" id="hiringStack">
          <div class="hiring-layer hiring-layer--base" id="hL1">${BASE}</div>
          <div class="hiring-layer hiring-layer--mid1" id="hL2">${MID}</div>
          <div class="hiring-layer hiring-layer--mid2" id="hL3">${MID}</div>
        </div>
        <svg class="hiring-callouts-svg" id="hiringCalloutsSvg" aria-hidden="true"></svg>
        <div class="hiring-callouts" id="hiringCallouts">
          ${SUBSTEPS.map((s) => `
          <div class="hiring-callout" data-layer="${s.layer}">
            <span class="hiring-callout__tag">
              <span class="hiring-callout__num">${s.num}</span>
              <span class="hiring-step__tag-line"></span>
              ${s.tag}
            </span>
            <p class="hiring-callout__text">${s.text}</p>
          </div>`).join('')}
        </div>
      </div>
    </div>

  </div>

</section>
`

export function init() {
  const section  = document.getElementById('hiring')
  const panel    = document.getElementById('hiringPanel')
  const stack    = document.getElementById('hiringStack')
  const l1       = document.getElementById('hL1')
  const l2       = document.getElementById('hL2')
  const l3       = document.getElementById('hL3')
  const headline = document.getElementById('hiringHeadline')
  const line     = document.getElementById('hiringStepsLine')
  const stepsRow = document.getElementById('hiringSteps')
  const steps    = document.querySelectorAll('.hiring-step')
  const calloutsSvg = document.getElementById('hiringCalloutsSvg')
  const callouts = [...document.querySelectorAll('.hiring-callout')]
  const tether     = document.getElementById('hiringTether')
  const tetherLine = document.getElementById('hiringTetherLine')
  const layers   = [l1, l2, l3]
  const mobileMq = window.matchMedia('(max-width: 768px)')
  const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)')
  if (!section || !panel || !stack) return

  /* Layers rest flush (closed deck) inside the hidden panel and fan open as
     it appears. Flush = cancelling the CSS bottom offsets, which differ per
     breakpoint. */
  const REST_Y = mobileMq.matches ? [0, 22, 44] : [0, 30, 60]
  const FAN    = [0, -14, -28]

  const PANEL_GAP = 32 // must match .hiring-annot-panel's bottom offset
  const animate = !reduceMq.matches

  gsap.set(panel, {
    autoAlpha: 0, y: 8,
    xPercent: mobileMq.matches ? 0 : -50,
    scale: !mobileMq.matches && animate ? 0.97 : 1,
    transformOrigin: '50% 100%',
  })
  gsap.set(l2, { y: REST_Y[1] })
  gsap.set(l3, { y: REST_Y[2] })
  gsap.set(headline, { opacity: 0, y: 12 })
  gsap.set(steps, { opacity: 0, y: 16 })
  gsap.set(line, { clipPath: 'inset(0 100% 0 0)' })
  gsap.set(callouts, { autoAlpha: 0, x: 8 })

  /* Entrance — headline, then the steps land left to right along the tether */
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } })
    .to(headline, { opacity: 1, y: 0, duration: 0.5 }, 0)
    .to(steps[0], { opacity: 1, y: 0, duration: 0.45 }, 0.15)
    .to(line,     { clipPath: 'inset(0 0% 0 0)', duration: 0.9, ease: 'power2.inOut' }, 0.3)
    .to(steps[1], { opacity: 1, y: 0, duration: 0.45 }, 0.5)
    .to(steps[2], { opacity: 1, y: 0, duration: 0.45 }, 0.85)

  let annotActive = false

  /* ── Bloom at the cursor, then plant ──
     The panel opens at the pointer's x — the one cursor-aware moment — and
     holds still there. A dashed tether from the step 02 pill to its
     underside says what the panel is: that pill's internals, exploded.
     Same leader-line grammar as the callouts inside. */
  const cursor = { x: 0, has: false }

  function seedCursor(e) {
    const r = stepsRow.getBoundingClientRect()
    cursor.x = e.clientX - r.left
    cursor.has = true
  }

  // Panel-center x offset from the row's center, clamped so it stays inside
  function plantX() {
    const rowW = stepsRow.offsetWidth
    const half = panel.offsetWidth / 2
    const cx = Math.max(half - 12, Math.min(rowW - half + 12, cursor.x))
    return cx - rowW / 2
  }

  function drawTether(drawIn) {
    const pill = steps[1] && steps[1].querySelector('.hiring-step__tag')
    if (!pill) return
    const rowR = stepsRow.getBoundingClientRect()
    const pillR = pill.getBoundingClientRect()
    const x1 = pillR.left - rowR.left + pillR.width / 2
    const y1 = pillR.top - rowR.top - 6
    const x2 = stepsRow.offsetWidth / 2 + Number(gsap.getProperty(panel, 'x'))
    const y2 = -PANEL_GAP + 2
    tetherLine.setAttribute('x1', x1)
    tetherLine.setAttribute('y1', y1)
    tetherLine.setAttribute('x2', drawIn ? x1 : x2)
    tetherLine.setAttribute('y2', drawIn ? y1 : y2)
    if (drawIn) {
      gsap.to(tetherLine, { attr: { x2, y2 }, duration: 0.3, ease: 'power2.out', delay: 0.08 })
    }
  }

  function drawCalloutLines(animate) {
    const pR = panel.getBoundingClientRect()
    // Rects are measured mid-bloom (panel scaled ~0.97); normalize back to
    // local units so line endpoints land right once the scale reaches 1
    const s = pR.width / panel.offsetWidth || 1
    calloutsSvg.innerHTML = ''
    callouts.forEach((c, idx) => {
      const li = +c.dataset.layer
      const lR = layers[li].getBoundingClientRect()
      const cR = c.getBoundingClientRect()
      // Anchor to where the layer will be once the fan-open tween lands
      const curY = Number(gsap.getProperty(layers[li], 'y'))
      const x1 = (lR.left - pR.left + lR.width * 0.8) / s
      const y1 = (lR.top - pR.top + lR.height * 0.45) / s + (FAN[li] - curY)
      const x2 = (cR.left - pR.left) / s - 10
      const y2 = (cR.top - pR.top + cR.height / 2) / s
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      ln.setAttribute('x1', x1)
      ln.setAttribute('y1', y1)
      ln.setAttribute('x2', animate ? x1 : x2)
      ln.setAttribute('y2', animate ? y1 : y2)
      ln.setAttribute('stroke', 'rgba(7,85,233,0.5)')
      ln.setAttribute('stroke-width', '1.2')
      ln.setAttribute('stroke-dasharray', '3 6')
      calloutsSvg.appendChild(ln)
      if (animate) {
        gsap.to(ln, { attr: { x2, y2 }, duration: 0.35, ease: 'power2.out', delay: 0.18 + idx * 0.08 })
      }
    })
  }

  function showAnnotations() {
    if (annotActive) return
    annotActive = true
    // Panel opens over the headline band on desktop — quiet it down
    if (!mobileMq.matches) {
      gsap.to(headline, { opacity: 0.08, duration: 0.25, overwrite: 'auto' })
      // Plant at the cursor's x before revealing; it stays put from here
      if (cursor.has) gsap.set(panel, { x: plantX() })
      if (animate) gsap.to(panel, { scale: 1, duration: 0.25, ease: 'power3.out', overwrite: 'auto' })
      drawTether(animate)
      gsap.fromTo(tether, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25, delay: 0.04, overwrite: 'auto' })
    }
    gsap.to(panel, { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power3.out', overwrite: 'auto' })
    gsap.to(l2, { y: FAN[1], duration: 0.5, ease: 'power3.out', delay: 0.06, overwrite: 'auto' })
    gsap.to(l3, { y: FAN[2], duration: 0.5, ease: 'power3.out', delay: 0.06, overwrite: 'auto' })
    gsap.to(callouts, { autoAlpha: 1, x: 0, duration: 0.3, stagger: 0.08, delay: 0.16, overwrite: 'auto' })
    drawCalloutLines(true)
  }

  function hideAnnotations(instant) {
    if (!annotActive) return
    annotActive = false
    const resetScale = !mobileMq.matches && animate ? 0.97 : 1
    if (instant) {
      gsap.set(headline, { opacity: 1 })
      gsap.set(panel, { autoAlpha: 0, y: 8, scale: resetScale })
      gsap.set(callouts, { autoAlpha: 0, x: 8 })
      gsap.set(tether, { autoAlpha: 0 })
      gsap.set(l2, { y: REST_Y[1] })
      gsap.set(l3, { y: REST_Y[2] })
      calloutsSvg.innerHTML = ''
      return
    }
    gsap.to(headline, { opacity: 1, duration: 0.3, overwrite: 'auto' })
    gsap.to(panel, { autoAlpha: 0, y: 8, scale: resetScale, duration: 0.2, ease: 'power2.in', overwrite: 'auto' })
    gsap.to(tether, { autoAlpha: 0, duration: 0.16, overwrite: 'auto' })
    gsap.to(l2, { y: REST_Y[1], duration: 0.25, delay: 0.18, overwrite: 'auto' })
    gsap.to(l3, { y: REST_Y[2], duration: 0.25, delay: 0.18, overwrite: 'auto' })
    gsap.to(callouts, { autoAlpha: 0, x: 8, duration: 0.18, overwrite: 'auto' })
    gsap.to(calloutsSvg, {
      autoAlpha: 0, duration: 0.18,
      onComplete: () => { calloutsSvg.innerHTML = ''; gsap.set(calloutsSvg, { autoAlpha: 1 }) },
    })
  }

  /* Play when the section comes into view; reset once fully out so it replays next visit */
  let playing = false
  let settled = false
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.intersectionRatio >= 0.35 && !playing) {
      playing = true
      tl.restart()
    } else if (!entry.isIntersecting && playing) {
      playing = false
      settled = false
      hideAnnotations(true)
      tl.pause(0)
    }
  }, { threshold: [0, 0.35] })
  observer.observe(section)

  /* No hover on touch — once the entrance settles, the panel simply sits
     open as an inline card right after step 02 */
  tl.eventCallback('onComplete', () => {
    settled = true
    if (mobileMq.matches) showAnnotations()
  })

  function setActiveStep(idx) {
    steps.forEach((el, i) => {
      gsap.to(el, { opacity: idx === null || i === idx ? 1 : 0.35, duration: 0.3, overwrite: 'auto' })
    })
  }

  /* The diagram belongs to step 02 alone — it blooms out of that step and
     out of no other, opening at the cursor's x and planting itself there.
     Leaving the row closes it. */
  steps.forEach((el, i) => {
    el.addEventListener('mouseenter', (e) => {
      if (!settled || mobileMq.matches) return
      seedCursor(e)
      setActiveStep(i)
      if (i === 1) showAnnotations()
      else hideAnnotations()
    })
  })

  if (stepsRow) {
    stepsRow.addEventListener('mouseleave', () => {
      if (!settled || mobileMq.matches) return
      setActiveStep(null)
      hideAnnotations()
    })
  }

  window.addEventListener('resize', () => {
    if (!annotActive) return
    if (!mobileMq.matches && cursor.has) gsap.set(panel, { x: plantX() })
    drawCalloutLines(false)
    if (!mobileMq.matches) drawTether(false)
  })
}

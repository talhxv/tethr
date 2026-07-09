import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { PROBLEM_POS, SOLUTION_POS, DOUBLE_POS } from './manifesto.js'

gsap.registerPlugin(ScrollTrigger)

export function initManifesto() {
  const track        = document.getElementById('manifesto-track')
  const s1           = document.getElementById('manifesto-s1')
  const s2           = document.getElementById('manifesto-s2')
  const s4           = document.getElementById('manifesto-s4')
  const links        = [...document.querySelectorAll('.problem-chain-link')]
  const doubleA      = document.getElementById('double-a')
  const doubleB      = document.getElementById('double-b')
  const fullChainEl  = document.getElementById('full-chain')
  const problemText  = document.getElementById('problem-text')
  const solutionText = document.getElementById('solution-text')
  const tethrText    = document.getElementById('tethr-text')
  const problemItems = document.querySelectorAll('#problem-text .problem-item')
  const solutionItems= document.querySelectorAll('#solution-text .problem-item')
  const tethrItems   = document.querySelectorAll('#tethr-text .problem-item')
  const rail         = document.getElementById('manifesto-rail')
  const railFill     = document.getElementById('manifesto-rail-fill')
  const railNodes    = rail ? [...rail.querySelectorAll('.manifesto-rail__node')] : []

  if (!track || !links.length) return


  // Pair indices that swap to double-link SVGs
  const PAIR_A = [1, 5]
  const PAIR_B = [9, 13]

  // Set all single links at problem positions
  links.forEach((el, i) => {
    const p = PROBLEM_POS[i]
    gsap.set(el, { x: p.x, y: p.y, rotation: p.r, scale: p.s, opacity: 0 })
  })

  // Set double SVGs — positioned at their pair's location, hidden
  gsap.set(doubleA, { x: DOUBLE_POS[0].x, y: DOUBLE_POS[0].y, rotation: DOUBLE_POS[0].r, opacity: 0 })
  gsap.set(doubleB, { x: DOUBLE_POS[1].x, y: DOUBLE_POS[1].y, rotation: DOUBLE_POS[1].r, opacity: 0 })

  // Prime full chain paths for stroke-draw
  if (fullChainEl) {
    fullChainEl.querySelectorAll('path').forEach(path => {
      const len = path.getTotalLength()
      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len })
    })
  }

  // Text initial states
  gsap.set([s2, s4],     { opacity: 0 })
  gsap.set(problemText,  { opacity: 0, x: 30 })
  gsap.set(solutionText, { opacity: 0, x: 30 })
  gsap.set(tethrText,    { opacity: 0, x: 30 })
  gsap.set(problemItems, { opacity: 0, y: 16 })
  gsap.set(solutionItems,{ opacity: 0, y: 16 })
  gsap.set(tethrItems,   { opacity: 0, y: 16 })

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: track,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.9,
    }
  })

  // ── S1 fades out ──
  tl.to(s1, { opacity: 0, duration: 0.06 }, 0)
  tl.to(s2, { opacity: 1, duration: 0.03 }, 0.07)

  // ── Links snap in fast — all visible before text ──
  tl.to(links, { opacity: 1, duration: 0.10, stagger: 0.003, ease: 'power3.out' }, 0.08)

  // ── Problem text ──
  tl.to(problemText,  { opacity: 1, x: 0, duration: 0.06 }, 0.14)
  tl.to(problemItems, { opacity: 1, y: 0, duration: 0.05, stagger: 0.018 }, 0.17)

  // ── Hold: user reads problem (0.22–0.44) ──

  // ── Problem text exits ──
  tl.to(problemText, { opacity: 0, x: -20, duration: 0.05 }, 0.44)

  // ── All links move to solution positions ──
  links.forEach((el, i) => {
    const s = SOLUTION_POS[i]
    tl.to(el, { x: s.x, y: s.y, rotation: s.r, duration: 0.14, ease: 'power2.inOut' }, 0.46 + i * 0.002)
  })

  // ── Paired singles fade out, doubly-linked SVGs draw themselves in ──
  const pairEls = [...PAIR_A, ...PAIR_B].map(i => links[i])
  tl.to(pairEls, { opacity: 0, duration: 0.08, ease: 'power2.in' }, 0.56)

  ;[doubleA, doubleB].forEach((el, ei) => {
    gsap.set(el, { opacity: 1, scale: 1 })
    el.querySelectorAll('path').forEach(path => {
      const len = path.getTotalLength()
      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len })
      tl.to(path, {
        strokeDashoffset: 0,
        duration: 0.12,
        ease: 'power2.inOut',
      }, 0.58 + ei * 0.04)
    })
  })

  // ── Solution text slides in simultaneously with double-link draw ──
  tl.to(solutionText,  { opacity: 1, x: 0, duration: 0.06 }, 0.60)
  tl.to(solutionItems, { opacity: 1, y: 0, duration: 0.05, stagger: 0.018 }, 0.63)

  // ── Hold: user reads solution (0.68–0.80) ──

  // ── Cross-fade to scene 4 — s4 starts fading IN before s2 is gone ──
  // This ensures there is never a blank screen
  tl.to(s4, { opacity: 1, duration: 0.06 }, 0.80)

  // ── Chain starts drawing while s2 is still partially visible ──
  if (fullChainEl) {
    const paths = [...fullChainEl.querySelectorAll('path')]
    paths.forEach((path, i) => {
      tl.to(path, {
        strokeDashoffset: 0,
        duration: 0.04,
        ease: 'power2.inOut',
      }, 0.82 + i * 0.012)
    })
  }

  // ── s2 exits as s4 is already in view ──
  tl.to(s2, { opacity: 0, duration: 0.05 }, 0.84)

  // ── Tethr text slides in early — content-first, don't make the user wait for drawing ──
  tl.to(tethrText,  { opacity: 1, x: 0, duration: 0.05 }, 0.86)
  tl.to(tethrItems, { opacity: 1, y: 0, duration: 0.04, stagger: 0.015 }, 0.89)

  // ── Hold: user reads tethr section (0.93–1.0) ──

  // ── Progress rail ──
  // Timeline progress where each scene sits fully rendered (mid-hold):
  // banner 0, problem hold 0.22–0.44, solution hold 0.68–0.80, tethr hold 0.93–1.0
  const SCENE_PROGRESS = [0, 0.30, 0.74, 0.97]

  if (rail && railFill && railNodes.length === SCENE_PROGRESS.length) {
    const segments = SCENE_PROGRESS.length - 1

    // Piecewise map so the fill reaches each evenly-spaced node exactly when
    // its scene is fully rendered
    const fillPct = p => {
      for (let i = 0; i < segments; i++) {
        if (p <= SCENE_PROGRESS[i + 1]) {
          const f = (p - SCENE_PROGRESS[i]) / (SCENE_PROGRESS[i + 1] - SCENE_PROGRESS[i])
          return (Math.max(i + f, 0) / segments) * 100
        }
      }
      return 100
    }

    const updateRail = () => {
      const p = tl.progress()
      railFill.style.height = fillPct(p) + '%'
      let current = 0
      SCENE_PROGRESS.forEach((t, i) => { if (p >= t - 0.02) current = i })
      railNodes.forEach((node, i) => {
        node.classList.toggle('is-active', i <= current)
        node.classList.toggle('is-current', i === current)
        if (i === current) node.setAttribute('aria-current', 'step')
        else node.removeAttribute('aria-current')
      })
    }

    // Driven by the timeline (not raw scroll) so the rail matches the
    // scrubbed playhead, including the catch-up after a node click
    tl.eventCallback('onUpdate', updateRail)
    updateRail()

    // Clicking a node jumps the scroll straight to that scene's rendered
    // state; the scrub then fast-forwards the animation to catch up
    railNodes.forEach((node, i) => {
      node.addEventListener('click', () => {
        const st = tl.scrollTrigger
        window.scrollTo({
          top: st.start + SCENE_PROGRESS[i] * (st.end - st.start),
          behavior: 'auto',
        })
      })
    })
  }
}

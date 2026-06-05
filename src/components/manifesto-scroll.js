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
      scrub: 1,
    }
  })

  // ── S1 fades out ──
  tl.to(s1, { opacity: 0, duration: 0.08 }, 0)
  tl.to(s2, { opacity: 1, duration: 0.04 }, 0.09)

  // ── Links scatter in ──
  tl.to(links, { opacity: 1, duration: 0.14, stagger: 0.006, ease: 'power2.out' }, 0.10)

  // ── Problem text ──
  tl.to(problemText,  { opacity: 1, x: 0, duration: 0.08 }, 0.18)
  tl.to(problemItems, { opacity: 1, y: 0, duration: 0.07, stagger: 0.025 }, 0.22)

  // ── Hold: user reads problem (0.28–0.50) ──

  // ── Problem text exits ──
  tl.to(problemText, { opacity: 0, x: -20, duration: 0.07 }, 0.50)

  // ── All links move to solution positions ──
  links.forEach((el, i) => {
    const s = SOLUTION_POS[i]
    tl.to(el, { x: s.x, y: s.y, rotation: s.r, duration: 0.18, ease: 'power2.inOut' }, 0.52 + i * 0.003)
  })

  // ── Paired singles fade out, doubly-linked SVGs draw themselves in ──
  const pairEls = [...PAIR_A, ...PAIR_B].map(i => links[i])
  tl.to(pairEls, { opacity: 0, duration: 0.10, ease: 'power2.in' }, 0.62)

  // Prime each path for stroke-draw: measure total length, set dasharray/offset
  ;[doubleA, doubleB].forEach((el, ei) => {
    gsap.set(el, { opacity: 1, scale: 1 })
    el.querySelectorAll('path').forEach(path => {
      const len = path.getTotalLength()
      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len })
      tl.to(path, {
        strokeDashoffset: 0,
        duration: 0.18,
        ease: 'power2.inOut',
      }, 0.66 + ei * 0.06)
    })
  })

  // ── Solution text slides in ──
  tl.to(solutionText,  { opacity: 1, x: 0, duration: 0.08 }, 0.72)
  tl.to(solutionItems, { opacity: 1, y: 0, duration: 0.07, stagger: 0.025 }, 0.76)

  // ── Hold: user reads solution (0.80–0.84) ──

  // ── Solution exits ──
  tl.to([s2], { opacity: 0, duration: 0.06 }, 0.84)

  // ── Scene 4: full chain draws itself in ──
  tl.to(s4, { opacity: 1, duration: 0.04 }, 0.87)

  // Draw each path sequentially — 7 paths trace the full chain link by link
  if (fullChainEl) {
    const paths = [...fullChainEl.querySelectorAll('path')]
    paths.forEach((path, i) => {
      tl.to(path, {
        strokeDashoffset: 0,
        duration: 0.06,
        ease: 'power1.inOut',
      }, 0.88 + i * 0.018)
    })
  }

  // ── Tethr text slides in as chain finishes drawing ──
  tl.to(tethrText,  { opacity: 1, x: 0, duration: 0.06 }, 0.94)
  tl.to(tethrItems, { opacity: 1, y: 0, duration: 0.05, stagger: 0.02 }, 0.97)
}

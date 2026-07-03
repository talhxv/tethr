import gsap from 'gsap'
import chainLink from '../assets/chainlinkherooutline.svg'

// The three pillars of the offer — rendered twice: side-by-side panel on
// desktop, tappable card deck on mobile.
const PILLARS = [
  { label: 'Hire',   claim: 'Exceptional talent, vetted and shortlisted for you' },
  { label: 'Employ', claim: 'Payroll, compliance and contracts — on one invoice' },
  { label: 'Scale',  claim: 'One predictable fee, the savings stay with you' },
]

const panelCols = PILLARS.map((p) => `
    <div class="hero-panel__col">
      <span class="hero-panel__pill">${p.label}</span>
      <p class="hero-panel__claim">${p.claim}</p>
    </div>`).join('\n    <div class="hero-panel__divider" aria-hidden="true"></div>')

const deckCards = PILLARS.map((p) => `
    <article class="hero-deck__card" data-deck-card>
      <span class="hero-panel__pill">${p.label}</span>
      <p class="hero-panel__claim">${p.claim}</p>
    </article>`).join('')

const deckDots = PILLARS.map((_, i) => `<span${i === 0 ? ' class="is-active"' : ''}></span>`).join('')

export const html = `
<div class="hero-zone">
<section id="hero-bg">
  <div class="chain-wrap">
    <div class="grid-overlay"></div>
    <div class="radial-glow"></div>
    <img src="${chainLink}" class="hero-chain" alt="chain link" />
  </div>
  <div class="hero-text hero-text--top">
    <p>Company that</p>
    <p><span class="connects"><span class="connects-slot"><span class="connects-word">connects.</span></span></span></p>
  </div>
  <div class="hero-text hero-text--bottom">
    <p>We <span class="accent">tethr</span> ambition</p>
    <p>to outcomes</p>
  </div>
</section>
<div class="hero-sub padded">
  <h2 class="hero-sub__title">Tethr is a managed offshore workforce platform</h2>
  <div class="hero-panel">${panelCols}
  </div>
  <div class="hero-deck" id="hero-deck" role="button" tabindex="0"
       aria-label="What Tethr does — tap to see the next card">
    <div class="hero-deck__stack">${deckCards}
    </div>
    <div class="hero-deck__dots" aria-hidden="true">${deckDots}</div>
  </div>
</div>
</div>
`

// ── Mobile card deck: front card carries the claim, the other two peek
// above it; a tap drops the front card away and tucks it to the back. ──
const PEEK = 28 // px of headroom the peeking cards need above the front card
const DEPTHS = [
  { y: 0,   scale: 1,    zIndex: 3 },
  { y: -15, scale: 0.95, zIndex: 2 },
  { y: -28, scale: 0.90, zIndex: 1 },
]

function initDeck() {
  const deck = document.getElementById('hero-deck')
  if (!deck) return
  const stack = deck.querySelector('.hero-deck__stack')
  const cards = gsap.utils.toArray('[data-deck-card]', deck)
  const dots = gsap.utils.toArray('.hero-deck__dots span', deck)
  if (cards.length < 2) return

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const mobile = window.matchMedia('(max-width: 640px)')
  let order = cards.map((_, i) => i)
  let animating = false
  let autoTimer = null
  let deckVisible = true
  let bound = false

  // Cards are absolutely positioned, so the stack must be sized by hand:
  // tallest card + the peek headroom. Re-run on resize while mobile.
  function size() {
    if (!mobile.matches) return
    const tallest = Math.max(...cards.map((c) => c.offsetHeight))
    stack.style.height = `${tallest + PEEK}px`
  }

  function render(animate) {
    order.forEach((cardIdx, depth) => {
      const { y, scale, zIndex } = DEPTHS[depth]
      const el = cards[cardIdx]
      if (animate) {
        gsap.to(el, { y, scale, duration: 0.45, ease: 'power3.out', overwrite: 'auto' })
        gsap.set(el, { zIndex })
      } else {
        gsap.set(el, { y, scale, zIndex })
      }
    })
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === order[0]))
  }

  // dx: horizontal swipe distance — the exit follows the finger's direction;
  // taps and auto-advance use the default drop-down exit.
  function swap(dx = 0) {
    if (animating || !mobile.matches) return
    animating = true
    const front = cards[order[0]]
    order.push(order.shift())

    if (reduceMotion) {
      render(false)
      animating = false
      return
    }

    const exit = dx
      ? { x: dx > 0 ? 110 : -110, rotation: dx > 0 ? 5 : -5, autoAlpha: 0, duration: 0.28, ease: 'power2.in' }
      : { y: 34, autoAlpha: 0, scale: 0.97, duration: 0.24, ease: 'power2.in' }

    // Front card exits, reappears in the back slot, others step forward
    gsap.timeline({ onComplete: () => { animating = false } })
      .to(front, exit)
      .set(front, { x: 0, rotation: 0, zIndex: DEPTHS[2].zIndex, y: DEPTHS[2].y - 8, scale: DEPTHS[2].scale })
      .to(front, { autoAlpha: 1, y: DEPTHS[2].y, duration: 0.3, ease: 'power2.out' })
      .add(() => render(true), 0.1)
  }

  // One showcase loop: the deck deals through all three pillars once and
  // settles back on the first, then rests — a finite orchestrated moment,
  // not a perpetual fidget competing with the hero's word rotator. Any
  // interaction hands over control early. Pauses off-screen and in
  // background tabs; never runs under reduced motion.
  function startAuto() {
    if (reduceMotion || autoTimer) return
    let dealt = 0
    autoTimer = setInterval(() => {
      if (!deckVisible || document.hidden) return
      swap()
      dealt += 1
      if (dealt >= cards.length) stopAuto()
    }, 3500)
  }

  function stopAuto() {
    if (autoTimer) {
      clearInterval(autoTimer)
      autoTimer = null
    }
  }

  function setup() {
    if (bound || !mobile.matches) return
    bound = true
    size()
    render(false)

    deck.addEventListener('click', () => {
      stopAuto()
      swap()
    })
    deck.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        stopAuto()
        swap()
      }
    })

    let touchX = 0
    let touchY = 0
    deck.addEventListener('touchstart', (e) => {
      touchX = e.touches[0].clientX
      touchY = e.touches[0].clientY
    }, { passive: true })
    deck.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchX
      const dy = e.changedTouches[0].clientY - touchY
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        stopAuto()
        swap(dx)
      }
    }, { passive: true })

    new IntersectionObserver(([entry]) => {
      deckVisible = entry.isIntersecting
    }, { threshold: 0.4 }).observe(deck)

    window.addEventListener('resize', size)
    startAuto()
  }

  setup()
  mobile.addEventListener('change', setup)
}

export function init() {
  initDeck()

  const words = ['connects.', 'nurtures.', 'performs.', 'delivers.', 'empowers.', 'scales.']
  const el = document.querySelector('.connects-word')
  if (!el) return

  const DISPLAY = 2800
  const TRANSITION = 300
  let index = 0

  function next() {
    index = (index + 1) % words.length
    el.classList.add('slot-exit')
    setTimeout(() => {
      el.textContent = words[index]
      el.classList.remove('slot-exit')
      el.classList.add('slot-enter')
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.classList.remove('slot-enter')
        el.classList.add('slot-active')
        setTimeout(() => {
          el.classList.remove('slot-active')
          setTimeout(next, DISPLAY)
        }, TRANSITION)
      }))
    }, TRANSITION)
  }

  setTimeout(next, DISPLAY)
}

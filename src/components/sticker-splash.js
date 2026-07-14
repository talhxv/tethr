import gsap from 'gsap'
import stickerSrc from '../assets/stickertwo.svg'

// Easter egg: clicking the navbar's "For Talent. By Talent." sticker floods
// the screen with CTA blue from the sticker's own position, slaps a giant
// copy of the sticker onto the center (left-to-right, the way a real sticker
// adheres), holds a beat, then peels it back off the opposite way and drains
// the splash back into the navbar. Pure spectacle — nothing changes.

export function initStickerSplash() {
  const sticker = document.querySelector('.navbar-sticker')
  if (!sticker) return

  sticker.classList.add('navbar-sticker--egg')
  sticker.setAttribute('role', 'button')
  sticker.setAttribute('tabindex', '0')
  sticker.setAttribute('aria-label', 'For Talent. By Talent.')

  let busy = false
  const run = () => {
    if (busy) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    busy = true
    splash(sticker).then(() => { busy = false })
  }

  sticker.addEventListener('click', run)
  sticker.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run() }
  })
}

function splash(origin) {
  const el = document.createElement('div')
  el.className = 'splash'
  // Just the sticker itself — no shadow, no highlight strip. Anything
  // rectangular layered around the art reads as a box on the flat blue.
  // The wink line is the payoff hiding "under" the sticker — a nod to
  // whoever was curious enough to press a decorative sticker.
  el.innerHTML = `
    <div class="splash__fill"></div>
    <div class="splash__sticker">
      <img class="splash__img" src="${stickerSrc}" alt="" draggable="false">
    </div>
    <p class="splash__wink">We like people who click things <span class="splash__wink-face">:)</span></p>`
  document.body.appendChild(el)

  const fill  = el.querySelector('.splash__fill')
  const stick = el.querySelector('.splash__sticker')
  const wink  = el.querySelector('.splash__wink')
  const face  = el.querySelector('.splash__wink-face')

  // The flood circle grows from the sticker's center until it covers the
  // farthest viewport corner
  const r  = origin.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  const radius = Math.hypot(
    Math.max(cx, window.innerWidth - cx),
    Math.max(cy, window.innerHeight - cy),
  ) + 40

  gsap.set(fill, {
    left: cx, top: cy,
    width: radius * 2, height: radius * 2,
    xPercent: -50, yPercent: -50,
    scale: 0,
  })
  gsap.set(stick, { xPercent: -50, yPercent: -50, autoAlpha: 0 })
  gsap.set(wink, { xPercent: -50, yPercent: -50, autoAlpha: 0 })

  document.documentElement.classList.add('splash-lock')

  const SHOWN  = 'inset(-8% -8% -8% -8%)'
  const HIDE_R = 'inset(-8% 108% -8% -8%)' // everything right of the edge hidden
  const HIDE_L = 'inset(-8% -8% -8% 108%)' // everything left of the edge hidden

  const tl = gsap.timeline()

  // 1 — splash: blue floods out of the navbar sticker
  tl.to(fill, { scale: 1, duration: 0.45, ease: 'power3.in' })

    // 2 — stick: the sticker adheres left-to-right, lands tilted, presses flat
    .set(stick, { autoAlpha: 1, rotation: -12, scale: 1.16, clipPath: HIDE_R })
    .to(stick, { clipPath: SHOWN, duration: 0.45, ease: 'power2.inOut' }, '+=0.04')
    .to(stick, { rotation: -7, scale: 1, duration: 0.45, ease: 'power2.out' }, '<')
    .to(stick, { scale: 0.965, duration: 0.08, repeat: 1, yoyo: true, ease: 'power1.inOut' })

    // 3 — peel: same sweep, opposite effect — the left edge lifts first
    .to(stick, { clipPath: HIDE_L, duration: 0.4, ease: 'power2.inOut' }, '+=0.2')
    .to(stick, { rotation: -13, scale: 1.08, duration: 0.4, ease: 'power2.in' }, '<')

    // 4 — the nod that was under the sticker, landing on an actual wink
    .fromTo(wink,
      { autoAlpha: 0, y: 16, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.3, ease: 'power2.out' })
    .call(() => { face.textContent = ';)' }, null, '+=0.3')
    .to(wink, { autoAlpha: 0, y: -12, duration: 0.25, ease: 'power2.in' }, '+=0.55')

    // 5 — the splash drains back into the navbar
    .to(fill, { scale: 0, duration: 0.45, ease: 'power3.inOut' }, '-=0.05')

  return new Promise((resolve) => {
    tl.eventCallback('onComplete', () => {
      document.documentElement.classList.remove('splash-lock')
      el.remove()
      resolve()
    })
  })
}

const PARTICLE_COLOR = '7, 85, 233'   // matches --accent #0755E9
const LINE_OPACITY   = 0.20
const CONNECT_DIST   = 78
const COUNT_LEFT     = 48
const COUNT_RIGHT    = 40

function randomParticle(w, h, speed, jitter = false) {
  const angle = Math.random() * Math.PI * 2
  const s = speed * (0.3 + Math.random() * 0.7)
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: Math.cos(angle) * s,
    vy: Math.sin(angle) * s,
    jitter,
    // jitter particles flip direction randomly to feel erratic
    jitterTimer: Math.random() * 80,
  }
}

function makeCanvas(container) {
  const c = document.createElement('canvas')
  c.style.cssText = 'position:absolute;inset:0;pointer-events:none;'
  container.appendChild(c)
  return c
}

function resize(canvas) {
  const r = canvas.parentElement.getBoundingClientRect()
  canvas.width  = r.width
  canvas.height = r.height
}

function stepParticle(p, w, h) {
  if (p.jitter) {
    p.jitterTimer--
    if (p.jitterTimer <= 0) {
      const angle = Math.random() * Math.PI * 2
      const s = 0.25 + Math.random() * 0.55
      p.vx = Math.cos(angle) * s
      p.vy = Math.sin(angle) * s
      p.jitterTimer = 40 + Math.random() * 80
    }
  }
  p.x += p.vx
  p.y += p.vy
  if (p.x < -10) p.x = w + 10
  else if (p.x > w + 10) p.x = -10
  if (p.y < -10) p.y = h + 10
  else if (p.y > h + 10) p.y = -10
}

function runLeft(canvas) {
  resize(canvas)
  const ctx = canvas.getContext('2d')
  const particles = Array.from({ length: COUNT_LEFT }, () =>
    randomParticle(canvas.width, canvas.height, 0.45, true)
  )

  function tick() {
    const w = canvas.width, h = canvas.height
    ctx.clearRect(0, 0, w, h)
    for (const p of particles) {
      stepParticle(p, w, h)
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${PARTICLE_COLOR}, 0.38)`
      ctx.fill()
    }
    requestAnimationFrame(tick)
  }
  tick()
}

function runRight(canvas) {
  resize(canvas)
  const ctx = canvas.getContext('2d')
  const particles = Array.from({ length: COUNT_RIGHT }, () =>
    randomParticle(canvas.width, canvas.height, 0.28, false)
  )

  function tick() {
    const w = canvas.width, h = canvas.height
    ctx.clearRect(0, 0, w, h)

    for (const p of particles) {
      stepParticle(p, w, h)
    }

    // connect each particle to its 2 nearest neighbors — every dot always has lines
    const NEAREST = 2
    for (let i = 0; i < particles.length; i++) {
      const dists = particles
        .map((p, j) => {
          if (j === i) return { j, dist: Infinity }
          const dx = particles[i].x - p.x
          const dy = particles[i].y - p.y
          return { j, dist: Math.sqrt(dx * dx + dy * dy) }
        })
        .sort((a, b) => a.dist - b.dist)
        .slice(0, NEAREST)

      for (const { j, dist } of dists) {
        const alpha = LINE_OPACITY * Math.max(0, 1 - dist / CONNECT_DIST)
        ctx.beginPath()
        ctx.moveTo(particles[i].x, particles[i].y)
        ctx.lineTo(particles[j].x, particles[j].y)
        ctx.strokeStyle = `rgba(${PARTICLE_COLOR}, ${Math.max(alpha, 0.08)})`
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    // draw dots on top
    for (const p of particles) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${PARTICLE_COLOR}, 0.32)`
      ctx.fill()
    }

    requestAnimationFrame(tick)
  }
  tick()
}

export function init() {
  const hero = document.getElementById('hero-bg')
  if (!hero) return

  // left panel — scattered, no connections
  const leftPanel = document.createElement('div')
  leftPanel.className = 'hero-particles hero-particles--left'
  hero.appendChild(leftPanel)
  runLeft(makeCanvas(leftPanel))

  // right panel — connected network
  const rightPanel = document.createElement('div')
  rightPanel.className = 'hero-particles hero-particles--right'
  hero.appendChild(rightPanel)
  runRight(makeCanvas(rightPanel))

  // handle resize
  window.addEventListener('resize', () => {
    for (const c of hero.querySelectorAll('.hero-particles canvas')) {
      resize(c)
    }
  }, { passive: true })
}

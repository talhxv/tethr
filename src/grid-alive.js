export function initGridAlive() {
  const hero = document.getElementById('hero-bg');
  if (!hero) return;

  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
  const wrap = hero.querySelector('.chain-wrap');
  wrap.insertBefore(canvas, wrap.querySelector('.radial-glow'));

  const ctx = canvas.getContext('2d');

  const CELL = 64;
  const LINE_W = 1.5;
  const INFLUENCE_R = 160;
  const MAX_BEND = 3.5;
  const LERP_K = 0.045;
  const GR = 7, GG = 85, GB = 233;

  let rawX = null, rawY = null;
  let lerpX = 0, lerpY = 0;
  let hasLerp = false;
  let fade = 0;

  function resize() { canvas.width = wrap.offsetWidth; canvas.height = wrap.offsetHeight; }
  resize();
  new ResizeObserver(resize).observe(wrap);

  hero.addEventListener('mousemove', e => {
    const r = wrap.getBoundingClientRect();
    rawX = e.clientX - r.left;
    rawY = e.clientY - r.top;
    if (!hasLerp) { lerpX = rawX; lerpY = rawY; hasLerp = true; }
  });
  hero.addEventListener('mouseleave', () => { rawX = null; rawY = null; });

  function smoothstep(x) {
    x = Math.max(0, Math.min(1, x));
    return x * x * (3 - 2 * x);
  }

  // Mirror the CSS mask: circle 360px at 50% 50%, black 0%, black 20%, transparent 65%
  function heroMask(x, y) {
    const d = Math.hypot(x - canvas.width * 0.5, y - canvas.height * 0.5);
    if (d <= 72) return 1;
    if (d >= 234) return 0;
    return 1 - (d - 72) / 162;
  }

  function displace(px, py) {
    const dx = px - lerpX, dy = py - lerpY;
    const dist = Math.hypot(dx, dy);
    if (!dist || dist >= INFLUENCE_R) return [px, py];
    const inf = smoothstep(1 - dist / INFLUENCE_R);
    return [px + (dx / dist) * MAX_BEND * inf, py + (dy / dist) * MAX_BEND * inf];
  }

  function draw() {
    requestAnimationFrame(draw);

    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (rawX !== null) {
      lerpX += (rawX - lerpX) * LERP_K;
      lerpY += (rawY - lerpY) * LERP_K;
      fade += (1 - fade) * 0.07;
    } else {
      fade *= 0.9;
    }

    if (fade < 0.008) return;

    const pad = INFLUENCE_R + CELL;
    const xS = Math.floor((lerpX - pad) / CELL) * CELL;
    const xE = Math.ceil( (lerpX + pad) / CELL) * CELL;
    const yS = Math.floor((lerpY - pad) / CELL) * CELL;
    const yE = Math.ceil( (lerpY + pad) / CELL) * CELL;

    // Softly erase CSS grid in zone so distorted lines read cleanly
    const eg = ctx.createRadialGradient(lerpX, lerpY, 0, lerpX, lerpY, INFLUENCE_R);
    eg.addColorStop(0,   `rgba(255,255,255,${fade})`);
    eg.addColorStop(0.55, `rgba(255,255,255,${fade})`);
    eg.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = eg;
    ctx.fillRect(0, 0, W, H);

    ctx.lineWidth = LINE_W;

    // Vertical lines
    for (let gx = xS; gx <= xE; gx += CELL) {
      const ld = Math.abs(gx - lerpX);
      if (ld > INFLUENCE_R) continue;
      const alpha = (0.08 + smoothstep(1 - ld / INFLUENCE_R) * 0.72) * fade;

      ctx.beginPath();
      let fresh = true;
      for (let py = Math.max(0, yS - CELL); py <= Math.min(H, yE + CELL); py += 4) {
        if (heroMask(gx, py) < 0.01) { fresh = true; continue; }
        const [dx, dy] = displace(gx, py);
        if (fresh) { ctx.moveTo(dx, dy); fresh = false; } else ctx.lineTo(dx, dy);
      }
      ctx.strokeStyle = `rgba(${GR},${GG},${GB},${alpha})`;
      ctx.stroke();
    }

    // Horizontal lines
    for (let gy = yS; gy <= yE; gy += CELL) {
      const ld = Math.abs(gy - lerpY);
      if (ld > INFLUENCE_R) continue;
      const alpha = (0.08 + smoothstep(1 - ld / INFLUENCE_R) * 0.72) * fade;

      ctx.beginPath();
      let fresh = true;
      for (let px = Math.max(0, xS - CELL); px <= Math.min(W, xE + CELL); px += 4) {
        if (heroMask(px, gy) < 0.01) { fresh = true; continue; }
        const [dx, dy] = displace(px, gy);
        if (fresh) { ctx.moveTo(dx, dy); fresh = false; } else ctx.lineTo(dx, dy);
      }
      ctx.strokeStyle = `rgba(${GR},${GG},${GB},${alpha})`;
      ctx.stroke();
    }
  }

  requestAnimationFrame(draw);
}

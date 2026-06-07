import chainOutline      from '../assets/fullylinkedbluevectorchain.svg'
import chainOutlinePhone from '../assets/fullylinkedvectorchainbluephone.svg'
import chainLink     from '../assets/singlechainlinkvectorblue.svg?raw'
import doubleLink    from '../assets/doublylinkedchainvectorblue.svg?raw'
import fullChain     from '../assets/fullylinkedbluevectorchain.svg?raw'

// 16 links — Problem positions (all scattered/broken)
export const PROBLEM_POS = [
  { x: -100, y: -100, r: -18,  s: 1.0  },
  { x: 100,  y: -80,  r: -40,  s: 0.95 },
  { x: 290,  y: -90,  r: 14,   s: 1.0  },
  { x: 470,  y: -70,  r: -25,  s: 0.9  },
  { x: -60,  y: 140,  r: 35,   s: 0.92 },
  { x: 150,  y: 160,  r: -20,  s: 1.0  },
  { x: 340,  y: 130,  r: 50,   s: 0.95 },
  { x: 530,  y: 150,  r: -10,  s: 0.88 },
  { x: -80,  y: 360,  r: -45,  s: 0.95 },
  { x: 120,  y: 370,  r: 22,   s: 1.0  },
  { x: 320,  y: 350,  r: -32,  s: 0.92 },
  { x: 510,  y: 370,  r: 18,   s: 0.9  },
  { x: -50,  y: 560,  r: 40,   s: 0.95 },
  { x: 160,  y: 570,  r: -15,  s: 1.0  },
  { x: 360,  y: 550,  r: 28,   s: 0.92 },
  { x: 540,  y: 565,  r: -38,  s: 0.88 },
]

// Solution positions — indices 1, 5 (pair A) and 9, 13 (pair B) fade out
// replaced by doubly-linked SVGs. Rest shift subtly.
export const SOLUTION_POS = [
  { x: -110, y: -110, r: -22,  s: 1.0  },
  { x: 100,  y: -80,  r: -40,  s: 0.95 }, // pair A — will fade out
  { x: 300,  y: -80,  r: 18,   s: 1.0  },
  { x: 460,  y: -80,  r: -20,  s: 0.9  },
  { x: -50,  y: 155,  r: 30,   s: 0.92 },
  { x: 150,  y: 160,  r: -20,  s: 1.0  }, // pair A — will fade out
  { x: 345,  y: 145,  r: 48,   s: 0.95 },
  { x: 525,  y: 160,  r: -8,   s: 0.88 },
  { x: -70,  y: 370,  r: -40,  s: 0.95 },
  { x: 120,  y: 370,  r: 22,   s: 1.0  }, // pair B — will fade out
  { x: 325,  y: 355,  r: -28,  s: 0.92 },
  { x: 515,  y: 375,  r: 15,   s: 0.9  },
  { x: -45,  y: 565,  r: 38,   s: 0.95 },
  { x: 160,  y: 570,  r: -15,  s: 1.0  }, // pair B — will fade out
  { x: 358,  y: 555,  r: 25,   s: 0.92 },
  { x: 535,  y: 560,  r: -35,  s: 0.88 },
]

// Doubly-linked SVGs placed where each pair lives in solution state
// doublylinkedchainvectorblue.svg is 581×515 — shows two links connected diagonally
// Rendered at ~2× single link width so each link inside matches the singles
export const DOUBLE_POS = [
  { x: 20,  y: -110, r: -25 }, // pair A
  { x: 20,  y:  340, r:  40 }, // pair B
]

export const html = `
<div class="manifesto-scroll-track" id="manifesto-track">
  <div class="manifesto-sticky" id="manifesto-sticky">

    <div class="section-label padded">
      <span class="section-label__num">01</span>
      <span class="section-label__line"></span>
      <span class="section-label__title">MANIFESTO</span>
    </div>

    <div class="manifesto-frame" id="manifesto-frame">

      <!-- Scene 1 -->
      <div class="manifesto-layer" id="manifesto-s1">
        <div class="manifesto-banner__chain-wrap">
          <picture>
            <source media="(max-width: 768px)" srcset="${chainOutlinePhone}" />
            <img src="${chainOutline}" class="manifesto-banner__chain" alt="" id="manifesto-chain-img" />
          </picture>
        </div>
        <p class="manifesto-banner__text">For Talent. By Talent.</p>
      </div>

      <!-- Scenes 2+3: shared links -->
      <div class="manifesto-layer manifesto-layer--split" id="manifesto-s2">

        <div class="problem-chains" id="shared-chains">
          ${PROBLEM_POS.map((_, i) => `
          <div class="problem-chain-link" data-i="${i}">${chainLink}</div>`).join('')}

          <!-- Doubly-linked SVGs — hidden until solution transition -->
          <div class="double-link" id="double-a">${doubleLink}</div>
          <div class="double-link" id="double-b">${doubleLink}</div>
        </div>

        <div class="narrative-text-wrap">
          <div class="problem-text narrative-text" id="problem-text">
            <div class="problem-label">
              <span class="problem-dot" style="background:#e03131"></span>
              <span>The Problem.</span>
            </div>
            <h2 class="problem-headline">
              Great talent exists in Pakistan.<br>
              <strong>Getting to it is broken.</strong>
            </h2>
            <div class="problem-items">
              <div class="problem-item">
                <span class="problem-item__title">NO LOCAL INFRASTRUCTURE</span>
                <p class="problem-item__body">No local legal or HR presence, slow and expensive global EOR platforms.</p>
              </div>
              <div class="problem-item">
                <span class="problem-item__title">TALENT LEFT UNDERUTILIZED</span>
                <p class="problem-item__body">Managing remote employees across legal, payroll, and performance is a full-time job in itself.</p>
              </div>
            </div>
          </div>

          <div class="problem-text narrative-text" id="solution-text">
            <div class="problem-label">
              <span class="problem-dot" style="background:#12b76a"></span>
              <span>The Solution.</span>
            </div>
            <h2 class="problem-headline">
              One partner.<br>
              <strong>Everything handled.</strong>
            </h2>
            <div class="problem-items">
              <div class="problem-item">
                <span class="problem-item__title">END-TO-END MANAGED</span>
                <p class="problem-item__body">A single invoice covers the full employee lifecycle — sourcing, onboarding, payroll, compliance, and performance support.</p>
              </div>
              <div class="problem-item">
                <span class="problem-item__title">ZERO HR OVERHEAD</span>
                <p class="problem-item__body">No HR overhead for the client. Talent that performs like an internal team.</p>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Scene 4: full chain — direct child of frame like s1 and s2 -->
      <div class="manifesto-layer manifesto-layer--split" id="manifesto-s4">
        <div class="problem-chains">
          <div class="full-chain" id="full-chain">${fullChain}</div>
        </div>
        <div class="narrative-text-wrap">
          <div class="problem-text narrative-text" id="tethr-text">
            <div class="problem-label">
              <span class="problem-dot" style="background:#0755E9"></span>
              <span>How Tethr Does it.</span>
            </div>
            <h2 class="problem-headline">
              Rooted in Pakistan.<br>
              <strong>Built for US teams.</strong>
            </h2>
            <div class="problem-items">
              <div class="problem-item">
                <span class="problem-item__title">REAL LOCAL DEPTH</span>
                <p class="problem-item__body">Unlike global EORs with shell offices, <strong style="color:#0755E9">Tethr</strong> operates from within Pakistan's talent community — with genuine investment in every hire.</p>
              </div>
              <div class="problem-item">
                <span class="problem-item__title">BUILT FOR SCALE</span>
                <p class="problem-item__body">From your first hire to a full team — one contract, one point of contact, zero overhead on your side.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</div>
`

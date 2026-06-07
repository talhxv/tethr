const JOBS = [
  {
    id: 1,
    title: 'Senior Frontend Engineer',
    department: 'Engineering',
    type: 'Full-time',
    location: 'Remote — Pakistan',
    salary: '$3,000 – $4,500 / mo',
    blurb: "Build the interfaces that define how users experience modern software. You'll work directly with US-based product teams, owning components end-to-end.",
    tags: ['React', 'TypeScript', 'GSAP'],
  },
  {
    id: 2,
    title: 'Product Designer',
    department: 'Design',
    type: 'Full-time',
    location: 'Remote — Pakistan',
    salary: '$2,500 – $3,800 / mo',
    blurb: "From wireframe to shipped — you'll own the design process for a fast-moving US startup. Strong systems thinking and an eye for motion required.",
    tags: ['Figma', 'Prototyping', 'Design Systems'],
  },
  {
    id: 3,
    title: 'Growth Lead',
    department: 'Growth',
    type: 'Full-time',
    location: 'Remote — Pakistan',
    salary: '$2,200 – $3,500 / mo',
    blurb: "Drive acquisition, retention, and revenue experiments for a scaling US SaaS product. You'll report directly to the founder and own your own roadmap.",
    tags: ['SEO', 'Paid Acquisition', 'Analytics'],
  },
  {
    id: 4,
    title: 'Backend Engineer',
    department: 'Engineering',
    type: 'Full-time',
    location: 'Remote — Pakistan',
    salary: '$3,200 – $5,000 / mo',
    blurb: "Architect and scale the systems behind a high-growth US fintech. Node.js or Go preferred. You'll be the most senior engineer on a lean, ambitious team.",
    tags: ['Node.js', 'PostgreSQL', 'AWS'],
  },
]

const DEPT_COLORS = {
  Engineering: { bg: 'rgba(7,85,233,0.08)', text: '#0755E9' },
  Design:      { bg: 'rgba(0,17,49,0.06)',  text: '#001131' },
  Growth:      { bg: 'rgba(43,68,255,0.08)', text: '#2B44FF' },
}

function jobRow(job, index) {
  const dept = DEPT_COLORS[job.department] || DEPT_COLORS.Engineering
  return `
  <article class="op-row" data-id="${job.id}" style="animation-delay:${index * 80}ms">
    <div class="op-row__main">
      <div class="op-row__left">
        <span class="op-row__dept" style="background:${dept.bg};color:${dept.text}">${job.department}</span>
        <h2 class="op-row__title">${job.title}</h2>
      </div>
      <div class="op-row__meta">
        <span class="op-row__location">${job.location}</span>
        <span class="op-row__type">${job.type}</span>
        <span class="op-row__salary">${job.salary}</span>
        <div class="op-row__arrow" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3.75 14.25L14.25 3.75M14.25 3.75H6.75M14.25 3.75V11.25" stroke="#2B44FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
    <div class="op-row__expand">
      <p class="op-row__blurb">${job.blurb}</p>
      <div class="op-row__footer">
        <div class="op-row__tags">
          ${job.tags.map(t => `<span class="op-row__tag">${t}</span>`).join('')}
        </div>
        <a href="#" class="op-row__apply">Apply for this role
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M1.5 9.5L9.5 1.5M9.5 1.5H3.5M9.5 1.5V7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
      </div>
    </div>
  </article>`
}

export const html = `
<section class="op-section" id="open-positions">

  <!-- Header -->
  <div class="op-header padded">
    <div class="section-label">
      <span class="section-label__num">04</span>
      <span class="section-label__line"></span>
      <span class="section-label__title">OPEN POSITIONS</span>
    </div>
    <div class="op-hero">
      <div class="op-hero__text">
        <h1 class="op-hero__headline">Work with the world's<br><em class="op-hero__em">best teams.</em></h1>
        <p class="op-hero__sub">Every role is remote-first, fully managed through Tethr — one contract, one point of contact, zero overhead.</p>
      </div>
      <div class="op-hero__count">
        <span class="op-count__num">${JOBS.length}</span>
        <span class="op-count__label">open<br>roles</span>
      </div>
    </div>
  </div>

  <!-- Filters -->
  <div class="op-filters padded">
    <div class="op-filters__inner">
      <button class="op-filter active" data-filter="all">All roles</button>
      <button class="op-filter" data-filter="Engineering">Engineering</button>
      <button class="op-filter" data-filter="Design">Design</button>
      <button class="op-filter" data-filter="Growth">Growth</button>
    </div>
    <div class="op-filters__rule" aria-hidden="true"></div>
  </div>

  <!-- Listings -->
  <div class="op-list padded" id="opList">
    ${JOBS.map((job, i) => jobRow(job, i)).join('')}
    <div class="op-empty" id="opEmpty" style="display:none">
      <p>No open roles in this department right now — check back soon.</p>
    </div>
  </div>

  <!-- Bottom note -->
  <div class="op-footer-note padded">
    <p>Don't see a fit? <a href="#" class="op-footer-note__link">Send an open application →</a></p>
  </div>

</section>
`

export function init() {
  const filters = document.querySelectorAll('.op-filter')
  const rows    = document.querySelectorAll('.op-row')
  const empty   = document.getElementById('opEmpty')

  /* Filter logic */
  filters.forEach(btn => {
    btn.addEventListener('click', () => {
      filters.forEach(b => b.classList.remove('active'))
      btn.classList.add('active')

      const f = btn.dataset.filter
      let visible = 0
      rows.forEach(row => {
        const dept = row.querySelector('.op-row__dept').textContent
        const show = f === 'all' || dept === f
        row.style.display = show ? '' : 'none'
        if (show) visible++
      })
      if (empty) empty.style.display = visible === 0 ? 'block' : 'none'
    })
  })

  /* Expand rows on click */
  rows.forEach(row => {
    row.addEventListener('click', () => {
      const isOpen = row.classList.contains('open')
      rows.forEach(r => r.classList.remove('open'))
      if (!isOpen) row.classList.add('open')
    })
  })
}

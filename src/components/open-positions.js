import { fetchJobs } from '../lib/notion.js'
import chainBg from '../assets/fullylinkedvectorchainbluephone.svg'

// Notion application form ("Apply to Tethr" view on Tethr — Applications DB).
// IMPORTANT: replace with the public "Share form" link from Notion so people
// without workspace access can submit (Form view → Share → Copy form link).
const APPLY_FORM_URL = 'https://app.notion.com/p/dc58643f0f824e5f9a48f41509d2e1ca?v=37d363751b2981209962000c8ec3a85e'

const DEPT_COLORS = {
  Engineering: { bg: 'rgba(7,85,233,0.08)',   text: '#0755E9' },
  Design:      { bg: 'rgba(0,17,49,0.06)',    text: '#001131' },
  Growth:      { bg: 'rgba(43,68,255,0.08)',  text: '#2B44FF' },
  Marketing:   { bg: 'rgba(43,68,255,0.08)',  text: '#2B44FF' },
  Operations:  { bg: 'rgba(0,17,49,0.06)',    text: '#001131' },
}

function deptColor(dept) {
  return DEPT_COLORS[dept] ?? { bg: 'rgba(7,85,233,0.08)', text: '#0755E9' }
}

function jobRow(job, index) {
  const d    = deptColor(job.department)
  const tags = Array.isArray(job.tags) ? job.tags : []
  const applyHref = job.applyUrl || APPLY_FORM_URL

  return `
  <article class="op-row" data-id="${job.id}" data-dept="${job.department}" style="animation-delay:${index * 80}ms">
    <div class="op-row__main">
      <div class="op-row__left">
        <span class="op-row__dept" style="background:${d.bg};color:${d.text}">${job.department || 'General'}</span>
        <h2 class="op-row__title">${job.title}</h2>
      </div>
      <div class="op-row__meta">
        ${job.location ? `<span class="op-row__location">${job.location}</span>` : ''}
        ${job.type     ? `<span class="op-row__type">${job.type}</span>` : ''}
        <div class="op-row__arrow" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3.75 14.25L14.25 3.75M14.25 3.75H6.75M14.25 3.75V11.25" stroke="#2B44FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
    <div class="op-row__expand">
      <div class="op-row__expand-inner">
      ${job.blurb ? `<p class="op-row__blurb">${job.blurb}</p>` : ''}
      <div class="op-row__footer">
        <div class="op-row__tags">
          ${tags.map(t => `<span class="op-row__tag">${t}</span>`).join('')}
        </div>
        <a href="${applyHref}" class="op-row__apply" ${applyHref !== '#' ? 'target="_blank" rel="noopener"' : ''}>Apply for this role
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M1.5 9.5L9.5 1.5M9.5 1.5H3.5M9.5 1.5V7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
      </div>
      </div>
    </div>
  </article>`
}

// Skeleton shown while Notion data loads
function skeletonRows(n = 3) {
  return Array.from({ length: n }, (_, i) => `
  <article class="op-row op-row--skeleton" style="animation-delay:${i * 80}ms">
    <div class="op-row__main">
      <div class="op-row__left">
        <span class="op-skeleton op-skeleton--tag"></span>
        <span class="op-skeleton op-skeleton--title"></span>
      </div>
      <div class="op-row__meta">
        <span class="op-skeleton op-skeleton--meta"></span>
        <span class="op-skeleton op-skeleton--meta"></span>
      </div>
    </div>
  </article>`).join('')
}

export const html = `
<section class="op-section" id="open-positions">

  <!-- Decorative chains clipped on the section corners -->
  <img src="${chainBg}" class="op-chain op-chain--tr" alt="" aria-hidden="true" />
  <img src="${chainBg}" class="op-chain op-chain--bl" alt="" aria-hidden="true" />

  <!-- Header -->
  <div class="op-header padded">
    <div class="section-label">
      <span class="section-label__num">04</span>
      <span class="section-label__line"></span>
      <span class="section-label__title">OPEN POSITIONS</span>
    </div>
  </div>

  <!-- Filters -->
  <div class="op-filters padded">
    <div class="op-filters__inner" id="opFilters">
      <button class="op-filter active" data-filter="all">All roles</button>
    </div>
    <div class="op-filters__rule" aria-hidden="true"></div>
  </div>

  <!-- Listings -->
  <div class="op-list padded" id="opList">
    ${skeletonRows(3)}
  </div>

  <!-- Pagination -->
  <div class="op-pagination padded" id="opPagination" style="display:none">
    <button class="op-page-btn op-page-nav" id="opPrev" aria-label="Previous page">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div class="op-page-numbers" id="opPageNumbers"></div>
    <button class="op-page-btn op-page-nav" id="opNext" aria-label="Next page">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  </div>

  <!-- Bottom note -->
  <div class="op-footer-note padded">
    <p>Don't see a fit? <a href="${APPLY_FORM_URL}" target="_blank" rel="noopener" class="op-footer-note__link">Send an open application →</a></p>
  </div>

</section>
`

const PER_PAGE = 6

export async function init() {
  const list       = document.getElementById('opList')
  const filtersEl  = document.getElementById('opFilters')
  const pagination = document.getElementById('opPagination')
  const pageNums   = document.getElementById('opPageNumbers')
  const prevBtn    = document.getElementById('opPrev')
  const nextBtn    = document.getElementById('opNext')

  let jobs = []
  let fetchError = false
  try {
    jobs = await fetchJobs()
  } catch (err) {
    console.error('Failed to load positions:', err)
    fetchError = true
  }

  if (fetchError) {
    list.innerHTML = `<p style="padding:2rem 0;color:rgba(0,17,49,0.4)">Could not load positions — please try again later.</p>`
    return
  }

  // Build filter buttons from unique departments
  const depts = [...new Set(jobs.map(j => j.department).filter(Boolean))]
  if (depts.length && filtersEl) {
    filtersEl.innerHTML =
      `<button class="op-filter active" data-filter="all">All roles</button>` +
      depts.map(d => `<button class="op-filter" data-filter="${d}">${d}</button>`).join('')
  }

  let filtered = [...jobs]
  let currentPage = 1

  function totalPages() { return Math.max(1, Math.ceil(filtered.length / PER_PAGE)) }

  function renderPage(page) {
    currentPage = Math.min(Math.max(1, page), totalPages())
    const start = (currentPage - 1) * PER_PAGE
    const slice = filtered.slice(start, start + PER_PAGE)

    list.innerHTML = slice.length
      ? slice.map((job, i) => jobRow(job, i)).join('')
      : `<p style="padding:2rem 0;color:rgba(0,17,49,0.4)">No open positions in this category.</p>`

    // Expand rows on click
    list.querySelectorAll('.op-row').forEach(row => {
      row.addEventListener('click', () => {
        const isOpen = row.classList.contains('open')
        list.querySelectorAll('.op-row').forEach(r => r.classList.remove('open'))
        if (!isOpen) row.classList.add('open')
      })
    })

    renderPagination()
  }

  function renderPagination() {
    const total = totalPages()
    pagination.style.display = total > 1 ? 'flex' : 'none'

    prevBtn.disabled = currentPage === 1
    nextBtn.disabled = currentPage === total

    // Show up to 5 page numbers with ellipsis
    const pages = []
    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('…')
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(total - 1, currentPage + 1); i++) pages.push(i)
      if (currentPage < total - 2) pages.push('…')
      pages.push(total)
    }

    pageNums.innerHTML = pages.map(p =>
      p === '…'
        ? `<span class="op-page-ellipsis">…</span>`
        : `<button class="op-page-btn${p === currentPage ? ' active' : ''}" data-page="${p}">${p}</button>`
    ).join('')

    pageNums.querySelectorAll('[data-page]').forEach(btn =>
      btn.addEventListener('click', () => renderPage(+btn.dataset.page))
    )
  }

  prevBtn.addEventListener('click', () => renderPage(currentPage - 1))
  nextBtn.addEventListener('click', () => renderPage(currentPage + 1))

  // Wire up filters
  filtersEl?.querySelectorAll('.op-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      filtersEl.querySelectorAll('.op-filter').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      const f = btn.dataset.filter
      filtered = f === 'all' ? [...jobs] : jobs.filter(j => j.department === f)
      renderPage(1)
    })
  })

  renderPage(1)
}

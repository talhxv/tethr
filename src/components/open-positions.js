import { fetchJobs } from '../lib/notion.js'
import { exciteNavbar } from './navbar.js'
import chainBg from '../assets/fullylinkedvectorchainbluephone.svg'

// Tally application form. Create it at tally.so, connect it to your Notion
// Applications DB, and add a hidden field whose query-parameter key is
// "position" so each role pre-fills. Then paste the form id below — it's the
// part after /r/ in the form URL (e.g. tally.so/r/wAbCdE → 'wAbCdE').
const TALLY_FORM_ID  = 'yP7a2d'
const TALLY_FORM_URL = `https://tally.so/r/${TALLY_FORM_ID}`

const escapeAttr = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Apply links navigate to the full-page Tally form (role pre-filled via the
// ?position= query param, which maps to the form's hidden "position" field).

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

// /positions/<slug> → the slug; /positions or /positions.html → null
function slugFromPath() {
  const m = window.location.pathname.match(/^\/positions\/([^/]+?)\/?$/)
  return m ? decodeURIComponent(m[1]) : null
}

// List rows are real links so the direct URL is middle-clickable and
// crawlable; a click handler upgrades plain clicks to the SPA transition.
function jobRow(job, index) {
  const d = deptColor(job.department)

  return `
  <a class="op-row" href="/positions/${job.slug}" data-slug="${escapeAttr(job.slug)}" style="animation-delay:${index * 80}ms">
    <div class="op-row__main">
      <div class="op-row__left">
        <h2 class="op-row__title">${job.title}</h2>
        <div class="op-row__badges">
          <span class="op-row__dept" style="background:${d.bg};color:${d.text}">${job.department || 'General'}</span>
          ${job.type ? `<span class="op-pill op-pill--type"><span class="op-pill__line"></span>${job.type}</span>` : ''}
        </div>
      </div>
      <div class="op-row__meta">
        ${job.location ? `<span class="op-row__location">${job.location}</span>` : ''}
        <div class="op-row__arrow" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3.75 14.25L14.25 3.75M14.25 3.75H6.75M14.25 3.75V11.25" stroke="#2B44FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  </a>`
}

// Full-page job view rendered at /positions/<slug>
function detailHtml(job) {
  const d = deptColor(job.department)
  // The location already has its own pill here — drop tags that repeat it
  const tags = (Array.isArray(job.tags) ? job.tags : [])
    .filter(t => t.toLowerCase() !== String(job.location ?? '').toLowerCase())

  return `
  <article class="op-detail">
    <a href="/positions" class="op-detail__back" data-back>
      <span class="op-detail__back-circle" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      All open positions
    </a>

    <div class="op-detail__badges">
      <span class="op-row__dept" style="background:${d.bg};color:${d.text}">${job.department || 'General'}</span>
      ${job.type ? `<span class="op-pill op-pill--type"><span class="op-pill__line"></span>${job.type}</span>` : ''}
    </div>

    <h1 class="op-detail__title">${job.title}</h1>
    ${job.tagline ? `<p class="op-detail__tagline">${job.tagline}</p>` : ''}

    <div class="op-detail__facts">
      ${job.location ? `<span class="op-row__tag">${job.location}</span>` : ''}
      ${job.compensation ? `<span class="op-pill op-pill--comp">${job.compensation}</span>` : ''}
      ${tags.map(t => `<span class="op-row__tag">${t}</span>`).join('')}
    </div>

    <div class="op-detail__rule" aria-hidden="true"></div>

    ${job.blurb ? `<p class="op-detail__blurb">${job.blurb}</p>` : ''}

    ${job.doList.length || job.needList.length ? `
    <div class="op-row__cols op-detail__cols">
      ${job.doList.length ? `
      <div class="op-row__col">
        <span class="op-row__col-label"><span class="op-pill__line"></span>What you'll do</span>
        <ul class="op-row__list">${job.doList.map(li => `<li>${li}</li>`).join('')}</ul>
      </div>` : ''}
      ${job.needList.length ? `
      <div class="op-row__col">
        <span class="op-row__col-label"><span class="op-pill__line"></span>What we need</span>
        <ul class="op-row__list">${job.needList.map(li => `<li>${li}</li>`).join('')}</ul>
      </div>` : ''}
    </div>` : ''}

    ${job.note ? `<p class="op-row__note"><strong>Note:</strong> ${job.note}</p>` : ''}

    <div class="op-detail__cta">
      <a href="${TALLY_FORM_URL}?position=${encodeURIComponent(job.title)}" class="op-detail__apply" data-apply data-position="${escapeAttr(job.title)}" target="_blank" rel="noopener">Apply for this role
        <svg width="12" height="12" viewBox="0 0 11 11" fill="none">
          <path d="M1.5 9.5L9.5 1.5M9.5 1.5H3.5M9.5 1.5V7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>
      <button type="button" class="op-detail__refer" data-refer>
        <!-- navbarchainlink.svg, inlined so it inherits the button's
             hover/copied color -->
        <svg width="18" height="6" viewBox="0 0 14 5" fill="none" aria-hidden="true">
          <path d="M4.46582 2.2063C4.46582 1.9626 4.66338 1.76505 4.90708 1.76505H9.31967C9.56337 1.76505 9.76093 1.9626 9.76093 2.2063C9.76093 2.45 9.56337 2.64756 9.31967 2.64756H4.90708C4.66338 2.64756 4.46582 2.45 4.46582 2.2063Z" fill="currentColor"/>
          <path d="M4.75195 0C5.67337 0.000126237 6.46188 0.565786 6.79199 1.36816H5.59766C5.39561 1.17821 5.12443 1.06055 4.8252 1.06055H2.13281C1.50968 1.06055 1.00433 1.56545 1.00391 2.18848C1.00393 2.81185 1.50943 3.31738 2.13281 3.31738H4.8252C5.08614 3.31738 5.3254 3.22783 5.5166 3.0791H6.77734C6.43908 3.86349 5.66021 4.41296 4.75195 4.41309H2.20605C0.987671 4.41292 2.22361e-05 3.42447 0 2.20605C0.00032914 0.987899 0.98786 0.000160668 2.20605 0H4.75195ZM11.7109 0C12.9289 0.000371713 13.9166 0.98805 13.917 2.20605C13.9169 3.42426 12.9291 4.41271 11.7109 4.41309H9.16504C8.25683 4.41296 7.47794 3.86347 7.13965 3.0791H8.39941C8.59073 3.22806 8.83054 3.31738 9.0918 3.31738H11.7852C12.408 3.31695 12.9128 2.81231 12.9131 2.18945C12.9129 1.56649 12.4081 1.06098 11.7852 1.06055H9.0918C8.79262 1.06055 8.52137 1.17815 8.31934 1.36816H7.125C7.45512 0.56579 8.24364 0.000123454 9.16504 0H11.7109Z" fill="currentColor"/>
        </svg>
        <span data-refer-label>Refer a friend</span>
      </button>
    </div>
  </article>`
}

// Shown when a shared link points at a role that's gone
function notFoundHtml() {
  return `
  <article class="op-detail">
    <a href="/positions" class="op-detail__back" data-back>
      <span class="op-detail__back-circle" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      All open positions
    </a>
    <h1 class="op-detail__title">This position has closed.</h1>
    <div class="op-detail__rule" aria-hidden="true"></div>
    <p class="op-detail__blurb">The role behind this link isn't open right now — it may have been filled, or the link has changed. The roles we're still hiring for are one click away.</p>
    <div class="op-detail__cta">
      <a href="/positions" class="op-detail__apply" data-back>View open positions
        <svg width="12" height="12" viewBox="0 0 11 11" fill="none">
          <path d="M1.5 9.5L9.5 1.5M9.5 1.5H3.5M9.5 1.5V7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>
    </div>
  </article>`
}

// Skeleton shown while Notion data loads
function skeletonRows(n = 3) {
  return Array.from({ length: n }, (_, i) => `
  <article class="op-row op-row--skeleton" style="animation-delay:${i * 80}ms">
    <div class="op-row__main">
      <div class="op-row__left">
        <div class="op-row__badges">
          <span class="op-skeleton op-skeleton--pill"></span>
          <span class="op-skeleton op-skeleton--pill op-skeleton--pill-wide"></span>
        </div>
        <span class="op-skeleton op-skeleton--title"></span>
      </div>
      <div class="op-row__meta">
        <span class="op-skeleton op-skeleton--arrow"></span>
      </div>
    </div>
  </article>`).join('')
}

// Skeleton for a direct landing on /positions/<slug>
function detailSkeleton() {
  return `
  <div class="op-detail op-detail--skeleton">
    <span class="op-skeleton op-skeleton--back"></span>
    <div class="op-detail__badges">
      <span class="op-skeleton op-skeleton--pill"></span>
      <span class="op-skeleton op-skeleton--pill op-skeleton--pill-wide"></span>
    </div>
    <span class="op-skeleton op-skeleton--headline"></span>
    <span class="op-skeleton op-skeleton--line"></span>
    <span class="op-skeleton op-skeleton--line"></span>
    <span class="op-skeleton op-skeleton--line op-skeleton--line-short"></span>
  </div>`
}

export const html = `
<section class="op-section" id="open-positions">

  <!-- Decorative chains clipped on the section corners -->
  <img src="${chainBg}" class="op-chain op-chain--tr" alt="" aria-hidden="true" />
  <img src="${chainBg}" class="op-chain op-chain--bl" alt="" aria-hidden="true" />

  <!-- Header -->
  <div class="op-header padded">
    <div class="section-label">
      <span class="section-label__num">00</span>
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

  <!-- Listings / job detail -->
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
    <p class="op-footer-note__prompt">Don't see a fit?</p>
    <a href="${TALLY_FORM_URL}?position=${encodeURIComponent('Open application')}" data-apply target="_blank" rel="noopener" class="op-footer-note__link">Send an open application
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <path d="M1.5 9.5L9.5 1.5M9.5 1.5H3.5M9.5 1.5V7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </a>
  </div>

</section>
`

const PER_PAGE = 6

export async function init() {
  const list        = document.getElementById('opList')
  const filtersEl   = document.getElementById('opFilters')
  const filtersWrap = document.querySelector('.op-filters')
  const footerNote  = document.querySelector('.op-footer-note')
  const pagination  = document.getElementById('opPagination')
  const pageNums    = document.getElementById('opPageNumbers')
  const prevBtn     = document.getElementById('opPrev')
  const nextBtn     = document.getElementById('opNext')

  let jobs = []
  let filtered = []
  let currentPage = 1
  // Whether the current detail view was reached from the list in this
  // session (→ back link can use history.back) or via a direct link
  let cameFromList = false

  // Filters + pagination + "don't see a fit" only belong to the list view
  function setListChrome(visible) {
    ;[filtersWrap, footerNote].forEach(el => {
      if (!el) return
      el.style.display = visible ? '' : 'none'
      el.classList.remove('op-leaving')
    })
    if (!visible) pagination.style.display = 'none'
    pagination.classList.remove('op-leaving')
  }

  // Landing straight on a job URL: show the detail skeleton, not list rows
  if (slugFromPath()) {
    setListChrome(false)
    list.innerHTML = detailSkeleton()
  }

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

  filtered = [...jobs]

  // Build filter buttons from unique departments
  const depts = [...new Set(jobs.map(j => j.department).filter(Boolean))]
  if (depts.length && filtersEl) {
    filtersEl.innerHTML =
      `<button class="op-filter active" data-filter="all">All roles</button>` +
      depts.map(d => `<button class="op-filter" data-filter="${d}">${d}</button>`).join('')
  }

  function totalPages() { return Math.max(1, Math.ceil(filtered.length / PER_PAGE)) }

  // ── List view ──

  function renderPage(page) {
    currentPage = Math.min(Math.max(1, page), totalPages())
    const start = (currentPage - 1) * PER_PAGE
    const slice = filtered.slice(start, start + PER_PAGE)

    list.innerHTML = slice.length
      ? slice.map((job, i) => jobRow(job, i)).join('')
      : `<p style="padding:2rem 0;color:rgba(0,17,49,0.4)">No open positions in this category.</p>`

    // Plain click → SPA transition; modified clicks keep native link behavior
    list.querySelectorAll('.op-row[data-slug]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return
        e.preventDefault()
        const job = jobs.find(j => j.slug === row.dataset.slug)
        if (job) openJob(job, row)
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

  function showList() {
    exciteNavbar(false) // a hovered CTA can be removed without its mouseleave
    setListChrome(true)
    document.title = 'Open Positions – Tethr'
    renderPage(currentPage)
  }

  // ── Detail view ──

  function showDetail(job) {
    exciteNavbar(false)
    setListChrome(false)
    document.title = job ? `${job.title} – Tethr` : 'Position not found – Tethr'
    list.innerHTML = job ? detailHtml(job) : notFoundHtml()
    wireDetail()
  }

  function wireDetail() {
    list.querySelectorAll('[data-back]').forEach(link => {
      link.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return
        e.preventDefault()
        const detail = list.querySelector('.op-detail')
        if (detail) detail.classList.add('op-leaving')
        setTimeout(() => {
          if (cameFromList) {
            history.back() // popstate handler re-renders the list
          } else {
            history.pushState({}, '', '/positions')
            showList()
          }
        }, 240)
      })
    })

    // Hovering the page's apply CTA excites the navbar the same way its own
    // apply button does — chain speeds up, nav glows
    const applyBtn = list.querySelector('.op-detail__apply')
    applyBtn?.addEventListener('mouseenter', () => exciteNavbar(true))
    applyBtn?.addEventListener('mouseleave', () => exciteNavbar(false))

    // Refer a friend — copies the job's direct link to the clipboard
    const referBtn = list.querySelector('[data-refer]')
    referBtn?.addEventListener('click', async () => {
      const label = referBtn.querySelector('[data-refer-label]')

      try {
        await navigator.clipboard.writeText(window.location.href)
      } catch {
        // Clipboard API unavailable (http, old browser) — textarea fallback
        const ta = document.createElement('textarea')
        ta.value = window.location.href
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      }
      referBtn.classList.add('copied')
      label.textContent = 'Link copied'
      setTimeout(() => {
        referBtn.classList.remove('copied')
        label.textContent = 'Refer a friend'
      }, 2200)
    })
  }

  // List → detail: URL flips to the direct link, the other rows fade out
  // staggered while the clicked one lingers, then the detail view enters
  function openJob(job, clickedRow) {
    cameFromList = true
    history.pushState({}, '', `/positions/${job.slug}`)
    document.title = `${job.title} – Tethr`

    const rows = [...list.querySelectorAll('.op-row')]
    let maxDelay = 0
    rows.forEach((row, i) => {
      const delay = row === clickedRow ? rows.length * 30 + 100 : i * 30
      maxDelay = Math.max(maxDelay, delay)
      row.style.animationDelay = `${delay}ms`
      row.classList.add('op-leaving')
    })
    ;[filtersWrap, pagination, footerNote].forEach(el => el?.classList.add('op-leaving'))

    setTimeout(() => {
      showDetail(job)
      window.scrollTo({ top: 0, behavior: 'auto' })
    }, maxDelay + 240)
  }

  // ── Routing ──

  function route() {
    const slug = slugFromPath()
    if (slug) {
      showDetail(jobs.find(j => j.slug === slug))
    } else {
      showList()
    }
  }

  window.addEventListener('popstate', route)

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

  route()
}

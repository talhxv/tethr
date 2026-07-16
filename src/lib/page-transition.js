// Cross-page leave transition — links marked data-transition fade the page
// out (like the open-positions list does before a job detail) before the
// real navigation happens. Modified clicks keep native behavior.
export function wirePageLeave() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-transition]')
    if (!link) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return
    e.preventDefault()
    document.body.classList.add('page-leaving')
    setTimeout(() => { window.location.href = link.getAttribute('href') }, 260)
  })
}

// Content is injected via innerHTML after load, so the browser's native
// hash-scroll (which fires against the still-empty #app) never finds the
// target — this replaces it with a scroll that runs once the section
// actually exists, offset to clear the sticky navbar.
export function scrollToHash() {
  const hash = window.location.hash
  if (!hash) return
  let target
  try {
    target = document.querySelector(hash)
  } catch {
    return
  }
  if (!target) return

  const run = () => {
    requestAnimationFrame(() => {
      // .navbar-wrap sticks at top: 20px, so its rendered bottom edge (not
      // just its own height) is how far down the sticky nav actually
      // reaches — matches the 100px scroll-margin already used elsewhere
      const navbar = document.querySelector('.navbar-wrap')
      const offset = (navbar ? navbar.getBoundingClientRect().bottom : 0) + 16
      const top = target.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top, behavior: 'auto' })
    })
  }

  if (document.readyState === 'complete') run()
  else window.addEventListener('load', run, { once: true })
}

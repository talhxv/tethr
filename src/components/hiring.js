export const html = `
<div class="section-label section-label--spaced">
  <span class="section-label__num">02</span>
  <span class="section-label__line"></span>
  <span class="section-label__title">HIRING</span>
</div>
<div class="hiring-toggle-wrap">
  <div class="hiring-toggle" id="hiringToggle">
    <div class="hiring-toggle__pill"></div>
    <button class="hiring-toggle__btn hiring-toggle__btn--left active" data-side="left">talent</button>
    <button class="hiring-toggle__btn hiring-toggle__btn--right" data-side="right">your company</button>
  </div>
</div>
`

export function init() {
  const toggle = document.getElementById('hiringToggle')
  if (!toggle) return
  const pill = toggle.querySelector('.hiring-toggle__pill')
  const btns = toggle.querySelectorAll('.hiring-toggle__btn')

  toggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.hiring-toggle__btn')
    if (!btn || btn.classList.contains('active')) return
    btns.forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    pill.style.transform = btn.dataset.side === 'right' ? 'translateX(100%)' : 'translateX(0)'
  })
}

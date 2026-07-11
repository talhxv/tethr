// Dev: Vite proxy at /notion-api handles auth + CORS
// Prod: Vercel serverless function at /api/notion handles auth + CORS
const isDev = import.meta.env.DEV

function text(prop) {
  if (!prop) return ''
  if (prop.type === 'title')        return prop.title.map(t => t.plain_text).join('')
  if (prop.type === 'rich_text')    return prop.rich_text.map(t => t.plain_text).join('')
  if (prop.type === 'select')       return prop.select?.name ?? ''
  if (prop.type === 'multi_select') return prop.multi_select.map(s => s.name)
  if (prop.type === 'url')          return prop.url ?? ''
  return ''
}

// Description is one rich-text field carrying two things: a "Type · Comp"
// meta line and the actual blurb, e.g. "Full-Time · $500–$700/mo\nFront-line
// IT support...". Employment type already has its own reliable Notion
// select (mapped to `type` below), so only compensation gets pulled out of
// the free-text meta line — the rest becomes the plain blurb paragraph.
function parseDescription(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return { blurb: '', compensation: '' }

  const nl = value.indexOf('\n')
  const firstLine = (nl === -1 ? value : value.slice(0, nl)).trim()
  const dot = firstLine.indexOf('·') // ·

  if (dot === -1) return { blurb: value, compensation: '' }

  const compensation = firstLine.slice(dot + 1).trim()
  const blurb = nl === -1 ? '' : value.slice(nl + 1).trim()
  return { blurb, compensation }
}

function mapPage(page) {
  const p = page.properties
  const { blurb, compensation } = parseDescription(text(p['Description']))
  return {
    id:           page.id,
    title:        text(p['Position']),
    department:   text(p['Client']),
    type:         text(p['Employment Type']),
    location:     text(p['Location']),
    blurb,
    compensation,
    tags:         [],
    applyUrl:     '',
    status:       text(p['Status']),
  }
}

export async function fetchJobs() {
  const url = isDev
    ? `/notion-api/v1/databases/${import.meta.env.VITE_NOTION_DB_ID}/query`
    : '/api/notion'

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page_size: 50 }),
  })

  if (!res.ok) {
    console.error('Notion API error:', res.status, await res.text())
    return []
  }

  const data = await res.json()
  return data.results
    .filter(p => !p.archived)
    .map(mapPage)
    .filter(j => j.title)
}

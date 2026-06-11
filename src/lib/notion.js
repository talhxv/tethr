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

function mapPage(page) {
  const p = page.properties
  return {
    id:         page.id,
    title:      text(p['Position']),
    department: text(p['Client']),
    type:       text(p['Employment Type']),
    location:   text(p['Location']),
    blurb:      text(p['Description']),
    tags:       [],
    applyUrl:   '',
    status:     text(p['Status']),
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

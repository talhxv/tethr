const DB_ID = import.meta.env.VITE_NOTION_DB_ID

// In dev, requests go through the Vite proxy (which injects auth + handles CORS).
// In production, requests go directly to Notion with the token in the header.
const isDev = import.meta.env.DEV
const BASE   = isDev ? '/notion-api' : 'https://api.notion.com'
const TOKEN  = import.meta.env.VITE_NOTION_TOKEN

function headers() {
  const h = { 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' }
  if (!isDev) h['Authorization'] = `Bearer ${TOKEN}`
  return h
}

function text(prop) {
  if (!prop) return ''
  if (prop.type === 'title')       return prop.title.map(t => t.plain_text).join('')
  if (prop.type === 'rich_text')   return prop.rich_text.map(t => t.plain_text).join('')
  if (prop.type === 'select')      return prop.select?.name ?? ''
  if (prop.type === 'multi_select') return prop.multi_select.map(s => s.name)
  if (prop.type === 'url')         return prop.url ?? ''
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
    salary:     text(p['Priority']),
    blurb:      text(p['Description']),
    tags:       [],
    applyUrl:   '',
    status:     text(p['Status']),
  }
}

export async function fetchJobs() {
  const res = await fetch(`${BASE}/v1/databases/${DB_ID}/query`, {
    method: 'POST',
    headers: headers(),
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
    .filter(j => j.title) // skip empty rows
}

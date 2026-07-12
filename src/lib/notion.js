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

// Description mirrors the LinkedIn post layout, authored as one rich-text
// blob with literal "\n" sequences (typed as text, not real newlines):
//
//   Display Title|Tagline. Intro paragraph...\n\n
//   What you'll do:\n- bullet\n- bullet\n\n
//   What we need:\n- bullet\n- bullet\n\n
//   Note: optional note line\n
//   Pay: Consulting | $1,000-$1,500 | Remote
//
// The segment before "|" is the post's display title (the row already
// shows the Notion Position title, so it's dropped). The Pay line's
// segments split into compensation (the one with digits) and tags.
function parseDescription(raw) {
  const out = { tagline: '', blurb: '', doList: [], needList: [], note: '', compensation: '', tags: [] }

  const value = String(raw ?? '')
    .replace(/\\n/g, '\n')      // literal backslash-n -> real newline
    .replace(/[\\\s]+$/, '')    // stray trailing backslash from authoring
    .trim()
  if (!value) return out

  const headLines = []
  let section = 'head'

  for (const line of value.split('\n')) {
    const l = line.trim()
    if (!l) continue
    if (/^what you'?ll do:?$/i.test(l)) { section = 'do';   continue }
    if (/^what we need:?$/i.test(l))    { section = 'need'; continue }
    const noteM = l.match(/^note:\s*(.*)$/i)
    if (noteM) { out.note = noteM[1].trim(); continue }
    const payM = l.match(/^pay:\s*(.*)$/i)
    if (payM) {
      const segs = payM[1].split('|').map(s => s.trim()).filter(Boolean)
      out.compensation = segs.find(s => /\d/.test(s)) ?? ''
      out.tags = segs.filter(s => s !== out.compensation)
      continue
    }
    if (/^-/.test(l)) {
      const item = l.replace(/^-+\s*/, '')
      if (section === 'do') out.doList.push(item)
      else if (section === 'need') out.needList.push(item)
      continue
    }
    if (section === 'head') headLines.push(l)
  }

  let head = headLines.join(' ')
  const bar = head.indexOf('|')
  if (bar !== -1) head = head.slice(bar + 1).trim() // drop display title

  // Tagline = a short opening sentence ("Systems Built right."); anything
  // longer is just the start of the intro, not a tagline
  const m = head.match(/^(.{1,60}?[.!?])\s+([\s\S]*)$/)
  if (m) {
    out.tagline = m[1].trim()
    out.blurb = m[2].trim()
  } else {
    out.blurb = head
  }
  return out
}

// URL-safe slug for direct links: /positions/<slug>
function slugify(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function mapPage(page) {
  const p = page.properties
  const d = parseDescription(text(p['Description']))
  const type = text(p['Employment Type'])
  return {
    id:           page.id,
    title:        text(p['Position']),
    slug:         slugify(text(p['Position'])) || page.id,
    department:   text(p['Client']),
    type,
    // Every Tethr role is remote — default when the Notion select is unset
    location:     text(p['Location']) || 'Remote',
    tagline:      d.tagline,
    blurb:        d.blurb,
    doList:       d.doList,
    needList:     d.needList,
    note:         d.note,
    compensation: d.compensation,
    // The title-row pill already states the employment type — drop tags
    // that just repeat it
    tags:         d.tags.filter(t => t.toLowerCase() !== type.toLowerCase()),
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
    .filter(j => j.title && j.status.toLowerCase() === 'open')
}

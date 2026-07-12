// Serves /positions/<slug> (rewritten here by vercel.json) with the job's
// title, description, Open Graph tags, and JobPosting JSON-LD baked into the
// raw HTML — social crawlers (LinkedIn, X, WhatsApp) don't run JavaScript,
// so client-side rendering alone would give every shared job link the
// generic positions-page preview. The SPA in positions.html then takes over
// in the browser exactly as before.

const SITE = 'https://tethrhq.com'

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function text(prop) {
  if (!prop) return ''
  if (prop.type === 'title')     return prop.title.map(t => t.plain_text).join('')
  if (prop.type === 'rich_text') return prop.rich_text.map(t => t.plain_text).join('')
  if (prop.type === 'select')    return prop.select?.name ?? ''
  return ''
}

// Must match src/lib/notion.js so links and server-rendered meta agree
function slugify(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// The Description blob is authored with literal "\n" sequences; the head
// section (before "What you'll do:") minus the "Title|" prefix is the blurb
function cleanDescription(raw) {
  let value = String(raw ?? '').replace(/\\n/g, '\n').replace(/[\\\s]+$/, '').trim()
  // Drop the authoring-format "Display Title|" prefix
  const bar = value.indexOf('|')
  if (bar !== -1 && bar < 80) value = value.slice(bar + 1).trim()
  const head = value.split(/what you'?ll do:?/i)[0]
  return { blurb: head.replace(/\s+/g, ' ').trim(), full: value }
}

function truncate(s, max = 155) {
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  return cut.slice(0, cut.lastIndexOf(' ')) + '…'
}

// schema.org employmentType from the Notion select's wording
function employmentType(type) {
  const t = String(type).toLowerCase()
  if (t.includes('full'))    return 'FULL_TIME'
  if (t.includes('part'))    return 'PART_TIME'
  if (t.includes('intern'))  return 'INTERN'
  if (t.includes('contract') || t.includes('consult') || t.includes('project') || t.includes('hourly'))
    return 'CONTRACTOR'
  return undefined
}

function metaBlock({ title, description, url, robots }) {
  return `<title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    ${robots ? `<meta name="robots" content="${robots}" />` : `<link rel="canonical" href="${esc(url)}" />`}
    <meta property="og:site_name" content="Tethr" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:image" content="${SITE}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${SITE}/og.png" />`
}

export default async function handler(req, res) {
  const slug = String(req.query?.slug ?? '')

  // The built positions.html shell, fetched from this same deployment
  const proto = req.headers['x-forwarded-proto'] ?? 'https'
  const host  = req.headers['x-forwarded-host'] ?? req.headers.host
  const shellRes = await fetch(`${proto}://${host}/positions.html`)
  if (!shellRes.ok) return res.status(500).send('Shell unavailable')
  let html = await shellRes.text()

  let job = null
  const token = process.env.VITE_NOTION_TOKEN
  const dbId  = process.env.VITE_NOTION_DB_ID
  if (token && dbId && slug) {
    try {
      const notion = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ page_size: 100 }),
      })
      const data = await notion.json()
      job = (data.results ?? [])
        .filter(p => !p.archived)
        .map(p => ({
          created:     p.created_time,
          title:       text(p.properties['Position']),
          type:        text(p.properties['Employment Type']),
          location:    text(p.properties['Location']) || 'Remote',
          status:      text(p.properties['Status']),
          description: cleanDescription(text(p.properties['Description'])),
        }))
        .find(j => slugify(j.title) === slug && j.status.toLowerCase() === 'open') ?? null
    } catch {
      // Notion unreachable — fall through to the generic shell; the SPA
      // will render its own state client-side
    }
  }

  const seoRe = /<!-- seo -->[\s\S]*?<!-- \/seo -->/

  if (job) {
    const url  = `${SITE}/positions/${slug}`
    const meta = metaBlock({
      title:       `${job.title} – Tethr`,
      description: truncate(job.description.blurb || `${job.title} at Tethr — remote role, apply directly.`),
      url,
    })

    const jsonLd = {
      '@context': 'https://schema.org/',
      '@type': 'JobPosting',
      title: job.title,
      description: `<p>${esc(job.description.full).replace(/\n/g, '<br>')}</p>`,
      datePosted: job.created,
      employmentType: employmentType(job.type),
      jobLocationType: 'TELECOMMUTE',
      hiringOrganization: {
        '@type': 'Organization',
        name: 'Tethr',
        sameAs: SITE,
        logo: `${SITE}/og.png`,
      },
      directApply: true,
    }
    if (!jsonLd.employmentType) delete jsonLd.employmentType

    html = html
      .replace(seoRe, `<!-- seo -->${meta}<!-- /seo -->`)
      .replace('</head>', `<script type="application/ld+json">${
        JSON.stringify(jsonLd).replace(/</g, '\\u003c')
      }</script></head>`)
    res.statusCode = 200
  } else if (slug) {
    // Filled/unknown role: the SPA shows its closed-position page; tell
    // crawlers this URL is gone so stale shares drop out of indexes
    html = html.replace(seoRe, `<!-- seo -->${metaBlock({
      title:       'Position not found – Tethr',
      description: 'This role isn’t open right now. Browse the positions we’re still hiring for.',
      url:         `${SITE}/positions`,
      robots:      'noindex',
    })}<!-- /seo -->`)
    res.statusCode = 404
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400')
  res.send(html)
}

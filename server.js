// Production server for the Docker/VPS deployment. Replaces what Vercel
// provides for free: static file serving, the /api/notion proxy, the
// /positions/:slug SEO-injection route, and the clean-URL rewrites that
// vercel.json + vite.config.js's dev middleware handle elsewhere.
import express from 'express'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import crypto from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, 'dist')
const SITE = process.env.SITE_URL ?? 'https://tethrhq.com'
const PORT = process.env.PORT ?? 3000

const app = express()
// Keep the raw body around for Tally's webhook signature check — HMAC has to
// run over the exact bytes Tally signed, not a re-serialized JSON.stringify
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf } }))
app.disable('x-powered-by')

// ---- /api/notion ---------------------------------------------------------
app.post('/api/notion', async (req, res) => {
  const token = process.env.VITE_NOTION_TOKEN
  const dbId = process.env.VITE_NOTION_DB_ID

  if (!token || !dbId) {
    return res.status(500).json({ error: 'Notion credentials not configured' })
  }

  try {
    const notion = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body ?? { page_size: 50 }),
    })

    const data = await notion.json()
    res.status(notion.status).json(data)
  } catch {
    res.status(500).json({ error: 'Failed to reach Notion API' })
  }
})

// ---- /api/applications/webhook ---------------------------------------------
// Fired by a Tally webhook (configured separately from the native Notion
// integration, which still creates the submission row itself, resume upload
// and all). The JD text lives only in the Job Openings DB — this resolves it
// by title-matching the submitted "position" value, then writes it onto the
// matching Submissions row's "Job Description" property.
//
// The webhook and Tally's own Notion write are two independent deliveries —
// neither is guaranteed to land first — so the row this writes to is found
// by "Submission ID" (map Tally's built-in Submission ID to that property in
// the Notion integration setup), retried a few times in case the webhook
// beats Tally's own write to Notion.
const NOTION_HEADERS = (token) => ({
  Authorization: `Bearer ${token}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
})

function verifyTallySignature(req) {
  const secret = process.env.TALLY_WEBHOOK_SECRET
  if (!secret) return true // no secret configured — skip (e.g. local testing)

  const signature = req.get('Tally-Signature')
  if (!signature || !req.rawBody) return false

  const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('base64')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

async function fetchJobOpenings() {
  const token = process.env.VITE_NOTION_TOKEN
  const dbId = process.env.VITE_NOTION_DB_ID

  const notion = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: 'POST',
    headers: NOTION_HEADERS(token),
    body: JSON.stringify({ page_size: 100 }),
  })
  const data = await notion.json()
  return (data.results ?? [])
    .filter((p) => !p.archived)
    .map((p) => ({
      title: text(p.properties['Position']),
      description: text(p.properties['Description']),
    }))
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Retries because the webhook can arrive before Tally's own Notion write
// finishes creating the row it needs to find
async function findSubmissionPage(submissionId, { attempts = 5, delayMs = 2000 } = {}) {
  const token = process.env.VITE_NOTION_TOKEN
  const dbId = process.env.VITE_NOTION_APPLICATIONS_DB_ID

  for (let i = 0; i < attempts; i++) {
    const notion = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: NOTION_HEADERS(token),
      body: JSON.stringify({
        filter: { property: 'Submission ID', rich_text: { equals: submissionId } },
      }),
    })
    if (!notion.ok) {
      throw new Error(`Notion query failed (${notion.status}): ${await notion.text()}`)
    }
    const data = await notion.json()
    if (data.results?.[0]) return data.results[0]
    if (i < attempts - 1) await sleep(delayMs)
  }
  return null
}

// Notion caps a single rich_text object at 2000 characters
function toRichText(value) {
  const chunks = []
  for (let i = 0; i < value.length; i += 2000) chunks.push(value.slice(i, i + 2000))
  return chunks.map((content) => ({ text: { content } }))
}

async function writeJobDescription(pageId, jd) {
  const token = process.env.VITE_NOTION_TOKEN
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: NOTION_HEADERS(token),
    body: JSON.stringify({ properties: { 'Job Description': { rich_text: toRichText(jd) } } }),
  })
  if (!res.ok) {
    throw new Error(`Notion PATCH failed (${res.status}): ${await res.text()}`)
  }
}

async function resolveAndWriteJd({ position, submissionId }) {
  const jobs = await fetchJobOpenings()
  const jd = jobs.find((j) => j.title === position)?.description ?? ''
  if (!jd) {
    console.log('No JD match for position', JSON.stringify(position))
    return
  }

  const page = await findSubmissionPage(submissionId)
  if (!page) {
    console.error('Submission row never appeared for Submission ID', submissionId)
    return
  }

  await writeJobDescription(page.id, jd)
  console.log('Wrote JD to submission', submissionId, 'for position', JSON.stringify(position))
}

app.post('/api/applications/webhook', (req, res) => {
  if (!verifyTallySignature(req)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const fields = req.body?.data?.fields ?? []
  const position = fields.find((f) => f.label?.toLowerCase() === 'position')?.value
  const submissionId = req.body?.data?.submissionId

  // Ack Tally immediately — the Notion lookup/retry loop runs after the
  // response so Tally isn't kept waiting on it
  res.status(200).json({ received: true })

  if (!position || !submissionId) return
  resolveAndWriteJd({ position, submissionId }).catch((err) =>
    console.error('Failed to resolve/write JD:', err),
  )
})

// ---- /positions/:slug -----------------------------------------------------
const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function text(prop) {
  if (!prop) return ''
  if (prop.type === 'title') return prop.title.map((t) => t.plain_text).join('')
  if (prop.type === 'rich_text') return prop.rich_text.map((t) => t.plain_text).join('')
  if (prop.type === 'select') return prop.select?.name ?? ''
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

function employmentType(type) {
  const t = String(type).toLowerCase()
  if (t.includes('full')) return 'FULL_TIME'
  if (t.includes('part')) return 'PART_TIME'
  if (t.includes('intern')) return 'INTERN'
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

app.get('/positions/:slug', async (req, res, next) => {
  const slug = req.params.slug

  let html
  try {
    html = await readFile(path.join(DIST, 'positions.html'), 'utf8')
  } catch {
    return next()
  }

  let job = null
  const token = process.env.VITE_NOTION_TOKEN
  const dbId = process.env.VITE_NOTION_DB_ID
  if (token && dbId && slug) {
    try {
      const notion = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ page_size: 100 }),
      })
      const data = await notion.json()
      job = (data.results ?? [])
        .filter((p) => !p.archived)
        .map((p) => ({
          created: p.created_time,
          title: text(p.properties['Position']),
          type: text(p.properties['Employment Type']),
          location: text(p.properties['Location']) || 'Remote',
          status: text(p.properties['Status']),
          description: cleanDescription(text(p.properties['Description'])),
        }))
        .find((j) => slugify(j.title) === slug && j.status.toLowerCase() === 'open') ?? null
    } catch {
      // Notion unreachable — fall through to the generic shell; the SPA
      // will render its own state client-side
    }
  }

  const seoRe = /<!-- seo -->[\s\S]*?<!-- \/seo -->/
  let status = 200

  if (job) {
    const url = `${SITE}/positions/${slug}`
    const meta = metaBlock({
      title: `${job.title} – Tethr`,
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
  } else if (slug) {
    html = html.replace(
      seoRe,
      `<!-- seo -->${metaBlock({
        title: 'Position not found – Tethr',
        description: 'This role isn’t open right now. Browse the positions we’re still hiring for.',
        url: `${SITE}/positions`,
        robots: 'noindex',
      })}<!-- /seo -->`,
    )
    status = 404
  }

  res.status(status)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400')
  res.send(html)
})

// ---- clean URLs + static assets -------------------------------------------
app.get('/positions', (_req, res) => res.sendFile(path.join(DIST, 'positions.html')))
app.get('/apply', (_req, res) => res.sendFile(path.join(DIST, 'apply.html')))

app.use(express.static(DIST, { extensions: ['html'] }))

app.use((_req, res) => {
  res.status(404).sendFile(path.join(DIST, '404.html'))
})

app.listen(PORT, () => {
  console.log(`Listening on :${PORT}`)
})

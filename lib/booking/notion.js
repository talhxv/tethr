// The leads database in Notion. Property names here must match the schema in
// booking-setup.md (and scripts/create-leads-db.mjs, which creates it).
import { notionConfig } from './config.js'

const API = 'https://api.notion.com/v1'

export const STATUS_NEW = 'New'
export const STATUS_BOOKED = 'Call booked'

const bare = (id) => String(id ?? '').replace(/-/g, '').toLowerCase()

// Notion ids arrive from the browser — check the shape before one goes in a URL
export const isNotionId = (id) => typeof id === 'string' && /^[0-9a-f]{32}$/.test(bare(id))

async function notion(path, { method = 'GET', body } = {}) {
  const cfg = notionConfig()
  if (!cfg) throw new Error('Notion is not configured: set NOTION_TOKEN (or VITE_NOTION_TOKEN) and NOTION_LEADS_DB_ID')

  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(`Notion ${method} ${path.split('/')[1]} failed (${res.status} ${data.code ?? ''}): ${data.message ?? ''}`)
    err.status = res.status
    throw err
  }
  return data
}

const rich = (value) => ({ rich_text: [{ text: { content: value } }] })
// Select option names can't contain commas
const select = (value) => ({ select: { name: value.replace(/,/g, ' ') } })
const plain = (prop) => (prop?.rich_text ?? prop?.title ?? []).map((t) => t.plain_text).join('')

// -> the new page's id
export async function createLead(lead) {
  const page = await notion('/pages', {
    method: 'POST',
    body: {
      parent: { database_id: notionConfig().leadsDbId },
      properties: {
        'Name':             { title: [{ text: { content: lead.name } }] },
        'Position / Title': rich(lead.title),
        'Company':          rich(lead.company),
        'Email':            { email: lead.email },
        'Challenge':        select(lead.challenge),
        'Headcount':        select(lead.headcount),
        'Timeline':         select(lead.timeline),
        'Status':           select(STATUS_NEW),
      },
    },
  })
  return page.id
}

// -> { id, url, name, company, title, email, booked } or null when the id isn't a
// live row of the leads database
export async function getLead(id) {
  let page
  try {
    page = await notion(`/pages/${bare(id)}`)
  } catch (err) {
    if (err.status === 404 || err.status === 400) return null
    throw err
  }
  if (page.archived || page.in_trash) return null
  if (bare(page.parent?.database_id) !== bare(notionConfig().leadsDbId)) return null

  const p = page.properties ?? {}
  return {
    id: page.id,
    url: page.url,
    name: plain(p['Name']),
    title: plain(p['Position / Title']),
    company: plain(p['Company']),
    email: p['Email']?.email ?? '',
    booked: p['Status']?.select?.name === STATUS_BOOKED || !!p['Call time']?.date,
  }
}

export async function markBooked(id, { start, end, meetLink, eventId }) {
  await notion(`/pages/${bare(id)}`, {
    method: 'PATCH',
    body: {
      properties: {
        'Status':            select(STATUS_BOOKED),
        'Call time':         { date: { start, end } },
        'Meeting link':      { url: meetLink || null },
        'Calendar event ID': rich(eventId),
      },
    },
  })
}

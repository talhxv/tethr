// Creates the Book a Call leads database in Notion and prints its id.
//
//   NOTION_TOKEN=secret_xxx node scripts/create-leads-db.mjs <parent-page-id>
//
// The parent page must already be shared with the integration whose token
// this is (page menu -> Connections). Put the printed id in NOTION_LEADS_DB_ID.
// The schema is the one lib/booking/notion.js reads and writes; see
// booking-setup.md.

const token = process.env.NOTION_TOKEN || process.env.VITE_NOTION_TOKEN
const parent = (process.argv[2] ?? '').replace(/-/g, '')

if (!token || !/^[0-9a-f]{32}$/i.test(parent)) {
  console.error('Usage: NOTION_TOKEN=... node scripts/create-leads-db.mjs <parent-page-id>')
  process.exit(1)
}

const options = (...names) => ({ select: { options: names.map((name) => ({ name })) } })

const res = await fetch('https://api.notion.com/v1/databases', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    parent: { type: 'page_id', page_id: parent },
    title: [{ text: { content: 'Book a Call Leads' } }],
    properties: {
      'Name':              { title: {} },
      'Position / Title':  { rich_text: {} },
      'Company':           { rich_text: {} },
      'Email':             { email: {} },
      // Options are added as leads arrive, from whatever the form offers
      'Challenge':         { select: {} },
      'Headcount':         options('1', '2-5', '6-10', '10+'),
      'Timeline':          options('ASAP', '<1 month', 'Not Defined'),
      'Status':            options('New', 'Call booked'),
      'Call time':         { date: {} },
      'Meeting link':      { url: {} },
      'Calendar event ID': { rich_text: {} },
      'Submitted':         { created_time: {} },
    },
  }),
})

const data = await res.json().catch(() => ({}))
if (!res.ok) {
  console.error(`Notion refused (${res.status} ${data.code ?? ''}): ${data.message ?? ''}`)
  process.exit(1)
}

console.log(`Created "Book a Call Leads": ${data.url}`)
console.log(`NOTION_LEADS_DB_ID=${data.id}`)

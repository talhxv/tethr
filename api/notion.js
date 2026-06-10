export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token  = process.env.VITE_NOTION_TOKEN
  const dbId   = process.env.VITE_NOTION_DB_ID

  if (!token || !dbId) {
    return res.status(500).json({ error: 'Notion credentials not configured' })
  }

  try {
    const notion = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body ?? { page_size: 50 }),
    })

    const data = await notion.json()
    res.status(notion.status).json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to reach Notion API' })
  }
}

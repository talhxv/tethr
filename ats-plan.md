# Tethr ATS — Application Flow (Tally + Notion)

Apply button → **Tally** form (role pre-filled) → Tally's native Notion
integration writes a row → team triages on a Notion board.

No custom backend, no serverless function. Tally hosts the form, handles the
resume upload + spam protection, and syncs each submission into Notion.

---

## Architecture

```
Open Positions (site)
   │ click "Apply for this role"
   ▼
Tally form (full page, new tab — hidden field "position" pre-filled)
   │ candidate submits (name, email, …, resume file)
   ▼
Tally → Notion integration  → new row in Applications DB (Status = "New")
   ▼
Notion board (grouped by Status): read answers, open resume link, drag status
```

---

## 1. Build the form in Tally

Create a form at [tally.so] with these fields:

| Field | Tally type | Notes |
|---|---|---|
| Full name | Short text | required |
| Email | Email | required |
| Phone | Phone | optional |
| LinkedIn / Portfolio | URL | optional |
| Years of experience | Short text / number | |
| Why this role | Long text | |
| Resume / CV | **File upload** | required; restrict to PDF/DOC |
| Position | **Hidden field** | query-param key = `position` (auto-filled per role) |

**Branding (minimal Tally look + Tethr touch):**
- Form settings → Theme: set the accent/button color to the CTA blue **`#0755E9`** (or `#2B44FF`).
- Add the **tethr logo** as the form's cover/logo image.
- Keep Tally's default clean layout otherwise.

## 2. Connect Tally → Notion

- In the form's **Integrations → Notion**, connect your workspace and pick the
  **Applications** database.
- Map each field to a Notion property. Map the **Position** hidden field to a
  `Position` text/select property.
- Set the `Status` property's default to **New** (or add a Notion default).
- The resume arrives in Notion as a **link** to the Tally-hosted file (one
  click to view) — not a native attachment.

## 3. Drop the form id into the site

In `src/components/open-positions.js`:

```js
const TALLY_FORM_ID = 'YOUR_FORM_ID' // the part after /r/ in the form URL
```

The Apply links already open the **full-page** Tally form in a new tab, with the
role pre-filled via the `?position=` query param (which maps to the form's
hidden `position` field).

The same `TALLY_FORM_URL` can be reused for the navbar/CTA "Apply" buttons.

## 4. Team workflow (Notion — unchanged)

- Board view grouped by **Status**: New → Screening → Interview → Offer → Hired
  / Rejected.
- Open a card to read all answers; click the **resume link** to view the CV.
- Drag the card between columns to change status.

---

## Trade-offs vs a custom build
- **Resume** is a Tally-hosted link in Notion, not a native Notion attachment
  (candidate PII lives on Tally).
- **Branding** is Tally's clean look tinted with the CTA blue + logo — not the
  full `design.md` language. Removing the "Made with Tally" badge / custom
  domain needs Tally Pro.
- In exchange: zero backend, built-in file handling + spam protection, and a
  form you can edit without redeploying.

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




##### COPPYY #######


# Tethr — Business Model Canvas

*Synthesized from the four-founder workshop and the Fork A/B/C decisions. Built on the corrected economic model (see note below).*

---

## Model note: this is a managed-services fee model, not a labour-markup model

Placed-talent salaries are a **reimbursed pass-through**, not Tethr's margin. The arbitrage saving accrues to the **client**; Tethr's revenue is the **management fee** (per-employee-per-month retainer), and its real cost is **internal Tethr payroll**. This sharpens the value proposition away from "we're cheap labour" toward *"the offshore team you don't have to build or manage — savings passed to you, burden taken off you."*

---

## The nine blocks

### Customer segments *(core)*
- **Beachhead:** early-stage startups earning in a strong currency — need quality delivery at low cost, without building their own HR/ops function.
- **Phase 2:** SMEs (same logic, larger teams, higher retainer volume).
- **Defining condition:** the customer is a strong-currency earner who wants cheaper, managed delivery. Size (startup → SME) is the *sequencing* axis, not the definition.

### Value proposition *(core)*
- **Fully-managed offshore talent at local-market cost** — vetted, onboarded, paid, compliant, offboarded — for a predictable per-head fee.
- We carry the employer burden (recruitment, payroll, compliance, IP/asset transfer, lifecycle); the cost savings stay with the client.
- Faster to market — no HR/ops build, less decision fatigue.
- Transparent, predictable pricing.
- Full visibility and control through the HRMS (also available standalone).

### Channels
*Client-facing only — talent sourcing lives under Key activities.*
- **Reach:** warm/cold outreach, LinkedIn, founder-led branding, website, PR, Apollo (data aggregator), freelancing/bidding platforms, tenders, private pipeline, Reddit/blogs/communities, conventions & expos.
- **Trust:** Trustpilot, Clutch.
- **Communicate / serve:** Slack, the Tethr platform.
- **Deliver value:** HRMS + CRM.

### Customer relationships
*Why clients stay.*
- HRMS self-serve visibility and communication (the product is the relationship).
- Transparent HCM + CRM reporting.
- Quarterly business reviews + newsletter.
- Guided HR advisory / consultancy sessions.
- High-touch: Slack, physical meetings, invitations to Pakistan for key clients.
- Upsell / cross-sell as the relationship deepens.

### Revenue streams *(core)*
- **Managed services (EOR):** monthly retainer / subscription, **per employee per month** — the recurring core.
- **Project-based delivery:** per-project fee, scoped.
- **HRMS subscription:** standalone SaaS — *pricing to be decided* (bundled free with managed services).
- *Placed-talent salaries pass through and are reimbursed — not a Tethr revenue line.*

### Key resources
*The block the team was already aligned on.*
- Human capital: the internal Tethr team + the vetted talent community/pool.
- The Tethr HRMS / platform.
- SOPs and the managed-services playbook.
- Tools and technology subscriptions.

### Key activities
- **Talent acquisition & pool development:** sourcing (job boards — Indeed, Monster, rozee, Wellfound, Glassdoor, HN; academia; community), JD writing, interviewing, shortlisting, vetting.
- **Managed-services delivery / lifecycle management:** onboarding, contracts, IP/asset transfer, payroll, leave & task management, insurance, offboarding (handover, access revoke).
- **Client acquisition & outreach** (sales, marketing material, founder branding).
- **Process creation, optimisation & auditing** — the backbone of quality-at-low-cost.
- **HRMS / platform development & maintenance.**

### Key partnerships
*Clients removed — partners help us deliver or scale, they don't pay us.*
- **Talent supply:** academia, accelerators, community organizers.
- **Compliance / domain expertise:** legal, tax & accounting partners.
- **Infrastructure:** local asset vendors, co-working spaces.
- **Employee benefits providers:** insurance, banks, gyms, lifestyle/benefits.
- **Go-to-market:** PR agencies, sales-partner program. *(TMF — pending definition.)*

### Cost structure
- **Largest cost:** internal Tethr team payroll (recruitment, delivery, ops, platform).
- Tools & technology subscriptions.
- Sales, marketing & scaling cost.
- Office / co-working expense.
- HRMS (platform) development & maintenance.
- *Placed-talent salaries = pass-through, reimbursed by clients — net-neutral, not a core cost.*

---

## Open items before this is "bulletproof"

1. **Gross margin per seat — not yet calculated.** Since talent is pass-through, margin = (fee per employee/month − internal cost to service that seat) ÷ fee, where internal cost per seat ≈ (internal payroll + tools + overhead) ÷ seats under management. Margin is therefore driven by **operational leverage** — seats managed per internal head. The startup "minimal pricing" tier only holds if this ratio is high.
2. **HRMS standalone pricing — undecided.** Acceptable to defer for v1, but flag as a deliberate "later," not a gap.
3. **Three classifications to confirm:** (a) freelancing platforms — client acquisition or talent sourcing; (b) what "TMF" is; (c) "professional outlook / powerful UX" — placed under Relationships, also works as a VP hook.

---

## Resolved forks (decision log)

- **Who first:** startups → SMEs, by size, all qualified by the strong-currency condition.
- **Not a sub-supplier to EORs** — Tethr is the managed-services / EOR provider directly.
- **Academia** is a talent-supply *partner*, not a paying customer segment.
- **Primary offering:** Managed Services (EOR) is the hero; project-based delivery and HRMS are attach-ons.
- **HRMS role:** bundled delivery/retention infrastructure for every managed-services client, *and* an optional standalone product.
- **"Deeper services / modules":** out of scope for v1.

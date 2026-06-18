# Tethr — Brand & Design System

A single reference for Tethr's brand identity, pulled from the live site. Use this to keep social posts, decks, and new pages on-brand.

> **Tagline:** For Talent. By Talent.
> **One-liner:** We tethr ambition to outcomes — one invoice, one partner, your team fully managed.

---

## 1. Brand Idea

Tethr connects US teams to vetted Pakistani talent and manages the entire employee lifecycle under **one partner, one invoice, zero HR overhead**.

The whole visual language is built on one metaphor: **the chain link**. Scattered/broken links = the broken status quo. Fully linked chains = Tethr's managed solution. Lean on this metaphor in any new creative.

**Voice:** confident, plain-spoken, declarative. Short sentences. Often a problem framed bluntly, then a calm resolution.
- "Great talent exists in Pakistan. Getting to it is broken."
- "One partner. Everything handled."
- "Rooted in Pakistan. Built for US teams."
- "Let's tethr something real."

Note the lowercase verb **tethr** used inline as a word ("We *tethr* ambition to outcomes"). Keep it lowercase and treat it as a verb.

---

## 2. Color Palette

### Core blues (the brand)
| Token | Hex | Use |
|---|---|---|
| **Primary blue** | `#2B44FF` | Buttons, CTAs, links, pills, active states, accents |
| **Royal / electric blue** | `#0755E9` | Hero accent, italic emphasis words, glows, grid lines, section rules |
| **Primary hover** | `#1a33ee` | Navbar apply hover |
| **Deep blue hover** | `#0340c4` | CTA primary button hover |

### Navy (text & dark surfaces)
| Token | Hex | Use |
|---|---|---|
| **Footer navy** | `#001B4D` | Footer background, services titles |
| **Ink navy** | `#001131` | Primary headlines, dark text |
| **Near-black** | `#08060d` | Hero headline text |
| **Toggle navy** | `#0d1f4a` | Hiring toggle track |

### Light surfaces & tints
| Token | Hex | Use |
|---|---|---|
| **White** | `#ffffff` | Page background, CTA card |
| **Card light blue** | `#F1F5FD` | Service cards, manifesto frame |
| **Pale blue** | `#E7EFFF` | Mobile menu / mobile navbar background |
| **Glass white** | `rgba(255,255,255,0.72)` | Navbar blur backdrop |

### Status accents (manifesto narrative only)
| Meaning | Hex |
|---|---|
| Problem (red) | `#e03131` |
| Solution (green) | `#12b76a` |
| Tethr (blue) | `#0755E9` |

### Common transparencies
- Text on navy: `rgba(255,255,255,0.88)` body, `0.5`/`0.4` muted
- Text on light: `rgba(0,17,49,0.5)` muted, `0.4`/`0.35` faint
- Borders on light: `rgba(0,17,49,0.08–0.12)`
- Blue glow fill: `rgba(7,85,233,0.55 → 0.08)` radial fades

---

## 3. Typography

### Font families
| Role | Font | Weights used |
|---|---|---|
| **Headings & UI (primary)** | **Manrope** | 400, 500, 600, 700, 800, 900 |
| **Body / secondary** | DM Sans | 400, 500, 700 (incl. italic) |
| **Editorial accent** | Instrument Serif (italic) | 400 italic — used for the word *tethr* in the CTA |
| **Labels / eyebrows / code** | Consolas / monospace | section numbers, eyebrows, technical labels |

> Manrope is the workhorse — use it for nearly all headlines, buttons, and nav. Reach for Instrument Serif italic only for the signature *tethr* flourish.

### Type treatments
- **Big headlines:** Manrope, weight 400–800, tight negative tracking. Display sizes use `letter-spacing: -1px to -2.5px`.
  - Hero / CTA: `clamp(40px, 5.5vw, 72px)`, `letter-spacing: -2.5px`
  - Open-positions hero: up to `72px`, weight 800, `-2px`
- **Section headlines:** ~`clamp(26px, 3vw, 46px)`, weight 400 with `<strong>` 600/700 for emphasis.
- **Emphasis word:** italic + skew + royal blue. e.g. `font-style: italic; transform: skewX(-10deg); color: #0755E9; font-weight: 800`.
- **Eyebrows / section labels:** monospace, `12–13px`, `letter-spacing: 0.08–0.18em`, uppercase, often muted.
- **Body:** Manrope `15–20px`, line-height `1.55–1.7`.
- **Tags / kicker labels:** Manrope, `10–13px`, weight 600–700, uppercase, `letter-spacing: 1.5–2px`.

---

## 4. Signature Visual Motifs

**The chain link** is the core brand asset. Variants in `src/assets/`:
- Single link, double link, full linked chain (blue vector versions)
- Outlined hero chain, navbar chain link
- Scattered links (broken) → doubly-linked → fully-linked (solution narrative)

Other recurring elements:
- **Swirl / spiral component** (`swirlcomponent.svg`) — abstract energy art behind cards & CTA, often blurred/low-opacity navy or white.
- **Glass sphere** — liquid-glass orb with refraction, used as a premium accent on service cards.
- **Radial blue glow** — `radial-gradient` of `#0755E9` fading to transparent. The site's signature light source (hero, CTA, footer).
- **Grid overlay** — `#0755E9` 1.5px lines on 64px squares, radially masked, behind the hero.
- **Chain-link tile pattern** — faint 5%-opacity links tiled across the hero zone background.
- **Earth / globe** (`tethrearth.svg`) — "remote first / global" cue, used in footer + software card.

---

## 5. Components & UI Language

### Buttons / CTAs
- **Primary:** `#2B44FF` bg, white text, `border-radius: 999px` (full pill), padding `14–16px × 28–36px`, Manrope 700. Hover: darken + `translateY(-1px)`. Often paired with a small arrow icon.
- **CTA primary (alt):** `#0755E9` bg with `2.5px` solid border.
- **Secondary:** transparent, navy text, `2.5px` border `rgba(0,17,49,0.22)`; hover fills blue.
- **Pills / tags:** fully rounded, `13–15px`, outline or filled; outline = `1.5px` border, filled = solid.

### Cards
- Service cards: `#F1F5FD` bg, `border-radius: 48px`, hover → fills `#2B44FF` (art fades/blurs, pills reveal).
- CTA card: white, `border-radius: 28px`, subtle blue border, central blue glow from bottom.

### Section labels
- Format: `[02]` mono number (45% opacity) + a **64px-wide, 3px-thick `#0755E9` rule** + uppercase title.
- The 64px / 3px blue divider is the standard section rule — reuse it as a divider element in any layout.

### Navbar
- Floating, sticky, pill-shaped (`border-radius: 44px`), translucent white with `backdrop-filter: blur(16px)`.
- Mobile: solid `#E7EFFF` bar with blue-tinted border; full-screen circular-reveal menu.

### Footer
- Deep navy `#001B4D`, white text, large chain/wordmark art, live UTC clock, "remote first" + "© 2026 Tethr, pvt ltd".

### Radii cheat-sheet
- Pills / buttons: `999px`
- Service cards: `48px`
- CTA card: `28px`
- Navbar: `44px`
- Manifesto frame / banners: `16–20px`
- Small chips / code: `4–8px`

---

## 6. Motion

- **Eases:** `cubic-bezier(0.4, 0, 0.2, 1)` (standard), `ease` for simple states.
- **Durations:** `0.18–0.35s` for UI states; longer scroll-driven sequences (GSAP) for the manifesto and hiring stacks.
- **Hover signature:** subtle `translateY(-1px)` lift + color deepen on buttons.
- **Hero word rotator:** the line "Company that *connects.*" cycles through: connects, nurtures, performs, delivers, empowers, scales — slot-machine vertical slide.
- **CTA "tubelight"** flicker animation on the blue swirl when hovering buttons.

---

## 7. Quick Reference for New Posts

When making a social post or new creative, default to:
- **Background:** white or `#001B4D` navy. Add a `#0755E9` radial glow for depth.
- **Headline:** Manrope, tight negative tracking, one bold idea. Use `<strong>` or color to emphasize the key phrase.
- **Accent word:** italic Instrument Serif or skewed italic `#0755E9` — ideally the word *tethr* or a verb.
- **Primary color:** `#2B44FF` for any button/CTA/highlight.
- **Motif:** include a chain link (broken → linked tells the whole story).
- **Voice:** state the problem plainly, then resolve it. Short. Confident. Lowercase *tethr* as a verb.
- **Footer cue:** "For Talent. By Talent." · "remote first"

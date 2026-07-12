# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # Start Vite dev server with HMR
pnpm build      # Production build to dist/
pnpm preview    # Serve production build locally
```

No test runner, linter, or type checker is configured.

## Architecture

Vanilla JavaScript + Vite, no framework. ES Modules throughout (`"type": "module"` in package.json).

**Entry flow:** `index.html` → `src/main.js` → imports CSS and modules, builds DOM via template strings.

**Module pattern:** Components are plain JS modules with named exports (see `src/counter.js`). DOM construction happens in `main.js` using `innerHTML` with template literals; interactive behavior is wired up by querying the rendered DOM.

**Styling:** `src/style.css` uses CSS custom properties (`--text`, `--bg`, `--accent`, etc.) for theming. Dark mode is handled via `prefers-color-scheme: dark` overriding those variables. Modern CSS nesting syntax is used throughout.

**Static assets:** Files in `public/` are served as-is (e.g. `public/icons.svg` for the SVG sprite). Images imported inside `src/` are processed by Vite.

**Vite config:** `vite.config.js` declares three HTML entries (`index.html`, `positions.html`, `404.html`), a dev proxy for the Notion API (`/notion-api`, auth injected from `VITE_NOTION_TOKEN`), and a middleware serving `positions.html` for the clean URLs `/positions` and `/positions/<job-slug>`. In production, `vercel.json` rewrites `/positions` to the static file and `/positions/:slug` to `api/position-page.js`, which injects per-job SEO meta (swapping the `<!-- seo -->…<!-- /seo -->` block in `positions.html`) plus JobPosting JSON-LD before returning the same shell.

import { defineConfig, loadEnv } from 'vite'
import { handle as handleBooking, BOOKING_PATHS } from './lib/booking/handlers.js'

// Vanity redirect to the talent-pool Tally form, shareable as tethrhq.com/pool
// instead of the raw tally.so link. Mirrors the redirect in vercel.json.
const POOL_REDIRECT_URL = 'https://tally.so/r/Y5vkxd?position=Talent%20pool'

/* /positions, /positions/<job-slug>, /apply, and /book are clean URLs onto their
   .html entries (the positions page routes the slug client-side). Prod is
   handled by the same rewrites in vercel.json; this middleware mirrors
   them for dev/preview. */
const positionsCleanUrls = () => (req, res, next) => {
  const path = req.url.split('?')[0]
  if (path === '/positions' || /^\/positions\/[^.]+$/.test(path)) {
    req.url = '/positions.html'
  } else if (path === '/apply') {
    req.url = '/apply.html'
  } else if (path === '/book') {
    req.url = '/book.html'
  } else if (path === '/pool') {
    res.writeHead(302, { Location: POOL_REDIRECT_URL })
    res.end()
    return
  }
  next()
}

/* The booking API (/api/lead, /api/availability, /api/book, /api/reminders)
   for dev and preview. Same handlers as api/*.js on Vercel and server.js in
   Docker. */
const bookingApi = () => (req, res, next) => {
  const [path, search = ''] = req.url.split('?')
  if (!BOOKING_PATHS.includes(path)) return next()
  const query = Object.fromEntries(new URLSearchParams(search))

  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', async () => {
    const { status, body } = await handleBooking(req.method, path, Buffer.concat(chunks).toString('utf8') || null, { headers: req.headers, query })
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(body))
  })
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // The booking handlers read process.env, as they do in production; give
  // them what's in .env without overriding the real environment
  for (const [key, value] of Object.entries(env)) {
    if (/^(NOTION_|GOOGLE_|BOOKING_|TURNSTILE_|VITE_NOTION_TOKEN$|CRON_SECRET$)/.test(key) && process.env[key] === undefined) process.env[key] = value
  }

  return {
    // Tells the /book form the dev server is on the in-memory mock, so it uses
    // Cloudflare's test captcha key. Never true in a build.
    define: { __BOOKING_MOCK__: JSON.stringify(command === 'serve' && process.env.BOOKING_MOCK === '1') },
    plugins: [
      {
        name: 'positions-clean-urls',
        configureServer(server) { server.middlewares.use(positionsCleanUrls()) },
        configurePreviewServer(server) { server.middlewares.use(positionsCleanUrls()) },
      },
      {
        name: 'booking-api',
        configureServer(server) { server.middlewares.use(bookingApi()) },
        configurePreviewServer(server) { server.middlewares.use(bookingApi()) },
      },
    ],
    build: {
      /* safari15 must be included: with a chrome-only target, esbuild's minifier
         treats backdrop-filter and -webkit-backdrop-filter as duplicates and
         drops the standard one, killing the glassmorphism in production. */
      cssTarget: ['chrome100', 'safari15'],
      target: 'es2020',
      rollupOptions: {
        input: {
          main:      'index.html',
          positions: 'positions.html',
          apply:     'apply.html',
          book:      'book.html',
          notFound:  '404.html',
        },
      },
    },
    server: {
      proxy: {
        '/notion-api': {
          target: 'https://api.notion.com',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/notion-api/, ''),
          configure(proxy) {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Bearer ${env.VITE_NOTION_TOKEN}`)
              proxyReq.setHeader('Notion-Version', '2022-06-28')
              proxyReq.setHeader('Content-Type', 'application/json')
            })
          },
        },
      },
    },
  }
})

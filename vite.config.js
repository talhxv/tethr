import { defineConfig, loadEnv } from 'vite'

/* /positions, /positions/<job-slug>, and /apply are clean URLs onto their
   .html entries (the positions page routes the slug client-side). Prod is
   handled by the same rewrites in vercel.json; this middleware mirrors
   them for dev/preview. */
const positionsCleanUrls = () => (req, _res, next) => {
  const path = req.url.split('?')[0]
  if (path === '/positions' || /^\/positions\/[^.]+$/.test(path)) {
    req.url = '/positions.html'
  } else if (path === '/apply') {
    req.url = '/apply.html'
  }
  next()
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      {
        name: 'positions-clean-urls',
        configureServer(server) { server.middlewares.use(positionsCleanUrls()) },
        configurePreviewServer(server) { server.middlewares.use(positionsCleanUrls()) },
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

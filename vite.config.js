import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    build: {
      cssTarget: 'chrome100',
      target: 'es2020',
      rollupOptions: {
        input: {
          main:      'index.html',
          positions: 'positions.html',
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

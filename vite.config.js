import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    cssTarget: 'chrome100',
    target: 'es2020'
  }
})

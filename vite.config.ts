import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { devPages } from './scripts/dev-pages.ts'

const backendHost = process.env.HOST && process.env.HOST !== '0.0.0.0' ? process.env.HOST : '127.0.0.1'
const backend = `http://${backendHost}:${process.env.PORT ?? 3000}`

export default defineConfig({
  root: resolve('src/client'),
  publicDir: resolve('public'),
  plugins: [vue(), devPages(backend)],
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    proxy: { '/api': { target: backend, changeOrigin: false }, '/ws': { target: backend, ws: true, changeOrigin: false } },
  },
  build: {
    outDir: resolve('dist'), emptyOutDir: true,
    rollupOptions: { input: { kiosk: resolve('src/client/kiosk/index.html'), manage: resolve('src/client/manage/index.html') } },
  },
})

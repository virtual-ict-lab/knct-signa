import { expect, test } from 'bun:test'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { devPages } from '../scripts/dev-pages'
import { fixture, authorization } from './helpers'

test('development serves the exact kiosk and management URLs with management authentication', async () => {
  const app = await fixture()
  const vite = await createServer({ configFile: false, root: resolve('src/client'), plugins: [vue(), devPages(app.url.href)], server: { host: '127.0.0.1', port: 0, hmr: false } })
  try {
    await vite.listen()
    const address = vite.httpServer!.address() as { port: number }
    const origin = `http://127.0.0.1:${address.port}`
    const kiosk = await fetch(`${origin}/kiosk`)
    expect(kiosk.status).toBe(200)
    expect(await kiosk.text()).toContain('/kiosk/main.ts')
    expect((await fetch(`${origin}/manage`)).status).toBe(401)
    const manage = await fetch(`${origin}/manage`, { headers: { Authorization: authorization } })
    expect(manage.status).toBe(200)
    expect(await manage.text()).toContain('/manage/main.ts')
  } finally { await vite.close(); await app.cleanup() }
}, 15000)

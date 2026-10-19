import { expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { configSchema, createDefaultConfig } from '../src/shared/config'
import { publicConfig } from '../src/shared/display'
import { ConfigStore } from '../src/server/config-store'
import { fixture, authorization } from './helpers'

test('accepts local and external background image URLs and an empty background', () => {
  for (const url of ['', '/assets/background.jpg', 'http://192.168.1.10/image.png', 'https://example.com/render?id=background']) {
    expect(configSchema.parse({ ...createDefaultConfig(), backgroundImageUrl: url }).backgroundImageUrl).toBe(url)
  }
  expect(configSchema.parse({ ...createDefaultConfig(), backgroundImageUrl: '  /assets/background.jpg  ' }).backgroundImageUrl).toBe('/assets/background.jpg')
})

test('rejects unsafe background URL schemes, credentials and ambiguous network paths', () => {
  for (const url of ['javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'file:///C:/secret.txt', 'ftp://example.com/a.png', 'blob:https://example.com/id', '//example.com/a.png', '/\\example.com/a.png', 'https://user:password@example.com/a.png', 'https:\\example.com/a.png', 'https://example.com/a\n.png']) {
    expect(configSchema.safeParse({ ...createDefaultConfig(), backgroundImageUrl: url }).success).toBe(false)
  }
})

test('persists background settings and loads legacy files without changing them', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'signage-background-'))
  try {
    const path = join(dir, 'config.json')
    const legacy = createDefaultConfig() as Record<string, unknown>
    delete legacy.backgroundImageUrl
    const text = JSON.stringify(legacy)
    await writeFile(path, text)
    const store = await ConfigStore.open(path)
    expect(store.get().backgroundImageUrl).toBe('')
    expect(await readFile(path, 'utf8')).toBe(text)
    const saved = await store.update({ ...store.get(), backgroundImageUrl: '/assets/background.jpg' })
    expect(publicConfig(saved).backgroundImageUrl).toBe('/assets/background.jpg')
    expect((await ConfigStore.open(path)).get().backgroundImageUrl).toBe('/assets/background.jpg')
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('saves and publishes background URLs without requesting them on the server', async () => {
  let requests = 0
  const imageServer = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => { requests++; return new Response('not an image') } })
  const app = await fixture()
  try {
    const url = new URL('/background.png', imageServer.url).href
    const response = await fetch(new URL('/api/manage/config', app.url), { method: 'PUT', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...app.store.get(), backgroundImageUrl: url }) })
    expect(response.status).toBe(200)
    expect((await response.json()).backgroundImageUrl).toBe(url)
    const display = await fetch(new URL('/api/display', app.url)).then(response => response.json())
    expect(display.config.backgroundImageUrl).toBe(url)
    expect(display.states).toEqual([])
    await Bun.sleep(30)
    expect(requests).toBe(0)
  } finally { await app.cleanup(); imageServer.stop(true) }
})

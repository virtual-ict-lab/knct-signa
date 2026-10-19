import { expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { configSchema, createDefaultConfig } from '../src/shared/config'
import { ConfigStore } from '../src/server/config-store'
import { publicConfig } from '../src/shared/display'
import { createPanel } from '../src/shared/panels'
import { fixture, authorization } from './helpers'

test('loads legacy configuration with its existing news display without rewriting the file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'signa-panels-'))
  try {
    const path = join(dir, 'config.json')
    const legacy = createDefaultConfig() as Record<string, unknown>
    delete legacy.panels
    const raw = JSON.stringify(legacy)
    await writeFile(path, raw)
    const store = await ConfigStore.open(path)
    expect(store.get().panels).toEqual([{ id: 'news', type: 'news', enabled: true, width: 'full', title: 'お知らせ', settings: {} }])
    expect(await readFile(path, 'utf8')).toBe(raw)
    const saved = await store.update({ ...store.get(), panels: [
      { id: 'welcome', type: 'text', enabled: true, width: 'half', title: '予定', settings: { body: '部会 16:00' } },
      { id: 'poster', type: 'image', enabled: false, width: 'half', title: '', settings: { url: '/assets/poster.png', fit: 'contain' } },
    ] })
    expect((await ConfigStore.open(path)).get().panels).toEqual(saved.panels)
    expect(publicConfig(saved).panels.map(panel => panel.id)).toEqual(['welcome', 'poster'])
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('rejects duplicate IDs, invalid sizes, excessive panels and unsafe image URLs', () => {
  const news = { id: 'news', type: 'news', enabled: true, width: 'full', title: 'お知らせ', settings: {} }
  for (const panels of [
    [news, news], [{ ...news, width: 'huge' }],
    Array.from({ length: 5 }, (_, index) => ({ ...news, id: `news-${index}` })),
    ...['javascript:alert(1)', 'file:///etc/passwd', '//example.com/x', 'data:image/svg+xml,<svg/>'].map(url => [
      { id: 'poster', type: 'image', enabled: true, width: 'full', title: '', settings: { url, fit: 'contain' } },
    ]),
  ]) expect(configSchema.safeParse({ ...createDefaultConfig(), panels }).success).toBe(false)
})

test('creates independently editable panels with unique IDs', () => {
  const first = createPanel('text')
  const second = createPanel('text')
  expect(first.id).not.toBe(second.id)
  expect(configSchema.parse({ ...createDefaultConfig(), panels: [first, second] }).panels).toHaveLength(2)
  expect(createPanel('image')).toMatchObject({ type: 'image', settings: { url: '', fit: 'contain' } })
})

test('removing all panels preserves news data for the independent ticker', () => {
  const config = configSchema.parse({ ...createDefaultConfig(), panels: [], sources: [
    { id: 'feed', type: 'rss', name: 'ニュース', url: 'https://example.com/feed', enabled: true, intervalSeconds: 300 },
  ] })
  expect(config.panels).toEqual([])
  expect(config.sources).toHaveLength(1)
  expect(publicConfig(config).panels).toEqual([])
})

test('saves and publishes image panels without requesting the image on the server', async () => {
  let requests = 0
  const images = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => { requests++; return new Response('<script>bad()</script>') } })
  const app = await fixture()
  try {
    const panels = [{ id: 'poster', type: 'image', enabled: true, width: 'full', title: '掲示', settings: { url: new URL('/poster', images.url).href, fit: 'cover' } }]
    const response = await fetch(new URL('/api/manage/config', app.url), { method: 'PUT', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...app.store.get(), panels }) })
    expect(response.status).toBe(200)
    const display = await fetch(new URL('/api/display', app.url)).then(response => response.json())
    expect(display.config.panels).toEqual(panels)
    await Bun.sleep(30)
    expect(requests).toBe(0)
  } finally { await app.cleanup(); images.stop(true) }
})


test('preserves temporarily uninstalled panels and their settings', () => {
  const panel = { id: 'custom', type: 'removed-plugin', enabled: true, width: 'full' as const, title: '予定', settings: { count: 3, caption: '部会' } }
  expect(configSchema.parse({ ...createDefaultConfig(), panels: [panel] }).panels).toEqual([panel])
})

test('validates installed plugin fields and fills in newly introduced defaults', () => {
  const meal = { id: 'meals', type: 'dorm-meals', enabled: true, width: 'full', title: '寮食', settings: {} }
  expect(configSchema.parse({ ...createDefaultConfig(), panels: [meal] }).panels[0]?.settings).toEqual({ url: 'https://virtual-ict-lab.github.io/knct-ryoshoku-api/kondate.json', intervalSeconds: 600 })
  for (const settings of [{ intervalSeconds: 0 }, { intervalSeconds: 60.5 }, { url: 'file:///etc/passwd' }, { url: 123 }]) {
    expect(configSchema.safeParse({ ...createDefaultConfig(), panels: [{ ...meal, settings }] }).success).toBe(false)
  }
})

test('never persists settings that cannot be read back after defaults are added', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'signa-panel-limit-'))
  try {
    const store = await ConfigStore.open(join(dir, 'config.json'))
    const settings = Object.fromEntries(Array.from({ length: 32 }, (_, index) => [`old-${index}`, index]))
    await expect(store.update({ ...store.get(), panels: [{ id: 'meals', type: 'dorm-meals', title: '', enabled: true, width: 'full', settings }] })).rejects.toThrow()
    expect((await ConfigStore.open(join(dir, 'config.json'))).get().revision).toBe(0)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

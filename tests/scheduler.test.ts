import { afterEach, expect, test } from 'bun:test'
import { SourceScheduler } from '../src/server/scheduler'
import { createDefaultConfig, type DataSource } from '../src/shared/config'

const schedulers: SourceScheduler[] = []
afterEach(() => { schedulers.splice(0).forEach(scheduler => scheduler.stop()) })
const source = (id: string): DataSource => ({ id, type: 'rss', name: id, url: `https://example.com/${id}`, enabled: true, intervalSeconds: 300 })
async function until(check: () => boolean) {
  const end = Date.now() + 2000
  while (!check()) { if (Date.now() > end) throw new Error('condition timed out'); await Bun.sleep(5) }
}

test('ignores a late response from a replaced source', async () => {
  let resolveOld!: (value: { title: string; body: string; id: string }[]) => void
  const scheduler = new SourceScheduler(() => {}, {
    source: async s => s.url.endsWith('/old') ? new Promise(resolve => { resolveOld = resolve }) : [{ id: 'new', title: '新しいデータ', body: '' }],
  })
  schedulers.push(scheduler)
  const config = createDefaultConfig(); config.weather.enabled = false
  config.sources = [{ ...source('news'), url: 'https://example.com/old' }]
  scheduler.configure(config)
  await until(() => !!resolveOld)
  config.sources[0]!.url = 'https://example.com/new'
  scheduler.configure(config)
  await until(() => scheduler.snapshot()[0]?.status === 'ready')
  resolveOld([{ id: 'old', title: '古いデータ', body: '' }])
  await Bun.sleep(10)
  expect(scheduler.snapshot()[0]?.items[0]?.title).toBe('新しいデータ')
})

test('preserves the last success when a later fetch fails', async () => {
  let fail = false
  const scheduler = new SourceScheduler(() => {}, { source: async () => {
    if (fail) throw new Error('upstream failed')
    return [{ id: '1', title: '最終取得データ', body: '' }]
  } })
  schedulers.push(scheduler)
  const config = createDefaultConfig(); config.weather.enabled = false; config.sources = [source('news')]
  scheduler.configure(config)
  await until(() => scheduler.snapshot()[0]?.status === 'ready')
  fail = true
  await scheduler.refresh('news')
  expect(scheduler.snapshot()[0]?.status).toBe('stale')
  expect(scheduler.snapshot()[0]?.items[0]?.title).toBe('最終取得データ')
  expect(scheduler.snapshot()[0]?.updatedAt).toBeTruthy()
})

test('caps concurrent upstream requests at four', async () => {
  let active = 0; let maximum = 0
  const scheduler = new SourceScheduler(() => {}, { source: async () => {
    active++; maximum = Math.max(maximum, active)
    await Bun.sleep(10)
    active--
    return []
  } })
  schedulers.push(scheduler)
  const config = createDefaultConfig(); config.weather.enabled = false
  config.sources = Array.from({ length: 12 }, (_, i) => source(`source${i}`))
  scheduler.configure(config)
  await until(() => scheduler.snapshot().every(state => state.status === 'ready'))
  expect(maximum).toBe(4)
})

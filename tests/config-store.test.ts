import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, rename, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ConfigStore, ConflictError } from '../src/server/config-store'

const dirs: string[] = []
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'signa-config-'))
  dirs.push(dir)
  return { dir, path: join(dir, 'config.json') }
}
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))) })

test('creates configuration and restores saved settings after reopening', async () => {
  const { path } = await setup()
  const store = await ConfigStore.open(path)
  const saved = await store.update({ ...store.get(), title: '部室のサイネージ' })
  expect(saved.revision).toBe(1)
  expect((await ConfigStore.open(path)).get().title).toBe('部室のサイネージ')
  const copy = store.get()
  copy.title = '外から変更'
  expect(store.get().title).toBe('部室のサイネージ')
})

test('serializes competing updates and rejects the stale revision', async () => {
  const { path } = await setup()
  const store = await ConfigStore.open(path)
  const current = store.get()
  const results = await Promise.allSettled([
    store.update({ ...current, title: '先の更新' }),
    store.update({ ...current, title: '後の更新' }),
  ])
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  const failed = results.find(result => result.status === 'rejected') as PromiseRejectedResult
  expect(failed.reason).toBeInstanceOf(ConflictError)
  expect(JSON.parse(await readFile(path, 'utf8')).title).toBe('先の更新')
})

test('preserves in-memory state on a failed write and accepts a later save', async () => {
  const { dir, path } = await setup()
  const store = await ConfigStore.open(path)
  await rename(dir, `${dir}-moved`)
  dirs.push(`${dir}-moved`)
  await expect(store.update({ ...store.get(), title: '保存失敗' })).rejects.toThrow()
  expect(store.get().revision).toBe(0)
  await rename(`${dir}-moved`, dir)
  expect((await store.update({ ...store.get(), title: '復帰' })).revision).toBe(1)
})

test('does not overwrite invalid existing JSON', async () => {
  const { path } = await setup()
  await writeFile(path, '{壊れたJSON')
  await expect(ConfigStore.open(path)).rejects.toThrow()
  expect(await readFile(path, 'utf8')).toBe('{壊れたJSON')
})

test('rejects invalid source URLs and duplicate IDs before persisting', async () => {
  const { path } = await setup()
  const store = await ConfigStore.open(path)
  const source = { id: 'rss1', type: 'rss', name: 'お知らせ', url: 'javascript:alert(1)', enabled: true, intervalSeconds: 300 }
  await expect(store.update({ ...store.get(), sources: [source] })).rejects.toThrow()
  source.url = 'https://example.com/feed'
  await expect(store.update({ ...store.get(), sources: [source, source] })).rejects.toThrow()
  expect(store.get().revision).toBe(0)
})

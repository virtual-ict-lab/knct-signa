import { expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ConfigStore } from '../src/server/config-store'
import { createDefaultConfig } from '../src/shared/config'
import { publicConfig } from '../src/shared/display'
import { resolveTheme } from '../src/client/shared/theme'
import { informationMessage } from '../src/client/kiosk/information'
import type { SourceState } from '../src/shared/display'

test('persists the selected theme and includes it in kiosk settings', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'signage-theme-'))
  try {
    const store = await ConfigStore.open(join(dir, 'config.json'))
    const saved = await store.update({ ...store.get(), theme: 'light' })
    expect(publicConfig(saved).theme).toBe('light')
    expect((await ConfigStore.open(join(dir, 'config.json'))).get().theme).toBe('light')
    await expect(store.update({ ...saved, theme: 'green' })).rejects.toThrow()
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('loads an existing configuration without a theme as dark without overwriting it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'signage-theme-'))
  try {
    const path = join(dir, 'config.json')
    const legacy = createDefaultConfig() as Record<string, unknown>
    delete legacy.theme
    const text = JSON.stringify(legacy)
    await writeFile(path, text)
    expect((await ConfigStore.open(path)).get().theme).toBe('dark')
    expect(await readFile(path, 'utf8')).toBe(text)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('uses the kiosk local choice until a newer management configuration takes precedence', () => {
  expect(resolveTheme('dark', 2, { theme: 'light', revision: 2 })).toBe('light')
  expect(resolveTheme('dark', 3, { theme: 'light', revision: 2 })).toBe('dark')
  expect(resolveTheme('light', 3, null)).toBe('light')
})

test('distinguishes an empty successful feed from loading and failed sources', () => {
  const state: SourceState = { id: 'rss', name: 'RSS', type: 'rss', status: 'ready', fetching: false, items: [], updatedAt: '2026-10-19T00:00:00Z', attemptedAt: '2026-10-19T00:00:00Z' }
  expect(informationMessage([])).toBe('情報はありません')
  expect(informationMessage([state])).toBe('情報はありません')
  expect(informationMessage([{ ...state, status: 'loading', updatedAt: null }])).toBe('取得中')
  expect(informationMessage([{ ...state, status: 'error', updatedAt: null }])).toBe('取得失敗')
})

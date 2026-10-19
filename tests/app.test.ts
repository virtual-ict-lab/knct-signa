import { afterEach, expect, test } from 'bun:test'
import { fixture, authorization } from './helpers'
import { readEnvironment } from '../src/server/environment'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { await Promise.all(cleanups.splice(0).map(cleanup => cleanup())) })

test('protects management pages and every management API while kiosk remains public', async () => {
  const app = await fixture(); cleanups.push(app.cleanup)
  for (const path of ['/manage', '/manage/settings', '/api/manage/config', '/api/manage/status']) {
    const response = await fetch(new URL(path, app.url))
    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toContain('Basic')
    expect((await fetch(new URL(path, app.url), { headers: { Authorization: authorization } })).status).toBe(200)
  }
  expect((await fetch(new URL('/manage', app.url), { headers: { Authorization: `Basic ${btoa('test-admin:wrong')}` } })).status).toBe(401)
  expect(await (await fetch(new URL('/kiosk', app.url))).text()).toContain('kiosk')
  expect((await fetch(new URL('/.env', app.url))).status).toBe(404)
})

test('saves authenticated configuration and rejects stale revisions and cross-origin writes', async () => {
  const app = await fixture(); cleanups.push(app.cleanup)
  const current = app.store.get()
  const url = new URL('/api/manage/config', app.url)
  const options = { method: 'PUT', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...current, title: '更新後のタイトル' }) }
  expect((await fetch(url, options)).status).toBe(200)
  expect(app.store.get().title).toBe('更新後のタイトル')
  expect((await fetch(url, options)).status).toBe(409)
  expect((await fetch(url, { ...options, headers: { ...options.headers, Origin: 'https://unrelated.example' } })).status).toBe(403)
  expect((await fetch(url, { ...options, body: '{bad json' })).status).toBe(400)
  expect((await fetch(url, { ...options, headers: { 'Content-Type': 'application/json' } })).status).toBe(401)
})

test('never includes source credentials in public snapshots', async () => {
  const app = await fixture(); cleanups.push(app.cleanup)
  await app.store.update({ ...app.store.get(), sources: [{ id: 'private', type: 'json', name: '非公開API', url: 'https://example.com/private', enabled: false, intervalSeconds: 300, itemsPath: '', titlePath: 'title', bodyPath: 'body', linkPath: 'url', headers: { Authorization: 'private-api-key' } }] })
  const text = await (await fetch(new URL('/api/display', app.url))).text()
  expect(text).not.toContain('private-api-key')
  expect(text).not.toContain('test-password-only')
  expect(text).not.toContain('https://example.com/private')
})

test('fails startup on missing credentials and invalid port', () => {
  expect(() => readEnvironment({})).toThrow('MANAGE_USERNAME')
  expect(() => readEnvironment({ MANAGE_USERNAME: 'admin', MANAGE_PASSWORD: '' })).toThrow('MANAGE_PASSWORD')
  expect(() => readEnvironment({ MANAGE_USERNAME: 'admin', MANAGE_PASSWORD: 'password', PORT: 'NaN' })).toThrow('PORT')
})

import { afterEach, expect, test } from 'bun:test'
import { fixture, authorization } from './helpers'
import type { DisplaySnapshot } from '../src/shared/display'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { await Promise.all(cleanups.splice(0).map(cleanup => cleanup())) })

function connect(url: URL) {
  const socket = new WebSocket(new URL('/ws', url).href.replace(/^http/, 'ws'))
  const messages: DisplaySnapshot[] = []
  socket.addEventListener('message', event => messages.push(JSON.parse(String(event.data))))
  return { socket, messages }
}
async function until(check: () => boolean) {
  const end = Date.now() + 2000
  while (!check()) { if (Date.now() > end) throw new Error('WebSocket timed out'); await Bun.sleep(5) }
}

test('pushes the initial state, saved configuration and a fresh snapshot after reconnecting', async () => {
  const app = await fixture(); cleanups.push(app.cleanup)
  const first = connect(app.url)
  await until(() => first.messages.length > 0)
  expect(first.messages[0]?.config.title).toBe('サイネージ')
  const response = await fetch(new URL('/api/manage/config', app.url), { method: 'PUT', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...app.store.get(), title: '即時反映' }) })
  expect(response.status).toBe(200)
  await until(() => first.messages.some(message => message.config.title === '即時反映'))
  first.socket.close()
  const second = connect(app.url)
  await until(() => second.messages.length > 0)
  expect(second.messages[0]?.config.title).toBe('即時反映')
  expect(second.messages[0]?.revision).toBe(app.store.get().revision)
  second.socket.close()
})

test('refuses a WebSocket upgrade from a different browser origin', async () => {
  const app = await fixture(); cleanups.push(app.cleanup)
  const response = await fetch(new URL('/ws', app.url), { headers: { Origin: 'https://unrelated.example', Upgrade: 'websocket', Connection: 'Upgrade', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version': '13' } })
  expect(response.status).toBe(403)
})

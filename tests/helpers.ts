import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ConfigStore } from '../src/server/config-store'
import { startServer } from '../src/server/index'

export const credentials = { username: 'test-admin', password: 'test-password-only' }
export const authorization = `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`
export async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'signa-http-'))
  const store = await ConfigStore.open(join(dir, 'config.json'))
  await store.update({ ...store.get(), weather: { ...store.get().weather, enabled: false } })
  for (const name of ['kiosk', 'manage']) {
    await mkdir(join(dir, name))
    await writeFile(join(dir, name, 'index.html'), `<html>${name}</html>`)
  }
  const runtime = startServer({ store, credentials, hostname: '127.0.0.1', port: 0, distDir: dir })
  return { ...runtime, store, url: runtime.server.url, cleanup: async () => { runtime.stop(); await rm(dir, { recursive: true, force: true }) } }
}

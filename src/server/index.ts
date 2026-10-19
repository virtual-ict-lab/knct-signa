import { resolve } from 'node:path'
import { ConfigStore } from './config-store'
import { readEnvironment, type Credentials } from './environment'
import { SourceScheduler } from './scheduler'
import { RealtimeHub } from './realtime'
import { createApp, sameOrigin } from './app'

interface ServerOptions { store: ConfigStore; credentials: Credentials; hostname?: string; port?: number; distDir?: string }

export function startServer(options: ServerOptions) {
  let hub: RealtimeHub
  const scheduler = new SourceScheduler(() => hub?.publish())
  hub = new RealtimeHub(() => options.store.get(), () => scheduler.snapshot())
  const app = createApp({ store: options.store, credentials: options.credentials, scheduler, hub, distDir: options.distDir ?? resolve('dist') })
  const server = Bun.serve({
    hostname: options.hostname ?? '127.0.0.1', port: options.port ?? 3000,
    fetch(request, server) {
      if (new URL(request.url).pathname === '/ws') {
        if (!sameOrigin(request)) return new Response('Forbidden', { status: 403 })
        if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 })
        return server.upgrade(request) ? undefined : new Response('WebSocket upgrade required', { status: 426 })
      }
      return app.fetch(request)
    },
    websocket: {
      maxPayloadLength: 4096, backpressureLimit: 2 * 1024 * 1024, idleTimeout: 120,
      open(socket) { hub.add(socket) },
      close(socket) { hub.remove(socket) },
      message() { /* 表示用接続ではクライアントからの変更を受け付けない */ },
    },
  })
  scheduler.configure(options.store.get())
  return { server, scheduler, hub, stop() { scheduler.stop(); hub.close(); server.stop(true) } }
}

if (import.meta.main) {
  try {
    const environment = readEnvironment(process.env)
    const store = await ConfigStore.open(resolve(environment.configPath))
    const runtime = startServer({ ...environment, store })
    console.log(`knct-signa: ${runtime.server.url}`)
    console.log('表示: /kiosk   管理: /manage')
    const stop = () => { runtime.stop(); process.exit(0) }
    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)
  } catch (error) {
    console.error('起動できません:', error instanceof Error ? error.message : '設定を確認してください')
    process.exit(1)
  }
}

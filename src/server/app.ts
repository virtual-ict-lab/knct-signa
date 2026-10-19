import { Hono } from 'hono'
import { basicAuth } from 'hono/basic-auth'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { join } from 'node:path'
import { ConfigStore, ConflictError } from './config-store'
import type { Credentials } from './environment'
import type { SourceScheduler } from './scheduler'
import type { RealtimeHub } from './realtime'

interface Dependencies { store: ConfigStore; scheduler: SourceScheduler; hub: RealtimeHub; credentials: Credentials; distDir: string }

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  return origin === null || origin === new URL(request.url).origin
}

export function createApp({ store, scheduler, hub, credentials, distDir }: Dependencies) {
  const app = new Hono()
  const auth = basicAuth({ ...credentials, realm: 'Management' })
  app.use('/manage', auth)
  app.use('/manage/*', auth)
  app.use('/api/manage/*', auth)
  app.use('/api/*', bodyLimit({ maxSize: 256 * 1024, onError: c => c.json({ error: 'リクエストが大きすぎます' }, 413) }))
  app.use('/api/*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next() })

  app.get('/api/manage/config', c => c.json(store.get()))
  app.get('/api/manage/status', c => c.json(scheduler.snapshot()))
  app.put('/api/manage/config', async c => {
    if (!sameOrigin(c.req.raw)) return c.json({ error: '同じサイトから操作してください' }, 403)
    if (!c.req.header('Content-Type')?.toLowerCase().startsWith('application/json')) return c.json({ error: 'JSON形式で送信してください' }, 415)
    const saved = await store.update(await c.req.json())
    scheduler.configure(saved)
    hub.publish()
    return c.json(saved)
  })
  app.get('/api/display', c => c.json(hub.current()))

  const page = async (name: 'kiosk' | 'manage') => {
    const file = Bun.file(join(distDir, name, 'index.html'))
    if (!await file.exists()) return new Response('画面の読込失敗', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    return new Response(file, { headers: { 'Cache-Control': 'no-cache', 'Content-Type': 'text/html; charset=utf-8' } })
  }
  app.get('/', c => c.redirect('/kiosk'))
  app.get('/kiosk', () => page('kiosk'))
  app.get('/kiosk/', () => page('kiosk'))
  app.get('/manage', () => page('manage'))
  app.get('/manage/*', () => page('manage'))
  app.get('/assets/*', async c => {
    const name = c.req.path.slice('/assets/'.length)
    if (!/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(name)) return c.notFound()
    const file = Bun.file(join(distDir, 'assets', name))
    return await file.exists() ? new Response(file, { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } }) : c.notFound()
  })
  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse()
    if (error instanceof ConflictError) return c.json({ error: error.message }, 409)
    if (error instanceof z.ZodError) return c.json({ error: '入力内容を確認してください', issues: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`) }, 400)
    if (error instanceof SyntaxError) return c.json({ error: 'JSONの形式を確認してください' }, 400)
    return c.json({ error: '処理失敗' }, 500)
  })
  return app
}

import type { Plugin } from 'vite'

export function devPages(backend: string): Plugin {
  return {
    name: 'signa-dev-pages', apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://localhost')
        if (url.pathname === '/') { response.writeHead(302, { Location: '/kiosk' }); response.end(); return }
        if (url.pathname === '/manage' || url.pathname.startsWith('/manage/')) {
          try {
            const auth = await fetch(new URL('/api/manage/config', backend), {
              headers: { Authorization: request.headers.authorization ?? '' }, signal: AbortSignal.timeout(5000),
            })
            await auth.body?.cancel()
            if (auth.status !== 200) {
              response.writeHead(auth.status, { 'WWW-Authenticate': auth.headers.get('www-authenticate') ?? 'Basic realm="knct-signa management"' })
              response.end('管理画面への認証が必要です'); return
            }
          } catch { response.writeHead(503); response.end('サーバーへ接続できません'); return }
        }
        if (['/kiosk', '/kiosk/', '/manage', '/manage/'].includes(url.pathname)) request.url = `${url.pathname.replace(/\/$/, '')}/index.html${url.search}`
        next()
      })
    },
  }
}

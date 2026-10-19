import { afterEach, expect, test } from 'bun:test'
import { parseRss } from '../src/server/sources/rss'
import { mapJson } from '../src/server/sources/json'
import { parseWeather } from '../src/server/sources/weather'
import { fetchText, plainText } from '../src/server/sources/http'
import type { DataSource } from '../src/shared/config'

test('parses RSS 2.0 and renders embedded markup as text with safe links', () => {
  const items = parseRss('<rss version="2.0"><channel><item><title><![CDATA[<b>お知らせ</b>]]></title><description><![CDATA[<p>部会は &amp; 16時</p>]]></description><link>javascript:alert(1)</link></item></channel></rss>', 'https://example.com/feed')
  expect(items[0]?.title).toBe('お知らせ')
  expect(items[0]?.body).toBe('部会は & 16時')
  expect(items[0]?.url).toBeUndefined()
})

test('supports Atom alternate links and RDF items', () => {
  const atom = parseRss('<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atomの記事</title><link rel="self" href="/entry.atom"/><link rel="alternate" href="/entry"/><updated>2026-10-19T12:00:00+09:00</updated></entry></feed>', 'https://example.com/feed')
  expect(atom[0]?.url).toBe('https://example.com/entry')
  const rdf = parseRss('<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><item><title>RDFの記事</title><link>https://example.com/news</link></item></rdf:RDF>', 'https://example.com/feed')
  expect(rdf[0]?.title).toBe('RDFの記事')
})

test('rejects malformed XML and entity definitions', () => {
  expect(() => parseRss('<rss><channel>', 'https://example.com')).toThrow()
  expect(() => parseRss('<!DOCTYPE rss [<!ENTITY x "expand">]><rss/>', 'https://example.com')).toThrow()
})

test('maps nested JSON without executing expressions or exposing headers', () => {
  const source: Extract<DataSource, { type: 'json' }> = {
    id: 'json1', type: 'json', name: '時間割', url: 'https://example.com/api', enabled: true, intervalSeconds: 300,
    itemsPath: 'data.changes', titlePath: 'subject.name', bodyPath: 'note', linkPath: 'link', headers: { Authorization: 'secret' },
  }
  const items = mapJson({ data: { changes: [{ subject: { name: '電子工学' }, note: '<b>休講</b>', link: '/detail' }] } }, source)
  expect(items[0]?.title).toBe('電子工学')
  expect(items[0]?.body).toBe('休講')
  expect(items[0]?.url).toBe('https://example.com/detail')
  expect(JSON.stringify(items)).not.toContain('secret')
  expect(() => mapJson({ data: {} }, source)).toThrow()
})

test('validates weather instead of displaying a malformed API response', () => {
  const weather = parseWeather({ current: { temperature_2m: 23.4, weather_code: 3 }, daily: { time: ['2026-10-19'], temperature_2m_max: [25], temperature_2m_min: [18], precipitation_probability_max: [40] } })
  expect(weather).toMatchObject({ temperature: 23.4, high: 25, low: 18, precipitation: 40, code: 3 })
  expect(() => parseWeather({ current: { temperature_2m: '23.4' } })).toThrow()
})

const servers: ReturnType<typeof Bun.serve>[] = []
afterEach(() => { servers.splice(0).forEach(server => server.stop(true)) })

test('limits decoded response bytes and rejects unsuccessful HTTP responses', async () => {
  const server = Bun.serve({ port: 0, fetch: req => new URL(req.url).pathname === '/fail'
    ? new Response('credentials', { status: 401 }) : new Response('a'.repeat(2 * 1024 * 1024 + 1)) })
  servers.push(server)
  await expect(fetchText(new URL('/large', server.url), { signal: new AbortController().signal })).rejects.toThrow('2MiB')
  await expect(fetchText(new URL('/fail', server.url), { signal: new AbortController().signal })).rejects.toThrow('HTTP 401')
})

test('retains configured headers on same-origin redirects', async () => {
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: req => {
    if (new URL(req.url).pathname === '/start') return new Response(null, { status: 302, headers: { Location: '/data' } })
    return Response.json({ key: req.headers.get('x-api-key'), authorization: req.headers.get('authorization') })
  } })
  servers.push(server)
  const text = await fetchText(new URL('/start', server.url), { signal: new AbortController().signal, headers: { 'X-API-Key': 'dummy-key', Authorization: 'Bearer dummy-token' } })
  expect(JSON.parse(text)).toEqual({ key: 'dummy-key', authorization: 'Bearer dummy-token' })
})

test('does not disclose configured headers to a cross-origin redirect destination', async () => {
  const destination = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: req => Response.json({
    key: req.headers.get('x-api-key'), token: req.headers.get('x-private-token'), authorization: req.headers.get('authorization'), cookie: req.headers.get('cookie'),
  }) })
  const upstream = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => Response.redirect(destination.url, 302) })
  servers.push(upstream, destination)
  const text = await fetchText(upstream.url, { signal: new AbortController().signal, headers: {
    'X-API-Key': 'dummy-key', 'X-Private-Token': 'dummy-token', Authorization: 'Bearer dummy-token', Cookie: 'session=dummy-cookie',
  } })
  expect(JSON.parse(text)).toEqual({ key: null, token: null, authorization: null, cookie: null })
})

test('does not restore secret headers when a redirect chain returns to the original origin', async () => {
  const upstream = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: (req): Response => new URL(req.url).pathname === '/start'
    ? Response.redirect(destination.url, 302) : Response.json({ key: req.headers.get('x-api-key') }) })
  const destination = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: (): Response => Response.redirect(new URL('/data', upstream.url), 302) })
  servers.push(upstream, destination)
  const text = await fetchText(new URL('/start', upstream.url), { signal: new AbortController().signal, headers: { 'X-API-Key': 'dummy-key' } })
  expect(JSON.parse(text)).toEqual({ key: null })
})

test('stops redirect loops and rejects credentials embedded in a redirect URL', async () => {
  let credentialDestinationCalled = false
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: req => {
    const url = new URL(req.url)
    if (url.pathname === '/loop') return new Response(null, { status: 302, headers: { Location: '/loop' } })
    if (url.pathname === '/credentials') return Response.redirect(`http://user:password@${url.host}/data`, 302)
    credentialDestinationCalled = true
    return new Response('data')
  } })
  servers.push(server)
  await expect(fetchText(new URL('/loop', server.url), { signal: new AbortController().signal })).rejects.toThrow()
  await expect(fetchText(new URL('/credentials', server.url), { signal: new AbortController().signal })).rejects.toThrow()
  expect(credentialDestinationCalled).toBe(false)
})

test('removes script and style content while preserving ordinary text and entities', () => {
  expect(plainText('<p>前文 &amp; 本文</p><SCRIPT type="text/javascript">if (a < b) alert(1)</SCRIPT><style>body { color: red }</style><b>後文</b>')).toBe('前文 & 本文 後文')
  expect(plainText('前文<script>閉じタグのないスクリプト')).toBe('前文')
  expect(plainText('値は 1 < 2')).toBe('値は 1 < 2')
})

test('processes large malformed markup without blocking on repeated opening tags', async () => {
  const moduleUrl = new URL('../src/server/sources/http.ts', import.meta.url).href
  const child = Bun.spawn([process.execPath, '--no-env-file', '--eval', `
    import { plainText } from ${JSON.stringify(moduleUrl)};
    plainText('<script>'.repeat(32768));
    plainText('<style>'.repeat(32768));
    plainText('<'.repeat(262144));
    console.log('completed');
  `], { stdout: 'pipe', stderr: 'pipe' })
  const deadline = setTimeout(() => child.kill(), 1500)
  try {
    expect(await child.exited).toBe(0)
    expect((await new Response(child.stdout).text()).trim()).toBe('completed')
  } finally { clearTimeout(deadline); child.kill() }
})

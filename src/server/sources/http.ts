interface FetchOptions { signal: AbortSignal; headers?: Record<string, string> }
const MAX_BYTES = 2 * 1024 * 1024
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

export async function fetchText(url: string | URL, options: FetchOptions): Promise<string> {
  const signal = AbortSignal.any([options.signal, AbortSignal.timeout(10_000)])
  let target = new URL(url)
  let headers = options.headers
  let response: Response
  for (let redirects = 0; ; redirects++) {
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw new Error('取得先URLが不正です')
    response = await fetch(target, { signal, headers, redirect: 'manual' })
    const location = response.headers.get('location')
    if (!REDIRECT_STATUSES.has(response.status) || !location) break
    await response.body?.cancel()
    if (redirects >= 20) throw new Error('リダイレクト回数が上限を超えています')
    const next = new URL(location, target)
    // 一度でもオリジンを越えたら、設定ヘッダーは以降の転送でも復元しない。
    if (next.origin !== target.origin) headers = undefined
    target = next
  }
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`HTTP ${response.status}`)
  }
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0; let text = ''
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      bytes += part.value.byteLength
      if (bytes > MAX_BYTES) throw new Error('応答が2MiBを超えています')
      text += decoder.decode(part.value, { stream: true })
    }
    return text + decoder.decode()
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

function stripMarkup(text: string): string {
  const parts: string[] = []
  const closingTags = /<\/(script|style)\s*>/gi
  let cursor = 0
  let hidden: string | undefined
  // 読み取り位置を前にだけ進め、閉じタグのない入力でも繰り返し走査しない。
  while (cursor < text.length) {
    if (hidden) {
      closingTags.lastIndex = cursor
      let closing: RegExpExecArray | null
      do { closing = closingTags.exec(text) } while (closing && closing[1]!.toLowerCase() !== hidden)
      if (!closing) break
      cursor = closingTags.lastIndex
      hidden = undefined
      parts.push(' ')
      continue
    }
    const start = text.indexOf('<', cursor)
    if (start === -1) { parts.push(text.slice(cursor)); break }
    parts.push(text.slice(cursor, start))
    const end = text.indexOf('>', start + 1)
    if (end === -1) { parts.push(text.slice(start)); break }
    hidden = /^(script|style)(?=[\s/>]|$)/i.exec(text.slice(start + 1, end))?.[1]?.toLowerCase()
    cursor = end + 1
    parts.push(' ')
  }
  return parts.join('')
}

export function plainText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object') {
    if ('#text' in value) return plainText(value['#text'])
    return ''
  }
  return stripMarkup(String(value))
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi, entity => {
      const entities: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' }
      if (entities[entity.toLowerCase()]) return entities[entity.toLowerCase()]!
      const hexadecimal = entity.toLowerCase().startsWith('&#x')
      const code = parseInt(entity.slice(hexadecimal ? 3 : 2, -1), hexadecimal ? 16 : 10)
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
    })
    .replace(/\s+/g, ' ').trim().slice(0, 4000)
}

export function safeLink(value: unknown, base: string): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  try {
    const url = new URL(value, base)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined
  } catch { return undefined }
}

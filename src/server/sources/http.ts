interface FetchOptions { signal: AbortSignal; headers?: Record<string, string> }
const MAX_BYTES = 2 * 1024 * 1024

export async function fetchText(url: string | URL, options: FetchOptions): Promise<string> {
  const signal = AbortSignal.any([options.signal, AbortSignal.timeout(10_000)])
  const response = await fetch(url, { signal, headers: options.headers, redirect: 'follow' })
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

export function plainText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object') {
    if ('#text' in value) return plainText(value['#text'])
    return ''
  }
  return String(value)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<[^>]*>/g, ' ')
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

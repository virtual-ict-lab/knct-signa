export function formatTime(value: string | null, timezone: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' } as const
  try { return new Intl.DateTimeFormat('ja-JP', { ...options, timeZone: timezone }).format(date) }
  catch { return new Intl.DateTimeFormat('ja-JP', { ...options, timeZone: 'Asia/Tokyo' }).format(date) }
}

export function createSourceId(cryptoApi: Pick<Crypto, 'getRandomValues'> = globalThis.crypto): string {
  // getRandomValuesはLAN内のHTTPでも利用できる。randomUUIDはsecure contextに限定される。
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
  return `source_${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`
}

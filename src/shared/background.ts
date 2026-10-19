export function isBackgroundImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  if (value === '') return true
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return false
  const relative = value.startsWith('/') && !value.startsWith('//')
  if (!relative && !/^https?:\/\//i.test(value)) return false
  try {
    const url = new URL(value, 'https://display.invalid')
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && (!relative || url.origin === 'https://display.invalid')
  } catch { return false }
}

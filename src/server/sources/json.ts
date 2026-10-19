import type { DataSource } from '../../shared/config'
import type { DisplayItem } from '../../shared/display'
import { plainText, safeLink } from './http'

function property(value: unknown, path: string): unknown {
  if (!path) return value
  let current = value
  for (const key of path.split('.')) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) return undefined
    if (current == null || typeof current !== 'object' || !Object.hasOwn(current, key)) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

export function mapJson(data: unknown, source: Extract<DataSource, { type: 'json' }>): DisplayItem[] {
  const items = property(data, source.itemsPath)
  if (!Array.isArray(items)) throw new Error('指定したパスに配列がありません')
  return items.slice(0, 100).flatMap((item, index) => {
    const title = plainText(property(item, source.titlePath))
    if (!title) return []
    return [{ id: `${source.id}-${index}`, title, body: source.bodyPath ? plainText(property(item, source.bodyPath)) : '', url: source.linkPath ? safeLink(property(item, source.linkPath), source.url) : undefined }]
  })
}

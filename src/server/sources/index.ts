import type { DataSource } from '../../shared/config'
import type { DisplayItem } from '../../shared/display'
import { fetchText } from './http'
import { parseRss } from './rss'
import { mapJson } from './json'

export async function fetchSource(source: DataSource, signal: AbortSignal): Promise<DisplayItem[]> {
  const text = await fetchText(source.url, { signal, headers: source.type === 'json' ? source.headers : undefined })
  return source.type === 'rss' ? parseRss(text, source.url) : mapJson(JSON.parse(text), source)
}

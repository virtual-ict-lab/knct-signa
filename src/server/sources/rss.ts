import { XMLParser, XMLValidator } from 'fast-xml-parser'
import type { DisplayItem } from '../../shared/display'
import { plainText, safeLink } from './http'

const list = (value: unknown): any[] => value == null ? [] : Array.isArray(value) ? value : [value]

export function parseRss(xml: string, baseUrl: string): DisplayItem[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('RSSのXMLが不正です')
  const parsed = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false }).parse(xml)
  const root = parsed?.rss?.channel ?? parsed?.feed ?? parsed?.RDF
  if (!root || typeof root !== 'object') throw new Error('RSS・Atom形式を確認してください')
  return list(root.item ?? root.entry).slice(0, 100).flatMap((entry, index) => {
    const title = plainText(entry.title)
    if (!title) return []
    const links = list(entry.link)
    const link = links.find(value => typeof value === 'object' && (!value['@_rel'] || value['@_rel'] === 'alternate')) ?? links[0]
    const url = safeLink(typeof link === 'object' ? link['@_href'] : link, baseUrl)
    const date = plainText(entry.pubDate ?? entry.published ?? entry.updated ?? entry.date)
    const timestamp = date ? Date.parse(date) : NaN
    return [{
      id: plainText(entry.guid ?? entry.id) || `${url ?? title}-${index}`,
      title, body: plainText(entry.description ?? entry.summary ?? entry.content ?? entry.encoded), url,
      publishedAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined,
    }]
  })
}

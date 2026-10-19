import { z } from 'zod'
import { isBackgroundImageUrl } from './background'
import { defaultPanels } from './panels'
import { panelsSchema } from './panel-schema'

export const httpUrl = z.string().max(2048).refine(value => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  } catch { return false }
}, 'HTTPまたはHTTPSのURLを指定してください（認証情報はヘッダー欄へ入力）')

const interval = z.number().int().min(60).max(86400)
const sourceBase = {
  id: z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().trim().min(1).max(120),
  url: httpUrl,
  enabled: z.boolean(),
  intervalSeconds: interval,
}
const propertyPath = z.string().max(200).refine(value =>
  !value.split('.').some(key => ['__proto__', 'prototype', 'constructor'].includes(key)), '使用できないプロパティパスです')

export const sourceSchema = z.discriminatedUnion('type', [
  z.object({ ...sourceBase, type: z.literal('rss') }),
  z.object({
    ...sourceBase,
    type: z.literal('json'),
    itemsPath: propertyPath,
    titlePath: propertyPath.min(1),
    bodyPath: propertyPath,
    linkPath: propertyPath,
    headers: z.record(z.string().min(1).max(100), z.string().max(2048)).refine(value => Object.keys(value).length <= 32),
  }),
])

export const configSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  theme: z.enum(['dark', 'light']).default('dark'),
  backgroundImageUrl: z.string().trim().max(2048).refine(isBackgroundImageUrl, '画像URLが不正です').default(''),
  title: z.string().trim().min(1).max(120),
  timezone: z.string().max(100).refine(value => {
    try { new Intl.DateTimeFormat('ja-JP', { timeZone: value }); return true } catch { return false }
  }, '有効なタイムゾーンを指定してください'),
  rotationSeconds: z.number().int().min(5).max(120),
  panels: panelsSchema.default(defaultPanels),
  weather: z.object({
    enabled: z.boolean(),
    city: z.string().trim().min(1).max(100),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    intervalSeconds: interval,
  }),
  sources: z.array(sourceSchema).max(32).refine(sources => new Set(sources.map(source => source.id)).size === sources.length, 'データソースのIDが重複しています'),
})

export type Config = z.infer<typeof configSchema>
export type DataSource = z.infer<typeof sourceSchema>
export type WeatherConfig = Config['weather']

export function createDefaultConfig(): Config {
  return {
    schemaVersion: 1, revision: 0, theme: 'dark', backgroundImageUrl: '', title: 'サイネージ', timezone: 'Asia/Tokyo', rotationSeconds: 12, panels: defaultPanels(),
    weather: { enabled: true, city: '高松', latitude: 34.3401, longitude: 134.0434, intervalSeconds: 600 },
    sources: [],
  }
}

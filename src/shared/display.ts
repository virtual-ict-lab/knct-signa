import type { Config } from './config'

export interface DisplayItem { id: string; title: string; body: string; url?: string; publishedAt?: string }
export interface WeatherData { temperature: number; high: number; low: number; precipitation: number | null; code: number }
export interface SourceState {
  id: string
  name: string
  type: 'weather' | 'rss' | 'json'
  status: 'loading' | 'ready' | 'stale' | 'error'
  fetching: boolean
  items: DisplayItem[]
  weather?: WeatherData
  updatedAt: string | null
  attemptedAt: string | null
  error?: string
}
export interface DisplaySnapshot {
  type: 'snapshot'
  instanceId: string
  sequence: number
  revision: number
  config: { title: string; theme: Config['theme']; timezone: string; rotationSeconds: number; city: string; weatherEnabled: boolean }
  states: SourceState[]
}
export function publicConfig(config: Config): DisplaySnapshot['config'] {
  return { title: config.title, theme: config.theme, timezone: config.timezone, rotationSeconds: config.rotationSeconds, city: config.weather.city, weatherEnabled: config.weather.enabled }
}

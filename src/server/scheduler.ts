import type { Config, DataSource, WeatherConfig } from '../shared/config'
import type { SourceState } from '../shared/display'
import { fetchSource } from './sources'
import { fetchWeather } from './sources/weather'

interface Job {
  signature: string
  source?: DataSource
  weather?: WeatherConfig
  timezone: string
  interval: number
  state: SourceState
  disposed: boolean
  queued: boolean
  running: boolean
  controller?: AbortController
  timer?: ReturnType<typeof setTimeout>
  completion?: Promise<void>
  resolve?: () => void
}
interface Fetchers { source: typeof fetchSource; weather: typeof fetchWeather }

export class SourceScheduler {
  private jobs = new Map<string, Job>()
  private order: string[] = []
  private queue: Job[] = []
  private active = 0
  private stopped = false
  private fetchers: Fetchers

  constructor(private readonly onChange: () => void, fetchers: Partial<Fetchers> = {}) {
    this.fetchers = { source: fetchSource, weather: fetchWeather, ...fetchers }
  }

  configure(config: Config): void {
    if (this.stopped) return
    const definitions = [
      ...(config.weather.enabled ? [{ id: '@weather', name: config.weather.city, type: 'weather' as const, weather: config.weather, source: undefined, interval: config.weather.intervalSeconds, timezone: config.timezone }] : []),
      ...config.sources.filter(source => source.enabled).map(source => ({ id: source.id, name: source.name, type: source.type, source, weather: undefined, interval: source.intervalSeconds, timezone: config.timezone })),
    ]
    this.order = definitions.map(definition => definition.id)
    const wanted = new Set(this.order)
    for (const [id, job] of this.jobs) {
      if (!wanted.has(id)) { this.dispose(job); this.jobs.delete(id) }
    }
    for (const definition of definitions) {
      const signature = JSON.stringify(definition)
      const existing = this.jobs.get(definition.id)
      if (existing?.signature === signature) continue
      if (existing) this.dispose(existing)
      const job: Job = {
        signature, source: definition.source, weather: definition.weather, timezone: definition.timezone, interval: definition.interval,
        disposed: false, queued: false, running: false,
        state: { id: definition.id, name: definition.name, type: definition.type, status: 'loading', fetching: false, items: [], updatedAt: null, attemptedAt: null },
      }
      this.jobs.set(definition.id, job)
      void this.refresh(definition.id)
    }
    this.onChange()
  }

  snapshot(): SourceState[] {
    return structuredClone(this.order.flatMap(id => this.jobs.get(id)?.state ?? []))
  }

  refresh(id: string): Promise<void> {
    const job = this.jobs.get(id)
    if (!job || job.disposed || this.stopped) return Promise.resolve()
    if (job.queued || job.running) return job.completion!
    clearTimeout(job.timer)
    job.queued = true
    job.completion = new Promise(resolve => { job.resolve = resolve })
    this.queue.push(job)
    this.pump()
    return job.completion
  }

  private pump() {
    while (!this.stopped && this.active < 4 && this.queue.length) {
      const job = this.queue.shift()!
      if (job.disposed) { job.resolve?.(); continue }
      job.queued = false; job.running = true; this.active++
      void this.run(job)
    }
  }

  private async run(job: Job) {
    job.controller = new AbortController()
    job.state.fetching = true
    job.state.attemptedAt = new Date().toISOString()
    this.onChange()
    try {
      const signal = AbortSignal.any([job.controller.signal, AbortSignal.timeout(10_000)])
      const result = job.weather ? await this.fetchers.weather(job.weather, signal, job.timezone) : await this.fetchers.source(job.source!, signal)
      if (!job.disposed) {
        if (job.weather) job.state.weather = result as SourceState['weather']
        else job.state.items = result as SourceState['items']
        job.state.status = 'ready'
        job.state.updatedAt = new Date().toISOString()
        delete job.state.error
      }
    } catch {
      if (!job.disposed) {
        job.state.status = job.state.updatedAt ? 'stale' : 'error'
        job.state.error = '取得できませんでした。URL・接続・データ形式を確認してください。'
      }
    } finally {
      job.running = false; job.state.fetching = false; this.active--
      if (!job.disposed && !this.stopped) {
        job.timer = setTimeout(() => { void this.refresh(job.state.id) }, job.interval * 1000)
        job.timer.unref()
        this.onChange()
      }
      job.resolve?.()
      this.pump()
    }
  }

  private dispose(job: Job) {
    job.disposed = true
    clearTimeout(job.timer)
    job.controller?.abort()
    if (job.queued) job.resolve?.()
  }

  stop(): void {
    this.stopped = true
    for (const job of this.jobs.values()) this.dispose(job)
    this.queue = []
  }
}

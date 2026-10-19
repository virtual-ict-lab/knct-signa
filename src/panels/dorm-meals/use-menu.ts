import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { japanDate, menuForDate } from './menu'

export function useDormMenu(settings: () => { url: string; intervalSeconds: number }) {
  const data = shallowRef<unknown>(null)
  const date = ref(japanDate())
  const status = ref<'loading' | 'ready' | 'error'>('loading')
  const menu = computed(() => menuForDate(data.value, date.value))
  let timer: ReturnType<typeof setInterval> | undefined
  let controller: AbortController | undefined
  let stopped = false
  async function refresh(clear = false) {
    controller?.abort()
    const current = new AbortController()
    controller = current
    if (clear) { data.value = null; status.value = 'loading' }
    const timeout = setTimeout(() => current.abort(), 10000)
    try {
      const response = await fetch(settings().url, { signal: current.signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
      if (!response.ok) throw new Error()
      const raw = await response.text()
      if (raw.length > 2 * 1024 * 1024) throw new Error()
      const parsed: unknown = JSON.parse(raw)
      if (controller !== current || stopped) return
      data.value = parsed; status.value = 'ready'
    } catch {
      if (controller === current && !stopped) status.value = 'error'
    } finally { clearTimeout(timeout) }
  }
  watch([() => settings().url, () => settings().intervalSeconds], () => {
    clearInterval(timer)
    void refresh(true)
    timer = setInterval(() => { void refresh() }, settings().intervalSeconds * 1000)
  }, { immediate: true })
  const clock = setInterval(() => {
    const next = japanDate()
    if (date.value !== next) { date.value = next; void refresh() }
  }, 1000)
  onScopeDispose(() => { stopped = true; clearInterval(timer); clearInterval(clock); controller?.abort() })
  return { menu, status }
}

import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
import type { DisplaySnapshot } from '../../shared/display'
import { applySnapshot } from './display-state'

export function useDisplay() {
  const snapshot = shallowRef<DisplaySnapshot | null>(null)
  const connection = ref<'connecting' | 'online' | 'reconnecting'>('connecting')
  let socket: WebSocket | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false; let attempts = 0; let receivedSocketState = false
  const controller = new AbortController()

  function connect() {
    if (stopped) return
    const next = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`)
    socket = next
    next.onopen = () => { if (socket === next) { connection.value = 'online'; attempts = 0 } }
    next.onmessage = event => {
      if (socket !== next || stopped) return
      try {
        snapshot.value = applySnapshot(snapshot.value, JSON.parse(event.data))
        receivedSocketState = true
      } catch { /* 受信済みの画面を維持する */ }
    }
    next.onerror = () => next.close()
    next.onclose = () => {
      if (socket !== next || stopped) return
      connection.value = 'reconnecting'
      const delay = Math.min(15_000, 500 * 2 ** Math.min(attempts++, 5)) + Math.random() * 300
      timer = setTimeout(connect, delay)
    }
  }
  onMounted(() => {
    void fetch('/api/display', { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('取得失敗')
      return response.json()
    }).then(value => { if (!stopped && !receivedSocketState) snapshot.value = applySnapshot(snapshot.value, value) }).catch(() => {})
    connect()
  })
  onUnmounted(() => { stopped = true; clearTimeout(timer); controller.abort(); socket?.close() })
  return { snapshot, connection }
}

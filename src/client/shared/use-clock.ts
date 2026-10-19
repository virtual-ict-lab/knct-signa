import { computed, onMounted, onUnmounted, ref, type ComputedRef } from 'vue'

export function useClock(timezone: ComputedRef<string>) {
  const now = ref(new Date())
  let interval: ReturnType<typeof setInterval>
  onMounted(() => { interval = setInterval(() => { now.value = new Date() }, 1000) })
  onUnmounted(() => clearInterval(interval))
  const timeFormat = computed(() => new Intl.DateTimeFormat('ja-JP', { timeZone: timezone.value, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }))
  const dateFormat = computed(() => new Intl.DateTimeFormat('ja-JP', { timeZone: timezone.value, year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }))
  const time = computed(() => timeFormat.value.format(now.value))
  const date = computed(() => dateFormat.value.format(now.value))
  return { time, date }
}

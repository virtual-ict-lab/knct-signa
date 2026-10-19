<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDisplay } from '../shared/use-display'
import { useClock } from '../shared/use-clock'
import ThemeSwitch from '../shared/ThemeSwitch.vue'
import { parseThemePreference, resolveTheme, type ThemePreference } from '../shared/theme'
import { informationMessage } from './information'
import WeatherIcon from './WeatherIcon.vue'
import BackgroundImage from './BackgroundImage.vue'
import PanelHost from './panels/PanelHost.vue'
import { defaultPanels } from '../../shared/panels'
import './kiosk.css'

const { snapshot, connection } = useDisplay()
const timezone = computed(() => snapshot.value?.config.timezone ?? 'Asia/Tokyo')
const { time, date } = useClock(timezone)
const fullscreen = ref(false)
const fullscreenError = ref('')
function updateFullscreen() { fullscreen.value = !!document.fullscreenElement }
async function toggleFullscreen() {
  fullscreenError.value = ''
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  } catch { fullscreenError.value = '全画面切替失敗' }
}
onMounted(() => {
  updateFullscreen()
  document.addEventListener('fullscreenchange', updateFullscreen)
})
onUnmounted(() => document.removeEventListener('fullscreenchange', updateFullscreen))
const preference = ref<ThemePreference | null>(null)
try { preference.value = parseThemePreference(localStorage.getItem('display.theme')) } catch { /* ストレージが使えない場合は画面内だけで保持 */ }
const theme = computed({
  get: () => resolveTheme(snapshot.value?.config.theme ?? 'dark', snapshot.value?.revision ?? 0, preference.value),
  set: value => {
    preference.value = { theme: value, revision: snapshot.value?.revision ?? 0 }
    try { localStorage.setItem('display.theme', JSON.stringify(preference.value)) } catch { /* 画面内の選択は維持 */ }
  },
})
watch(theme, value => { document.documentElement.dataset.theme = value }, { immediate: true })
const weatherState = computed(() => snapshot.value?.states.find(state => state.type === 'weather'))
const weather = computed(() => weatherState.value?.weather)
const states = computed(() => snapshot.value?.states.filter(state => state.type !== 'weather') ?? [])
const entries = computed(() => states.value.flatMap(source => source.items.map(item => ({ ...item, source }))))
const panels = computed(() => (snapshot.value?.config.panels ?? defaultPanels()).filter(panel => panel.enabled))
const panelContext = computed(() => ({ states: snapshot.value?.states ?? [], timezone: timezone.value, rotationSeconds: snapshot.value?.config.rotationSeconds ?? 12 }))
const ticker = computed(() => entries.value.map(item => `${item.source.name}：${item.title}`).join('　　 /　　 '))
const emptyMessage = computed(() => informationMessage(states.value))
function weatherDescription(code?: number) {
  if (code === undefined) return ''
  if (code === 0) return '快晴'
  if (code <= 2) return '晴れ・曇り'
  if (code === 3) return '曇り'
  if (code <= 48) return '霧'
  if (code <= 67) return '雨'
  if (code <= 77) return '雪'
  if (code <= 82) return 'にわか雨'
  if (code <= 86) return 'にわか雪'
  return '雷雨'
}
function shortTime(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('ja-JP', { timeZone: timezone.value, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : '—'
}
</script>

<template>
  <div class="kiosk-shell">
    <BackgroundImage v-if="snapshot?.config.backgroundImageUrl" :key="snapshot.config.backgroundImageUrl" :url="snapshot.config.backgroundImageUrl" />
    <div class="kiosk-controls">
      <ThemeSwitch v-model="theme" />
      <button type="button" class="fullscreen-button" :aria-pressed="fullscreen" @click="toggleFullscreen">{{ fullscreen ? '全画面解除' : '全画面' }}</button>
      <span v-if="fullscreenError" class="fullscreen-error" role="status">{{ fullscreenError }}</span>
    </div>
    <main class="kiosk-main">
      <aside class="kiosk-sidebar">
        <section class="clock-panel" aria-label="現在時刻">
          <div class="clock-time">{{ time }}</div>
          <div class="clock-date">{{ date }}</div>
          <div class="clock-location">{{ snapshot?.config.city ?? '高松' }}</div>
          <p v-if="connection === 'reconnecting'" class="connection-error" role="status">再接続中</p>
        </section>
        <section v-if="snapshot?.config.weatherEnabled !== false" class="weather-panel" aria-label="今日の天気">
          <div class="panel-topline"><h2>今日の天気</h2><span class="weather-update">{{ weatherState?.status === 'stale' ? '前回取得データ' : weatherState?.updatedAt ? `${shortTime(weatherState.updatedAt)} 更新` : '' }}</span></div>
          <div class="weather-main"><WeatherIcon :code="weather?.code" /><div class="weather-temperature">{{ weather ? Math.round(weather.temperature) : '—' }}<span>°C</span></div></div>
          <div class="weather-description">{{ weather ? weatherDescription(weather.code) : weatherState?.status === 'error' ? '取得失敗' : '取得中' }}</div>
          <div class="weather-stats">
            <div><span>最高 / 最低</span><strong>{{ weather ? Math.round(weather.high) : '—' }}°<i>/</i>{{ weather ? Math.round(weather.low) : '—' }}°</strong></div>
            <div><span>降水確率</span><strong>{{ weather?.precipitation ?? '—' }}<small>%</small></strong></div>
          </div>
          <div class="weather-credit"><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">気象データ</a></div>
        </section>
      </aside>
      <section class="updates-panel" aria-label="パネル">
        <div v-if="panels.length" class="panel-grid">
          <PanelHost v-for="panel in panels" :key="panel.id" :panel="panel" :context="panelContext" />
        </div>
        <div v-else class="kiosk-empty" role="status">情報はありません</div>
      </section>
    </main>
    <footer class="kiosk-ticker" aria-label="ニュース">
      <div class="ticker-window"><div v-if="ticker" class="ticker-content" :style="{ animationDuration: `${Math.max(30, ticker.length * .4)}s` }"><span>{{ ticker }}　　 /　　 </span><span aria-hidden="true">{{ ticker }}　　 /　　 </span></div><span v-else class="ticker-placeholder">{{ emptyMessage }}</span></div>
    </footer>
  </div>
</template>

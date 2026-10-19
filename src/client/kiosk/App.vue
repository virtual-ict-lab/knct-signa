<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import Brand from '../shared/Brand.vue'
import { useDisplay } from '../shared/use-display'
import { useClock } from '../shared/use-clock'
import WeatherIcon from './WeatherIcon.vue'
import './kiosk.css'

const { snapshot, connection } = useDisplay()
const timezone = computed(() => snapshot.value?.config.timezone ?? 'Asia/Tokyo')
const { time, date } = useClock(timezone)
const weatherState = computed(() => snapshot.value?.states.find(state => state.type === 'weather'))
const weather = computed(() => weatherState.value?.weather)
const states = computed(() => snapshot.value?.states.filter(state => state.type !== 'weather') ?? [])
const entries = computed(() => states.value.flatMap(source => source.items.map(item => ({ ...item, source }))))
const page = ref(0)
const pageCount = computed(() => Math.max(1, Math.ceil(entries.value.length / 4)))
const currentPage = computed(() => page.value % pageCount.value)
const visibleEntries = computed(() => entries.value.slice(currentPage.value * 4, currentPage.value * 4 + 4))
const ticker = computed(() => entries.value.map(item => `${item.source.name} ─ ${item.title}`).join('　　 /　　 '))
const sourceErrors = computed(() => states.value.filter(state => state.status === 'error'))
let rotation: ReturnType<typeof setInterval>
watch(() => snapshot.value?.config.rotationSeconds ?? 12, seconds => {
  clearInterval(rotation)
  rotation = setInterval(() => { page.value++ }, seconds * 1000)
}, { immediate: true })
watch(() => snapshot.value?.config.title, title => { if (title) document.title = title })
onUnmounted(() => clearInterval(rotation))

function weatherDescription(code?: number) {
  if (code === undefined) return ''
  if (code === 0) return '快晴'
  if (code <= 2) return '晴れ、ときどき曇り'
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
async function fullscreen() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen() } catch { /* ブラウザー側の表示設定も利用できる */ }
}
</script>

<template>
  <div class="kiosk-shell">
    <header class="kiosk-header">
      <Brand />
      <span class="kiosk-heading">{{ snapshot?.config.title ?? 'knct-signa' }}<span class="header-divider">/</span><span class="eyebrow">INFORMATION DISPLAY</span></span>
      <div class="kiosk-connection" role="status"><span class="connection-dot" :class="{ online: connection === 'online' }"></span>{{ connection === 'online' ? 'LIVE' : connection === 'connecting' ? '接続中' : '再接続中' }}</div>
      <button class="fullscreen-button" title="全画面表示を切り替え" aria-label="全画面表示を切り替え" @click="fullscreen"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5" /></svg></button>
    </header>

    <main class="kiosk-main">
      <aside class="kiosk-sidebar">
        <section class="clock-panel" aria-label="現在時刻">
          <div class="clock-overline"><span class="eyebrow">RIGHT HERE, RIGHT NOW</span><span class="clock-asterisk">✳</span></div>
          <div class="clock-time">{{ time.slice(0, 5) }}<span class="clock-seconds">{{ time.slice(6) }}</span></div>
          <div class="clock-date">{{ date }}</div>
          <div class="clock-location"><span class="location-mark"></span>{{ snapshot?.config.city ?? '高松' }}<span class="clock-zone">{{ timezone }}</span></div>
        </section>

        <section v-if="snapshot?.config.weatherEnabled !== false" class="weather-panel" aria-label="今日の天気">
          <div class="panel-topline"><span class="eyebrow">TODAY’S WEATHER</span><span class="weather-update">{{ weatherState?.status === 'stale' ? '前回取得データ' : weatherState?.updatedAt ? `${shortTime(weatherState.updatedAt)} 更新` : '今日の天気' }}</span></div>
          <div class="weather-main"><WeatherIcon :code="weather?.code" /><div class="weather-temperature">{{ weather ? Math.round(weather.temperature) : '—' }}<span>°C</span></div></div>
          <div class="weather-description">{{ weather ? weatherDescription(weather.code) : weatherState?.status === 'error' ? '天気を取得できませんでした' : '天気を取得しています' }}</div>
          <div class="weather-stats">
            <div><span>最高 / 最低</span><strong><b class="temperature-high">{{ weather ? Math.round(weather.high) : '—' }}°</b><i>/</i>{{ weather ? Math.round(weather.low) : '—' }}°</strong></div>
            <div><span>降水確率</span><strong>{{ weather?.precipitation ?? '—' }}<small>%</small></strong></div>
          </div>
          <div class="weather-credit">Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a></div>
        </section>
        <div class="sidebar-note"><span class="note-line"></span><p>日々の情報を、<br>いつもの場所で。</p><span class="eyebrow">A LITTLE MORE CONNECTED.</span></div>
      </aside>

      <section class="updates-panel" aria-label="ニュースとお知らせ">
        <div class="updates-heading"><div><span class="eyebrow">NEWS & UPDATES</span><h1>キャンパスのいま<span>。</span></h1></div><span class="item-count">{{ entries.length.toString().padStart(2, '0') }}<small>TOPICS</small></span></div>
        <div class="updates-meta"><span><i></i>{{ states.length ? `${states.length}つのデータソースからお届け` : 'あなたの場所に、あなたの情報を。' }}</span><div class="page-dots" v-if="pageCount > 1"><i v-for="n in Math.min(pageCount, 8)" :key="n" :class="{ active: n - 1 === currentPage % 8 }"></i><span>{{ currentPage + 1 }} / {{ pageCount }}</span></div><span v-else class="eyebrow">STAY IN THE LOOP</span></div>

        <div v-if="visibleEntries.length" class="news-grid">
          <article v-for="(item, index) in visibleEntries" :key="`${item.source.id}-${item.id}`" class="news-card">
            <div class="news-card-top"><span class="source-tag">{{ item.source.name }}</span><span class="news-number">{{ String(currentPage * 4 + index + 1).padStart(2, '0') }}</span></div>
            <h2>{{ item.title }}</h2><p v-if="item.body" class="news-description">{{ item.body }}</p>
            <div class="news-card-bottom"><span>{{ item.source.status === 'stale' ? '前回取得データ' : `${shortTime(item.source.updatedAt)} 更新` }}</span><a v-if="item.url" :href="item.url" target="_blank" rel="noopener noreferrer" aria-label="記事を開く">↗</a><span v-else>{{ item.source.type.toUpperCase() }}</span></div>
          </article>
        </div>
        <div v-else class="kiosk-empty">
          <div class="empty-orbit" aria-hidden="true"><span></span><i></i><b>✳</b></div>
          <span class="eyebrow">MAKE THIS SPACE YOURS</span>
          <h2>{{ sourceErrors.length ? '情報の取得を待っています。' : states.length ? 'まもなく、情報が届きます。' : '必要な情報を、ひとつの画面に。' }}</h2>
          <p>{{ sourceErrors.length ? '接続先を確認しながら、自動で再取得します。' : states.length ? '配信元からの最初のデータを取得しています。' : 'お知らせも、ニュースも。ここからつながる、いつもの毎日。' }}</p>
          <a v-if="!states.length" href="/manage" target="_blank" rel="noopener" class="empty-action">表示内容を設定する<span>↗</span></a>
          <span v-else-if="sourceErrors.length" class="empty-source-errors">{{ sourceErrors.map(source => source.name).join(' / ') }} を取得できませんでした</span>
        </div>
        <div class="updates-bottom"><span>KNCT SIGNA<span class="bottom-slash">/</span>YOUR EVERYDAY INFORMATION</span><span v-if="sourceErrors.length">{{ sourceErrors.length }}件のソースが取得待ち</span><span v-else>ひと目で、今日がわかる。</span></div>
      </section>
    </main>

    <footer class="kiosk-ticker"><span class="ticker-label"><span></span>INFORMATION</span><div class="ticker-window"><div v-if="ticker" class="ticker-content"><span>{{ ticker }}　　 /　　 </span><span aria-hidden="true">{{ ticker }}　　 /　　 </span></div><span v-else class="ticker-placeholder">{{ connection === 'reconnecting' ? 'サーバーへ再接続しています。表示中の情報は最後に取得した内容です。' : '今日も、よい一日を。' }}</span></div><span class="ticker-end">knct-signa</span></footer>
  </div>
</template>

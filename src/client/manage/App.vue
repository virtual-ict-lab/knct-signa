<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Config, DataSource } from '../../shared/config'
import Brand from '../shared/Brand.vue'
import { useDisplay } from '../shared/use-display'
import SourceEditor from './SourceEditor.vue'
import './manage.css'

const { snapshot, connection } = useDisplay()
const tab = ref<'general' | 'sources' | 'status'>('general')
const draft = ref<Config | null>(null)
const baseline = ref('')
const headers = ref<Record<string, string>>({})
const loading = ref(true); const saving = ref(false)
const error = ref(''); const notice = ref(''); const conflict = ref(false)
const savedAt = ref<string | null>(null)
let noticeTimer: ReturnType<typeof setTimeout>
const form = ref<HTMLFormElement | null>(null)
const dirty = computed(() => !!draft.value && (JSON.stringify(draft.value) !== baseline.value || draft.value.sources.some(source => source.type === 'json' && (headers.value[source.id] ?? '{}') !== JSON.stringify(source.headers, null, 2))))
const headings = { general: ['DISPLAY SETTINGS', '表示を、整える。', '画面に流す情報と、見せ方を設定します。'], sources: ['DATA SOURCES', '情報を、つなぐ。', 'ニュースから独自のデータまで、表示する情報を選びます。'], status: ['SYSTEM STATUS', 'いまの状態を、ひと目で。', '接続とデータの取得状況を確認します。'] }
const heading = computed(() => headings[tab.value])
const enabledCount = computed(() => draft.value?.sources.filter(source => source.enabled).length ?? 0)
const states = computed(() => snapshot.value?.states ?? [])
const otherUpdate = computed(() => !!draft.value && !!snapshot.value && snapshot.value.revision > draft.value.revision)

function accept(config: Config) {
  draft.value = config; baseline.value = JSON.stringify(config)
  headers.value = Object.fromEntries(config.sources.filter(source => source.type === 'json').map(source => [source.id, JSON.stringify(source.headers, null, 2)]))
  conflict.value = false
}
async function load() {
  loading.value = true; error.value = ''; notice.value = ''
  try {
    const response = await fetch('/api/manage/config')
    if (!response.ok) throw new Error('設定を読み込めませんでした。認証とサーバーの状態を確認してください。')
    accept(await response.json())
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '設定の読み込みに失敗しました' }
  finally { loading.value = false }
}
async function save() {
  if (!draft.value || saving.value || !form.value?.reportValidity()) return
  saving.value = true; error.value = ''; notice.value = ''
  try {
    const proposed: Config = JSON.parse(JSON.stringify(draft.value))
    for (const source of proposed.sources) {
      if (source.type !== 'json') continue
      try {
        const value = JSON.parse(headers.value[source.id] || '{}')
        if (!value || Array.isArray(value) || typeof value !== 'object' || Object.values(value).some(item => typeof item !== 'string')) throw new Error()
        source.headers = value
      } catch { tab.value = 'sources'; throw new Error(`${source.name || 'JSON API'}: ヘッダーは文字列の値を持つJSONオブジェクトで入力してください。`) }
    }
    const response = await fetch('/api/manage/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(proposed) })
    const result = await response.json()
    if (!response.ok) {
      if (response.status === 409) conflict.value = true
      throw new Error(result.issues?.join(' / ') || result.error || '保存できませんでした')
    }
    accept(result)
    savedAt.value = new Date().toISOString()
    notice.value = '保存しました。キオスクに反映しています。'
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice.value = '' }, 6000)
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '保存に失敗しました。接続を確認してください。' }
  finally { saving.value = false }
}
function addSource(type: DataSource['type']) {
  if (!draft.value || draft.value.sources.length >= 32) return
  const base = { id: crypto.randomUUID(), type, name: '', url: '', enabled: true, intervalSeconds: 300 }
  const source: DataSource = type === 'rss' ? { ...base, type: 'rss' } : { ...base, type: 'json', itemsPath: '', titlePath: 'title', bodyPath: 'description', linkPath: 'url', headers: {} }
  draft.value.sources.push(source)
  headers.value[source.id] = '{}'
}
function removeSource(index: number) {
  const source = draft.value?.sources[index]
  if (!source) return
  delete headers.value[source.id]
  draft.value!.sources.splice(index, 1)
}
function moveSource(index: number, direction: number) {
  if (!draft.value) return
  const target = index + direction
  if (target < 0 || target >= draft.value.sources.length) return
  const sources = draft.value.sources
  ;[sources[index], sources[target]] = [sources[target]!, sources[index]!]
}
function time(value: string | null) {
  return value ? new Intl.DateTimeFormat('ja-JP', { timeZone: draft.value?.timezone ?? 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : '—'
}
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value) { event.preventDefault(); event.returnValue = '' } }
onMounted(() => { void load(); window.addEventListener('beforeunload', beforeUnload) })
onUnmounted(() => { clearTimeout(noticeTimer); window.removeEventListener('beforeunload', beforeUnload) })
</script>

<template>
  <div class="manage-shell">
    <aside class="manage-sidebar">
      <div class="sidebar-brand"><Brand /><span class="sidebar-brand-label">MANAGEMENT CONSOLE</span></div>
      <div class="sidebar-section-label">WORKSPACE</div>
      <nav aria-label="管理メニュー"><button type="button" :class="{ selected: tab === 'general' }" @click="tab = 'general'"><span>01</span>一般設定<i>↗</i></button><button type="button" :class="{ selected: tab === 'sources' }" @click="tab = 'sources'"><span>02</span>データソース<b>{{ draft?.sources.length ?? 0 }}</b></button><button type="button" :class="{ selected: tab === 'status' }" @click="tab = 'status'"><span>03</span>取得状況<i>↗</i></button></nav>
      <div class="sidebar-preview"><span class="preview-illustration" aria-hidden="true"><i></i><b></b></span><p>いつもの場所に、<br>必要な情報を。</p><a href="/kiosk" target="_blank" rel="noopener">キオスクを開く<span>↗</span></a></div>
      <div class="sidebar-footer"><div><span class="connection-dot" :class="{ online: connection === 'online' }"></span>{{ connection === 'online' ? 'サーバーに接続中' : 'サーバーへ再接続中' }}</div><span>KNCT SIGNA <i>v0.1</i></span></div>
    </aside>

    <main class="manage-main">
      <header class="manage-topbar"><span>ワークスペース<span class="breadcrumb-slash">/</span><b>{{ tab === 'general' ? '一般設定' : tab === 'sources' ? 'データソース' : '取得状況' }}</b></span><span class="local-badge"><span></span>LOCAL DISPLAY</span></header>
      <div class="manage-content">
        <div class="manage-page-heading"><div><span class="eyebrow">{{ heading[0] }}</span><h1>{{ heading[1] }}</h1><p>{{ heading[2] }}</p></div><a class="secondary-button preview-button" href="/kiosk" target="_blank" rel="noopener">キオスクを表示<span>↗</span></a></div>

        <div class="overview-grid"><div class="overview-card"><span class="overview-label">接続ステータス</span><strong><span class="connection-dot" :class="{ online: connection === 'online' }"></span>{{ connection === 'online' ? 'オンライン' : '接続を確認中' }}</strong><small>設定の変更をリアルタイムで反映</small></div><div class="overview-card"><span class="overview-label">有効なデータソース</span><strong>{{ enabledCount }}<span class="overview-unit">/ {{ draft?.sources.length ?? 0 }}</span></strong><small>RSS・JSON APIの登録数</small></div><div class="overview-card"><span class="overview-label">設定の保存</span><strong class="save-overview">{{ dirty ? '未保存の変更あり' : 'すべて保存済み' }}<span class="saved-check" v-if="!dirty && draft">✓</span></strong><small>{{ savedAt ? `${time(savedAt)} に保存` : `revision ${draft?.revision ?? '—'}` }}</small></div></div>

        <div v-if="error" class="message error-message" role="alert"><span>!</span><div>{{ error }}</div></div>
        <div v-if="notice" class="message success-message" role="status"><span>✓</span><div>{{ notice }}</div></div>
        <div v-if="conflict || otherUpdate" class="conflict-banner"><span>別の画面で設定が更新されています。編集中の入力は保持しています。</span><button type="button" @click="load" :disabled="saving">最新設定で入力を置き換える ↻</button></div>
        <div v-if="loading" class="loading-panel">設定を読み込んでいます…</div>
        <button v-if="!draft && !loading" class="secondary-button" type="button" @click="load">読み込みを再試行</button>

        <form v-if="draft" id="settings-form" ref="form" @submit.prevent="save">
          <fieldset :disabled="saving || loading" class="settings-fieldset">
            <template v-if="tab === 'general'">
              <section class="settings-card"><div class="section-heading"><span class="section-number">01</span><div><h2>表示の基本設定</h2><p>画面の名前と、時刻・表示の切り替えを設定します。</p></div><span class="section-corner">DISPLAY</span></div><div class="settings-card-body"><label class="field">サイネージの名前<input v-model="draft.title" required maxlength="120" placeholder="knct-signa" /><small>キオスク画面のヘッダーに表示されます。</small></label><div class="field-grid"><label class="field">タイムゾーン<input v-model="draft.timezone" required list="timezones" placeholder="Asia/Tokyo" /><datalist id="timezones"><option value="Asia/Tokyo"/><option value="UTC"/></datalist></label><label class="field">記事の切り替え間隔（秒）<input v-model.number="draft.rotationSeconds" type="number" required min="5" max="120" step="1" /><small>5件以上の記事を順番に表示します。</small></label></div></div></section>
              <section class="settings-card"><div class="section-heading"><span class="section-number">02</span><div><h2>今日の天気</h2><p>表示する地域と、天気の更新頻度を設定します。</p></div><label class="switch section-toggle"><input v-model="draft.weather.enabled" type="checkbox" aria-label="今日の天気を表示" /><span></span></label></div><div class="settings-card-body"><div class="field-grid"><label class="field">地域の表示名<input v-model="draft.weather.city" required maxlength="100" placeholder="高松" /></label><label class="field">取得間隔（秒）<input v-model.number="draft.weather.intervalSeconds" type="number" required min="60" max="86400" step="1" /></label><label class="field">緯度<input v-model.number="draft.weather.latitude" type="number" required min="-90" max="90" step="any" /></label><label class="field">経度<input v-model.number="draft.weather.longitude" type="number" required min="-180" max="180" step="any" /></label></div><div class="field-note"><span>↗</span>地域の座標に合わせた天気を表示します。天気データ：Open-Meteo</div></div></section>
              <div class="settings-tip"><span>✳</span><p>変更は保存後、表示中のキオスクへ自動で反映されます。</p><a href="/kiosk" target="_blank" rel="noopener">表示を確認 ↗</a></div>
            </template>

            <template v-if="tab === 'sources'">
              <div class="sources-toolbar"><div><h2>登録したデータソース<span>{{ draft.sources.length }} / 32</span></h2><p>上から順に表示します。RSSとJSON APIを自由に組み合わせられます。</p></div><div class="source-add-actions"><button type="button" class="secondary-button" :disabled="draft.sources.length >= 32" @click="addSource('rss')">＋ RSSを追加</button><button type="button" class="dark-button" :disabled="draft.sources.length >= 32" @click="addSource('json')">＋ JSON APIを追加</button></div></div>
              <div v-if="!draft.sources.length" class="manage-empty"><span class="empty-source-icon">＋</span><span class="eyebrow">CONNECT YOUR INFORMATION</span><h2>最初のデータソースをつなぎましょう。</h2><p>ニュースのRSSや独自のJSON APIを追加して、<br>この場所に合ったサイネージを作れます。</p><button class="dark-button" type="button" @click="addSource('rss')">＋ RSSフィードを追加</button></div>
              <SourceEditor v-for="(source, index) in draft.sources" :key="source.id" v-model="draft.sources[index]!" :index="index" :total="draft.sources.length" :headers-text="headers[source.id] ?? '{}'" @headers="headers[source.id] = $event" @remove="removeSource(index)" @move="moveSource(index, $event)" />
            </template>

            <template v-if="tab === 'status'">
              <section class="settings-card"><div class="section-heading"><span class="section-number">↻</span><div><h2>データの取得状況</h2><p>設定した間隔で自動更新されます。</p></div><span class="section-corner">LIVE STATUS</span></div><div v-if="!states.length" class="status-empty">有効なデータソースがありません。</div><div v-for="state in states" :key="state.id" class="status-row"><span class="status-source-icon">{{ state.type === 'weather' ? '☀' : state.type === 'rss' ? '≋' : '{ }' }}</span><div class="status-source-info"><strong>{{ state.name }}</strong><small>{{ state.type.toUpperCase() }}<span v-if="state.error"> · {{ state.error }}</span></small></div><div class="status-times"><span>最終取得 {{ time(state.updatedAt) }}</span><small>最終試行 {{ time(state.attemptedAt) }}</small></div><span class="status-badge" :class="state.status">{{ state.fetching ? '取得中' : state.status === 'ready' ? '正常' : state.status === 'stale' ? '前回データを表示' : state.status === 'error' ? '取得失敗' : '取得待ち' }}</span></div></section>
              <div class="settings-tip"><span>✳</span><p>取得に失敗したときも、最後に取得できた情報を表示しながら再試行します。</p></div>
            </template>
          </fieldset>
        </form>
        <footer class="manage-content-footer"><span>KNCT SIGNA <span>/</span> MANAGEMENT CONSOLE</span><span>いつもの毎日を、少し便利に。</span></footer>
      </div>
      <div v-if="draft" class="manage-savebar"><div><span class="save-indicator" :class="{ dirty }"></span><span>{{ saving ? '設定を保存しています…' : dirty ? '変更がまだ保存されていません' : '最新の設定が保存されています' }}</span></div><div class="savebar-actions"><span class="revision-label">REV. {{ String(draft.revision).padStart(3, '0') }}</span><button class="primary-button" type="submit" form="settings-form" :disabled="!dirty || saving || loading">{{ saving ? '保存中…' : '変更を保存' }}<span>↗</span></button></div></div>
    </main>
  </div>
</template>

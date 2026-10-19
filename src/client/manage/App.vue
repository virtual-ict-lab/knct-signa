<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Config, DataSource } from '../../shared/config'
import ThemeSwitch from '../shared/ThemeSwitch.vue'
import { useDisplay } from '../shared/use-display'
import SourceEditor from './SourceEditor.vue'
import { createSourceId, formatTime } from './management-utils'
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
const headings = { general: '一般設定', sources: 'データソース', status: '取得状況' }
const heading = computed(() => headings[tab.value])
watch(() => draft.value?.theme ?? snapshot.value?.config.theme ?? 'dark', value => { document.documentElement.dataset.theme = value }, { immediate: true })
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
    if (!response.ok) throw new Error('読込失敗')
    accept(await response.json())
  } catch { error.value = '読込失敗' }
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
      } catch { tab.value = 'sources'; throw new Error('ヘッダー形式エラー') }
    }
    const response = await fetch('/api/manage/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(proposed) })
    if (!response.ok) {
      if (response.status === 409) conflict.value = true
      throw new Error(response.status === 409 ? '保存競合' : response.status === 400 ? '入力エラー' : '保存失敗')
    }
    const result = await response.json()
    accept(result)
    savedAt.value = new Date().toISOString()
    notice.value = '保存完了'
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice.value = '' }, 6000)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : ''
    error.value = ['ヘッダー形式エラー', '保存競合', '入力エラー'].includes(message) ? message : '保存失敗'
  }
  finally { saving.value = false }
}
function addSource(type: DataSource['type']) {
  if (!draft.value || draft.value.sources.length >= 32) return
  const base = { id: createSourceId(), type, name: '', url: '', enabled: true, intervalSeconds: 300 }
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
  return formatTime(value, draft.value?.timezone ?? 'Asia/Tokyo')
}
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value) { event.preventDefault(); event.returnValue = '' } }
onMounted(() => { void load(); window.addEventListener('beforeunload', beforeUnload) })
onUnmounted(() => { clearTimeout(noticeTimer); window.removeEventListener('beforeunload', beforeUnload) })
</script>

<template>
  <div class="manage-shell">
    <aside class="manage-sidebar">
      <h1 class="management-label">管理画面</h1>
      <ThemeSwitch v-if="draft" v-model="draft.theme" :disabled="saving || loading" />
      <nav aria-label="管理メニュー">
        <button type="button" :class="{ selected: tab === 'general' }" @click="tab = 'general'">一般設定</button>
        <button type="button" :class="{ selected: tab === 'sources' }" @click="tab = 'sources'">データソース<span>{{ draft?.sources.length ?? 0 }}</span></button>
        <button type="button" :class="{ selected: tab === 'status' }" @click="tab = 'status'">取得状況</button>
      </nav>
      <a class="sidebar-kiosk-link" href="/kiosk" target="_blank" rel="noopener">キオスク表示</a>
      <div class="sidebar-footer">{{ connection === 'online' ? '接続中' : '再接続中' }}</div>
    </aside>
    <main class="manage-main">
      <div class="manage-content">
        <header class="manage-page-heading"><h2>{{ heading }}</h2><a class="secondary-button" href="/kiosk" target="_blank" rel="noopener">キオスク表示</a></header>
        <div class="overview-grid">
          <div class="overview-card"><span class="overview-label">接続状態</span><strong>{{ connection === 'online' ? '接続中' : '接続待ち' }}</strong></div>
          <div class="overview-card"><span class="overview-label">有効なデータソース</span><strong>{{ enabledCount }}<span class="overview-unit">/ {{ draft?.sources.length ?? 0 }}</span></strong></div>
          <div class="overview-card"><span class="overview-label">保存状態</span><strong class="save-overview">{{ dirty ? '未保存' : '保存済み' }}</strong><small v-if="savedAt">{{ time(savedAt) }}</small></div>
        </div>
        <div v-if="error" class="message error-message" role="alert">{{ error }}</div>
        <div v-if="notice" class="message success-message" role="status">{{ notice }}</div>
        <div v-if="conflict || otherUpdate" class="conflict-banner"><span>設定更新あり</span><button type="button" @click="load" :disabled="saving">最新設定を読込</button></div>
        <div v-if="loading" class="loading-panel">読込中</div>
        <button v-if="!draft && !loading" class="secondary-button" type="button" @click="load">再読込</button>
        <form v-if="draft" id="settings-form" ref="form" @submit.prevent="save">
          <fieldset :disabled="saving || loading" class="settings-fieldset">
            <template v-if="tab === 'general'">
              <section class="settings-card">
                <div class="section-heading"><h3>表示設定</h3></div>
                <div class="settings-card-body"><div class="field-grid">
                  <label class="field">テーマ<select v-model="draft.theme"><option value="dark">ダーク</option><option value="light">ライト</option></select></label>
                  <label class="field">タイムゾーン<input v-model="draft.timezone" required list="timezones" placeholder="Asia/Tokyo" /><datalist id="timezones"><option value="Asia/Tokyo"/><option value="UTC"/></datalist></label>
                  <label class="field">記事の切り替え間隔（秒）<input v-model.number="draft.rotationSeconds" type="number" required min="5" max="120" step="1" /></label>
                </div></div>
              </section>
              <section class="settings-card">
                <div class="section-heading"><h3>今日の天気</h3><label class="switch section-toggle"><input v-model="draft.weather.enabled" type="checkbox" aria-label="今日の天気を表示" /><span></span></label></div>
                <div class="settings-card-body"><div class="field-grid">
                  <label class="field">地域名<input v-model="draft.weather.city" required maxlength="100" placeholder="高松" /></label>
                  <label class="field">取得間隔（秒）<input v-model.number="draft.weather.intervalSeconds" type="number" required min="60" max="86400" step="1" /></label>
                  <label class="field">緯度<input v-model.number="draft.weather.latitude" type="number" required min="-90" max="90" step="any" /></label>
                  <label class="field">経度<input v-model.number="draft.weather.longitude" type="number" required min="-180" max="180" step="any" /></label>
                </div></div>
              </section>
            </template>
            <template v-if="tab === 'sources'">
              <div class="sources-toolbar"><h3>登録数 {{ draft.sources.length }} / 32</h3><div class="source-add-actions"><button type="button" class="secondary-button" :disabled="draft.sources.length >= 32" @click="addSource('rss')">RSS追加</button><button type="button" class="dark-button" :disabled="draft.sources.length >= 32" @click="addSource('json')">JSON API追加</button></div></div>
              <div v-if="!draft.sources.length" class="manage-empty">情報はありません</div>
              <SourceEditor v-for="(source, index) in draft.sources" :key="source.id" v-model="draft.sources[index]!" :index="index" :total="draft.sources.length" :headers-text="headers[source.id] ?? '{}'" @headers="headers[source.id] = $event" @remove="removeSource(index)" @move="moveSource(index, $event)" />
            </template>
            <template v-if="tab === 'status'">
              <section class="settings-card">
                <div class="section-heading"><h3>取得状況</h3></div>
                <div v-if="!states.length" class="status-empty">情報はありません</div>
                <div v-for="state in states" :key="state.id" class="status-row">
                  <div class="status-source-info"><strong>{{ state.name }}</strong><small>{{ state.type === 'weather' ? '天気' : state.type.toUpperCase() }}</small></div>
                  <div class="status-times"><span>最終取得 {{ time(state.updatedAt) }}</span><small>最終試行 {{ time(state.attemptedAt) }}</small></div>
                  <span class="status-badge" :class="state.status">{{ state.fetching ? '取得中' : state.status === 'ready' ? '正常' : state.status === 'stale' ? '前回データ' : state.status === 'error' ? '取得失敗' : '取得待ち' }}</span>
                </div>
              </section>
            </template>
          </fieldset>
        </form>
      </div>
      <div v-if="draft" class="manage-savebar"><span>{{ saving ? '保存中' : dirty ? '未保存' : '保存済み' }}</span><button class="primary-button" type="submit" form="settings-form" :disabled="!dirty || saving || loading">{{ saving ? '保存中' : '保存' }}</button></div>
    </main>
  </div>
</template>

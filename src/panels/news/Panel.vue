<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { PanelProps } from '../../shared/panel-definition'
import { informationMessage } from '../../client/kiosk/information'
const props = defineProps<PanelProps>()
const entries = computed(() => props.context.states.filter(source => source.type !== 'weather').flatMap(source => source.items.map(item => ({ ...item, source }))))
const page = ref(0)
const pageSize = computed(() => props.panel.width === 'half' ? 2 : 4)
const pageCount = computed(() => Math.max(1, Math.ceil(entries.value.length / pageSize.value)))
const currentPage = computed(() => page.value % pageCount.value)
const visibleEntries = computed(() => entries.value.slice(currentPage.value * pageSize.value, (currentPage.value + 1) * pageSize.value))
let rotation: ReturnType<typeof setInterval> | undefined
watch(() => props.context.rotationSeconds, seconds => {
  clearInterval(rotation)
  rotation = setInterval(() => { page.value++ }, seconds * 1000)
}, { immediate: true })
onUnmounted(() => clearInterval(rotation))
function shortTime(value: string | null) {
  return value ? new Intl.DateTimeFormat('ja-JP', { timeZone: props.context.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) : '—'
}
</script>

<template>
  <div class="news-panel" :class="{ 'news-panel--half': panel.width === 'half' }">
    <div v-if="entries.length" class="news-pagination">{{ entries.length }}件<span v-if="pageCount > 1" class="page-count">{{ currentPage + 1 }} / {{ pageCount }}</span></div>
    <div v-if="visibleEntries.length" class="news-grid">
      <article v-for="item in visibleEntries" :key="`${item.source.id}-${item.id}`" class="news-card">
        <div class="source-name">{{ item.source.name }}</div>
        <h2>{{ item.title }}</h2><p v-if="item.body" class="news-description">{{ item.body }}</p>
        <div class="news-card-bottom"><span>{{ item.source.status === 'stale' ? '前回取得データ' : `${shortTime(item.source.updatedAt)} 更新` }}</span><a v-if="item.url" :href="item.url" target="_blank" rel="noopener noreferrer">詳細</a></div>
      </article>
    </div>
    <div v-else class="kiosk-empty" role="status">{{ informationMessage(context.states.filter(source => source.type !== 'weather')) }}</div>
  </div>
</template>

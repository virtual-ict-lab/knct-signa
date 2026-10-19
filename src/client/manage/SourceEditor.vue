<script setup lang="ts">
import type { DataSource } from '../../shared/config'
const source = defineModel<DataSource>({ required: true })
defineProps<{ index: number; total: number; headersText: string }>()
defineEmits<{ remove: []; move: [direction: number]; headers: [text: string] }>()
</script>

<template>
  <details class="source-editor" open>
    <summary><span class="source-order">{{ String(index + 1).padStart(2, '0') }}</span><span class="source-type">{{ source.type === 'rss' ? 'RSS' : 'JSON API' }}</span><span class="source-summary-name">{{ source.name || '新しいデータソース' }}</span><span class="source-summary-state">{{ source.enabled ? '表示中' : '無効' }}</span><span class="source-chevron">⌄</span></summary>
    <div class="source-editor-body">
      <div class="field-grid source-basics"><label class="field">表示名<input v-model="source.name" required maxlength="120" placeholder="学内のお知らせ" /></label><label class="field">取得間隔（秒）<input v-model.number="source.intervalSeconds" type="number" required min="60" max="86400" step="1" /></label></div>
      <label class="field">{{ source.type === 'rss' ? 'RSSフィードのURL' : 'JSON APIのURL' }}<input v-model="source.url" type="url" required maxlength="2048" placeholder="https://example.com/feed.xml" /></label>
      <template v-if="source.type === 'json'">
        <div class="json-mapping-title"><span>表示するフィールド</span><small>階層は data.items のように「.」で区切ります</small></div>
        <div class="field-grid"><label class="field">配列のパス<input v-model="source.itemsPath" placeholder="data.items（ルートの配列は空欄）" /></label><label class="field">タイトルのパス<input v-model="source.titlePath" required placeholder="title" /></label><label class="field">本文のパス<input v-model="source.bodyPath" placeholder="description（省略可）" /></label><label class="field">リンクのパス<input v-model="source.linkPath" placeholder="url（省略可）" /></label></div>
        <label class="field">リクエストヘッダー（JSON・任意）<textarea :value="headersText" @input="$emit('headers', ($event.target as HTMLTextAreaElement).value)" rows="3" spellcheck="false" placeholder='{"Authorization": "Bearer ..."}'></textarea><small>ヘッダーはサーバーからの取得にのみ使用します。</small></label>
      </template>
      <div class="source-editor-footer"><label class="toggle-row"><span class="switch"><input v-model="source.enabled" type="checkbox" /><span></span></span><span>キオスクに表示する</span></label><div class="source-actions"><button type="button" class="icon-button" :disabled="index === 0" aria-label="上へ移動" @click="$emit('move', -1)">↑</button><button type="button" class="icon-button" :disabled="index === total - 1" aria-label="下へ移動" @click="$emit('move', 1)">↓</button><button type="button" class="delete-button" @click="$emit('remove')">削除</button></div></div>
    </div>
  </details>
</template>

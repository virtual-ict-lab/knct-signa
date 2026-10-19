<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { PanelProps } from '../../shared/panel-definition'
import { isBackgroundImageUrl } from '../../shared/background'
const props = defineProps<PanelProps<{ url: string; fit: 'contain' | 'cover' }>>()
const loaded = ref(false)
const failed = ref(false)
const validUrl = computed(() => !!props.settings.url && isBackgroundImageUrl(props.settings.url))
watch(() => props.settings.url, () => { loaded.value = false; failed.value = false })
</script>

<template>
  <div class="image-panel">
    <div class="image-panel-content">
      <img v-if="validUrl" v-show="loaded && !failed" :key="settings.url" :src="settings.url" :alt="panel.title" :style="{ objectFit: settings.fit }" referrerpolicy="no-referrer" decoding="async" draggable="false" @load="loaded = true" @error="failed = true" />
      <div v-if="!loaded || failed" class="kiosk-empty" role="status">{{ failed ? '画像の読込失敗' : validUrl ? '読込中' : '情報はありません' }}</div>
    </div>
  </div>
</template>

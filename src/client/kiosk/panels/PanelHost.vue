<script setup lang="ts">
import { computed, onErrorCaptured, ref, watch } from 'vue'
import type { Panel } from '../../../shared/panels'
import type { PanelContext } from '../../../shared/panel-definition'
import { panelComponents } from './registry'
const props = defineProps<{ panel: Panel; context: PanelContext }>()
const failed = ref(false)
const component = computed(() => Object.hasOwn(panelComponents, props.panel.type) ? panelComponents[props.panel.type] : null)
watch(() => props.panel, () => { failed.value = false }, { deep: true })
onErrorCaptured(() => { failed.value = true; return false })
</script>

<template>
  <section class="content-panel" :class="{ 'content-panel--full': panel.width === 'full' }" :aria-label="panel.title || undefined">
    <h2 v-if="panel.title" class="content-panel-title">{{ panel.title }}</h2>
    <component :is="component" v-if="component && !failed" :panel="panel" :settings="panel.settings" :context="context" />
    <div v-else class="kiosk-empty" role="status">{{ component ? '表示失敗' : 'パネルが見つかりません' }}</div>
  </section>
</template>

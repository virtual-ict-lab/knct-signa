<script setup lang="ts">
import { computed, ref } from 'vue'
import { panelCatalog } from '../../shared/panel-catalog.generated'
import { createPanel, MAX_PANELS, type Panel } from '../../shared/panels'
import PanelSettings from './PanelSettings.vue'
const panels = defineModel<Panel[]>({ required: true })
const selected = ref(panelCatalog[0]?.id ?? '')
const definitions = computed(() => new Map(panelCatalog.map(panel => [panel.id, panel])))
function add() { if (panels.value.length < MAX_PANELS && definitions.value.has(selected.value)) panels.value.push(createPanel(selected.value)) }
function move(index: number, direction: number) {
  const target = index + direction
  if (target < 0 || target >= panels.value.length) return
  ;[panels.value[index], panels.value[target]] = [panels.value[target]!, panels.value[index]!]
}
</script>

<template>
  <div class="panel-add-toolbar">
    <label class="field">パネルの種類<select v-model="selected" :disabled="!panelCatalog.length"><option v-for="definition in panelCatalog" :key="definition.id" :value="definition.id">{{ definition.name }}</option></select></label>
    <button type="button" class="secondary-button" :disabled="panels.length >= MAX_PANELS || !panelCatalog.length" @click="add">パネル追加</button>
    <span>{{ panels.length }} / {{ MAX_PANELS }}</span>
  </div>
  <div v-if="!panels.length" class="manage-empty">情報はありません</div>
  <section v-for="(panel, index) in panels" :key="panel.id" class="settings-card panel-editor">
    <div class="section-heading"><h3>{{ definitions.get(panel.type)?.name ?? panel.type }}</h3><label class="switch section-toggle"><input v-model="panel.enabled" type="checkbox" :aria-label="`${panel.title || panel.type}を表示`" /><span></span></label></div>
    <div class="settings-card-body">
      <div class="field-grid">
        <label class="field">見出し<input v-model="panel.title" maxlength="120" /></label>
        <label class="field">幅<select v-model="panel.width"><option value="full">全幅</option><option value="half">半幅</option></select></label>
      </div>
      <PanelSettings v-if="definitions.has(panel.type)" v-model="panel.settings" :definition="definitions.get(panel.type)!" />
      <p v-else class="panel-missing">パネルが見つかりません</p>
      <div class="source-editor-footer">
        <div class="source-actions"><button type="button" class="icon-button" :disabled="index === 0" aria-label="パネルを上へ" @click="move(index, -1)">↑</button><button type="button" class="icon-button" :disabled="index === panels.length - 1" aria-label="パネルを下へ" @click="move(index, 1)">↓</button></div>
        <button type="button" class="delete-button" @click="panels.splice(index, 1)">削除</button>
      </div>
    </div>
  </section>
</template>

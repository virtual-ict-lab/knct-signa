import { defineAsyncComponent, type Component } from 'vue'
import { panelCatalog } from '../../../shared/panel-catalog.generated'

// src/panels/<ID>/panel.json + Panel.vue がビルド時に自動登録される。
const modules = import.meta.glob<{ default: Component }>('../../../panels/*/Panel.vue')
export const panelComponents: Record<string, Component> = Object.fromEntries(panelCatalog.map(definition => {
  const load = modules[`../../../panels/${definition.id}/Panel.vue`]
  if (!load) throw new Error(`パネルが見つかりません: ${definition.id}`)
  return [definition.id, defineAsyncComponent(() => load().then(module => module.default))]
}))

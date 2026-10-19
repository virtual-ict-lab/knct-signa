import { panelCatalog } from './panel-catalog.generated'
import type { PanelSettings } from './panel-definition'

export interface Panel {
  id: string
  type: string
  enabled: boolean
  width: 'full' | 'half'
  title: string
  settings: PanelSettings
}
export const MAX_PANELS = 4
export function defaultPanels(): Panel[] {
  return [{ id: 'news', type: 'news', enabled: true, width: 'full', title: 'お知らせ', settings: {} }]
}
export function createPanel(type: string): Panel {
  const definition = panelCatalog.find(panel => panel.id === type)
  if (!definition) throw new Error('パネルが見つかりません')
  return {
    id: crypto.randomUUID(), type, enabled: true, width: 'full', title: definition.name,
    settings: Object.fromEntries(definition.fields.map(field => [field.key, field.default])),
  }
}

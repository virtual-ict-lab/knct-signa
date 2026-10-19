import { z } from 'zod'
import { MAX_PANELS } from './panels'
import { panelCatalog } from './panel-catalog.generated'
import { settingsSchema, type PanelSettings } from './panel-definition'

const identifier = z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/)
const settings = z.record(z.string().min(1).max(80).refine(key => !['__proto__', 'prototype', 'constructor'].includes(key)), z.union([z.string().max(10000), z.number().finite(), z.boolean()])).refine(value => Object.keys(value).length <= 32)
const schemas = new Map(panelCatalog.map(definition => [definition.id, settingsSchema(definition)]))
export const panelSchema = z.object({
  id: identifier,
  type: identifier,
  enabled: z.boolean(),
  width: z.enum(['full', 'half']),
  title: z.string().trim().max(120),
  settings: settings.default({}),
}).transform((panel, context) => {
  const schema = schemas.get(panel.type)
  // 未インストールのパネルも設定を保持し、再インストール時に復元できるようにする。
  if (!schema) return panel
  const parsed = schema.safeParse(panel.settings)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) context.addIssue({ code: 'custom', message: issue.message, path: ['settings', ...issue.path] })
    return z.NEVER
  }
  if (!settings.safeParse(parsed.data).success) {
    context.addIssue({ code: 'custom', message: '設定項目が多すぎます', path: ['settings'] })
    return z.NEVER
  }
  return { ...panel, settings: parsed.data as PanelSettings }
})
export const panelsSchema = z.array(panelSchema).max(MAX_PANELS).refine(
  panels => new Set(panels.map(panel => panel.id)).size === panels.length, 'パネルのIDが重複しています',
)

import { z } from 'zod'
import { isBackgroundImageUrl } from './background'
import type { SourceState } from './display'

const key = z.string().min(1).max(80).regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/).refine(value => !['__proto__', 'prototype', 'constructor'].includes(value))
const fieldBase = { key, label: z.string().trim().min(1).max(120) }
const stringField = { default: z.string().max(10000), required: z.boolean().optional(), maxLength: z.number().int().min(1).max(10000).optional() }
export const panelFieldSchema = z.discriminatedUnion('type', [
  z.object({ ...fieldBase, ...stringField, type: z.literal('text') }),
  z.object({ ...fieldBase, ...stringField, type: z.literal('textarea') }),
  z.object({ ...fieldBase, type: z.literal('image'), default: z.string().refine(isBackgroundImageUrl), required: z.boolean().optional() }),
  z.object({ ...fieldBase, type: z.literal('url'), default: z.string().max(2048), required: z.boolean().optional() }),
  z.object({ ...fieldBase, type: z.literal('number'), default: z.number().finite(), min: z.number().finite().optional(), max: z.number().finite().optional(), step: z.number().positive().finite().optional() }),
  z.object({ ...fieldBase, type: z.literal('boolean'), default: z.boolean() }),
  z.object({ ...fieldBase, type: z.literal('select'), default: z.string(), options: z.array(z.object({ value: z.string().max(120), label: z.string().min(1).max(120) })).min(1).max(32) }),
])
export type PanelField = z.infer<typeof panelFieldSchema>
export type SettingValue = string | number | boolean
export type PanelSettings = Record<string, SettingValue>
export const panelDefinitionSchema = z.object({
  id: key,
  name: z.string().trim().min(1).max(120),
  fields: z.array(panelFieldSchema).max(32).refine(fields => new Set(fields.map(field => field.key)).size === fields.length, '設定項目のキーが重複しています'),
})
export type PanelDefinition = z.infer<typeof panelDefinitionSchema>

export function settingsSchema(definition: PanelDefinition) {
  const shape: Record<string, z.ZodType> = {}
  for (const field of definition.fields) {
    let schema: z.ZodType
    switch (field.type) {
      case 'number': {
        let number = z.number().finite()
        if (field.min !== undefined) number = number.min(field.min)
        if (field.max !== undefined) number = number.max(field.max)
        if (field.step !== undefined) number = number.refine(value => Math.abs((value - (field.min ?? 0)) / field.step! - Math.round((value - (field.min ?? 0)) / field.step!)) < 1e-8)
        schema = number
        break
      }
      case 'boolean': schema = z.boolean(); break
      case 'select': schema = z.enum(field.options.map(option => option.value) as [string, ...string[]]); break
      case 'image': schema = z.string().max(2048).refine(value => (!field.required || !!value) && isBackgroundImageUrl(value)); break
      case 'url': schema = z.string().max(2048).refine(value => {
        if (!value) return !field.required
        try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password } catch { return false }
      }); break
      default: schema = z.string().max(field.maxLength ?? 10000).refine(value => !field.required || !!value.trim())
    }
    shape[field.key] = schema.default(field.default)
  }
  return z.object(shape).passthrough()
}

// 自作Panel.vueのprops。settingsはpanel.jsonから生成・検証され、contextは共通の表示データ。
export interface PanelContext { states: SourceState[]; timezone: string; rotationSeconds: number }
export interface PanelProps<T extends PanelSettings = PanelSettings> {
  panel: { id: string; type: string; enabled: boolean; width: 'full' | 'half'; title: string; settings: PanelSettings }
  settings: T
  context: PanelContext
}

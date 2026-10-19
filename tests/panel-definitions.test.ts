import { expect, test } from 'bun:test'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generatePanelCatalog } from '../scripts/generate-panels'
import { panelDefinitionSchema, settingsSchema } from '../src/shared/panel-definition'

test('discovers a new folder and its custom settings without a registry change', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'signa-plugin-'))
  try {
    const root = join(dir, 'panels'); const plugin = join(root, 'custom'); const output = join(dir, 'catalog.ts')
    await mkdir(plugin, { recursive: true })
    await writeFile(join(plugin, 'Panel.vue'), '<template>予定表</template>')
    await writeFile(join(plugin, 'panel.json'), JSON.stringify({ id: 'custom', name: '予定表', fields: [
      { key: 'limit', label: '表示件数', type: 'number', default: 3, min: 1, max: 10, step: 1 },
      { key: 'compact', label: '省略表示', type: 'boolean', default: false },
      { key: 'mode', label: '期間', type: 'select', default: 'today', options: [{ value: 'today', label: '今日' }] },
    ] }))
    const [definition] = await generatePanelCatalog(root, output)
    expect(definition?.id).toBe('custom')
    const schema = settingsSchema(definition!)
    expect(schema.parse({ limit: 5, compact: true })).toEqual({ limit: 5, compact: true, mode: 'today' })
    for (const input of [{ limit: 0 }, { limit: 2.5 }, { compact: 'yes' }, { mode: 'invalid' }]) expect(schema.safeParse(input).success).toBe(false)
    const first = await readFile(output, 'utf8')
    await generatePanelCatalog(root, output)
    expect(await readFile(output, 'utf8')).toBe(first)
    await rm(join(plugin, 'Panel.vue'))
    await expect(generatePanelCatalog(root, output)).rejects.toThrow()
    expect(await readFile(output, 'utf8')).toBe(first)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('rejects duplicate and prototype property fields in plugin definitions', () => {
  const field = { key: 'body', label: '本文', type: 'text', default: '' }
  for (const fields of [[field, field], [{ ...field, key: '__proto__' }], [{ ...field, key: 'constructor' }]]) {
    expect(panelDefinitionSchema.safeParse({ id: 'custom', name: '独自', fields }).success).toBe(false)
  }
})

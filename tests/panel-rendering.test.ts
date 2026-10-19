import { afterAll, beforeAll, expect, test } from 'bun:test'
import { createServer, type ViteDevServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import type { PanelDefinition } from '../src/shared/panel-definition'

let server: ViteDevServer
beforeAll(async () => { server = await createServer({ configFile: false, plugins: [vue()], server: { middlewareMode: true }, appType: 'custom' }) })
afterAll(async () => { await server?.close() })

test('generates custom controls with saved values and validation constraints from the plugin definition', async () => {
  const { default: Form } = await server.ssrLoadModule('/src/client/manage/PanelSettings.vue')
  const definition: PanelDefinition = { id: 'custom', name: '独自パネル', fields: [
    { key: 'body', label: '独自の本文', type: 'textarea', default: '', required: true, maxLength: 200 },
    { key: 'count', label: '独自の件数', type: 'number', default: 3, min: 1, max: 10, step: 1 },
    { key: 'compact', label: '独自の切替', type: 'boolean', default: false },
    { key: 'mode', label: '独自の選択肢', type: 'select', default: 'today', options: [{ value: 'today', label: '今日' }, { value: 'week', label: '今週' }] },
  ] }
  const html = await renderToString(createSSRApp(Form, { definition, modelValue: { body: '<script>alert(1)</script>', count: 5, compact: true, mode: 'week' } }))
  expect(html).toContain('独自の本文')
  expect(html).toContain('required maxlength="200"')
  expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  expect(html).toContain('type="number" value="5" min="1" max="10" step="1"')
  expect(html).toContain('type="checkbox" checked')
  expect(html).toContain('value="week" selected')
})

test('loads a discovered Vue component into the shared panel frame and escapes its text', async () => {
  const { default: Host } = await server.ssrLoadModule('/src/client/kiosk/panels/PanelHost.vue')
  const html = await renderToString(createSSRApp(Host, {
    panel: { id: 'image-1', type: 'image', enabled: true, width: 'half', title: '予定 <img src=x onerror=alert(1)>', settings: { url: '', fit: 'contain' } },
    context: { states: [], timezone: 'Asia/Tokyo', rotationSeconds: 12 },
  }))
  expect(html).toContain('class="content-panel"')
  expect(html).toContain('class="image-panel"')
  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  expect(html).not.toContain('<img')
})

test('keeps the window and a short fallback when its plugin is no longer installed', async () => {
  const { default: Host } = await server.ssrLoadModule('/src/client/kiosk/panels/PanelHost.vue')
  const html = await renderToString(createSSRApp(Host, {
    panel: { id: 'missing', type: 'uninstalled', enabled: true, width: 'full', title: '予定', settings: {} },
    context: { states: [], timezone: 'Asia/Tokyo', rotationSeconds: 12 },
  }))
  expect(html).toContain('content-panel--full')
  expect(html).toContain('パネルが見つかりません')
})

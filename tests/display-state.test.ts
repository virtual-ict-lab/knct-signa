import { expect, test } from 'bun:test'
import { applySnapshot } from '../src/client/shared/display-state'
import type { DisplaySnapshot } from '../src/shared/display'

const snapshot = (instanceId: string, sequence: number, title: string): DisplaySnapshot => ({
  type: 'snapshot', instanceId, sequence, revision: sequence,
  config: { title, timezone: 'Asia/Tokyo', rotationSeconds: 12, city: '高松', weatherEnabled: true }, states: [],
})
test('keeps the latest state when an older initial HTTP response arrives after WebSocket', () => {
  const current = snapshot('server-one', 5, '最新設定')
  expect(applySnapshot(current, snapshot('server-one', 4, '古い設定'))?.config.title).toBe('最新設定')
})
test('accepts the new server state after restarting even when its sequence is lower', () => {
  expect(applySnapshot(snapshot('server-one', 20, '旧サーバー'), snapshot('server-two', 1, '再起動後'))?.config.title).toBe('再起動後')
})
test('preserves the display on invalid messages', () => {
  const current = snapshot('server-one', 5, '取得済み')
  expect(applySnapshot(current, { type: 'something-else' })?.config.title).toBe('取得済み')
  expect(applySnapshot(current, null)?.config.title).toBe('取得済み')
})

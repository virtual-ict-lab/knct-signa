import { expect, test } from 'bun:test'
import { createSourceId, formatTime } from '../src/client/manage/management-utils'

test('editing an incomplete timezone does not interrupt time rendering', () => {
  expect(formatTime('2026-10-19T00:01:02Z', '')).toBe('09:01:02')
  expect(formatTime('2026-10-19T00:01:02Z', 'Asia/')).toBe('09:01:02')
  expect(formatTime('2026-10-19T00:01:02Z', 'UTC')).toBe('00:01:02')
  expect(formatTime(null, 'Asia/')).toBe('—')
})

test('creates valid distinct source IDs using the crypto API available over ordinary HTTP', () => {
  const httpCrypto = { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) }
  const first = createSourceId(httpCrypto)
  const second = createSourceId(httpCrypto)
  expect(first).toMatch(/^[a-zA-Z0-9_-]{1,80}$/)
  expect(first).not.toBe(second)
})

import { expect, test } from 'bun:test'
import { japanDate, menuForDate } from '../src/panels/dorm-meals/menu'

test('selects the requested day even when the next week is listed first and returns menu names only', () => {
  const data = { weeks: [
    { days: [{ date: '2026-10-26', breakfast: { text: '翌週の献立' } }] },
    { days: [{ date: '2026-10-20',
      breakfast: { text: '[ A ]\nごはん\n[ B ]\nパン\n[ 共通料理 ]\n白菜のクリーム煮', warnings: ['低信頼度'], rawText: '出さない文字' },
      lunch: { text: 'ミートスパゲティー\nロールパン' },
      dinner: { text: '[ A ]\n鯖のカレー竜田揚げ\n[ B ]\n鮭のちゃんちゃん焼き' },
    }] },
  ] }
  expect(menuForDate(data, '2026-10-20')).toEqual({ breakfast: ['ごはん', 'パン', '白菜のクリーム煮'], lunch: ['ミートスパゲティー', 'ロールパン'], dinner: ['鯖のカレー竜田揚げ', '鮭のちゃんちゃん焼き'] })
  expect(menuForDate(data, '2026-10-21')).toBeNull()
})

test('uses the Japan calendar date across midnight independently of the host timezone', () => {
  expect(japanDate(new Date('2026-10-19T14:59:59Z'))).toBe('2026-10-19')
  expect(japanDate(new Date('2026-10-19T15:00:00Z'))).toBe('2026-10-20')
})

test('handles missing or malformed meals without leaking raw OCR text', () => {
  for (const input of [null, [], {}, { weeks: [null, { days: 'bad' }] }]) expect(menuForDate(input, '2026-10-20')).toBeNull()
  expect(menuForDate({ weeks: [{ days: [{ date: '2026-10-20', breakfast: { rawText: '出さない' }, lunch: { text: 3 } }] }] }, '2026-10-20')).toEqual({ breakfast: [], lunch: [], dinner: [] })
})

test('keeps loaded menus and the fetch interval across unrelated snapshots, and stops on removal', async () => {
  const { effectScope, reactive, nextTick } = await import('vue')
  const { useDormMenu } = await import('../src/panels/dorm-meals/use-menu')
  let requests = 0
  const api = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => {
    requests++
    return Response.json({ weeks: [{ days: [{ date: japanDate(), breakfast: { text: 'ごはん' } }] }] })
  } })
  const props = reactive({ settings: { url: api.url.href, intervalSeconds: 600 } })
  const scope = effectScope()
  try {
    const state = scope.run(() => useDormMenu(() => props.settings))!
    const end = Date.now() + 2000
    while (!state.menu.value) { if (Date.now() > end) throw new Error('Menu fetch timed out'); await Bun.sleep(5) }
    expect(requests).toBe(1)
    props.settings = { ...props.settings }
    await nextTick(); await Bun.sleep(30)
    expect(requests).toBe(1)
    expect(state.menu.value?.breakfast).toEqual(['ごはん'])
    props.settings = { ...props.settings, url: new URL('/updated', api.url).href }
    await nextTick()
    const updatedEnd = Date.now() + 2000
    while (requests < 2) { if (Date.now() > updatedEnd) throw new Error('Settings update timed out'); await Bun.sleep(5) }
    expect(requests).toBe(2)
    scope.stop()
    props.settings = { ...props.settings, url: new URL('/removed', api.url).href }
    await nextTick(); await Bun.sleep(30)
    expect(requests).toBe(2)
  } finally { scope.stop(); api.stop(true) }
})

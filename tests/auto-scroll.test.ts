import { expect, test } from 'bun:test'
import { createScrollState, advanceScroll } from '../src/client/shared/auto-scroll'

test('waits at the top before scrolling slowly', () => {
  const state = createScrollState(0, 0)
  for (let time = 0; time <= 2500; time += 50) expect(advanceScroll(state, time, 100)).toBe(0)
  for (let time = 2550; time <= 3500; time += 50) advanceScroll(state, time, 100)
  expect(state.position).toBeCloseTo(20)
})

test('pauses at both ends and reverses without jumping', () => {
  const state = createScrollState(0, 0)
  for (let time = 0; time <= 3000; time += 50) advanceScroll(state, time, 10)
  expect(state.position).toBe(10)
  expect(state.direction).toBe(-1)
  for (let time = 3050; time <= 5500; time += 50) expect(advanceScroll(state, time, 10)).toBe(10)
  for (let time = 5550; time <= 6000; time += 50) advanceScroll(state, time, 10)
  expect(state.position).toBe(0)
  expect(state.direction).toBe(1)
  expect(advanceScroll(state, 6050, 10)).toBe(0)
})

test('clamps the position when refreshed content gets shorter or no longer overflows', () => {
  const state = createScrollState(0, 80)
  expect(advanceScroll(state, 50, 30)).toBe(30)
  expect(advanceScroll(state, 100, 0)).toBe(0)
})

test('avoids a large jump after a delayed frame', () => {
  const state = createScrollState(0, 0)
  expect(advanceScroll(state, 100000, 1000)).toBe(1)
})

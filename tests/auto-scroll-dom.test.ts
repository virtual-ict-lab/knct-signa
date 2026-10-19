import { expect, test } from 'bun:test'
import { installAutoScroll } from '../src/client/shared/auto-scroll'

// Bunにはレイアウトエンジンがないため、寸法とブラウザー境界だけを差し替える。
// EventTargetとスクロール制御本体は実物を使い、ネイティブ操作後の位置を検証する。
function layout() {
  let now = performance.now()
  let sequence = 0
  const frames = new Map<number, FrameRequestCallback>()
  const saved = new Map<string, PropertyDescriptor | undefined>()
  class Element extends EventTarget {
    scrollTop = 0; scrollHeight = 200; clientHeight = 100
    overflowY = 'auto'
    children: Element[] = []
    querySelectorAll() { return this.children }
    closest() { return null }
  }
  const root = new Element(); root.overflowY = 'hidden'
  const region = new Element(); root.children.push(region)
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  const motion = Object.assign(new EventTarget(), { matches: false })
  const window = new EventTarget()
  class Observer { observe() {} unobserve() {} disconnect() {} }
  const bindings = {
    performance: { now: () => now },
    HTMLElement: Element, document, window, ResizeObserver: Observer, MutationObserver: Observer,
    getComputedStyle: (element: Element) => ({ overflowY: element.overflowY }),
    matchMedia: () => motion,
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++sequence, callback); return sequence },
    cancelAnimationFrame: (id: number) => { frames.delete(id) },
  }
  for (const [key, value] of Object.entries(bindings)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const stop = installAutoScroll(root as unknown as HTMLElement)
  return {
    root, region, document, motion,
    frame(elapsed: number) { now += elapsed; const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(now) },
    close() {
      stop()
      try { expect(frames.size).toBe(0) }
      finally {
        for (const [key, descriptor] of saved) {
          if (descriptor) Object.defineProperty(globalThis, key, descriptor)
          else Reflect.deleteProperty(globalThis, key)
        }
      }
    },
  }
}

test('preserves native keyboard scrolling while automation is paused', () => {
  const page = layout()
  try {
    page.frame(3000)
    page.root.dispatchEvent(new Event('keydown'))
    page.region.scrollTop = 60
    page.frame(16)
    expect(page.region.scrollTop).toBe(60)
  } finally { page.close() }
})

test('resumes from the manual position after reduced motion is turned off', () => {
  const page = layout()
  try {
    page.frame(3000)
    page.motion.matches = true; page.motion.dispatchEvent(new Event('change'))
    page.region.scrollTop = 60
    page.motion.matches = false; page.motion.dispatchEvent(new Event('change'))
    page.frame(16); page.frame(16)
    expect(page.region.scrollTop).toBe(60)
  } finally { page.close() }
})

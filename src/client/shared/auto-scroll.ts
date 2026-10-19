import type { ObjectDirective } from 'vue'

const PAUSE_MS = 2500
const PIXELS_PER_SECOND = 20
export interface ScrollState { position: number; direction: 1 | -1; lastTime: number; pauseUntil: number }
export function createScrollState(now: number, position: number): ScrollState {
  return { position, direction: 1, lastTime: now, pauseUntil: now + PAUSE_MS }
}
export function advanceScroll(state: ScrollState, now: number, maximum: number): number {
  const elapsed = Math.min(50, Math.max(0, now - Math.max(state.lastTime, state.pauseUntil)))
  state.lastTime = now
  state.position = Math.min(Math.max(0, maximum), Math.max(0, state.position))
  if (maximum <= 0 || !elapsed) return state.position
  state.position += state.direction * PIXELS_PER_SECOND * elapsed / 1000
  if (state.position >= maximum) {
    state.position = maximum; state.direction = -1; state.pauseUntil = now + PAUSE_MS
  } else if (state.position <= 0) {
    state.position = 0; state.direction = 1; state.pauseUntil = now + PAUSE_MS
  }
  return state.position
}

export function installAutoScroll(root: HTMLElement): () => void {
  const targets = new Map<HTMLElement, { state: ScrollState; maximum: number }>()
  const observed = new Set<Element>()
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  let animation: number | undefined
  let measurement: number | undefined
  let manualUntil = 0
  let stopped = false
  const canAnimate = () => !stopped && !motion.matches && document.visibilityState !== 'hidden'
  function start() {
    if (animation === undefined && targets.size && canAnimate()) animation = requestAnimationFrame(tick)
  }
  function tick(now: number) {
    animation = undefined
    if (!canAnimate()) return
    for (const [element, target] of targets) {
      if (now < manualUntil) {
        target.state.position = element.scrollTop
        target.state.lastTime = now
        target.state.pauseUntil = manualUntil
      } else {
        element.scrollTop = advanceScroll(target.state, now, target.maximum)
      }
    }
    start()
  }
  function measure() {
    measurement = undefined
    if (stopped) return
    const elements = new Set<HTMLElement>([root, ...root.querySelectorAll<HTMLElement>('*')].filter(element => element instanceof HTMLElement))
    for (const element of observed) if (!elements.has(element as HTMLElement)) { resize?.unobserve(element); observed.delete(element) }
    const active = new Set<HTMLElement>()
    for (const element of elements) {
      if (!observed.has(element)) { observed.add(element); resize?.observe(element) }
      if (element.closest('[data-auto-scroll="off"]') || !/^(auto|scroll)$/.test(getComputedStyle(element).overflowY)) continue
      const maximum = element.scrollHeight - element.clientHeight
      if (element.clientHeight <= 0 || maximum <= 1) continue
      active.add(element)
      const target = targets.get(element)
      if (target) target.maximum = maximum
      else targets.set(element, { state: createScrollState(performance.now(), element.scrollTop), maximum })
    }
    for (const element of targets.keys()) if (!active.has(element)) targets.delete(element)
    if (!targets.size && animation !== undefined) { cancelAnimationFrame(animation); animation = undefined }
    start()
  }
  function scheduleMeasure() {
    if (!stopped && measurement === undefined) measurement = requestAnimationFrame(measure)
  }
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure)
  const mutations = new MutationObserver(scheduleMeasure)
  mutations.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'data-auto-scroll'] })
  function pause() { manualUntil = performance.now() + 8000 }
  function nativeScroll(event: Event) {
    if (!(event.target instanceof HTMLElement)) return
    const target = targets.get(event.target)
    if (!target || Math.abs(event.target.scrollTop - target.state.position) <= 1) return
    pause()
    target.state.position = event.target.scrollTop
    target.state.lastTime = performance.now()
  }
  function visibility() {
    if (animation !== undefined) { cancelAnimationFrame(animation); animation = undefined }
    const now = performance.now()
    for (const [element, target] of targets) { target.state.position = element.scrollTop; target.state.lastTime = now; target.state.pauseUntil = now + PAUSE_MS }
    if (canAnimate()) scheduleMeasure()
  }
  root.addEventListener('wheel', pause, { passive: true })
  root.addEventListener('touchstart', pause, { passive: true })
  root.addEventListener('pointerdown', pause, { passive: true })
  root.addEventListener('keydown', pause)
  root.addEventListener('focusin', pause)
  root.addEventListener('scroll', nativeScroll, { capture: true, passive: true })
  window.addEventListener('resize', scheduleMeasure)
  document.addEventListener('visibilitychange', visibility)
  motion.addEventListener('change', visibility)
  measure()
  return () => {
    stopped = true
    if (animation !== undefined) cancelAnimationFrame(animation)
    if (measurement !== undefined) cancelAnimationFrame(measurement)
    resize?.disconnect(); mutations.disconnect(); targets.clear(); observed.clear()
    root.removeEventListener('wheel', pause)
    root.removeEventListener('touchstart', pause)
    root.removeEventListener('pointerdown', pause)
    root.removeEventListener('keydown', pause)
    root.removeEventListener('focusin', pause)
    root.removeEventListener('scroll', nativeScroll, true)
    window.removeEventListener('resize', scheduleMeasure)
    document.removeEventListener('visibilitychange', visibility)
    motion.removeEventListener('change', visibility)
  }
}
const cleanup = new WeakMap<HTMLElement, () => void>()
export const vAutoScroll: ObjectDirective<HTMLElement> = {
  mounted(element) { cleanup.set(element, installAutoScroll(element)) },
  beforeUnmount(element) { cleanup.get(element)?.(); cleanup.delete(element) },
}

import type { DisplaySnapshot } from '../../shared/display'

export function applySnapshot(current: DisplaySnapshot | null, value: unknown): DisplaySnapshot | null {
  if (!value || typeof value !== 'object') return current
  const next = value as DisplaySnapshot
  if (next.type !== 'snapshot' || typeof next.instanceId !== 'string' || !Number.isSafeInteger(next.sequence) || !Number.isSafeInteger(next.revision)) return current
  if (!next.config || typeof next.config.title !== 'string' || typeof next.config.timezone !== 'string' || typeof next.config.rotationSeconds !== 'number' || !Array.isArray(next.states)) return current
  if (current?.instanceId === next.instanceId && next.sequence <= current.sequence) return current
  return next
}

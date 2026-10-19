import type { SourceState } from '../../shared/display'

export function informationMessage(states: SourceState[]): string {
  if (states.some(state => state.status === 'loading')) return '取得中'
  if (states.some(state => state.status === 'error')) return '取得失敗'
  return '情報はありません'
}

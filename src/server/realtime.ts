import type { Config } from '../shared/config'
import { publicConfig, type DisplaySnapshot, type SourceState } from '../shared/display'

interface Subscriber { send(data: string): number | void; close(code?: number, reason?: string): void }

export class RealtimeHub {
  private readonly instanceId = crypto.randomUUID()
  private sequence = 0
  private clients = new Set<Subscriber>()
  constructor(private getConfig: () => Config, private getStates: () => SourceState[]) {}

  current(): DisplaySnapshot {
    const config = this.getConfig()
    return { type: 'snapshot', instanceId: this.instanceId, sequence: this.sequence, revision: config.revision, config: publicConfig(config), states: this.getStates() }
  }

  add(client: Subscriber) {
    this.clients.add(client)
    this.send(client, JSON.stringify(this.current()))
  }
  remove(client: Subscriber) { this.clients.delete(client) }
  publish() {
    this.sequence++
    const message = JSON.stringify(this.current())
    for (const client of this.clients) this.send(client, message)
  }
  private send(client: Subscriber, message: string) {
    try {
      const sent = client.send(message)
      if (typeof sent === 'number' && sent <= 0) { this.clients.delete(client); client.close(1013, '再接続してください') }
    } catch { this.clients.delete(client); client.close() }
  }
  close() {
    for (const client of this.clients) client.close(1001, 'サーバーを停止します')
    this.clients.clear()
  }
}

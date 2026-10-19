export interface Credentials { username: string; password: string }

export function readEnvironment(env: Record<string, string | undefined>) {
  if (!env.MANAGE_USERNAME?.trim() || env.MANAGE_USERNAME.includes(':')) throw new Error('MANAGE_USERNAMEを.envに設定してください（コロンは使用できません）')
  if (!env.MANAGE_PASSWORD?.trim()) throw new Error('MANAGE_PASSWORDを.envに設定してください')
  const port = Number(env.PORT ?? '3000')
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORTは1〜65535で指定してください')
  return {
    credentials: { username: env.MANAGE_USERNAME, password: env.MANAGE_PASSWORD },
    hostname: env.HOST ?? '127.0.0.1', port, configPath: env.CONFIG_PATH ?? 'data/config.json',
  }
}

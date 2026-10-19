import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { configSchema, createDefaultConfig, type Config } from '../shared/config'

export class ConflictError extends Error {
  constructor() { super('別の画面で設定が更新されています。最新設定を読み込み直してください。') }
}

async function persist(path: string, config: Config) {
  const temporary = `${path}.${crypto.randomUUID()}.tmp`
  try {
    await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true }).catch(() => {})
  }
}

export class ConfigStore {
  private queue: Promise<void> = Promise.resolve()
  private constructor(private readonly path: string, private current: Config) {}

  static async open(path: string): Promise<ConfigStore> {
    try {
      const raw = await readFile(path, 'utf8')
      return new ConfigStore(path, configSchema.parse(JSON.parse(raw)))
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
      await mkdir(dirname(path), { recursive: true })
      const config = createDefaultConfig()
      await persist(path, config)
      return new ConfigStore(path, config)
    }
  }

  get(): Config { return structuredClone(this.current) }

  update(input: unknown): Promise<Config> {
    const proposed = structuredClone(input)
    const operation = this.queue.then(async () => {
      const parsed = configSchema.parse(proposed)
      if (parsed.revision !== this.current.revision) throw new ConflictError()
      const next = { ...parsed, revision: this.current.revision + 1 }
      await persist(this.path, next)
      this.current = next
      return this.get()
    })
    this.queue = operation.then(() => {}, () => {})
    return operation
  }
}

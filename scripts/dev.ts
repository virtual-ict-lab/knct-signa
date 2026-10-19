import { readEnvironment } from '../src/server/environment'

try { readEnvironment(process.env) } catch (error) {
  console.error(error instanceof Error ? error.message : '環境変数を確認してください')
  process.exit(1)
}
const backend = Bun.spawn([process.execPath, '--watch', 'src/server/index.ts'], { stdout: 'inherit', stderr: 'inherit' })
const frontend = Bun.spawn([process.execPath, 'node_modules/vite/bin/vite.js'], { stdout: 'inherit', stderr: 'inherit' })
let stopping = false
function stop() {
  if (stopping) return
  stopping = true; backend.kill(); frontend.kill()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
const code = await Promise.race([backend.exited, frontend.exited])
stop()
await Promise.all([backend.exited, frontend.exited])
process.exit(code)

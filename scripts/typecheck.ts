import ts from 'typescript'
import { createParsedCommandLine, createVueLanguagePlugin } from '@vue/language-core'
import { proxyCreateProgram } from '@volar/typescript/lib/node/proxyCreateProgram'
import { dirname, resolve } from 'node:path'

// vue-tsc CLIはNodeのモジュール読み込みをフックするため、Bunでは同じ言語プラグインを直接使う。
const path = resolve(process.argv[2] ?? 'tsconfig.json')
const raw = ts.readConfigFile(path, ts.sys.readFile)
const config = ts.parseJsonConfigFileContent(raw.config ?? {}, ts.sys, dirname(path), {}, path, undefined,
  [{ extension: 'vue', isMixedContent: true, scriptKind: ts.ScriptKind.Deferred }])
const vueOptions = createParsedCommandLine(ts, ts.sys, path).vueOptions
const createProgram = proxyCreateProgram(ts, ts.createProgram, () => [
  createVueLanguagePlugin<string>(ts, config.options, vueOptions, id => id),
])
const options = { ...config.options, allowNonTsExtensions: true }
const program = createProgram({ rootNames: config.fileNames, options, host: ts.createCompilerHost(options) })
const diagnostics = [...(raw.error ? [raw.error] : []), ...config.errors, ...ts.getPreEmitDiagnostics(program)]
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: file => file, getCurrentDirectory: ts.sys.getCurrentDirectory, getNewLine: () => '\n',
  }))
  process.exit(1)
}
console.log(`Typecheck passed (${config.fileNames.length} source files, including Vue templates).`)

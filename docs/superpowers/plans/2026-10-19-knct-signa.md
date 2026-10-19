# knct-signa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bunで起動する、管理画面と表示画面を備えた部内向けサイネージを実装する。

**Architecture:** Honoで管理APIと画面を配信し、Vue 3の別エントリーで`/manage`と`/kiosk`を描画する。設定はJSONへ直列保存し、取得結果と設定を表示用スナップショットにまとめてBunのWebSocketで配信する。

**Tech Stack:** Bun、Hono、Vue 3、TypeScript、Vite、Zod、fast-xml-parser。

**Spec:** `docs/superpowers/specs/2026-10-19-knct-signa-design.md`

## Global Constraints

- 実行基盤、依存管理、開発・ビルドコマンドはBunに統一する。
- 本番は1プロセス、設定は`data/config.json`、管理資格情報は`.env`。
- `HOST=127.0.0.1`、`PORT=3000`を既定とする。
- データソースは最大32件、取得間隔は60秒から24時間。
- HTTP取得は10秒、展開後2MiBまで、ソースごとに最大100件、同時取得は最大4件。
- 管理ページと管理APIはBasic認証、表示用APIとWebSocketは読み取り専用。
- 電源断時の直前の保存の永続性保証、複数プロセスの同時書き込みは初版の範囲外。

## Review Focus

- 古い管理タブからの保存は409となり、入力は維持される。
- 保存処理の失敗後も次の保存が可能で、メモリの設定を巻き戻す必要がない。
- 接続先変更前の取得結果が遅れて到着しても新しい設定へ混入しない。
- WebSocket切断中も表示が残り、サーバー再起動後は新しいスナップショットを受け入れる。
- 外部応答のHTML、認証ヘッダー、不正JSONが画面・公開APIに流出しない。

## File Structure

- `src/shared/config.ts`：Zod設定スキーマ、初期値、設定型。
- `src/shared/display.ts`：配信用の型と公開設定の抽出。
- `src/server/config-store.ts`：JSON設定ストア。
- `src/server/sources/{http,rss,json,weather}.ts`：サイズ制限付き取得と各データ変換。
- `src/server/scheduler.ts`：取得・再取得、キャッシュ、世代管理。
- `src/server/realtime.ts`：最新状態とWebSocket配信。
- `src/server/app.ts`：Honoアプリと認証、API、静的配信。
- `src/server/index.ts`：環境変数、起動・終了、Bun WebSocket。
- `src/client/{kiosk,manage}/`：Vueの各アプリとHTMLエントリー。
- `src/client/shared/`：配信状態と共通の表示・スタイル。
- `scripts/dev.ts`：Bun/Vite開発プロセスの起動と停止。
- `tests/`：設定ストア、データソース、スケジューラー、API、WebSocketのテスト。

### Task 1: 設定スキーマとJSON保存

**Files:** `package.json`, `tsconfig.json`, `.gitignore`, `src/shared/config.ts`, `src/server/config-store.ts`, `tests/config-store.test.ts`。

**Interfaces:** `createDefaultConfig(): Config`; `ConfigStore.open(path: string): Promise<ConfigStore>`; `store.get(): Config`; `store.update(input: unknown): Promise<Config>`。競合は`ConflictError`、入力不正はZodエラー。

- [ ] 設定の初回作成、再読み込み、同一revisionの同時保存で1件成功・1件409相当、保存先の障害からの復帰、不正な既存JSONを上書きしないテストを書く。
- [ ] `bun test tests/config-store.test.ts`を実行し、未実装による失敗を確認する。
- [ ] 依存とBunコマンドを設定し、更新全体の直列化、一時ファイルとrename、保存後のメモリ切り替えを実装する。
- [ ] 同じテストと`bun test`で成功を確認し、コミットする。

### Task 2: 外部データとスケジューラー

**Files:** `src/shared/display.ts`, `src/server/sources/{http,rss,json,weather}.ts`, `src/server/scheduler.ts`, `tests/sources.test.ts`, `tests/scheduler.test.ts`。

**Interfaces:** `fetchSource(source: DataSource, signal: AbortSignal): Promise<DisplayItem[]>`; `fetchWeather(settings: WeatherConfig, signal: AbortSignal): Promise<WeatherData>`; `SourceScheduler.configure(config: Config): void`; `snapshot(): SourceState[]`; `stop(): void`; 更新コールバック`onChange(): void`。

- [ ] RSS/Atom/RDF、JSONのプロパティパス、天気、外部HTMLのテキスト化、不正応答・サイズ上限のテストを書く。
- [ ] 設定変更後の遅い応答を捨てること、失敗時の最終成功データ維持、ソース数によらず同時取得4件までのテストを書く。
- [ ] `bun test tests/sources.test.ts tests/scheduler.test.ts`で失敗を確認する。
- [ ] 取得関数と、タイムアウト・世代管理・再取得タイマーを備えるスケジューラーを実装する。時刻・取得関数はテストで差し替え可能にする。
- [ ] 対象テストと`bun test`で成功を確認し、コミットする。

### Task 3: 認証付きHTTPとWebSocket

**Files:** `src/server/{app,realtime,index}.ts`, `tests/app.test.ts`, `tests/realtime.test.ts`, `.env.example`。

**Interfaces:** `RealtimeHub`は`DisplaySnapshot`を作り、接続時・変更時に完全状態を送る。`createApp(deps): Hono`はストア、スケジューラー、Hub、資格情報、生成済みファイルのディレクトリを受け取る。`startServer(options)`は停止できるBunサーバーを返す。

- [ ] 管理画面・管理APIの401、正資格情報、設定PUTと409、不正Origin、公開APIの秘密除外、未設定資格情報のテストを書く。
- [ ] 実際のローカルWebSocketで初期状態・設定保存後の配信・再接続後の状態同期をテストする。
- [ ] `bun test tests/app.test.ts tests/realtime.test.ts`で失敗を確認する。
- [ ] Hono認証とAPI、公開用設定の抽出、BunのWebSocket、既定環境変数、終了処理を実装する。
- [ ] 対象テストと`bun test`で成功を確認し、コミットする。

### Task 4: Vueキオスクと管理画面

**Files:** `src/client/`, `vite.config.ts`, `scripts/dev.ts`, `public/favicon.svg`。

**Interfaces:** `useDisplay()`は公開状態と接続状況を返す。管理画面は`GET/PUT /api/manage/config`を使い、保存後revisionを更新する。`useDisplay`の受信設定で編集中の設定を上書きしない。

- [ ] 画面の状態を担う共有処理について、接続世代の変更・再接続で最新状態に戻ること、古い連番の破棄をテストする。
- [ ] `bun test tests/display-state.test.ts`で失敗を確認する。
- [ ] 時計・天気・RSS・追加カード、情報の自動送り、再接続状態を表示するVueコンポーネントを実装する。
- [ ] 管理フォーム、RSS/JSONソースの追加・編集・削除・順序変更、ヘッダー編集、状態表示、保存競合時の入力維持を実装する。
- [ ] Viteの複数エントリーと同一オリジンのAPI/WSプロキシ、Bunによる開発起動を実装する。
- [ ] `bun test`, `bun run typecheck`, `bun run build`で成功を確認し、コミットする。

### Task 5: 実運用の確認と文書

**Files:** 動作確認中に必要になった修正。READMEはユーザーの許可があるまで変更しない。

**Interfaces:** `bun run dev`, `bun run build`, `bun start`, `bun test`, `bun run typecheck`。

- [ ] READMEを変更せず、起動方法は最終報告に記載する（ユーザーの追加指示）。
- [ ] 一時設定と資格情報で本番サーバーを起動し、ブラウザーで両画面を表示する。
- [ ] 設定保存からキオスク反映、複数タブの409、認証拒否、再接続、ソース失敗表示を確認する。
- [ ] `bun test`, `bun run typecheck`, `bun run build`, `git diff --check`を実行する。
- [ ] requesting-code-reviewスキルで全体のレビューを依頼し、重大な指摘を回帰テストとともに修正する。
- [ ] 最終検証を通し、変更をコミットして起動方法と検証結果を報告する。

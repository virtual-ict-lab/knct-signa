# パネル追加

`src/panels/<ID>/` に `panel.json` と `Panel.vue` を置き、`bun run build` を実行する。登録ファイルの手動編集は不要。管理画面の「パネル」から追加・設定・並べ替え・表示切替を行う。開発中にフォルダーや定義を追加した場合は `bun run dev` を再起動する。

## panel.json

フォルダー名と `id` を一致させる。

```json
{
  "id": "schedule",
  "name": "予定",
  "fields": [
    { "key": "message", "label": "本文", "type": "textarea", "default": "部会 16:00" },
    { "key": "count", "label": "表示件数", "type": "number", "default": 5, "min": 1, "max": 20, "step": 1 },
    { "key": "compact", "label": "省略表示", "type": "boolean", "default": false }
  ]
}
```

設定項目は `text` / `textarea` / `number` / `boolean` / `select` / `url` / `image` に対応。文字列には `required`、`text`・`textarea` には `maxLength` を指定できる。`select` には `options: [{ "value": "today", "label": "今日" }]` を指定する。初期値は型と制約を満たす値にする。

## Panel.vue

```vue
<script setup lang="ts">
import type { PanelProps } from '../../shared/panel-definition'
const props = defineProps<PanelProps<{ message: string; count: number; compact: boolean }>>()
</script>

<template>
  <div class="schedule">{{ props.settings.message }}</div>
</template>

<style scoped>
.schedule { color: var(--foreground); font-size: 24px; line-height: 1.8; }
</style>
```

- `settings`: 定義に基づいて検証した設定値。
- `panel`: インスタンスのID・種類・見出し・幅・表示設定。
- `context.states`: 共通WebSocketで受信する公開データソースの状態と記事。
- `context.timezone` / `context.rotationSeconds`: 表示設定。

外枠・余白・見出しは共通ホストが描画する。コンポーネントは内容だけを描画する。共通色は `--background` / `--surface` / `--foreground` / `--muted` / `--border`。独自CSSは `scoped` にする。

設定値はキオスクへ公開される。APIの秘密情報は既存のサーバー側データソース設定に置く。パネル自身で取得する公開APIはCORS対応が必要。タイマー・通信はアンマウント時に停止する。

同じ種類のパネルを複数追加できる。削除したプラグインの設定は保持され、再配置・ビルドすれば再利用できる。ビルド後はBunサーバーを再起動し、管理画面とキオスクを再読み込みする。

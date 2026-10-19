<script setup lang="ts">
import type { Theme } from './theme'
const theme = defineModel<Theme>({ required: true })
defineProps<{ disabled?: boolean }>()
</script>

<template>
  <div class="theme-switch" role="group" aria-label="テーマ">
    <button type="button" :disabled="disabled" :aria-pressed="theme === 'dark'" @click="theme = 'dark'">ダーク</button>
    <button type="button" :disabled="disabled" :aria-pressed="theme === 'light'" @click="theme = 'light'">ライト</button>
  </div>
</template>

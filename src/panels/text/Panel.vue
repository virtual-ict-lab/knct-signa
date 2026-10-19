<script setup lang="ts">
import type { PanelProps } from '../../shared/panel-definition'
defineProps<PanelProps<{ body: string }>>()
</script>

<template>
  <div class="text-panel">
    <div v-if="settings.body.trim()" class="text-panel-body">{{ settings.body }}</div>
    <div v-else class="kiosk-empty" role="status">情報はありません</div>
  </div>
</template>

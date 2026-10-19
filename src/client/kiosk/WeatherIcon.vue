<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ code?: number }>()
const sunny = computed(() => props.code !== undefined && props.code <= 2)
const wet = computed(() => props.code !== undefined && props.code >= 51)
</script>

<template>
  <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <g v-if="sunny" stroke="#dfebad" stroke-width="3" stroke-linecap="round">
      <circle cx="52" cy="40" r="18" fill="#dfebad" stroke="none" />
      <path d="M52 10v6m0 48v6M22 40h6m48 0h6M31 19l4 4m34 34 4 4M31 61l4-4m34-34 4-4" />
    </g>
    <path v-if="!sunny || code === 2" d="M24 72a17 17 0 0 1 0-34 24 24 0 0 1 46-3 19 19 0 0 1 4 37H24Z" fill="#dce7df" :opacity="sunny ? '.9' : '1'" />
    <g v-if="wet" stroke="#95bccc" stroke-width="4" stroke-linecap="round"><path d="m35 81-4 9m22-9-4 9m22-9-4 9" /></g>
  </svg>
</template>

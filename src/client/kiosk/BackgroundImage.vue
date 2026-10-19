<script setup lang="ts">
import { ref } from 'vue'
import { isBackgroundImageUrl } from '../../shared/background'
defineProps<{ url: string }>()
const loaded = ref(false)
</script>

<template>
  <div class="kiosk-background" aria-hidden="true">
    <img v-if="url && isBackgroundImageUrl(url)" v-show="loaded" :src="url" alt="" referrerpolicy="no-referrer" decoding="async" draggable="false" @load="loaded = true" @error="loaded = false" />
  </div>
</template>

<script setup lang="ts">
import type { PanelProps } from '../../shared/panel-definition'
import { useDormMenu } from './use-menu'
const props = defineProps<PanelProps<{ url: string; intervalSeconds: number }>>()
const { menu, status } = useDormMenu(() => props.settings)
const meals = [{ key: 'breakfast', label: '朝食' }, { key: 'lunch', label: '昼食' }, { key: 'dinner', label: '夕食' }] as const
</script>

<template>
  <div class="meal-panel">
    <div v-if="menu" class="meal-grid">
      <section v-for="meal in meals" :key="meal.key" class="meal-section">
        <h3>{{ meal.label }}</h3>
        <ul v-if="menu[meal.key].length"><li v-for="(name, index) in menu[meal.key]" :key="index">{{ name }}</li></ul>
        <p v-else>情報はありません</p>
      </section>
    </div>
    <div v-else class="kiosk-empty" role="status">{{ status === 'loading' ? '取得中' : status === 'error' ? '取得失敗' : '情報はありません' }}</div>
  </div>
</template>

<style scoped>
.meal-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.meal-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; flex: 1; min-height: 0; overflow: auto; }
.meal-section { min-width: 0; }
.meal-section + .meal-section { border-left: 1px solid var(--border); padding-left: 24px; }
.meal-section h3 { margin: 0 0 18px; color: var(--muted); font-size: 17px; font-weight: 500; }
.meal-section ul { margin: 0; padding: 0; list-style: none; }
.meal-section li { font-size: clamp(16px, 2.2cqw, 26px); line-height: 1.9; overflow-wrap: anywhere; }
.meal-section p { color: var(--muted); font-size: 16px; }
@container (max-width: 600px) {
  .meal-grid { grid-template-columns: 1fr; gap: 18px; }
  .meal-section + .meal-section { border-left: 0; border-top: 1px solid var(--border); padding-left: 0; padding-top: 18px; }
  .meal-section h3 { margin-bottom: 8px; }
  .meal-section li { font-size: 17px; }
}
</style>

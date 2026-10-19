<script setup lang="ts">
import type { PanelDefinition, PanelSettings } from '../../shared/panel-definition'
defineProps<{ definition: PanelDefinition }>()
const settings = defineModel<PanelSettings>({ required: true })
function input(event: Event) { return event.target as HTMLInputElement }
function number(event: Event) {
  const value = input(event).valueAsNumber
  return Number.isFinite(value) ? value : ''
}
</script>

<template>
  <div class="panel-settings">
    <template v-for="field in definition.fields" :key="field.key">
      <label v-if="field.type === 'boolean'" class="toggle-row panel-boolean-field"><span class="switch"><input type="checkbox" :checked="settings[field.key] === true" @change="settings[field.key] = input($event).checked" /><span></span></span>{{ field.label }}</label>
      <label v-else class="field">{{ field.label }}
        <textarea v-if="field.type === 'textarea'" :value="String(settings[field.key] ?? '')" :required="field.required" :maxlength="field.maxLength ?? 10000" rows="5" @input="settings[field.key] = input($event).value" />
        <select v-else-if="field.type === 'select'" v-model="settings[field.key]"><option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option></select>
        <input v-else-if="field.type === 'number'" type="number" :value="settings[field.key]" :min="field.min" :max="field.max" :step="field.step ?? 'any'" required @input="settings[field.key] = number($event)" />
        <input v-else :type="field.type === 'url' ? 'url' : 'text'" :value="String(settings[field.key] ?? '')" :required="field.required" :maxlength="field.type === 'text' ? field.maxLength ?? 10000 : 2048" @input="settings[field.key] = input($event).value" />
      </label>
    </template>
  </div>
</template>

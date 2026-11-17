<script setup lang="ts" generic="T extends string">
import { nextTick } from 'vue'

/**
 * Dropdown in the toolbar style. Use with v-model, or as an "action menu" by
 * keeping model-value fixed (e.g. "") and listening to @update:model-value —
 * the dropdown then snaps back to the placeholder after each pick.
 */
const props = defineProps<{
  modelValue: T
  options: readonly { value: T; label: string }[]
}>()
const emit = defineEmits<{ 'update:modelValue': [T] }>()

function onChange(e: Event) {
  const el = e.target as HTMLSelectElement
  emit('update:modelValue', el.value as T)
  // Keep the DOM in step with the model when the parent did not accept the change.
  nextTick(() => {
    if (el.value !== props.modelValue) el.value = props.modelValue
  })
}
</script>

<template>
  <select
    :value="modelValue"
    class="rounded-lg bg-[var(--ctrl-bg)] px-2 py-1.5 text-xs font-medium text-[var(--text)] outline-none disabled:opacity-40"
    @change="onChange"
  >
    <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
  </select>
</template>

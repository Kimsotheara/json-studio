<script setup lang="ts">
/**
 * Single-line input, or a textarea with `multiline`. Use with v-model.
 * Other attributes (placeholder, rows, readonly, @keyup…) pass straight through.
 */
defineProps<{
  modelValue: string
  multiline?: boolean
  /** Monospace text — for code, URLs, encoded data. */
  mono?: boolean
}>()
defineEmits<{ 'update:modelValue': [string] }>()
</script>

<template>
  <component
    :is="multiline ? 'textarea' : 'input'"
    :value="modelValue"
    spellcheck="false"
    class="w-full rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-2 text-[var(--text)] caret-[var(--accent)] outline-none transition-colors placeholder:text-[var(--muted)]/70 focus:border-[var(--accent)]"
    :class="[mono ? 'font-[family-name:var(--mono)] text-[12.5px]' : 'text-[13px]', multiline && 'resize-y']"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>

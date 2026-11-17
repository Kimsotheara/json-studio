<script setup lang="ts" generic="T extends string">
/** A row of mutually exclusive choices (Code | Tree, Format | Minify, …). Use with v-model. */
withDefaults(
  defineProps<{
    modelValue: T
    options: readonly { value: T; label: string }[]
    /** soft: white pill on grey (inside panels) · solid: dark pill (toolbars) */
    variant?: 'soft' | 'solid'
  }>(),
  { variant: 'soft' },
)
defineEmits<{ 'update:modelValue': [T] }>()
</script>

<template>
  <div class="flex rounded-lg bg-[var(--ctrl-bg)] p-0.5 text-xs font-medium">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      class="rounded-md px-3 py-1 transition-colors"
      :class="
        modelValue === o.value
          ? variant === 'solid'
            ? 'bg-[var(--tab-active-bg)] text-[var(--tab-active-text)]'
            : 'bg-[var(--panel)] text-[var(--text)] shadow-sm'
          : 'text-[var(--muted)] hover:text-[var(--text)]'
      "
      @click="$emit('update:modelValue', o.value)"
    >
      {{ o.label }}
    </button>
  </div>
</template>

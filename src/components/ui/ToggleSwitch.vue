<script setup lang="ts">
/** On/off switch with a text label in front. Use with v-model. */
defineProps<{ modelValue: boolean }>()
defineEmits<{ 'update:modelValue': [boolean] }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    class="flex items-center gap-2 text-[13px] font-medium text-[var(--muted)]"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <slot />
    <span
      class="relative h-5 w-9 rounded-full transition-colors"
      :class="modelValue ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'"
    >
      <span
        class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all"
        :class="modelValue ? 'left-[18px]' : 'left-0.5'"
      ></span>
    </span>
  </button>
</template>

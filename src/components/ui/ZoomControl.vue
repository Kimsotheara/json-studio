<script setup lang="ts">
/** − 100% + zoom stepper. Use with v-model (1 = 100%). */
const props = withDefaults(defineProps<{ modelValue: number; min?: number; max?: number; step?: number }>(), {
  min: 0.25,
  max: 4,
  step: 0.25,
})
const emit = defineEmits<{ 'update:modelValue': [number] }>()

function zoomBy(delta: number) {
  emit('update:modelValue', Math.min(props.max, Math.max(props.min, +(props.modelValue + delta).toFixed(2))))
}
</script>

<template>
  <div class="flex items-center rounded-lg bg-[var(--ctrl-bg)] text-xs font-medium text-[var(--text)]">
    <button type="button" class="px-2 py-1.5 hover:text-[var(--accent)]" title="Zoom out" @click="zoomBy(-step)">−</button>
    <button
      type="button"
      class="w-11 py-1.5 text-center hover:text-[var(--accent)]"
      title="Reset zoom"
      @click="emit('update:modelValue', 1)"
    >
      {{ Math.round(modelValue * 100) }}%
    </button>
    <button type="button" class="px-2 py-1.5 hover:text-[var(--accent)]" title="Zoom in" @click="zoomBy(step)">+</button>
  </div>
</template>

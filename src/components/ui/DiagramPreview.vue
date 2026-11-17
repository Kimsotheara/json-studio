<script setup lang="ts">
/**
 * Scrollable, zoomable area that shows a rendered SVG diagram.
 * The default slot is layered on top — use it for an error list.
 */
defineProps<{
  svg: string
  /** 1 = fit the panel width */
  zoom: number
  /** Fade the diagram (while re-rendering, or when the source has an error). */
  dimmed?: boolean
  /** Text shown while there is no diagram. */
  placeholder?: string
}>()
</script>

<template>
  <div class="relative flex-1 overflow-auto bg-[var(--panel-soft)]" style="min-height: 520px">
    <div
      v-if="svg"
      class="diagram p-4"
      :class="{ 'opacity-50': dimmed }"
      :style="{ width: zoom * 100 + '%' }"
      v-html="svg"
    ></div>
    <div v-else-if="placeholder" class="absolute inset-0 grid place-items-center text-[13px] text-[var(--muted)]">
      {{ placeholder }}
    </div>
    <slot />
  </div>
</template>

<style scoped>
.diagram :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}
</style>

<script setup lang="ts">
import AppIcon, { type IconName } from './AppIcon.vue'

/** Small square button holding one icon (Clear, Download, …). */
defineProps<{
  icon: IconName
  title: string
  /** Turns red on hover — for destructive actions such as Clear. */
  danger?: boolean
}>()
</script>

<template>
  <button
    type="button"
    class="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--ctrl-bg)] disabled:opacity-40"
    :class="danger ? 'hover:text-[var(--red)]' : 'hover:text-[var(--text)]'"
    :title="title"
    :aria-label="title"
  >
    <AppIcon :name="icon" />
  </button>
</template>

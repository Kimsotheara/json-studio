<script setup lang="ts">
import AppIcon from './AppIcon.vue'

/** The swap / copy → / copy ← column that sits between two compare panes. */
defineEmits<{ swap: []; copyRight: []; copyLeft: [] }>()

const btn =
  'grid h-[34px] w-[34px] place-items-center rounded-[9px] border border-[var(--border)] bg-[var(--panel)] transition-colors hover:bg-[var(--accent-soft)]'
const quiet = 'text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
</script>

<template>
  <div class="flex flex-row justify-center gap-2.5 md:flex-col">
    <button type="button" :class="[btn, 'text-[var(--accent)]']" title="Swap" @click="$emit('swap')">
      <AppIcon name="swap" :size="16" />
    </button>
    <button type="button" :class="[btn, quiet]" title="Copy left → right" @click="$emit('copyRight')">
      <AppIcon name="arrow-right" :size="16" />
    </button>
    <button type="button" :class="[btn, quiet]" title="Copy right → left" @click="$emit('copyLeft')">
      <AppIcon name="arrow-left" :size="16" />
    </button>
  </div>
</template>

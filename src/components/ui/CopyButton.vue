<script setup lang="ts">
import { useClipboard } from '../../composables/useClipboard'
import AppIcon from './AppIcon.vue'

/**
 * Copies `text` to the clipboard and shows a tick for a moment.
 *   icon    — icon only, for panel headers (default)
 *   label   — small icon + "Copy" text link
 *   outline — bordered button with text
 */
const props = withDefaults(
  defineProps<{
    text: string
    variant?: 'icon' | 'label' | 'outline'
    label?: string
    copiedLabel?: string
    title?: string
  }>(),
  { variant: 'icon', label: 'Copy', copiedLabel: 'Copied' },
)

const { copied, copy } = useClipboard()
</script>

<template>
  <button
    type="button"
    :class="
      variant === 'icon'
        ? 'rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--ctrl-bg)] hover:text-[var(--text)] disabled:opacity-40'
        : variant === 'label'
          ? 'inline-flex items-center gap-1 text-[11px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--accent)] disabled:opacity-40'
          : 'rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40'
    "
    :title="title ?? label"
    :aria-label="title ?? label"
    :disabled="!text"
    @click="copy(props.text)"
  >
    <template v-if="variant === 'icon'">
      <AppIcon v-if="!copied" name="copy" />
      <AppIcon v-else name="check" :stroke-width="2.5" class="text-[var(--green)]" />
    </template>
    <template v-else-if="variant === 'label'">
      <AppIcon :name="copied ? 'check' : 'copy'" :size="13" />
      {{ copied ? copiedLabel : label }}
    </template>
    <template v-else>{{ copied ? `✓ ${copiedLabel}` : label }}</template>
  </button>
</template>

<script setup lang="ts">
/**
 * The bordered card every tool is built from.
 *
 *   <AppPanel label="SQL INPUT">
 *     <template #title>…next to the label (toggles, hints)…</template>
 *     <template #actions>…right side of the header (buttons)…</template>
 *     …body…
 *     <template #footer>…status bar…</template>
 *   </AppPanel>
 *
 * `narrow` gives the centred single-column card used by the small tools
 * (Base64, UUID, IP Lookup), with `title` shown as a heading.
 */
defineProps<{
  /** Small uppercase label at the left of the header. */
  label?: string
  /** Heading shown after the label. */
  title?: string
  narrow?: boolean
}>()
</script>

<template>
  <section
    class="flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]"
    :class="narrow ? 'mx-auto w-full max-w-[820px]' : 'min-w-0 flex-1'"
  >
    <header
      v-if="label || title || $slots.title || $slots.actions"
      class="flex flex-wrap items-center gap-2 border-b border-[var(--border)]"
      :class="narrow ? 'px-4 py-3' : 'px-3 py-2.5'"
    >
      <span v-if="label" class="text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)]">{{ label }}</span>
      <h2 v-if="title" class="text-sm font-semibold">{{ title }}</h2>
      <slot name="title" />
      <div v-if="$slots.actions" class="ml-auto flex flex-wrap items-center justify-end gap-1.5">
        <slot name="actions" />
      </div>
    </header>

    <slot />

    <footer
      v-if="$slots.footer"
      class="flex items-center gap-3.5 border-t border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-[11.5px] text-[var(--muted)]"
    >
      <slot name="footer" />
    </footer>
  </section>
</template>

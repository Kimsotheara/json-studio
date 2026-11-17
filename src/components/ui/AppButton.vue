<script setup lang="ts">
/**
 * Text button in the app's four styles:
 *   primary — filled accent, the main action of a tool (Encode, Generate, Lookup)
 *   soft    — grey chip in panel headers (Beautify, Use as input); `active` for on/off chips
 *   outline — bordered secondary action (Decode, Swap)
 *   ghost   — plain text action (Minify, Sample, Clear). Pass `href` to render a link.
 */
withDefaults(
  defineProps<{
    variant?: 'primary' | 'soft' | 'outline' | 'ghost'
    size?: 'sm' | 'md'
    /** soft only: highlighted "on" state */
    active?: boolean
    /** outline only: quieter text colour */
    muted?: boolean
    /** Turns red on hover — for destructive actions. */
    danger?: boolean
    /** Renders an external link instead of a button. */
    href?: string
  }>(),
  { variant: 'soft', size: 'sm' },
)

const BASE: Record<string, string> = {
  primary:
    'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] text-xs font-semibold text-[var(--tab-active-text)] transition-opacity hover:opacity-90 disabled:opacity-50',
  soft: 'rounded-lg text-xs font-medium transition-colors disabled:opacity-40',
  outline:
    'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel)] text-xs font-medium transition-colors disabled:opacity-40',
  ghost:
    'rounded-md text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--ctrl-bg)] disabled:opacity-40',
}
const SIZE: Record<string, Record<string, string>> = {
  primary: { sm: 'px-3 py-1.5', md: 'px-3.5 py-2' },
  soft: { sm: 'px-3 py-1.5', md: 'px-3.5 py-2' },
  outline: { sm: 'px-3 py-1.5', md: 'px-3.5 py-2' },
  ghost: { sm: 'px-2 py-1.5', md: 'px-3 py-2' },
}
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :type="href ? undefined : 'button'"
    :href="href"
    :target="href ? '_blank' : undefined"
    :rel="href ? 'noopener' : undefined"
    :class="[
      BASE[variant],
      SIZE[variant][size],
      variant === 'soft' &&
        (active
          ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
          : 'bg-[var(--ctrl-bg)] text-[var(--text)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]'),
      variant === 'outline' &&
        (danger
          ? 'text-[var(--muted)] hover:border-[var(--red)] hover:text-[var(--red)]'
          : muted
            ? 'text-[var(--muted)] hover:text-[var(--text)]'
            : 'text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]'),
      variant === 'ghost' && (danger ? 'hover:text-[var(--red)]' : 'hover:text-[var(--text)]'),
    ]"
  >
    <slot />
  </component>
</template>

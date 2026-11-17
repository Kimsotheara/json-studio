<script setup lang="ts">
export interface Problem {
  message: string
  level?: 'error' | 'warning'
  /** 1-based position in the source; makes the row clickable ("jump to"). */
  line?: number
  column?: number
}

/** Floating list of errors / warnings at the bottom of a preview. Rows with a line emit `jump`. */
defineProps<{ problems: Problem[] }>()
defineEmits<{ jump: [line: number, column?: number] }>()
</script>

<template>
  <div
    v-if="problems.length"
    class="absolute inset-x-3 bottom-3 max-h-[45%] overflow-auto rounded-lg border bg-[var(--panel)] p-2 font-[family-name:var(--mono)] text-[12px] shadow-sm"
    :class="problems.some((p) => p.level !== 'warning') ? 'border-[var(--red)]' : 'border-[var(--border)]'"
  >
    <button
      v-for="(p, i) in problems"
      :key="i"
      type="button"
      class="block w-full rounded px-1.5 py-0.5 text-left whitespace-pre-wrap"
      :class="[
        p.level === 'warning' ? 'text-[var(--muted)]' : 'text-[var(--red)]',
        p.line ? 'hover:bg-[var(--diff-bg)]' : 'cursor-default',
      ]"
      :title="p.line ? 'Jump to line' : undefined"
      @click="p.line && $emit('jump', p.line, p.column)"
    >
      {{ p.message }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

export interface CodeError {
  line: number
  column?: number
  message?: string
}

const props = defineProps<{
  modelValue: string
  /** Returns one HTML string per source line (see composables/highlight). */
  highlight: (src: string) => string[]
  readonly?: boolean
  minHeight?: string
  /** Problems to mark in the editor (1-based line/column). */
  errors?: CodeError[]
}>()
const emit = defineEmits<{
  'update:modelValue': [string]
  /** Caret position (1-based), sent as the user types, clicks or moves. */
  caret: [{ line: number; col: number }]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const gutterRef = ref<HTMLDivElement | null>(null)
const highlightRef = ref<HTMLPreElement | null>(null)

const lines = computed(() => props.highlight(props.modelValue))
const lineNumbers = computed(() =>
  Array.from({ length: props.modelValue.split('\n').length }, (_, i) => i + 1),
)

/** line number → error on that line (first one wins). */
const errorByLine = computed(() => {
  const map = new Map<number, CodeError>()
  for (const e of props.errors ?? []) if (!map.has(e.line)) map.set(e.line, e)
  return map
})

/** Scroll the error line into view and put the caret on it. */
function revealLine(line: number, column = 1) {
  const ta = textareaRef.value
  if (!ta) return
  const lines = props.modelValue.split('\n')
  const offset =
    lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0) +
    Math.min(column - 1, lines[line - 1]?.length ?? 0)
  ta.focus()
  ta.setSelectionRange(offset, offset)
  const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 19
  ta.scrollTop = Math.max(0, (line - 1) * lineHeight - ta.clientHeight / 3)
  syncScroll()
}
defineExpose({ revealLine })

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
  onCaret(e)
}

function onCaret(e: Event) {
  const ta = e.target as HTMLTextAreaElement
  const before = ta.value.slice(0, ta.selectionStart)
  emit('caret', { line: before.split('\n').length, col: ta.selectionStart - before.lastIndexOf('\n') })
}

/** Keep the gutter and highlight layer aligned with the textarea while scrolling. */
function syncScroll() {
  const ta = textareaRef.value
  if (!ta) return
  if (gutterRef.value) gutterRef.value.scrollTop = ta.scrollTop
  if (highlightRef.value) {
    highlightRef.value.scrollTop = ta.scrollTop
    highlightRef.value.scrollLeft = ta.scrollLeft
  }
}
</script>

<template>
  <div class="relative flex flex-1" :style="{ minHeight: minHeight || '420px' }">
    <div
      ref="gutterRef"
      class="overflow-hidden bg-[var(--gutter)] py-3 pr-2 pl-3 text-right font-[family-name:var(--mono)] text-[12.5px] leading-[1.55] text-[var(--gutter-text)] select-none"
    >
      <div
        v-for="n in lineNumbers"
        :key="n"
        :class="errorByLine.has(n) ? 'font-bold text-[var(--red)]' : ''"
        :title="errorByLine.get(n)?.message"
      >
        {{ n }}
      </div>
    </div>

    <div class="relative min-w-0 flex-1">
      <pre
        ref="highlightRef"
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 m-0 overflow-hidden px-3 py-3 font-[family-name:var(--mono)] text-[12.5px] leading-[1.55] whitespace-pre [tab-size:2]"
       ><div
          v-for="(l, i) in lines"
          :key="i"
          class="relative block w-max"
          :class="errorByLine.has(i + 1)
            ? '-mx-3 min-w-[calc(100%+1.5rem)] bg-[var(--diff-bg)] px-3 shadow-[inset_2px_0_var(--red)]'
            : 'min-w-full'"
        ><span v-html="l || '&#8203;'"></span><span
          v-if="errorByLine.get(i + 1)?.column"
          class="absolute inset-y-0 w-[1ch] rounded-[2px] border-b-2 border-[var(--red)] bg-[var(--red)]/25"
          :title="errorByLine.get(i + 1)?.message"
          :style="{ left: `calc(0.75rem + ${errorByLine.get(i + 1)!.column! - 1}ch)` }"
        ></span></div></pre>

      <textarea
        ref="textareaRef"
        :value="modelValue"
        :readonly="readonly"
        spellcheck="false"
        class="absolute inset-0 resize-none overflow-auto bg-transparent px-3 py-3 font-[family-name:var(--mono)] text-[12.5px] leading-[1.55] whitespace-pre text-transparent caret-[var(--accent)] outline-none [tab-size:2]"
        :class="readonly ? 'cursor-default caret-transparent' : ''"
        @input="onInput"
        @click="onCaret"
        @keyup="onCaret"
        @scroll="syncScroll"
      ></textarea>
    </div>
  </div>
</template>


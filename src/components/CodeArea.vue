<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  modelValue: string
  /** Returns one HTML string per source line (see composables/highlight). */
  highlight: (src: string) => string[]
  readonly?: boolean
  minHeight?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const gutterRef = ref<HTMLDivElement | null>(null)
const highlightRef = ref<HTMLPreElement | null>(null)

const lines = computed(() => props.highlight(props.modelValue))
const lineNumbers = computed(() =>
  Array.from({ length: props.modelValue.split('\n').length }, (_, i) => i + 1),
)

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
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
      <div v-for="n in lineNumbers" :key="n">{{ n }}</div>
    </div>

    <div class="relative min-w-0 flex-1">
      <pre
        ref="highlightRef"
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 m-0 overflow-hidden px-3 py-3 font-[family-name:var(--mono)] text-[12.5px] leading-[1.55] whitespace-pre [tab-size:2]"
      ><div v-for="(l, i) in lines" :key="i" class="block w-max min-w-full"><span v-html="l || '&#8203;'"></span></div></pre>

      <textarea
        ref="textareaRef"
        :value="modelValue"
        :readonly="readonly"
        spellcheck="false"
        class="absolute inset-0 resize-none overflow-auto bg-transparent px-3 py-3 font-[family-name:var(--mono)] text-[12.5px] leading-[1.55] whitespace-pre text-transparent caret-[var(--accent)] outline-none [tab-size:2]"
        @input="onInput"
        @scroll="syncScroll"
      ></textarea>
    </div>
  </div>
</template>

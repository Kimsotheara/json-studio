<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EditorView, JsonValue } from '../types'
import type { JsonEditor } from '../composables/useJsonEditor'
import JsonTreeNode from './JsonTreeNode.vue'

const props = defineProps<{
  editor: JsonEditor
  /** lines that differ from the other pane (1-based), for compare mode */
  diffLines?: Set<number>
}>()

const view = ref<EditorView>('code')
const copied = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const gutterRef = ref<HTMLDivElement | null>(null)

const lineNumbers = computed(() =>
  Array.from({ length: props.editor.lineCount.value }, (_, i) => i + 1),
)

const parsed = computed<{ ok: true; value: JsonValue } | { ok: false; error: string }>(() => {
  try {
    return { ok: true, value: JSON.parse(props.editor.text.value || 'null') }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
})

const status = computed(() => {
  const state = props.editor.validation.value.state
  if (state === 'valid') return { label: 'Valid JSON', cls: 'text-[var(--green)]' }
  if (state === 'invalid') return { label: 'Invalid JSON', cls: 'text-[var(--red)]' }
  return { label: 'Empty', cls: 'text-[var(--muted)]' }
})

function onCursor(e: Event) {
  props.editor.updateCursor(e.target as HTMLTextAreaElement)
}

function syncScroll() {
  if (textareaRef.value && gutterRef.value) {
    gutterRef.value.scrollTop = textareaRef.value.scrollTop
  }
}

function beautify() {
  props.editor.beautify()
}
function minify() {
  props.editor.minify()
}
async function copy() {
  await navigator.clipboard.writeText(props.editor.text.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 900)
}
</script>

<template>
  <section
    class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-white"
  >
    <header class="flex items-center gap-1.5 border-b border-[var(--border)] px-3 py-2.5">
      <div class="flex rounded-lg bg-[var(--gutter)] p-0.5">
        <button
          class="rounded-md px-3 py-1 text-xs font-medium"
          :class="
            view === 'code'
              ? 'bg-white text-[var(--text)] shadow-sm'
              : 'text-[var(--muted)]'
          "
          @click="view = 'code'"
        >
          Code
        </button>
        <button
          class="rounded-md px-3 py-1 text-xs font-medium"
          :class="
            view === 'tree'
              ? 'bg-white text-[var(--text)] shadow-sm'
              : 'text-[var(--muted)]'
          "
          @click="view = 'tree'"
        >
          Tree
        </button>
      </div>
      <div class="ml-auto flex gap-1">
        <button
          class="rounded-md border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-medium hover:bg-[var(--bg)]"
          @click="beautify"
        >
          Beautify
        </button>
        <button
          class="rounded-md border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-medium hover:bg-[var(--bg)]"
          @click="minify"
        >
          Minify
        </button>
        <button
          class="rounded-md px-1.5 py-1 text-sm text-[var(--muted)] hover:bg-[var(--gutter)] hover:text-[var(--text)]"
          title="Copy"
          @click="copy"
        >
          {{ copied ? '✓' : '⧉' }}
        </button>
        <button
          class="rounded-md px-1.5 py-1 text-sm text-[var(--muted)] hover:bg-[var(--gutter)] hover:text-[var(--text)]"
          title="Clear"
          @click="editor.clear()"
        >
          🗑
        </button>
      </div>
    </header>

    <div class="relative flex min-h-[420px] flex-1">
      <!-- Code view -->
      <template v-if="view === 'code'">
        <div
          ref="gutterRef"
          class="overflow-hidden bg-[var(--gutter)] px-2 py-3 text-right font-[var(--mono)] text-[12.5px] leading-[1.55] text-[var(--gutter-text)] select-none"
        >
          <div
            v-for="n in lineNumbers"
            :key="n"
            :class="diffLines?.has(n) ? 'font-bold text-[var(--red)]' : ''"
          >
            {{ n }}
          </div>
        </div>
        <textarea
          ref="textareaRef"
          v-model="editor.text.value"
          spellcheck="false"
          class="flex-1 resize-none overflow-auto whitespace-pre p-3 font-[var(--mono)] text-[12.5px] leading-[1.55] text-[var(--text)] outline-none [tab-size:2]"
          @click="onCursor"
          @keyup="onCursor"
          @scroll="syncScroll"
        ></textarea>
      </template>

      <!-- Tree view -->
      <div v-else class="flex-1 overflow-auto p-3 font-[var(--mono)] text-[12.5px] leading-[1.6]">
        <JsonTreeNode v-if="parsed.ok" :value="parsed.value" />
        <div v-else class="font-[var(--mono)] text-[12.5px] text-[var(--red)]">⚠ {{ parsed.error }}</div>
      </div>
    </div>

    <footer
      class="flex items-center gap-3.5 border-t border-[var(--border)] bg-[#fafbfc] px-3 py-1.5 text-[11.5px] text-[var(--muted)]"
    >
      <span>Ln {{ editor.cursor.value.line }}, Col {{ editor.cursor.value.col }}</span>
      <span>{{ editor.lineCount.value }} lines</span>
      <span>{{ editor.byteSize.value }} B</span>
      <span class="ml-auto flex items-center gap-1.5 font-semibold" :class="status.cls">
        <span class="h-2 w-2 rounded-full bg-current"></span>
        {{ status.label }}
      </span>
    </footer>
  </section>
</template>

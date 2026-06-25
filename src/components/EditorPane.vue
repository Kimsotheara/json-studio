<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EditorView, JsonValue } from '../types'
import type { JsonEditor } from '../composables/useJsonEditor'
import { highlightLines } from '../composables/highlight'
import JsonTreeNode from './JsonTreeNode.vue'

const props = defineProps<{
  editor: JsonEditor
  /** Uppercase label shown at the left of the pane header. */
  label: string
  /** lines that differ from the other pane (1-based), for compare mode */
  diffLines?: Set<number>
  /** When true the pane is auto-driven: not editable, edit actions hidden. */
  readonly?: boolean
}>()

const view = ref<EditorView>('code')
const copied = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const gutterRef = ref<HTMLDivElement | null>(null)
const highlightRef = ref<HTMLPreElement | null>(null)

const lineNumbers = computed(() =>
  Array.from({ length: props.editor.lineCount.value }, (_, i) => i + 1),
)

const highlighted = computed(() => highlightLines(props.editor.text.value))

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

async function copy() {
  await navigator.clipboard.writeText(props.editor.text.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 900)
}
</script>

<template>
  <section
    class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]"
  >
    <header
      class="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-3 py-2.5"
    >
      <span class="text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)]">
        {{ label }}
      </span>

      <!-- Code / Tree segmented control -->
      <div class="flex rounded-lg bg-[var(--ctrl-bg)] p-0.5">
        <button
          class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
          :class="
            view === 'code'
              ? 'bg-[var(--panel)] text-[var(--text)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          "
          @click="view = 'code'"
        >
          Code
        </button>
        <button
          class="rounded-md px-3 py-1 text-xs font-medium transition-colors"
          :class="
            view === 'tree'
              ? 'bg-[var(--panel)] text-[var(--text)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          "
          @click="view = 'tree'"
        >
          Tree
        </button>
      </div>

      <div class="flex w-full flex-wrap items-center justify-end gap-1.5 sm:ml-auto sm:w-auto">
        <span
          v-if="readonly"
          class="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-semibold tracking-wide text-[var(--accent)] uppercase"
        >
          Auto
        </span>
        <button
          v-if="!readonly"
          class="rounded-lg bg-[var(--ctrl-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
          @click="editor.beautify()"
        >
          Beautify
        </button>
        <button
          v-if="!readonly"
          class="px-2 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]"
          @click="editor.minify()"
        >
          Minify
        </button>
        <button
          class="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--ctrl-bg)] hover:text-[var(--text)]"
          title="Copy"
          @click="copy"
        >
          <svg v-if="!copied" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </button>
        <button
          v-if="!readonly"
          class="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--ctrl-bg)] hover:text-[var(--red)]"
          title="Clear"
          @click="editor.clear()"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
    </header>

    <div class="relative flex min-h-[300px] flex-1 sm:min-h-[420px]">
      <!-- Code view -->
      <template v-if="view === 'code'">
        <div
          ref="gutterRef"
          class="overflow-hidden bg-[var(--gutter)] py-3 pr-2 pl-3 text-right font-[family-name:var(--mono)] text-[12.5px] leading-[1.55] text-[var(--gutter-text)] select-none"
        >
          <div
            v-for="n in lineNumbers"
            :key="n"
            :class="diffLines?.has(n) ? 'font-bold text-[var(--red)]' : ''"
          >
            {{ n }}
          </div>
        </div>

        <div class="relative min-w-0 flex-1">
          <!-- Highlight layer (behind the textarea) -->
          <pre
            ref="highlightRef"
            aria-hidden="true"
            class="pointer-events-none absolute inset-0 m-0 overflow-hidden py-3 font-[family-name:var(--mono)] text-[12.5px] leading-[1.55] whitespace-pre [tab-size:2]"
          ><div
              v-for="(line, i) in highlighted"
              :key="i"
              class="block w-max min-w-full"
              :class="diffLines?.has(i + 1)
                ? 'border-l-2 border-[var(--red)] bg-[var(--diff-bg)] pr-3 pl-[10px]'
                : 'px-3'"
            ><span v-html="line || '&#8203;'"></span></div></pre>

          <!-- Transparent textarea on top for editing -->
          <textarea
            ref="textareaRef"
            v-model="editor.text.value"
            spellcheck="false"
            :readonly="readonly"
            class="absolute inset-0 resize-none overflow-auto bg-transparent px-3 py-3 font-[family-name:var(--mono)] text-[12.5px] leading-[1.55] whitespace-pre text-transparent caret-[var(--accent)] outline-none [tab-size:2]"
            :class="readonly ? 'cursor-default caret-transparent' : ''"
            @click="onCursor"
            @keyup="onCursor"
            @input="onCursor"
            @scroll="syncScroll"
          ></textarea>
        </div>
      </template>

      <!-- Tree view -->
      <div v-else class="flex-1 overflow-auto p-3 font-[family-name:var(--mono)] text-[12.5px] leading-[1.6]">
        <JsonTreeNode v-if="parsed.ok" :value="parsed.value" />
        <div v-else class="font-[family-name:var(--mono)] text-[12.5px] text-[var(--red)]">⚠ {{ parsed.error }}</div>
      </div>
    </div>

    <footer
      class="flex items-center gap-3.5 border-t border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-[11.5px] text-[var(--muted)]"
    >
      <span>Ln {{ editor.cursor.value.line }}, Col {{ editor.cursor.value.col }}</span>
      <span>{{ editor.lineCount.value }} lines · {{ editor.byteSize.value }} B</span>
      <span class="ml-auto font-semibold" :class="status.cls">{{ status.label }}</span>
    </footer>
  </section>
</template>

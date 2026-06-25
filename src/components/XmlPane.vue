<script setup lang="ts">
import { ref } from 'vue'
import type { XmlEditor } from '../composables/useXmlEditor'
import { highlightXmlLines } from '../composables/highlight'
import CodeArea from './CodeArea.vue'

const props = defineProps<{
  editor: XmlEditor
  /** Uppercase label shown at the left of the pane header. */
  label: string
  /** When true the pane is auto-driven: not editable, edit actions hidden. */
  readonly?: boolean
}>()

const copied = ref(false)

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
    <header class="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
      <span class="text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)]">{{ label }}</span>

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

    <CodeArea
      :model-value="editor.text.value"
      :highlight="highlightXmlLines"
      :readonly="readonly"
      min-height="420px"
      @update:model-value="(v: string) => (editor.text.value = v)"
    />

    <footer
      class="flex items-center gap-3.5 border-t border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-[11.5px] text-[var(--muted)]"
    >
      <span>{{ editor.lineCount.value }} lines · {{ editor.byteSize.value }} B</span>
      <span
        class="ml-auto font-semibold"
        :class="
          editor.validation.value.state === 'valid'
            ? 'text-[var(--green)]'
            : editor.validation.value.state === 'invalid'
              ? 'text-[var(--red)]'
              : 'text-[var(--muted)]'
        "
      >
        {{ editor.validation.value.label }}
      </span>
    </footer>
  </section>
</template>

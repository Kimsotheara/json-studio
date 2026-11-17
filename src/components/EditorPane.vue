<script setup lang="ts">
import { computed, ref } from 'vue'
import type { JsonValue } from '../types'
import type { TextEditor } from '../composables/useTextEditor'
import CodeArea, { type CodeError } from './CodeArea.vue'
import JsonTreeNode from './JsonTreeNode.vue'
import AppButton from './ui/AppButton.vue'
import AppPanel from './ui/AppPanel.vue'
import CopyButton from './ui/CopyButton.vue'
import IconButton from './ui/IconButton.vue'
import SegmentedControl from './ui/SegmentedControl.vue'

/**
 * One editor pane for any text format (JSON, XML, …): header with
 * Beautify / Minify / Copy / Clear, the code editor, and a status bar.
 */
const props = defineProps<{
  editor: TextEditor
  /** Uppercase label shown at the left of the pane header. */
  label: string
  /** Returns one HTML string per source line (see composables/highlight). */
  highlight: (src: string) => string[]
  /** Lines that differ from the other pane (1-based), for compare mode. */
  diffLines?: Set<number>
  /** When true the pane is auto-driven: not editable, edit actions hidden. */
  readonly?: boolean
  /** Adds the Code / Tree switch. JSON only. */
  tree?: boolean
}>()

const VIEWS = [
  { value: 'code', label: 'Code' },
  { value: 'tree', label: 'Tree' },
] as const
const view = ref<'code' | 'tree'>('code')

const marks = computed<CodeError[]>(() => [...(props.diffLines ?? [])].map((line) => ({ line })))

const parsed = computed<{ ok: true; value: JsonValue } | { ok: false; error: string }>(() => {
  try {
    return { ok: true, value: JSON.parse(props.editor.text.value || 'null') }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
})

const STATE_CLASS = {
  valid: 'text-[var(--green)]',
  invalid: 'text-[var(--red)]',
  empty: 'text-[var(--muted)]',
}
</script>

<template>
  <AppPanel :label="label">
    <template v-if="tree" #title>
      <SegmentedControl v-model="view" :options="VIEWS" />
    </template>

    <template #actions>
      <span
        v-if="readonly"
        class="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-semibold tracking-wide text-[var(--accent)] uppercase"
      >
        Auto
      </span>
      <template v-else>
        <AppButton @click="editor.beautify()">Beautify</AppButton>
        <AppButton variant="ghost" @click="editor.minify()">Minify</AppButton>
      </template>
      <CopyButton :text="editor.text.value" />
      <IconButton v-if="!readonly" icon="trash" title="Clear" danger @click="editor.clear()" />
    </template>

    <div
      v-if="tree && view === 'tree'"
      class="min-h-[420px] flex-1 overflow-auto p-3 font-[family-name:var(--mono)] text-[12.5px] leading-[1.6]"
    >
      <JsonTreeNode v-if="parsed.ok" :value="parsed.value" />
      <div v-else class="text-[var(--red)]">⚠ {{ parsed.error }}</div>
    </div>
    <CodeArea
      v-else
      v-model="editor.text.value"
      :highlight="highlight"
      :errors="marks"
      :readonly="readonly"
      min-height="420px"
      @caret="editor.cursor.value = $event"
    />

    <template #footer>
      <span>Ln {{ editor.cursor.value.line }}, Col {{ editor.cursor.value.col }}</span>
      <span>{{ editor.lineCount.value }} lines · {{ editor.byteSize.value }} B</span>
      <span
        class="ml-auto font-semibold"
        :class="STATE_CLASS[editor.validation.value.state]"
        :title="editor.validation.value.message"
      >
        {{ editor.validation.value.label }}
      </span>
    </template>
  </AppPanel>
</template>

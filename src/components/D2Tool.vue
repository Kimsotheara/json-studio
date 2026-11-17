<script setup lang="ts">
import { computed, ref } from 'vue'
import { useD2Render } from '../composables/d2'
import { downloadText } from '../composables/download'
import { highlightD2Lines } from '../composables/highlight'
import { dark } from '../composables/theme'
import CodeArea, { type CodeError } from './CodeArea.vue'
import AppButton from './ui/AppButton.vue'
import AppPanel from './ui/AppPanel.vue'
import AppSelect from './ui/AppSelect.vue'
import CopyButton from './ui/CopyButton.vue'
import DiagramPreview from './ui/DiagramPreview.vue'
import IconButton from './ui/IconButton.vue'
import ProblemList, { type Problem } from './ui/ProblemList.vue'
import ZoomControl from './ui/ZoomControl.vue'

const sample = `# Write D2 on the left, see the diagram on the right.
direction: right

user: User {shape: person}
app: JSON Studio {
  editor: Editor
  d2: D2 Renderer
  editor -> d2: source
}
db: Storage {shape: cylinder}

user -> app.editor: types code
app.d2 -> user: diagram
app -> db: save
`

const LAYOUTS = [
  { value: 'dagre', label: 'Dagre' },
  { value: 'elk', label: 'ELK' },
] as const

const source = ref(sample)
const layout = ref<'dagre' | 'elk'>('dagre')
const sketch = ref(false)
const zoom = ref(1)
const sourceArea = ref<InstanceType<typeof CodeArea> | null>(null)

const { svg, error, rendering } = useD2Render(
  () => source.value,
  () => ({ layout: layout.value, sketch: sketch.value, dark: dark.value }),
)

/** One problem per error line; positions come from messages like "index:3:7: maps must be terminated with }". */
const problems = computed<Problem[]>(() =>
  error.value
    .split('\n')
    .filter(Boolean)
    .map((message) => {
      const m = message.match(/^[^:\s]+:(\d+):(\d+):/)
      return m ? { message, line: +m[1], column: +m[2] } : { message }
    }),
)
const errorMarks = computed<CodeError[]>(() =>
  problems.value.flatMap((p) => (p.line ? [{ line: p.line, column: p.column, message: p.message }] : [])),
)

const lineCount = computed(() => source.value.split('\n').length)
</script>

<template>
  <div class="flex flex-col items-stretch gap-4 md:flex-row">
    <AppPanel label="D2 SOURCE">
      <template #actions>
        <AppButton variant="ghost" href="https://d2lang.com/tour/intro">Docs ↗</AppButton>
        <IconButton icon="trash" title="Clear" danger @click="source = ''" />
      </template>

      <CodeArea
        ref="sourceArea"
        v-model="source"
        :highlight="highlightD2Lines"
        :errors="errorMarks"
        min-height="520px"
      />

      <template #footer>
        <span>{{ lineCount }} lines</span>
        <span
          class="ml-auto font-semibold"
          :class="error ? 'text-[var(--red)]' : svg ? 'text-[var(--green)]' : 'text-[var(--muted)]'"
        >
          {{ rendering ? 'Rendering…' : error ? '✕ Error' : svg ? '✓ Valid D2' : 'Empty' }}
        </span>
      </template>
    </AppPanel>

    <AppPanel label="PREVIEW">
      <template #actions>
        <AppSelect v-model="layout" :options="LAYOUTS" title="Layout engine" />
        <AppButton :active="sketch" title="Hand-drawn sketch style" @click="sketch = !sketch">Sketch</AppButton>
        <ZoomControl v-model="zoom" />
        <CopyButton :text="svg" title="Copy SVG" />
        <IconButton icon="download" title="Download SVG" :disabled="!svg" @click="downloadText(svg, 'diagram.svg', 'image/svg+xml')" />
      </template>

      <DiagramPreview
        :svg="svg"
        :zoom="zoom"
        :dimmed="rendering || !!error"
        :placeholder="error ? '' : rendering ? 'Loading D2 engine…' : 'Diagram appears here'"
      >
        <ProblemList :problems="problems" @jump="(line, column) => sourceArea?.revealLine(line, column)" />
      </DiagramPreview>
    </AppPanel>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { D2 } from '@terrastruct/d2'
import { highlightD2Lines } from '../composables/highlight'
import CodeArea, { type CodeError } from './CodeArea.vue'

const props = defineProps<{ dark: boolean }>()

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

const source = ref(sample)
const svg = ref('')
const error = ref('')
const rendering = ref(false)
const layout = ref<'dagre' | 'elk'>('dagre')
const sketch = ref(false)
const zoom = ref(1)
const copied = ref(false)
const sourceArea = ref<InstanceType<typeof CodeArea> | null>(null)

/** Error positions from messages like "index:3:7: maps must be terminated with }". */
const errorMarks = computed<CodeError[]>(() =>
  error.value.split('\n').flatMap((msg) => {
    const m = msg.match(/^[^:\s]+:(\d+):(\d+):/)
    return m ? [{ line: +m[1], column: +m[2], message: msg }] : []
  }),
)

const lineCount = computed(() => source.value.split('\n').length)

// The D2 WASM bundle is ~8 MB, so it is only loaded when this tab is opened.
let d2Instance: Promise<D2> | null = null
function getD2(): Promise<D2> {
  d2Instance ??= import('@terrastruct/d2').then((m) => new m.D2())
  return d2Instance
}

/** D2 compile errors arrive as a JSON array of { errmsg }; show one per line. */
function formatError(err: unknown): string {
  const msg = (err as Error)?.message ?? String(err)
  try {
    const list = JSON.parse(msg) as { errmsg?: string }[]
    if (Array.isArray(list)) return list.map((e) => e.errmsg ?? JSON.stringify(e)).join('\n')
  } catch {
    /* not JSON — use as-is */
  }
  return msg
}

// Each render gets a sequence number so a slow, stale render never
// overwrites the result of a newer one.
let seq = 0
async function render() {
  const id = ++seq
  const code = source.value
  if (!code.trim()) {
    svg.value = ''
    error.value = ''
    return
  }
  rendering.value = true
  try {
    const d2 = await getD2()
    const result = await d2.compile(code, {
      options: { layout: layout.value, sketch: sketch.value },
    })
    const out = await d2.render(result.diagram, {
      ...result.renderOptions,
      sketch: sketch.value,
      themeID: props.dark ? 200 : 0,
      noXMLTag: true,
      pad: 40,
    })
    if (id !== seq) return
    svg.value = out
    error.value = ''
  } catch (err) {
    if (id !== seq) return
    error.value = formatError(err)
  } finally {
    if (id === seq) rendering.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(
  [source, layout, sketch, () => props.dark],
  () => {
    clearTimeout(timer)
    timer = setTimeout(render, 350)
  },
  { immediate: true },
)
onBeforeUnmount(() => clearTimeout(timer))

function jumpTo(msg: string) {
  const mark = errorMarks.value.find((e) => e.message === msg)
  if (mark) sourceArea.value?.revealLine(mark.line, mark.column)
}

function zoomBy(delta: number) {
  zoom.value = Math.min(4, Math.max(0.25, +(zoom.value + delta).toFixed(2)))
}

async function copySvg() {
  if (!svg.value) return
  await navigator.clipboard.writeText(svg.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 900)
}

function downloadSvg() {
  if (!svg.value) return
  const url = URL.createObjectURL(new Blob([svg.value], { type: 'image/svg+xml' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'diagram.svg'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="flex flex-col items-stretch gap-4 md:flex-row">
    <!-- Source -->
    <section
      class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]"
    >
      <header class="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
        <span class="text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)]">D2 SOURCE</span>
        <div class="ml-auto flex items-center gap-1.5">
          <a
            href="https://d2lang.com/tour/intro"
            target="_blank"
            rel="noopener"
            class="px-2 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
          >
            Docs ↗
          </a>
          <button
            class="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--ctrl-bg)] hover:text-[var(--red)]"
            title="Clear"
            @click="source = ''"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      </header>

      <CodeArea
        ref="sourceArea"
        v-model="source"
        :highlight="highlightD2Lines"
        :errors="errorMarks"
        min-height="520px"
      />

      <footer
        class="flex items-center gap-3.5 border-t border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-[11.5px] text-[var(--muted)]"
      >
        <span>{{ lineCount }} lines</span>
        <span
          class="ml-auto font-semibold"
          :class="error ? 'text-[var(--red)]' : svg ? 'text-[var(--green)]' : 'text-[var(--muted)]'"
        >
          {{ rendering ? 'Rendering…' : error ? '✕ Error' : svg ? '✓ Valid D2' : 'Empty' }}
        </span>
      </footer>
    </section>

    <!-- Preview -->
    <section
      class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]"
    >
      <header class="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
        <span class="text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)]">PREVIEW</span>

        <div class="flex w-full flex-wrap items-center justify-end gap-1.5 sm:ml-auto sm:w-auto">
          <select
            v-model="layout"
            class="rounded-lg bg-[var(--ctrl-bg)] px-2 py-1.5 text-xs font-medium text-[var(--text)] outline-none"
            title="Layout engine"
          >
            <option value="dagre">Dagre</option>
            <option value="elk">ELK</option>
          </select>
          <button
            class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            :class="
              sketch
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'bg-[var(--ctrl-bg)] text-[var(--text)] hover:text-[var(--accent)]'
            "
            title="Hand-drawn sketch style"
            @click="sketch = !sketch"
          >
            Sketch
          </button>
          <div class="flex items-center rounded-lg bg-[var(--ctrl-bg)] text-xs font-medium text-[var(--text)]">
            <button class="px-2 py-1.5 hover:text-[var(--accent)]" title="Zoom out" @click="zoomBy(-0.25)">−</button>
            <button class="w-11 py-1.5 text-center hover:text-[var(--accent)]" title="Reset zoom" @click="zoom = 1">
              {{ Math.round(zoom * 100) }}%
            </button>
            <button class="px-2 py-1.5 hover:text-[var(--accent)]" title="Zoom in" @click="zoomBy(0.25)">+</button>
          </div>
          <button
            class="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--ctrl-bg)] hover:text-[var(--text)] disabled:opacity-40"
            title="Copy SVG"
            :disabled="!svg"
            @click="copySvg"
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
            class="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--ctrl-bg)] hover:text-[var(--text)] disabled:opacity-40"
            title="Download SVG"
            :disabled="!svg"
            @click="downloadSvg"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          </button>
        </div>
      </header>

      <div class="relative flex-1 overflow-auto bg-[var(--panel-soft)]" style="min-height: 520px">
        <div
          v-if="svg"
          class="d2-preview p-4"
          :class="{ 'opacity-50': rendering || error }"
          :style="{ width: zoom * 100 + '%' }"
          v-html="svg"
        ></div>
        <div
          v-else-if="!error"
          class="absolute inset-0 grid place-items-center text-[13px] text-[var(--muted)]"
        >
          {{ rendering ? 'Loading D2 engine…' : 'Diagram appears here' }}
        </div>

        <div
          v-if="error"
          class="absolute inset-x-3 bottom-3 max-h-[45%] overflow-auto rounded-lg border border-[var(--red)] bg-[var(--panel)] p-2 font-[family-name:var(--mono)] text-[12px] text-[var(--red)] shadow-sm"
        >
          <button
            v-for="(msg, i) in error.split('\n')"
            :key="i"
            class="block w-full rounded px-1.5 py-0.5 text-left whitespace-pre-wrap hover:bg-[var(--diff-bg)]"
            :title="errorMarks.some((e) => e.message === msg) ? 'Jump to error' : undefined"
            @click="jumpTo(msg)"
          >
            {{ msg }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.d2-preview :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}
</style>

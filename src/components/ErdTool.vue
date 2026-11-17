<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { renderD2, useD2Render } from '../composables/d2'
import { downloadBlob, downloadText } from '../composables/download'
import { highlightDbmlLines, highlightSqlLines } from '../composables/highlight'
import { loadStored, useAutoSave } from '../composables/storage'
import { dark } from '../composables/theme'
import {
  inferRefs,
  parseDbml,
  parseSql,
  SAMPLES,
  toD2,
  toDbml,
  toSql,
  type Dialect,
  type ErdRef,
  type ErdSchema,
} from '../composables/erd'
import CodeArea, { type CodeError } from './CodeArea.vue'
import AppButton from './ui/AppButton.vue'
import AppPanel from './ui/AppPanel.vue'
import AppSelect from './ui/AppSelect.vue'
import CopyButton from './ui/CopyButton.vue'
import DiagramPreview from './ui/DiagramPreview.vue'
import IconButton from './ui/IconButton.vue'
import ProblemList, { type Problem } from './ui/ProblemList.vue'
import SegmentedControl from './ui/SegmentedControl.vue'
import ZoomControl from './ui/ZoomControl.vue'

type Mode = 'sql' | 'dbml'

const MODES = [
  { value: 'sql', label: 'SQL DDL' },
  { value: 'dbml', label: 'DBML' },
] as const
const DIALECTS = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'oracle', label: 'Oracle' },
] as const
const LAYOUTS = [
  { value: 'elk', label: 'ELK' },
  { value: 'dagre', label: 'Dagre' },
] as const

/* ---------- state (kept in this browser between visits) ---------- */

const STORE = 'json-studio-erd'
const saved = loadStored<{
  mode?: Mode
  dialect?: Dialect
  sql?: string
  dbml?: string
  /** Older versions kept one text for both tabs. */
  source?: string
}>(STORE)

const mode = ref<Mode>(saved?.mode ?? 'sql')
const dialect = ref<Dialect>(saved?.dialect ?? 'postgresql')

// SQL DDL and DBML each keep their own text, so switching tabs never feeds
// one language to the other's parser.
const legacyIsDbml = !!saved?.source && (saved.mode === 'dbml' || !/\bcreate\b[^;]*\btable\b/i.test(saved.source))
const texts = reactive<Record<Mode, string>>({
  sql: saved?.sql ?? (saved?.source && !legacyIsDbml ? saved.source : SAMPLES[dialect.value]),
  dbml: saved?.dbml ?? (saved?.source && legacyIsDbml ? saved.source : SAMPLES.dbml),
})
const source = computed({
  get: () => texts[mode.value],
  set: (v) => (texts[mode.value] = v),
})

useAutoSave(STORE, [mode, dialect, texts], () => ({ mode: mode.value, dialect: dialect.value, ...texts }))

/** Changing dialect swaps the SQL sample in, unless the user has written their own. */
const isSample = (s: string) => !s.trim() || Object.values(SAMPLES).includes(s)
watch(dialect, () => {
  if (isSample(texts.sql)) texts.sql = SAMPLES[dialect.value]
})

/* ---------- parsing ---------- */

const layout = ref<'elk' | 'dagre'>('elk')
const direction = ref<'right' | 'down'>('right')
const infer = ref(true)
const zoom = ref(1)
const sourceArea = ref<InstanceType<typeof CodeArea> | null>(null)

const schema = computed<ErdSchema>(() => (mode.value === 'sql' ? parseSql(source.value) : parseDbml(source.value)))
const inferred = computed<ErdRef[]>(() => (infer.value ? inferRefs(schema.value) : []))
const allRefs = computed(() => [...schema.value.refs, ...inferred.value])

const sourceProblems = computed(() => [
  ...schema.value.errors.map((e) => ({ ...e, level: 'error' as const })),
  ...schema.value.warnings.map((e) => ({ ...e, level: 'warning' as const })),
])
const errorMarks = computed<CodeError[]>(() =>
  sourceProblems.value.map((p) => ({ line: p.line, column: p.column, message: p.message })),
)

const lineCount = computed(() => source.value.split('\n').length)

/* ---------- rendering ---------- */

const d2Code = computed(() =>
  schema.value.tables.length ? toD2(schema.value, allRefs.value, direction.value) : '',
)
const { svg, error: renderError, rendering } = useD2Render(
  () => d2Code.value,
  () => ({ layout: layout.value, dark: dark.value }),
)

const exportError = ref('')

/** Everything listed under the diagram: render / export failures first, then source problems. */
const problems = computed<Problem[]>(() => [
  ...[renderError.value, exportError.value].filter(Boolean).map((message) => ({ message })),
  ...sourceProblems.value.map((p) => ({
    ...p,
    message: `${p.level === 'error' ? '✕' : '⚠'} line ${p.line}: ${p.message}`,
  })),
])

/* ---------- actions ---------- */

function jumpTo(line: number, column?: number) {
  sourceArea.value?.revealLine(line, column)
}

function loadSample() {
  source.value = mode.value === 'dbml' ? SAMPLES.dbml : SAMPLES[dialect.value]
}

/** Syntax reference for whatever is being typed on the left. */
const DOCS = {
  dbml: { href: 'https://dbml.dbdiagram.io/docs', title: 'DBML syntax reference' },
  postgresql: {
    href: 'https://www.postgresql.org/docs/current/sql-createtable.html',
    title: 'PostgreSQL CREATE TABLE reference',
  },
  oracle: {
    href: 'https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CREATE-TABLE.html',
    title: 'Oracle CREATE TABLE reference',
  },
}
const docs = computed(() => DOCS[mode.value === 'dbml' ? 'dbml' : dialect.value])

type Target = 'dbml' | Dialect
const convertTargets = computed<{ value: Target | ''; label: string }[]>(() => [
  { value: '', label: 'Convert to…' },
  ...(
    [
      { value: 'dbml', label: 'DBML' },
      { value: 'postgresql', label: 'PostgreSQL DDL' },
      { value: 'oracle', label: 'Oracle DDL' },
    ] as const
  ).filter((t) => (mode.value === 'dbml' ? t.value !== 'dbml' : t.value !== dialect.value)),
])

function convert(target: Target | '') {
  if (!target || !schema.value.tables.length) return
  if (target === 'dbml') {
    texts.dbml = toDbml(schema.value)
    mode.value = 'dbml'
  } else {
    texts.sql = toSql(schema.value, target)
    dialect.value = target
    mode.value = 'sql'
  }
}

/* ---------- export ---------- */

const EXPORTS = ['svg', 'png', 'pdf'] as const
const exporting = ref('')

/** Diagram size from the root viewBox ("0 0 W H"). */
function svgSize(s: string): { w: number; h: number } {
  const m = s.match(/viewBox="([-\d.]+)\s+([-\d.]+)\s+([\d.]+)\s+([\d.]+)"/)
  return m ? { w: +m[3], h: +m[4] } : { w: 800, h: 600 }
}

async function svgToPng(s: string, scale: number): Promise<{ dataUrl: string; w: number; h: number }> {
  const { w, h } = svgSize(s)
  const sized = s.replace(/^<svg /, `<svg width="${w}" height="${h}" `)
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized)
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0, w, h)
  return { dataUrl: canvas.toDataURL('image/png'), w, h }
}

/** Exports always use the light theme so they print and paste into documents cleanly. */
async function exportAs(kind: 'svg' | 'png' | 'pdf') {
  if (!d2Code.value || exporting.value) return
  exporting.value = kind
  exportError.value = ''
  try {
    const light = await renderD2(d2Code.value, { layout: layout.value, dark: false })
    if (kind === 'svg') {
      downloadText(light, 'database-diagram.svg', 'image/svg+xml')
    } else if (kind === 'png') {
      const { dataUrl } = await svgToPng(light, 2)
      downloadBlob(await (await fetch(dataUrl)).blob(), 'database-diagram.png')
    } else {
      const [{ jsPDF }, png] = await Promise.all([import('jspdf'), svgToPng(light, 2)])
      const pdf = new jsPDF({
        orientation: png.w >= png.h ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [png.w, png.h],
      })
      pdf.addImage(png.dataUrl, 'PNG', 0, 0, png.w, png.h)
      pdf.save('database-diagram.pdf')
    }
  } catch (err) {
    exportError.value = `Export failed: ${(err as Error)?.message ?? err}`
  } finally {
    exporting.value = ''
  }
}

const kindLabel: Record<ErdRef['kind'], string> = {
  'many-to-one': 'N : 1',
  'one-to-one': '1 : 1',
  'many-to-many': 'N : N',
}

const status = computed(() => {
  if (!source.value.trim()) return { text: 'Empty', cls: 'text-[var(--muted)]' }
  if (schema.value.errors.length) return { text: `✕ ${schema.value.errors.length} error(s)`, cls: 'text-[var(--red)]' }
  if (schema.value.warnings.length)
    return { text: `⚠ ${schema.value.warnings.length} warning(s)`, cls: 'text-[var(--accent)]' }
  return { text: mode.value === 'sql' ? '✓ Valid DDL' : '✓ Valid DBML', cls: 'text-[var(--green)]' }
})
</script>

<template>
  <div class="flex flex-col items-stretch gap-4 md:flex-row">
    <AppPanel>
      <template #title>
        <SegmentedControl v-model="mode" :options="MODES" />
        <AppSelect v-if="mode === 'sql'" v-model="dialect" :options="DIALECTS" title="SQL dialect" />
      </template>
      <template #actions>
        <AppSelect
          model-value=""
          :options="convertTargets"
          title="Rewrite the source in another format (comments, indexes and storage clauses are not kept)"
          :disabled="!schema.tables.length"
          @update:model-value="convert"
        />
        <AppButton variant="ghost" title="Load an example" @click="loadSample">Sample</AppButton>
        <AppButton variant="ghost" :href="docs.href" :title="docs.title">Docs ↗</AppButton>
        <CopyButton :text="source" title="Copy source" />
        <IconButton icon="trash" title="Clear" danger @click="source = ''" />
      </template>

      <CodeArea
        ref="sourceArea"
        v-model="source"
        :highlight="mode === 'sql' ? highlightSqlLines : highlightDbmlLines"
        :errors="errorMarks"
        min-height="520px"
      />

      <template #footer>
        <span>{{ lineCount }} lines</span>
        <span>{{ schema.tables.length }} tables</span>
        <span>
          {{ schema.refs.length }} relationships<template v-if="inferred.length"> (+{{ inferred.length }} inferred)</template>
        </span>
        <span class="ml-auto font-semibold" :class="status.cls">{{ status.text }}</span>
      </template>
    </AppPanel>

    <AppPanel label="ERD">
      <template #actions>
        <AppSelect v-model="layout" :options="LAYOUTS" title="Layout engine" />
        <AppButton
          :title="direction === 'right' ? 'Left to right — click for top to bottom' : 'Top to bottom — click for left to right'"
          @click="direction = direction === 'right' ? 'down' : 'right'"
        >
          {{ direction === 'right' ? '→' : '↓' }}
        </AppButton>
        <AppButton
          :active="infer"
          title="Guess relationships from column names (customer_id → customers.id), drawn dashed"
          @click="infer = !infer"
        >
          Infer
        </AppButton>
        <ZoomControl v-model="zoom" />
        <div class="flex items-center rounded-lg bg-[var(--ctrl-bg)] text-xs font-medium text-[var(--text)]">
          <button
            v-for="k in EXPORTS"
            :key="k"
            class="px-2.5 py-1.5 uppercase hover:text-[var(--accent)] disabled:opacity-40"
            :title="`Download ${k.toUpperCase()} (light theme)`"
            :disabled="!svg || !!exporting"
            @click="exportAs(k)"
          >
            {{ exporting === k ? '…' : k }}
          </button>
        </div>
      </template>

      <DiagramPreview
        :svg="svg"
        :zoom="zoom"
        :dimmed="rendering"
        :placeholder="renderError ? '' : rendering ? 'Loading diagram engine…' : 'Paste CREATE TABLE statements or write DBML'"
      >
        <ProblemList :problems="problems" @jump="jumpTo" />
      </DiagramPreview>

      <details class="border-t border-[var(--border)] bg-[var(--panel-soft)] text-[12px]">
        <summary class="cursor-pointer px-3 py-1.5 text-[11.5px] text-[var(--muted)] select-none hover:text-[var(--text)]">
          Detected: {{ schema.tables.length }} tables · {{ allRefs.length }} relationships
        </summary>
        <div class="grid max-h-56 gap-4 overflow-auto px-3 pb-3 sm:grid-cols-2">
          <div>
            <div class="mb-1 text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)]">TABLES</div>
            <button
              v-for="t in schema.tables"
              :key="(t.schema ?? '') + '.' + t.name"
              class="flex w-full justify-between gap-2 rounded px-1.5 py-0.5 text-left font-[family-name:var(--mono)] hover:bg-[var(--ctrl-bg)]"
              title="Jump to definition"
              @click="jumpTo(t.line)"
            >
              <span class="truncate">{{ t.schema ? t.schema + '.' : '' }}{{ t.name }}</span>
              <span class="shrink-0 text-[var(--muted)]">{{ t.columns.length }} cols</span>
            </button>
          </div>
          <div>
            <div class="mb-1 text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)]">RELATIONSHIPS</div>
            <button
              v-for="(r, i) in allRefs"
              :key="i"
              class="flex w-full gap-2 rounded px-1.5 py-0.5 text-left font-[family-name:var(--mono)] hover:bg-[var(--ctrl-bg)]"
              :class="r.inferred ? 'text-[var(--muted)]' : ''"
              :title="r.inferred ? 'Inferred from the column name — not declared' : 'Jump to definition'"
              @click="jumpTo(r.line)"
            >
              <span class="w-9 shrink-0 text-[var(--accent)]">{{ kindLabel[r.kind] }}</span>
              <span class="truncate">
                {{ r.from.table }}.{{ r.from.columns.join(',') }} → {{ r.to.table }}.{{ r.to.columns.join(',') }}
                <template v-if="r.inferred"> (inferred)</template>
              </span>
            </button>
            <div v-if="!allRefs.length" class="px-1.5 text-[var(--muted)]">None found</div>
          </div>
        </div>
      </details>
    </AppPanel>
  </div>
</template>

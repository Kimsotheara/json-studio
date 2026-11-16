<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import {
  applyOverrides,
  buildCurl,
  buildMarkdown,
  buildOpenApi,
  flattenJson,
  parseHeaders,
  parseJson,
  parseUrl,
  type ApiInput,
  type DocField,
  type DocModel,
  type Overrides,
  type SectionKey,
} from '../composables/apiDocs'
import { highlightLines } from '../composables/highlight'
import CodeArea, { type CodeError } from './CodeArea.vue'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

const SAMPLE: ApiInput = {
  title: 'Fund Transfer',
  description: 'Transfers money from the customer\'s account to another account in the same bank.',
  method: 'POST',
  url: 'https://api.example-bank.com.kh/v1/accounts/{accountNo}/transfers?channel=MOBILE',
  headers: 'Content-Type: application/json\nAuthorization: Bearer <access_token>\nX-Request-Id: 2f6c1e9a-8a4b-4c1e-9d2a-0b7a5e1c3f10',
  request: JSON.stringify(
    { toAccount: '0098765432', amount: 150.5, currency: 'USD', remark: 'Rent payment', transferDate: '2026-11-16' },
    null,
    2,
  ),
  responseStatus: '200',
  response: JSON.stringify(
    {
      status: 'SUCCESS',
      code: '00',
      message: 'Transfer completed',
      data: { transactionId: 'TXN202611160001', referenceNo: 'FT26320ABC123', fee: 0, createdAt: '2026-11-16T09:30:00Z' },
    },
    null,
    2,
  ),
  errorStatus: '400',
  error: JSON.stringify({ status: 'FAILED', code: 'E101', message: 'Insufficient balance' }, null, 2),
}

const EMPTY: ApiInput = {
  title: '',
  description: '',
  method: 'GET',
  url: '',
  headers: 'Content-Type: application/json',
  request: '',
  responseStatus: '200',
  response: '',
  errorStatus: '400',
  error: '',
}

/* ---------- draft persistence (per-browser convenience) ---------- */

const STORE = 'json-studio-apidoc-draft'
function loadDraft(): { input: ApiInput; overrides: Overrides } {
  try {
    const d = JSON.parse(localStorage.getItem(STORE) ?? 'null')
    if (d?.input) return { input: { ...EMPTY, ...d.input }, overrides: d.overrides ?? {} }
  } catch {
    /* ignore */
  }
  return { input: { ...SAMPLE }, overrides: {} }
}
const draft = loadDraft()
const input = reactive<ApiInput>(draft.input)
const overrides = reactive<Overrides>(draft.overrides)

let saveTimer: ReturnType<typeof setTimeout> | undefined
watch([input, overrides], () => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ input, overrides }))
    } catch {
      /* ignore */
    }
  }, 300)
}, { deep: true })

function loadSample() {
  Object.assign(input, SAMPLE)
  for (const k of Object.keys(overrides)) delete overrides[k]
}
function clearAll() {
  if (!confirm('Clear all inputs and your field descriptions?')) return
  Object.assign(input, EMPTY)
  for (const k of Object.keys(overrides)) delete overrides[k]
}

/* ---------- JSON bodies ---------- */

type BodyKey = 'request' | 'response' | 'error'
const BODIES: { key: BodyKey; label: string; status?: 'responseStatus' | 'errorStatus'; hint: string }[] = [
  { key: 'request', label: 'REQUEST BODY', hint: 'Optional — leave empty for GET' },
  { key: 'response', label: 'RESPONSE BODY', status: 'responseStatus', hint: 'Success example' },
  { key: 'error', label: 'ERROR RESPONSE', status: 'errorStatus', hint: 'Optional' },
]

const parsed = computed(() => ({
  request: parseJson(input.request),
  response: parseJson(input.response),
  error: parseJson(input.error),
}))

function bodyErrors(key: BodyKey): CodeError[] {
  const p = parsed.value[key]
  return !p.ok && p.line ? [{ line: p.line, column: p.column, message: p.message }] : []
}

function isEmptyBody(key: BodyKey): boolean {
  const p = parsed.value[key]
  return p.ok && p.empty
}
function errorMessage(key: BodyKey): string {
  const p = parsed.value[key]
  return p.ok ? '' : p.message
}

const areas: Partial<Record<BodyKey, InstanceType<typeof CodeArea>>> = {}
function jumpToError(key: BodyKey) {
  const e = bodyErrors(key)[0]
  if (e) areas[key]?.revealLine(e.line, e.column)
}

function formatBody(key: BodyKey) {
  const p = parsed.value[key]
  if (p.ok && !p.empty) input[key] = JSON.stringify(p.value, null, 2)
}

/* ---------- document model ---------- */

const model = computed<DocModel>(() => {
  const url = parseUrl(input.url)
  const body = (key: BodyKey, section: SectionKey, requiredByDefault: boolean) => {
    const p = parsed.value[key]
    if (!p.ok || p.empty) return undefined
    return { fields: applyOverrides(section, flattenJson(p.value, requiredByDefault), overrides), json: input[key] }
  }
  return {
    input: { ...input },
    url,
    headers: applyOverrides('headers', parseHeaders(input.headers), overrides),
    pathParams: applyOverrides('path', url.pathParams, overrides),
    queryParams: applyOverrides('query', url.queryParams, overrides),
    request: body('request', 'request', true),
    response: body('response', 'response', false),
    error: body('error', 'error', false),
  }
})

const sections = computed(() => {
  const m = model.value
  const list: { key: SectionKey; title: string; fields: DocField[]; required: boolean; json?: string }[] = []
  if (m.headers.length) list.push({ key: 'headers', title: 'Headers', fields: m.headers, required: true })
  if (m.pathParams.length) list.push({ key: 'path', title: 'Path Parameters', fields: m.pathParams, required: true })
  if (m.queryParams.length) list.push({ key: 'query', title: 'Query Parameters', fields: m.queryParams, required: true })
  if (m.request) list.push({ key: 'request', title: 'Request Body', fields: m.request.fields, required: true, json: m.request.json })
  if (m.response)
    list.push({ key: 'response', title: `Response — ${input.responseStatus || '200'}`, fields: m.response.fields, required: false, json: m.response.json })
  if (m.error)
    list.push({ key: 'error', title: `Error Response — ${input.errorStatus || '400'}`, fields: m.error.fields, required: false, json: m.error.json })
  return list
})

function setDescription(section: SectionKey, f: DocField, value: string) {
  ;(overrides[`${section}:${f.path}`] ??= {}).description = value
}
function setRequired(section: SectionKey, f: DocField, value: boolean) {
  ;(overrides[`${section}:${f.path}`] ??= {}).required = value
}

const pretty = (json: string) => {
  try {
    return JSON.stringify(JSON.parse(json), null, 2)
  } catch {
    return json
  }
}

/* ---------- output ---------- */

type View = 'preview' | 'markdown' | 'openapi' | 'curl'
const VIEWS: { key: View; label: string }[] = [
  { key: 'preview', label: 'Preview' },
  { key: 'markdown', label: 'Markdown' },
  { key: 'openapi', label: 'OpenAPI' },
  { key: 'curl', label: 'cURL' },
]
const view = ref<View>('preview')

const markdown = computed(() => buildMarkdown(model.value))
const openapi = computed(() => buildOpenApi(model.value))
const curl = computed(() => buildCurl(model.value))
const outputText = computed(() =>
  view.value === 'openapi' ? openapi.value : view.value === 'curl' ? curl.value : markdown.value,
)

const slug = computed(
  () => (input.title.trim() || 'api-doc').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'api-doc',
)

const copied = ref(false)
async function copyOutput() {
  await navigator.clipboard.writeText(outputText.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1000)
}
function saveText(text: string, filename: string, type: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

type Format = 'pdf' | 'docx' | 'md' | 'yaml' | 'sh'
const FORMATS: { key: Format; label: string; ext: string }[] = [
  { key: 'pdf', label: 'PDF document', ext: '.pdf' },
  { key: 'docx', label: 'Word document', ext: '.docx' },
  { key: 'md', label: 'Markdown', ext: '.md' },
  { key: 'yaml', label: 'OpenAPI 3 (YAML)', ext: '.yaml' },
  { key: 'sh', label: 'cURL script', ext: '.sh' },
]

const menuOpen = ref(false)
const exporting = ref<Format | null>(null)
const exportError = ref('')
const exportNote = ref('')

async function download(format: Format) {
  menuOpen.value = false
  exportError.value = ''
  exportNote.value = ''
  if (format === 'md') return saveText(markdown.value, `${slug.value}.md`, 'text/markdown')
  if (format === 'yaml') return saveText(openapi.value, `${slug.value}.openapi.yaml`, 'application/yaml')
  if (format === 'sh') return saveText(curl.value, `${slug.value}.sh`, 'text/plain')
  exporting.value = format
  try {
    // The PDF / Word libraries are loaded on first use.
    const { downloadPdf, downloadDocx } = await import('../composables/apiDocsExport')
    if (format === 'docx') await downloadDocx(model.value, slug.value)
    else if ((await downloadPdf(model.value, slug.value)) === 'print') {
      exportNote.value =
        'Your document contains Khmer, so the PDF is made by the browser for correct Khmer rendering — choose "Save as PDF" as the printer.'
    }
  } catch (err) {
    exportError.value = `Could not create the ${format === 'pdf' ? 'PDF' : 'Word'} file: ${(err as Error).message}`
  } finally {
    exporting.value = null
  }
}

// Close the download menu on any outside click.
function onDocClick(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('[data-download-menu]')) menuOpen.value = false
}
document.addEventListener('click', onDocClick)
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

const METHOD_COLORS: Record<string, string> = {
  GET: 'var(--green)',
  POST: 'var(--accent)',
  PUT: '#3b82f6',
  PATCH: '#a855f7',
  DELETE: 'var(--red)',
}

const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-2 text-[13px] text-[var(--text)] caret-[var(--accent)] outline-none transition-colors placeholder:text-[var(--muted)]/70 focus:border-[var(--accent)]'
const labelClass = 'mb-1 block text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase'
const cardClass = 'overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]'
const smallBtn =
  'rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--ctrl-bg)] hover:text-[var(--text)]'
</script>

<template>
  <div class="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
    <!-- Inputs -->
    <div class="flex min-w-0 flex-col gap-4">
      <section :class="cardClass">
        <header class="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
          <span class="text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)]">ENDPOINT</span>
          <div class="ml-auto flex gap-1">
            <button :class="smallBtn" @click="loadSample">Load sample</button>
            <button :class="smallBtn" class="hover:!text-[var(--red)]" @click="clearAll">Clear all</button>
          </div>
        </header>
        <div class="flex flex-col gap-3 p-4">
          <div>
            <label :class="labelClass">API name</label>
            <input v-model="input.title" placeholder="Get Account Balance" :class="inputClass" />
          </div>
          <div>
            <label :class="labelClass">Method &amp; URL</label>
            <div class="flex gap-2">
              <select
                v-model="input.method"
                class="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-2 text-[13px] font-bold outline-none focus:border-[var(--accent)]"
                :style="{ color: METHOD_COLORS[input.method] }"
              >
                <option v-for="m in METHODS" :key="m" :value="m">{{ m }}</option>
              </select>
              <input
                v-model="input.url"
                placeholder="https://api.example.com/v1/accounts/{accountNo}?currency=USD"
                :class="inputClass"
                class="font-[family-name:var(--mono)] !text-[12.5px]"
              />
            </div>
            <p class="mt-1 text-[11px] text-[var(--muted)]">
              Write path parameters as <code>{id}</code> or <code>:id</code>. Query parameters are documented automatically.
            </p>
          </div>
          <div>
            <label :class="labelClass">Description</label>
            <textarea v-model="input.description" rows="2" placeholder="What does this API do?" :class="inputClass" class="resize-y"></textarea>
          </div>
          <div>
            <label :class="labelClass">Headers <span class="normal-case">(one per line: Name: value)</span></label>
            <textarea
              v-model="input.headers"
              rows="3"
              spellcheck="false"
              :class="inputClass"
              class="resize-y font-[family-name:var(--mono)] !text-[12.5px]"
            ></textarea>
          </div>
        </div>
      </section>

      <section v-for="b in BODIES" :key="b.key" :class="cardClass" class="flex flex-col">
        <header class="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
          <span class="text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)]">{{ b.label }}</span>
          <span class="text-[11px] text-[var(--muted)]">{{ b.hint }}</span>
          <div class="ml-auto flex items-center gap-1.5">
            <label v-if="b.status" class="flex items-center gap-1 text-[11px] text-[var(--muted)]">
              Status
              <input
                v-model="input[b.status]"
                class="w-14 rounded-md border border-[var(--border)] bg-[var(--panel-soft)] px-1.5 py-1 text-center font-[family-name:var(--mono)] text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <button :class="smallBtn" :disabled="!parsed[b.key].ok" @click="formatBody(b.key)">Format</button>
            <button :class="smallBtn" class="hover:!text-[var(--red)]" @click="input[b.key] = ''">Clear</button>
          </div>
        </header>
        <CodeArea
          :ref="(el) => (areas[b.key] = (el as InstanceType<typeof CodeArea>) ?? undefined)"
          v-model="input[b.key]"
          :highlight="highlightLines"
          :errors="bodyErrors(b.key)"
          min-height="170px"
        />
        <footer
          class="flex items-center border-t border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-[11.5px] font-semibold"
        >
          <button
            v-if="!parsed[b.key].ok"
            class="truncate text-[var(--red)] hover:underline"
            title="Jump to error"
            @click="jumpToError(b.key)"
          >
            ✕ {{ errorMessage(b.key) }}
          </button>
          <span v-else-if="isEmptyBody(b.key)" class="text-[var(--muted)]">Empty — not included</span>
          <span v-else class="text-[var(--green)]">✓ Valid JSON</span>
        </footer>
      </section>
    </div>

    <!-- Output -->
    <section :class="cardClass" class="xl:sticky xl:top-4">
      <header class="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <div class="flex rounded-lg bg-[var(--ctrl-bg)] p-0.5 text-xs font-medium">
          <button
            v-for="v in VIEWS"
            :key="v.key"
            class="rounded-md px-3 py-1.5 transition-colors"
            :class="
              view === v.key
                ? 'bg-[var(--tab-active-bg)] text-[var(--tab-active-text)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            "
            @click="view = v.key"
          >
            {{ v.label }}
          </button>
        </div>
        <div class="ml-auto flex items-center gap-1.5">
          <button
            class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            :title="view === 'preview' ? 'Copy as Markdown' : 'Copy'"
            @click="copyOutput"
          >
            {{ copied ? '✓ Copied' : view === 'preview' ? 'Copy Markdown' : 'Copy' }}
          </button>
          <div class="relative" data-download-menu>
            <button
              class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--tab-active-text)] transition-opacity hover:opacity-90 disabled:opacity-60"
              :disabled="!!exporting"
              @click="menuOpen = !menuOpen"
            >
              <span v-if="exporting" class="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
              {{ exporting ? `Creating ${exporting === 'pdf' ? 'PDF' : 'Word'}…` : 'Download ▾' }}
            </button>
            <div
              v-if="menuOpen"
              class="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel)] py-1 shadow-lg"
            >
              <button
                v-for="f in FORMATS"
                :key="f.key"
                class="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] text-[var(--text)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                @click="download(f.key)"
              >
                {{ f.label }}
                <span class="font-[family-name:var(--mono)] text-[11px] text-[var(--muted)]">{{ f.ext }}</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      <p v-if="exportNote" class="border-b border-[var(--border)] bg-[var(--accent-soft)] px-4 py-2 text-[12px] text-[var(--accent)]">
        ℹ {{ exportNote }}
      </p>
      <p v-if="exportError" class="border-b border-[var(--border)] px-4 py-2 text-[12px] text-[var(--red)]">✕ {{ exportError }}</p>

      <!-- Preview (descriptions and "required" are editable here) -->
      <div v-if="view === 'preview'" class="max-h-[calc(100vh-150px)] overflow-y-auto px-5 py-4">
        <h1 class="text-[20px] font-bold text-[var(--text)]">{{ input.title.trim() || `${input.method} ${model.url.path}` }}</h1>
        <p v-if="input.description.trim()" class="mt-1 text-[13.5px] leading-relaxed whitespace-pre-wrap text-[var(--muted)]">
          {{ input.description.trim() }}
        </p>

        <div class="mt-4 flex items-center gap-2 overflow-x-auto rounded-lg bg-[var(--panel-soft)] px-3 py-2.5 font-[family-name:var(--mono)] text-[13px]">
          <span class="rounded px-1.5 py-0.5 text-[11.5px] font-bold text-white" :style="{ background: METHOD_COLORS[input.method] }">
            {{ input.method }}
          </span>
          <span class="whitespace-nowrap text-[var(--text)]">{{ model.url.path }}</span>
        </div>
        <p v-if="model.url.server" class="mt-1.5 text-[12px] text-[var(--muted)]">
          Base URL: <code class="font-[family-name:var(--mono)]">{{ model.url.server }}</code>
        </p>

        <p class="mt-4 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-[11.5px] text-[var(--muted)]">
          ✎ Click any description to edit it, and tick Required where needed. Your edits are kept and used in every export.
        </p>

        <div v-for="s in sections" :key="s.key" class="mt-5">
          <h2 class="mb-2 text-[15px] font-semibold text-[var(--text)]">{{ s.title }}</h2>
          <div v-if="s.fields.length" class="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table class="w-full text-left text-[12.5px]">
              <thead class="bg-[var(--panel-soft)] text-[11px] tracking-wide text-[var(--muted)] uppercase">
                <tr>
                  <th class="px-3 py-2 font-semibold">Field</th>
                  <th class="px-3 py-2 font-semibold">Type</th>
                  <th v-if="s.required" class="px-3 py-2 text-center font-semibold">Req.</th>
                  <th class="min-w-[180px] px-3 py-2 font-semibold">Description</th>
                  <th class="px-3 py-2 font-semibold">Example</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--border)]">
                <tr v-for="f in s.fields" :key="f.path" class="align-top">
                  <td class="px-3 py-1.5 font-[family-name:var(--mono)] whitespace-nowrap text-[var(--text)]">
                    <span :style="{ paddingLeft: f.depth * 14 + 'px' }">
                      <span v-if="f.depth" class="text-[var(--muted)]">└ </span>{{ f.path.split('.').pop() }}
                    </span>
                  </td>
                  <td class="px-3 py-1.5 whitespace-nowrap text-[var(--accent)]">
                    {{ f.type }}<span v-if="f.format" class="text-[var(--muted)]"> ({{ f.format }})</span>
                  </td>
                  <td v-if="s.required" class="px-3 py-1.5 text-center">
                    <input
                      type="checkbox"
                      class="accent-[var(--accent)]"
                      :checked="f.required"
                      @change="setRequired(s.key, f, ($event.target as HTMLInputElement).checked)"
                    />
                  </td>
                  <td class="px-1.5 py-0.5">
                    <input
                      :value="f.description"
                      class="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-[var(--text)] outline-none hover:border-[var(--border)] focus:border-[var(--accent)] focus:bg-[var(--panel-soft)]"
                      @input="setDescription(s.key, f, ($event.target as HTMLInputElement).value)"
                    />
                  </td>
                  <td class="max-w-[200px] truncate px-3 py-1.5 font-[family-name:var(--mono)] text-[var(--muted)]" :title="f.example">
                    {{ f.example }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <template v-if="s.json">
            <div class="mt-2.5 mb-1 text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Example</div>
            <pre
              class="overflow-x-auto rounded-lg bg-[var(--panel-soft)] px-3 py-2.5 font-[family-name:var(--mono)] text-[12px] leading-[1.55]"
            ><div v-for="(l, i) in highlightLines(pretty(s.json))" :key="i" v-html="l || '&#8203;'"></div></pre>
          </template>
        </div>

        <h2 class="mt-5 mb-2 text-[15px] font-semibold text-[var(--text)]">Sample Request</h2>
        <pre
          class="overflow-x-auto rounded-lg bg-[var(--panel-soft)] px-3 py-2.5 font-[family-name:var(--mono)] text-[12px] leading-[1.55] text-[var(--text)]"
        >{{ curl }}</pre>
      </div>

      <!-- Raw outputs -->
      <pre
        v-else
        class="m-0 max-h-[calc(100vh-150px)] overflow-auto px-4 py-3.5 font-[family-name:var(--mono)] text-[12px] leading-[1.6] whitespace-pre text-[var(--text)]"
      >{{ outputText }}</pre>
    </section>
  </div>
</template>

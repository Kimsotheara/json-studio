<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import {
  BUILT_IN_TEMPLATES,
  GREETINGS,
  SIGN_OFFS,
  TONES,
  type EmailField,
  type EmailTemplate,
  type Tone,
} from '../composables/emailTemplates'

/* ---------- persistence (per-browser conveniences, never required) ---------- */

const STORE_TEMPLATES = 'json-studio-email-templates'
const STORE_PROFILE = 'json-studio-email-profile'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked — ignore */
  }
}

/* ---------- templates ---------- */

const customTemplates = ref<EmailTemplate[]>(load(STORE_TEMPLATES, { list: [] as EmailTemplate[] }).list)
watch(customTemplates, (list) => save(STORE_TEMPLATES, { list }), { deep: true })

const allTemplates = computed(() => [...BUILT_IN_TEMPLATES, ...customTemplates.value])

/** Shared fields that every template can use and that are remembered across visits. */
const profile = reactive(
  load(STORE_PROFILE, {
    recipient: '',
    recipientEmail: '',
    sender: '',
    senderTitle: '',
    tone: 'formal' as Tone,
    templateId: 'leave',
  }),
)
watch(profile, (p) => save(STORE_PROFILE, p), { deep: true })

const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const match = (t: EmailTemplate) =>
    !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
  return {
    builtIn: BUILT_IN_TEMPLATES.filter(match),
    custom: customTemplates.value.filter(match),
  }
})

const template = computed(
  () => allTemplates.value.find((t) => t.id === profile.templateId) ?? BUILT_IN_TEMPLATES[0],
)

/** Field values per template, so switching templates doesn't lose what was typed. */
const values = reactive<Record<string, Record<string, string>>>({})
watch(
  () => template.value.id,
  (id) => {
    values[id] ??= {}
  },
  { immediate: true },
)
const fieldValues = computed(() => values[template.value.id] ?? {})

const SHARED_FIELDS: Record<string, string> = { recipient: 'Recipient name', sender: 'Your name' }

/** Custom templates declare fields implicitly through their {placeholders}. */
function fieldsOf(t: EmailTemplate): EmailField[] {
  if (!t.custom) return t.fields
  const text = t.variants.formal.subject + '\n' + t.variants.formal.body
  const keys = [...new Set([...text.matchAll(/\{([^{}\n]+)\}/g)].map((m) => m[1].trim()))]
  return keys.filter((k) => !(k in SHARED_FIELDS)).map((k) => ({ key: k, label: k }))
}
const fields = computed(() => fieldsOf(template.value))

/* ---------- rendering ---------- */

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}

function valueOf(key: string): string {
  if (key === 'recipient') return profile.recipient.trim()
  if (key === 'sender') return profile.sender.trim()
  const raw = (fieldValues.value[key] ?? '').trim()
  const field = fields.value.find((f) => f.key === key)
  if (raw && field?.type === 'date') {
    const [y, m, d] = raw.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', DATE_FORMAT)
  }
  return raw
}

function labelOf(key: string): string {
  return SHARED_FIELDS[key] ?? fields.value.find((f) => f.key === key)?.label ?? key
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ESC[c])

/** Fill {placeholders}: plain text for copying, HTML with unfilled ones highlighted. */
function fill(text: string, missing: Set<string>) {
  let plain = ''
  let html = ''
  let last = 0
  for (const m of text.matchAll(/\{([^{}\n]+)\}/g)) {
    const before = text.slice(last, m.index)
    plain += before
    html += escapeHtml(before)
    const key = m[1].trim()
    const value = valueOf(key)
    if (value) {
      plain += value
      html += escapeHtml(value)
    } else {
      missing.add(key)
      plain += `[${labelOf(key)}]`
      html += `<mark class="email-missing" data-key="${escapeHtml(key)}">${escapeHtml(labelOf(key))}</mark>`
    }
    last = m.index + m[0].length
  }
  const rest = text.slice(last)
  return { plain: plain + rest, html: html + escapeHtml(rest) }
}

const generated = computed(() => {
  const t = template.value
  const tone = profile.tone
  const variant = t.custom ? t.variants.formal : t.variants[tone]
  const wrap = t.wrap !== false

  let body = variant.body
  if (wrap) {
    const greeting = t.greeting?.[tone] ?? GREETINGS[tone]
    const title = profile.senderTitle.trim()
    body = `${greeting}\n\n${body}\n\n${SIGN_OFFS[tone]}\n{sender}${title ? '\n' + title.replace(/[{}]/g, '') : ''}`
  }

  const missing = new Set<string>()
  const subject = fill(variant.subject, missing)
  const filledBody = fill(body, missing)
  return { subject, body: filledBody, missing: [...missing] }
})

/* ---------- editing the final draft by hand ---------- */

const editingDraft = ref(false)
const draftSubject = ref('')
const draftBody = ref('')

function startDraftEdit() {
  draftSubject.value = generated.value.subject.plain
  draftBody.value = generated.value.body.plain
  editingDraft.value = true
}
watch(() => [profile.templateId, profile.tone], () => (editingDraft.value = false))

const finalSubject = computed(() => (editingDraft.value ? draftSubject.value : generated.value.subject.plain))
const finalBody = computed(() => (editingDraft.value ? draftBody.value : generated.value.body.plain))

/* ---------- actions ---------- */

const copied = ref<'' | 'subject' | 'body' | 'all'>('')
async function copy(what: 'subject' | 'body' | 'all') {
  const text =
    what === 'subject'
      ? finalSubject.value
      : what === 'body'
        ? finalBody.value
        : `Subject: ${finalSubject.value}\n\n${finalBody.value}`
  await navigator.clipboard.writeText(text)
  copied.value = what
  setTimeout(() => (copied.value = ''), 1000)
}

const mailtoHref = computed(
  () =>
    `mailto:${encodeURIComponent(profile.recipientEmail.trim())}` +
    `?subject=${encodeURIComponent(finalSubject.value)}&body=${encodeURIComponent(finalBody.value)}`,
)

/** Jump to the input for a placeholder (from the warning chip or a highlighted blank). */
async function focusField(key: string) {
  await nextTick()
  document.getElementById(`email-field-${key}`)?.focus()
}
function onPreviewClick(e: MouseEvent) {
  const key = (e.target as HTMLElement).closest<HTMLElement>('.email-missing')?.dataset.key
  if (key) focusField(key)
}

function clearFields() {
  values[template.value.id] = {}
  editingDraft.value = false
}

/* ---------- custom template editor ---------- */

interface TemplateForm {
  id?: string
  name: string
  subject: string
  body: string
  wrap: boolean
}
const form = ref<TemplateForm | null>(null)

function newTemplate() {
  form.value = {
    name: '',
    subject: 'Update on {Project}',
    body: 'I wanted to share a quick update on {Project}.\n\n{Update details}\n\nPlease let me know if you have any questions.',
    wrap: true,
  }
}

/** Copy the current template (in the current tone) into a new, editable one. */
function duplicateTemplate() {
  const t = template.value
  const variant = t.custom ? t.variants.formal : t.variants[profile.tone]
  // Built-in keys are terse ({cover}); use the readable label in custom templates.
  const relabel = (s: string) =>
    s.replace(/\{([^{}\n]+)\}/g, (m, k: string) => {
      const f = t.fields.find((x) => x.key === k)
      return f && !t.custom ? `{${f.label}}` : m
    })
  form.value = {
    name: `${t.name} (copy)`,
    subject: relabel(variant.subject),
    body: relabel(variant.body),
    wrap: t.wrap !== false,
  }
}

function editTemplate() {
  const t = template.value
  if (!t.custom) return
  form.value = {
    id: t.id,
    name: t.name,
    subject: t.variants.formal.subject,
    body: t.variants.formal.body,
    wrap: t.wrap !== false,
  }
}

function saveTemplate() {
  const f = form.value
  if (!f || !f.name.trim() || !f.body.trim()) return
  const draft = { subject: f.subject, body: f.body }
  const tpl: EmailTemplate = {
    id: f.id ?? `custom-${Date.now()}`,
    name: f.name.trim(),
    description: 'My template',
    fields: [],
    variants: { formal: draft, friendly: draft, short: draft },
    custom: true,
    wrap: f.wrap,
  }
  const i = customTemplates.value.findIndex((t) => t.id === tpl.id)
  if (i >= 0) customTemplates.value[i] = tpl
  else customTemplates.value.push(tpl)
  profile.templateId = tpl.id
  form.value = null
}

function deleteTemplate() {
  const t = template.value
  if (!t.custom || !confirm(`Delete the template "${t.name}"?`)) return
  customTemplates.value = customTemplates.value.filter((x) => x.id !== t.id)
  profile.templateId = BUILT_IN_TEMPLATES[0].id
  form.value = null
}

function selectTemplate(id: string) {
  profile.templateId = id
  form.value = null
}

const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-2 text-[13px] text-[var(--text)] caret-[var(--accent)] outline-none transition-colors placeholder:text-[var(--muted)]/70 focus:border-[var(--accent)]'
const labelClass = 'mb-1 block text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase'
</script>

<template>
  <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-[230px_minmax(0,1fr)_minmax(0,1.25fr)]">
    <!-- Template list -->
    <aside class="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]">
      <header class="border-b border-[var(--border)] px-3 py-2.5">
        <span class="text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)]">TEMPLATES</span>
      </header>
      <div class="p-2">
        <input v-model="search" placeholder="Search…" :class="inputClass" class="mb-2 !py-1.5" />

        <nav class="flex max-h-[220px] flex-col gap-0.5 overflow-y-auto lg:max-h-none">
          <button
            v-for="t in filtered.builtIn"
            :key="t.id"
            class="rounded-lg px-2.5 py-2 text-left transition-colors"
            :class="
              t.id === template.id
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-[var(--text)] hover:bg-[var(--ctrl-bg)]'
            "
            @click="selectTemplate(t.id)"
          >
            <div class="text-[13px] font-medium">{{ t.name }}</div>
            <div class="text-[11px] text-[var(--muted)]">{{ t.description }}</div>
          </button>

          <div class="mt-2 flex items-center justify-between px-2.5 pt-2 pb-1">
            <span class="text-[10.5px] font-semibold tracking-[0.12em] text-[var(--muted)]">MY TEMPLATES</span>
            <button
              class="text-[12px] font-semibold text-[var(--accent)] hover:opacity-80"
              title="Create a new template"
              @click="newTemplate"
            >
              + New
            </button>
          </div>
          <button
            v-for="t in filtered.custom"
            :key="t.id"
            class="rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors"
            :class="
              t.id === template.id
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-[var(--text)] hover:bg-[var(--ctrl-bg)]'
            "
            @click="selectTemplate(t.id)"
          >
            {{ t.name }}
          </button>
          <p v-if="!customTemplates.length" class="px-2.5 py-1 text-[11.5px] text-[var(--muted)]">
            Save your own wording with “+ New” or “Duplicate”.
          </p>
        </nav>
      </div>
    </aside>

    <!-- Fields / template editor -->
    <section class="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]">
      <!-- Template editor -->
      <template v-if="form">
        <header class="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
          <span class="text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)]">
            {{ form.id ? 'EDIT TEMPLATE' : 'NEW TEMPLATE' }}
          </span>
        </header>
        <div class="flex flex-col gap-3 p-4">
          <div>
            <label :class="labelClass">Template name</label>
            <input v-model="form.name" placeholder="Weekly status update" :class="inputClass" />
          </div>
          <div>
            <label :class="labelClass">Subject</label>
            <input v-model="form.subject" :class="inputClass" />
          </div>
          <div>
            <label :class="labelClass">Body</label>
            <textarea v-model="form.body" rows="10" :class="inputClass" class="resize-y leading-relaxed"></textarea>
            <p class="mt-1.5 text-[11.5px] leading-relaxed text-[var(--muted)]">
              Write <code class="rounded bg-[var(--ctrl-bg)] px-1">{Anything}</code> in curly braces to make a
              fill-in field. <code class="rounded bg-[var(--ctrl-bg)] px-1">{recipient}</code> and
              <code class="rounded bg-[var(--ctrl-bg)] px-1">{sender}</code> use the shared names.
            </p>
          </div>
          <label class="flex items-center gap-2 text-[13px] text-[var(--text)]">
            <input v-model="form.wrap" type="checkbox" class="accent-[var(--accent)]" />
            Add greeting and sign-off automatically
          </label>
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <button
              class="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-[var(--tab-active-text)] transition-opacity hover:opacity-90 disabled:opacity-40"
              :disabled="!form.name.trim() || !form.body.trim()"
              @click="saveTemplate"
            >
              Save template
            </button>
            <button
              class="rounded-lg border border-[var(--border)] px-3.5 py-2 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]"
              @click="form = null"
            >
              Cancel
            </button>
            <button
              v-if="form.id"
              class="ml-auto rounded-lg px-3 py-2 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--red)]"
              @click="deleteTemplate"
            >
              Delete
            </button>
          </div>
        </div>
      </template>

      <!-- Fill-in fields -->
      <template v-else>
        <header class="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
          <span class="text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)]">DETAILS</span>
          <div class="ml-auto flex items-center gap-1">
            <button
              v-if="template.custom"
              class="rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--ctrl-bg)] hover:text-[var(--text)]"
              @click="editTemplate"
            >
              Edit
            </button>
            <button
              class="rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--ctrl-bg)] hover:text-[var(--text)]"
              title="Save a copy of this template that you can change"
              @click="duplicateTemplate"
            >
              Duplicate
            </button>
            <button
              class="rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--ctrl-bg)] hover:text-[var(--red)]"
              title="Clear this template's fields"
              @click="clearFields"
            >
              Clear
            </button>
          </div>
        </header>

        <div class="flex flex-col gap-3 p-4">
          <div v-if="!template.custom">
            <label :class="labelClass">Tone</label>
            <div class="flex rounded-lg bg-[var(--ctrl-bg)] p-0.5 text-xs font-medium">
              <button
                v-for="t in TONES"
                :key="t.value"
                class="flex-1 rounded-md px-3 py-1.5 transition-colors"
                :class="
                  profile.tone === t.value
                    ? 'bg-[var(--tab-active-bg)] text-[var(--tab-active-text)]'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                "
                @click="profile.tone = t.value"
              >
                {{ t.label }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label :class="labelClass" for="email-field-recipient">Recipient name</label>
              <input id="email-field-recipient" v-model="profile.recipient" placeholder="Mr. Dara" :class="inputClass" />
            </div>
            <div>
              <label :class="labelClass">Recipient email <span class="normal-case">(optional)</span></label>
              <input v-model="profile.recipientEmail" type="email" placeholder="dara@example.com" :class="inputClass" />
            </div>
          </div>

          <div v-for="f in fields" :key="f.key">
            <label :class="labelClass" :for="`email-field-${f.key}`">{{ f.label }}</label>
            <textarea
              v-if="f.type === 'textarea'"
              :id="`email-field-${f.key}`"
              v-model="fieldValues[f.key]"
              rows="4"
              :placeholder="f.placeholder"
              :class="inputClass"
              class="resize-y"
            ></textarea>
            <input
              v-else
              :id="`email-field-${f.key}`"
              v-model="fieldValues[f.key]"
              :type="f.type === 'date' ? 'date' : 'text'"
              :placeholder="f.placeholder"
              :class="inputClass"
            />
          </div>

          <div class="grid grid-cols-1 gap-3 border-t border-[var(--border)] pt-3 sm:grid-cols-2">
            <div>
              <label :class="labelClass" for="email-field-sender">Your name</label>
              <input id="email-field-sender" v-model="profile.sender" placeholder="Your full name" :class="inputClass" />
            </div>
            <div>
              <label :class="labelClass">Title / team <span class="normal-case">(optional)</span></label>
              <input v-model="profile.senderTitle" placeholder="Software Engineer, IT Department" :class="inputClass" />
            </div>
          </div>
          <p class="text-[11px] text-[var(--muted)]">
            Names and your templates are remembered in this browser only.
          </p>
        </div>
      </template>
    </section>

    <!-- Preview -->
    <section class="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] lg:sticky lg:top-4">
      <header class="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
        <span class="text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)]">PREVIEW</span>
        <button
          v-if="generated.missing.length && !editingDraft"
          class="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-[10.5px] font-semibold tracking-wide text-[var(--accent)] uppercase hover:opacity-80"
          title="Go to the first empty field"
          @click="focusField(generated.missing[0])"
        >
          {{ generated.missing.length }} to fill
        </button>
        <span
          v-else-if="!editingDraft"
          class="rounded-md px-2 py-1 text-[10.5px] font-semibold tracking-wide text-[var(--green)] uppercase"
        >
          ✓ Ready
        </span>
        <div class="ml-auto flex items-center gap-1">
          <button
            v-if="!editingDraft"
            class="rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--ctrl-bg)] hover:text-[var(--text)]"
            title="Edit the final text by hand"
            @click="startDraftEdit"
          >
            Edit text
          </button>
          <button
            v-else
            class="rounded-md px-2 py-1 text-xs font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)]"
            title="Discard manual edits and go back to the template"
            @click="editingDraft = false"
          >
            ↺ Reset
          </button>
        </div>
      </header>

      <div class="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5">
        <span class="shrink-0 text-[12px] font-semibold text-[var(--muted)]">Subject</span>
        <input
          v-if="editingDraft"
          v-model="draftSubject"
          class="min-w-0 flex-1 bg-transparent text-[13.5px] font-semibold text-[var(--text)] outline-none"
        />
        <div
          v-else
          class="min-w-0 flex-1 truncate text-[13.5px] font-semibold"
          @click="onPreviewClick"
          v-html="generated.subject.html"
        ></div>
        <button
          class="shrink-0 rounded-md p-1 text-[var(--muted)] transition-colors hover:bg-[var(--ctrl-bg)] hover:text-[var(--text)]"
          title="Copy subject"
          @click="copy('subject')"
        >
          <svg v-if="copied !== 'subject'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </button>
      </div>

      <textarea
        v-if="editingDraft"
        v-model="draftBody"
        class="block min-h-[380px] w-full resize-y bg-transparent px-4 py-3.5 text-[14px] leading-relaxed text-[var(--text)] caret-[var(--accent)] outline-none"
      ></textarea>
      <div
        v-else
        class="min-h-[380px] px-4 py-3.5 text-[14px] leading-relaxed break-words whitespace-pre-wrap"
        @click="onPreviewClick"
        v-html="generated.body.html"
      ></div>

      <p
        v-if="editingDraft"
        class="border-t border-[var(--border)] bg-[var(--panel-soft)] px-4 py-1.5 text-[11.5px] text-[var(--muted)]"
      >
        Editing by hand — field changes won’t update the text until you Reset.
      </p>

      <footer class="flex flex-wrap items-center gap-2 border-t border-[var(--border)] bg-[var(--panel-soft)] px-3 py-2.5">
        <button
          class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-[var(--tab-active-text)] transition-opacity hover:opacity-90"
          @click="copy('all')"
        >
          {{ copied === 'all' ? '✓ Copied' : 'Copy email' }}
        </button>
        <button
          class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          @click="copy('body')"
        >
          {{ copied === 'body' ? '✓ Copied' : 'Copy body' }}
        </button>
        <a
          :href="mailtoHref"
          class="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          title="Open in your email app"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-10 6L2 7" />
          </svg>
          Open in Mail
        </a>
      </footer>
    </section>
  </div>
</template>

<style scoped>
:deep(.email-missing) {
  cursor: pointer;
  border-radius: 4px;
  padding: 0 4px;
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
  border: 1px dashed var(--accent);
}
:deep(.email-missing)::before {
  content: '[';
  opacity: 0.6;
}
:deep(.email-missing)::after {
  content: ']';
  opacity: 0.6;
}
</style>

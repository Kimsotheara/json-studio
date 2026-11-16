<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { format, type KeywordCase, type SqlLanguage } from 'sql-formatter'
import { highlightSqlLines } from '../composables/highlight'
import CodeArea, { type CodeError } from './CodeArea.vue'

const sample =
  "select u.id, u.name, count(o.id) as orders from users u left join orders o on o.user_id = u.id where u.active = true and u.created_at >= '2024-01-01' group by u.id, u.name having count(o.id) > 5 order by orders desc limit 10;"

const dialects: { value: SqlLanguage; label: string }[] = [
  { value: 'sql', label: 'Standard SQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'mariadb', label: 'MariaDB' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'tsql', label: 'SQL Server' },
  { value: 'plsql', label: 'Oracle PL/SQL' },
  { value: 'db2', label: 'DB2' },
  { value: 'bigquery', label: 'BigQuery' },
  { value: 'snowflake', label: 'Snowflake' },
  { value: 'redshift', label: 'Redshift' },
  { value: 'spark', label: 'Spark' },
  { value: 'trino', label: 'Trino' },
  { value: 'hive', label: 'Hive' },
]

type ParserModule = { Parser: new () => { astify(sql: string, opt?: { database?: string }): unknown } }

/**
 * sql-formatter happily formats almost anything, so syntax is checked separately
 * with node-sql-parser. Each dialect's grammar is ~200–300 kB and is loaded on demand.
 * Dialects without a grammar (Oracle, Spark) are formatted but not validated.
 */
const validators: Partial<Record<SqlLanguage, { db: string; load: () => Promise<unknown> }>> = {
  sql: { db: 'postgresql', load: () => import('node-sql-parser/build/postgresql') },
  mysql: { db: 'mysql', load: () => import('node-sql-parser/build/mysql') },
  mariadb: { db: 'mariadb', load: () => import('node-sql-parser/build/mariadb') },
  postgresql: { db: 'postgresql', load: () => import('node-sql-parser/build/postgresql') },
  sqlite: { db: 'sqlite', load: () => import('node-sql-parser/build/sqlite') },
  tsql: { db: 'transactsql', load: () => import('node-sql-parser/build/transactsql') },
  db2: { db: 'db2', load: () => import('node-sql-parser/build/db2') },
  bigquery: { db: 'bigquery', load: () => import('node-sql-parser/build/bigquery') },
  snowflake: { db: 'snowflake', load: () => import('node-sql-parser/build/snowflake') },
  redshift: { db: 'redshift', load: () => import('node-sql-parser/build/redshift') },
  trino: { db: 'trino', load: () => import('node-sql-parser/build/trino') },
  hive: { db: 'hive', load: () => import('node-sql-parser/build/hive') },
}

const source = ref(sample)
const dialect = ref<SqlLanguage>('sql')
const keywordCase = ref<KeywordCase>('upper')
const indent = ref<'2' | '4' | 'tab'>('2')
const mode = ref<'format' | 'minify'>('format')
const copied = ref(false)
const inputArea = ref<InstanceType<typeof CodeArea> | null>(null)

/** Collapse whitespace and drop comments, leaving quoted strings untouched. */
function minify(sql: string): string {
  return sql
    .replace(
      /('(?:''|[^'])*'|"(?:""|[^"])*"|`[^`]*`)|(--[^\n]*|\/\*[\s\S]*?\*\/)|(\s+)/g,
      (_m, str, _comment, space) => (str ?? (space ? ' ' : '')),
    )
    .replace(/\s*([(),;])\s*/g, '$1')
    .replace(/,/g, ', ')
    .trim()
}

const result = computed<{ text: string; error: string; errors: CodeError[] }>(() => {
  if (!source.value.trim()) return { text: '', error: '', errors: [] }
  try {
    const formatted = format(source.value, {
      language: dialect.value,
      keywordCase: keywordCase.value,
      tabWidth: indent.value === '4' ? 4 : 2,
      useTabs: indent.value === 'tab',
    })
    return { text: mode.value === 'minify' ? minify(formatted) : formatted, error: '', errors: [] }
  } catch (err) {
    // Parse errors include a long grammar trace — the first line is the useful part.
    const error = (err as Error).message.split('\n')[0]
    // Both lexer and parser errors end with "at line N column M".
    const pos = error.match(/line (\d+) column (\d+)/)
    const errors = pos ? [{ line: +pos[1], column: +pos[2], message: error }] : []
    return { text: '', error, errors }
  }
})

interface SqlSyntaxError {
  message: string
  found?: string | null
  location?: { start: { line: number; column: number } }
}

/** Result of the grammar check: null = valid (or nothing to check). */
const syntax = ref<{ error: string; errors: CodeError[] } | null>(null)
const checking = ref(false)
const validated = computed(() => !!validators[dialect.value])

let checkSeq = 0
let checkTimer: ReturnType<typeof setTimeout> | undefined
watch(
  [source, dialect],
  () => {
    clearTimeout(checkTimer)
    const id = ++checkSeq
    const v = validators[dialect.value]
    if (!v || !source.value.trim()) {
      syntax.value = null
      checking.value = false
      return
    }
    checking.value = true
    checkTimer = setTimeout(async () => {
      let mod: ParserModule & { default?: ParserModule }
      try {
        mod = (await v.load()) as typeof mod
      } catch {
        // Grammar failed to load (e.g. offline) — fall back to formatting only.
        if (id === checkSeq) checking.value = false
        return
      }
      if (id !== checkSeq) return
      const Parser = mod.Parser ?? mod.default!.Parser
      try {
        new Parser().astify(source.value, { database: v.db })
        syntax.value = null
      } catch (err) {
        const e = err as SqlSyntaxError
        const pos = e.location?.start
        if (pos) {
          const near = e.found == null ? 'end of input' : `"${e.found}"`
          const error = `Syntax error near ${near} at line ${pos.line} column ${pos.column}`
          syntax.value = { error, errors: [{ line: pos.line, column: pos.column, message: error }] }
        } else {
          syntax.value = { error: e.message, errors: [] }
        }
      } finally {
        checking.value = false
      }
    }, 250)
  },
  { immediate: true },
)

/** The problem to show: formatter failure first, then grammar errors. */
const problem = computed(() => (result.value.error ? result.value : syntax.value))

// Keep showing the last good output while the user is mid-edit.
let lastGood = ''
const output = computed(() => {
  if (!result.value.error) lastGood = result.value.text
  return lastGood
})

const sourceLines = computed(() => source.value.split('\n').length)
const outputLines = computed(() => (output.value ? output.value.split('\n').length : 0))

async function copy() {
  if (!output.value) return
  await navigator.clipboard.writeText(output.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 900)
}

function useOutput() {
  if (output.value) source.value = output.value
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center justify-end gap-2 px-1 text-xs font-medium">
      <select
        v-model="dialect"
        class="rounded-lg bg-[var(--ctrl-bg)] px-2 py-1.5 text-[var(--text)] outline-none"
        title="SQL dialect"
      >
        <option v-for="d in dialects" :key="d.value" :value="d.value">{{ d.label }}</option>
      </select>
      <select
        v-model="keywordCase"
        class="rounded-lg bg-[var(--ctrl-bg)] px-2 py-1.5 text-[var(--text)] outline-none"
        title="Keyword case"
      >
        <option value="upper">UPPER keywords</option>
        <option value="lower">lower keywords</option>
        <option value="preserve">Preserve case</option>
      </select>
      <select
        v-model="indent"
        class="rounded-lg bg-[var(--ctrl-bg)] px-2 py-1.5 text-[var(--text)] outline-none"
        title="Indentation"
        :disabled="mode === 'minify'"
      >
        <option value="2">2 spaces</option>
        <option value="4">4 spaces</option>
        <option value="tab">Tabs</option>
      </select>
      <div class="flex rounded-lg bg-[var(--ctrl-bg)] p-0.5">
        <button
          v-for="m in (['format', 'minify'] as const)"
          :key="m"
          class="rounded-md px-3 py-1 capitalize transition-colors"
          :class="
            mode === m
              ? 'bg-[var(--tab-active-bg)] text-[var(--tab-active-text)]'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          "
          @click="mode = m"
        >
          {{ m }}
        </button>
      </div>
    </div>

    <div class="flex flex-col items-stretch gap-4 md:flex-row">
      <!-- Source -->
      <section
        class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]"
      >
        <header class="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
          <span class="text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)]">SQL INPUT</span>
          <button
            class="ml-auto rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--ctrl-bg)] hover:text-[var(--red)]"
            title="Clear"
            @click="source = ''"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        </header>

        <CodeArea
          ref="inputArea"
          v-model="source"
          :highlight="highlightSqlLines"
          :errors="problem?.errors"
          min-height="460px"
        />

        <footer
          class="flex items-center gap-3.5 border-t border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-[11.5px] text-[var(--muted)]"
        >
          <span>{{ sourceLines }} lines · {{ source.length }} chars</span>
          <button
            v-if="problem"
            class="ml-auto truncate font-semibold text-[var(--red)] hover:underline"
            :title="problem.errors.length ? 'Jump to error' : problem.error"
            @click="problem.errors[0] && inputArea?.revealLine(problem.errors[0].line, problem.errors[0].column)"
          >
            ✕ {{ problem.error }}
          </button>
          <span v-else-if="!source.trim()" class="ml-auto font-semibold">Empty</span>
          <span v-else-if="checking" class="ml-auto font-semibold">Checking…</span>
          <span
            v-else-if="!validated"
            class="ml-auto font-semibold"
            title="No syntax checker is available for this dialect — formatting only"
          >
            Formatted · not validated
          </span>
          <span v-else class="ml-auto font-semibold text-[var(--green)]">✓ Valid SQL</span>
        </footer>
      </section>

      <!-- Output -->
      <section
        class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]"
      >
        <header class="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
          <span class="text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)]">
            {{ mode === 'format' ? 'FORMATTED' : 'MINIFIED' }}
          </span>
          <div class="ml-auto flex items-center gap-1.5">
            <button
              class="rounded-lg bg-[var(--ctrl-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] disabled:opacity-40"
              title="Replace the input with this output"
              :disabled="!output"
              @click="useOutput"
            >
              ← Use as input
            </button>
            <button
              class="rounded-md p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--ctrl-bg)] hover:text-[var(--text)] disabled:opacity-40"
              title="Copy"
              :disabled="!output"
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
          </div>
        </header>

        <CodeArea
          :model-value="output"
          :highlight="highlightSqlLines"
          readonly
          min-height="460px"
          :class="{ 'opacity-50': problem }"
        />

        <footer
          class="flex items-center gap-3.5 border-t border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-[11.5px] text-[var(--muted)]"
        >
          <span>{{ outputLines }} lines · {{ output.length }} chars</span>
        </footer>
      </section>
    </div>
  </div>
</template>

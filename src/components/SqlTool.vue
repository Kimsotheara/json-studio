<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { format, type KeywordCase, type SqlLanguage } from 'sql-formatter'
import { highlightSqlLines } from '../composables/highlight'
import CodeArea, { type CodeError } from './CodeArea.vue'
import AppButton from './ui/AppButton.vue'
import AppPanel from './ui/AppPanel.vue'
import AppSelect from './ui/AppSelect.vue'
import CopyButton from './ui/CopyButton.vue'
import IconButton from './ui/IconButton.vue'
import SegmentedControl from './ui/SegmentedControl.vue'

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

const KEYWORD_CASES: { value: KeywordCase; label: string }[] = [
  { value: 'upper', label: 'UPPER keywords' },
  { value: 'lower', label: 'lower keywords' },
  { value: 'preserve', label: 'Preserve case' },
]
const INDENTS = [
  { value: '2', label: '2 spaces' },
  { value: '4', label: '4 spaces' },
  { value: 'tab', label: 'Tabs' },
] as const
const MODES = [
  { value: 'format', label: 'Format' },
  { value: 'minify', label: 'Minify' },
] as const

const source = ref(sample)
const dialect = ref<SqlLanguage>('sql')
const keywordCase = ref<KeywordCase>('upper')
const indent = ref<'2' | '4' | 'tab'>('2')
const mode = ref<'format' | 'minify'>('format')
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

function useOutput() {
  if (output.value) source.value = output.value
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center justify-end gap-2 px-1">
      <AppSelect v-model="dialect" :options="dialects" title="SQL dialect" />
      <AppSelect v-model="keywordCase" :options="KEYWORD_CASES" title="Keyword case" />
      <AppSelect v-model="indent" :options="INDENTS" title="Indentation" :disabled="mode === 'minify'" />
      <SegmentedControl v-model="mode" :options="MODES" variant="solid" />
    </div>

    <div class="flex flex-col items-stretch gap-4 md:flex-row">
      <AppPanel label="SQL INPUT">
        <template #actions>
          <IconButton icon="trash" title="Clear" danger @click="source = ''" />
        </template>

        <CodeArea
          ref="inputArea"
          v-model="source"
          :highlight="highlightSqlLines"
          :errors="problem?.errors"
          min-height="460px"
        />

        <template #footer>
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
        </template>
      </AppPanel>

      <AppPanel :label="mode === 'format' ? 'FORMATTED' : 'MINIFIED'">
        <template #actions>
          <AppButton title="Replace the input with this output" :disabled="!output" @click="useOutput">
            ← Use as input
          </AppButton>
          <CopyButton :text="output" />
        </template>

        <CodeArea
          :model-value="output"
          :highlight="highlightSqlLines"
          readonly
          min-height="460px"
          :class="{ 'opacity-50': problem }"
        />

        <template #footer>
          <span>{{ outputLines }} lines · {{ output.length }} chars</span>
        </template>
      </AppPanel>
    </div>
  </div>
</template>

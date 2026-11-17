/**
 * Database diagram (ERD) model, parsers and generators.
 *
 *   SQL DDL (Oracle / PostgreSQL) ─┐
 *                                  ├─► ErdSchema ─► D2 code (rendered by the D2 engine)
 *   DBML ──────────────────────────┘             ├─► DBML
 *                                                └─► SQL DDL (Oracle / PostgreSQL)
 *
 * The SQL parser only needs the shape of the schema (tables, columns, keys), so it
 * is deliberately lenient: anything it doesn't understand (indexes, grants, storage
 * clauses, PL/SQL…) is skipped rather than reported as an error.
 */

export type Dialect = 'postgresql' | 'oracle'

export interface ErdColumn {
  name: string
  type: string
  pk: boolean
  notNull: boolean
  unique: boolean
  increment: boolean
  default?: string
  note?: string
}

export interface ErdTable {
  schema?: string
  name: string
  columns: ErdColumn[]
  note?: string
  line: number
}

/** Many-to-one is "from" (child, holds the FK) → "to" (parent). */
export type RefKind = 'many-to-one' | 'one-to-one' | 'many-to-many'

export interface ErdRef {
  name?: string
  from: { table: string; columns: string[] }
  to: { table: string; columns: string[] }
  kind: RefKind
  /** Guessed from column names (e.g. `customer_id` → `customers.id`), not declared. */
  inferred?: boolean
  onDelete?: string
  line: number
}

export interface ErdProblem {
  line: number
  column?: number
  message: string
}

export interface ErdSchema {
  tables: ErdTable[]
  refs: ErdRef[]
  errors: ErdProblem[]
  warnings: ErdProblem[]
}

export const tableKey = (t: { schema?: string; name: string }) =>
  t.schema ? `${t.schema}.${t.name}` : t.name

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function lineStarts(src: string): number[] {
  const starts = [0]
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1)
  return starts
}

function posOf(starts: number[], offset: number): { line: number; column: number } {
  let lo = 0
  let hi = starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (starts[mid] <= offset) lo = mid
    else hi = mid - 1
  }
  return { line: lo + 1, column: offset - starts[lo] + 1 }
}

/** Case-insensitive lookup of tables by full key, falling back to the bare name. */
function tableIndex(tables: ErdTable[]) {
  const byKey = new Map<string, ErdTable>()
  const byName = new Map<string, ErdTable[]>()
  for (const t of tables) {
    byKey.set(tableKey(t).toLowerCase(), t)
    const list = byName.get(t.name.toLowerCase()) ?? []
    list.push(t)
    byName.set(t.name.toLowerCase(), list)
  }
  return (ref: string): ErdTable | undefined => {
    const k = ref.toLowerCase()
    if (byKey.has(k)) return byKey.get(k)
    const bare = k.includes('.') ? k.slice(k.lastIndexOf('.') + 1) : k
    const list = byName.get(bare)
    return list?.length === 1 ? list[0] : undefined
  }
}

const findColumn = (t: ErdTable, name: string) =>
  t.columns.find((c) => c.name.toLowerCase() === name.toLowerCase())

/**
 * Resolve ref table names to canonical keys, fill in implicit target columns
 * (`REFERENCES dept` → dept's primary key), work out 1-1 vs many-1, and report
 * refs that point at unknown tables or columns.
 */
function finishSchema(tables: ErdTable[], refs: ErdRef[], errors: ErdProblem[], warnings: ErdProblem[]): ErdSchema {
  const lookup = tableIndex(tables)
  const out: ErdRef[] = []
  for (const r of refs) {
    const from = lookup(r.from.table)
    const to = lookup(r.to.table)
    if (!from || !to) {
      warnings.push({
        line: r.line,
        message: `Relationship skipped: table "${!from ? r.from.table : r.to.table}" is not defined`,
      })
      continue
    }
    let toCols = r.to.columns
    if (!toCols.length) toCols = to.columns.filter((c) => c.pk).map((c) => c.name)
    const missing = [
      ...r.from.columns.filter((c) => !findColumn(from, c)).map((c) => `${tableKey(from)}.${c}`),
      ...toCols.filter((c) => !findColumn(to, c)).map((c) => `${tableKey(to)}.${c}`),
    ]
    if (missing.length) warnings.push({ line: r.line, message: `Unknown column ${missing.join(', ')}` })

    let kind = r.kind
    if (kind === 'many-to-one') {
      // A foreign key that is also the whole primary key (or unique) is one-to-one.
      const fromCols = r.from.columns.map((c) => c.toLowerCase())
      const pkCols = from.columns.filter((c) => c.pk).map((c) => c.name.toLowerCase())
      const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))
      const single = fromCols.length === 1 ? findColumn(from, fromCols[0]) : undefined
      if ((pkCols.length && sameSet(fromCols, pkCols) && from !== to) || single?.unique) kind = 'one-to-one'
    }
    out.push({
      ...r,
      kind,
      from: { table: tableKey(from), columns: r.from.columns.map((c) => findColumn(from, c)?.name ?? c) },
      to: { table: tableKey(to), columns: toCols.map((c) => findColumn(to, c)?.name ?? c) },
    })
  }
  return { tables, refs: out, errors, warnings }
}

/* ------------------------------------------------------------------ */
/* Relationship inference                                              */
/* ------------------------------------------------------------------ */

const singular = (w: string) =>
  /ies$/i.test(w) ? w.slice(0, -3) + 'y' : /(s|x|ch|sh)es$/i.test(w) ? w.slice(0, -2) : /s$/i.test(w) ? w.slice(0, -1) : w

/**
 * Guess relationships from naming conventions for columns that have no declared
 * foreign key: `customer_id`, `customerId`, `CUSTOMER_ID` → table `customer(s)`
 * with a single-column primary key.
 */
export function inferRefs(schema: ErdSchema): ErdRef[] {
  const declared = new Set(
    schema.refs.flatMap((r) => r.from.columns.map((c) => `${r.from.table}.${c}`.toLowerCase())),
  )
  const byStem = new Map<string, ErdTable>()
  for (const t of schema.tables) {
    const stem = singular(t.name).toLowerCase().replace(/_/g, '')
    if (!byStem.has(stem)) byStem.set(stem, t)
    // Oracle-style prefixes: tbl_customer, t_customer
    const unprefixed = singular(t.name.replace(/^(tbl|tb|t)_/i, '')).toLowerCase().replace(/_/g, '')
    if (!byStem.has(unprefixed)) byStem.set(unprefixed, t)
  }
  // Oracle-style schemas repeat the key name: employees.dept_id → departments.dept_id
  const byPkName = new Map<string, ErdTable | null>()
  for (const t of schema.tables) {
    const pk = t.columns.filter((c) => c.pk)
    if (pk.length !== 1 || /^id$/i.test(pk[0].name)) continue
    const k = pk[0].name.toLowerCase()
    byPkName.set(k, byPkName.has(k) ? null : t)
  }
  const out: ErdRef[] = []
  for (const t of schema.tables) {
    for (const c of t.columns) {
      if (declared.has(`${tableKey(t)}.${c.name}`.toLowerCase())) continue
      const m = c.name.match(/^(.+?)_?(id|Id|ID)$/)
      if (!m || !m[1]) continue
      const target =
        byStem.get(singular(m[1]).toLowerCase().replace(/_/g, '')) ?? byPkName.get(c.name.toLowerCase()) ?? undefined
      if (!target) continue
      const pk = target.columns.filter((x) => x.pk)
      if (pk.length !== 1 || (target === t && pk[0] === c)) continue
      out.push({
        from: { table: tableKey(t), columns: [c.name] },
        to: { table: tableKey(target), columns: [pk[0].name] },
        kind: c.unique ? 'one-to-one' : 'many-to-one',
        inferred: true,
        line: t.line,
      })
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* SQL DDL parser (Oracle + PostgreSQL)                                */
/* ------------------------------------------------------------------ */

type SqlTok = { kind: 'word' | 'qident' | 'str' | 'num' | 'punc'; text: string; pos: number }

function sqlTokens(src: string): SqlTok[] {
  const toks: SqlTok[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (/\s/.test(ch)) {
      i++
    } else if (src.startsWith('--', i)) {
      while (i < src.length && src[i] !== '\n') i++
    } else if (src.startsWith('/*', i)) {
      const end = src.indexOf('*/', i + 2)
      i = end < 0 ? src.length : end + 2
    } else if (ch === "'") {
      let j = i + 1
      while (j < src.length && !(src[j] === "'" && src[j + 1] !== "'")) j += src[j] === "'" ? 2 : 1
      toks.push({ kind: 'str', text: src.slice(i + 1, j).replace(/''/g, "'"), pos: i })
      i = j + 1
    } else if (ch === '"') {
      let j = i + 1
      while (j < src.length && !(src[j] === '"' && src[j + 1] !== '"')) j += src[j] === '"' ? 2 : 1
      toks.push({ kind: 'qident', text: src.slice(i + 1, j).replace(/""/g, '"'), pos: i })
      i = j + 1
    } else if (ch === '$' && /^\$\w*\$/.test(src.slice(i))) {
      // PostgreSQL dollar-quoted string
      const tag = src.slice(i).match(/^\$\w*\$/)![0]
      const end = src.indexOf(tag, i + tag.length)
      const stop = end < 0 ? src.length : end
      toks.push({ kind: 'str', text: src.slice(i + tag.length, stop), pos: i })
      i = end < 0 ? src.length : end + tag.length
    } else if (/[A-Za-z_\u0080-￿]/.test(ch)) {
      let j = i + 1
      while (j < src.length && /[\w$#\u0080-￿]/.test(src[j])) j++
      toks.push({ kind: 'word', text: src.slice(i, j), pos: i })
      i = j
    } else if (/\d/.test(ch)) {
      let j = i + 1
      while (j < src.length && /[\d.]/.test(src[j])) j++
      toks.push({ kind: 'num', text: src.slice(i, j), pos: i })
      i = j
    } else if (src.startsWith('::', i)) {
      toks.push({ kind: 'punc', text: '::', pos: i })
      i += 2
    } else {
      toks.push({ kind: 'punc', text: ch, pos: i })
      i++
    }
  }
  return toks
}

const isWord = (t: SqlTok | undefined, ...words: string[]) =>
  !!t && t.kind === 'word' && words.includes(t.text.toUpperCase())
const isPunc = (t: SqlTok | undefined, p: string) => !!t && t.kind === 'punc' && t.text === p
const isIdent = (t: SqlTok | undefined) => !!t && (t.kind === 'word' || t.kind === 'qident')

/** Re-assemble tokens into readable SQL text (for types and defaults). */
function tokText(toks: SqlTok[]): string {
  let out = ''
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]
    const s = t.kind === 'str' ? `'${t.text.replace(/'/g, "''")}'` : t.kind === 'qident' ? `"${t.text}"` : t.text
    const prev = toks[i - 1]
    const glue =
      !prev ||
      t.text === '(' && prev.kind !== 'punc' ||
      [')', ',', '.', '::', '[', ']'].includes(t.text) ||
      ['(', '.', '::', '['].includes(prev.text)
    out += (glue ? '' : ' ') + s
  }
  return out
}

/** Split a token list on top-level commas. */
function splitTopLevel(toks: SqlTok[]): SqlTok[][] {
  const parts: SqlTok[][] = [[]]
  let depth = 0
  for (const t of toks) {
    if (isPunc(t, '(')) depth++
    else if (isPunc(t, ')')) depth--
    if (depth === 0 && isPunc(t, ',')) parts.push([])
    else parts[parts.length - 1].push(t)
  }
  return parts.filter((p) => p.length)
}

/** Read `( a, b, c )` starting at toks[i]; returns names and the index after `)`. */
function readNameList(toks: SqlTok[], i: number): { names: string[]; next: number } {
  const names: string[] = []
  if (!isPunc(toks[i], '(')) return { names, next: i }
  i++
  while (i < toks.length && !isPunc(toks[i], ')')) {
    if (isIdent(toks[i])) names.push(toks[i].text)
    i++
  }
  return { names, next: i + 1 }
}

/** Read `a.b.c` as a qualified name. */
function readQualified(toks: SqlTok[], i: number): { parts: string[]; next: number } {
  const parts: string[] = []
  if (!isIdent(toks[i])) return { parts, next: i }
  parts.push(toks[i].text)
  i++
  while (isPunc(toks[i], '.') && isIdent(toks[i + 1])) {
    parts.push(toks[i + 1].text)
    i += 2
  }
  return { parts, next: i }
}

const qualifiedToKey = (parts: string[]) => parts.slice(-2).join('.')

/** Words that end a column's type and start its constraints. */
const COLUMN_STOP = new Set([
  'CONSTRAINT', 'NOT', 'NULL', 'PRIMARY', 'UNIQUE', 'REFERENCES', 'DEFAULT', 'CHECK',
  'GENERATED', 'COLLATE', 'IDENTITY', 'ENABLE', 'DISABLE', 'VISIBLE', 'INVISIBLE',
  'ENCRYPT', 'SORT', 'AUTO_INCREMENT', 'COMMENT',
])
const DEFAULT_STOP = new Set([
  'CONSTRAINT', 'NOT', 'NULL', 'PRIMARY', 'UNIQUE', 'REFERENCES', 'CHECK', 'GENERATED',
  'COLLATE', 'ENABLE', 'DISABLE',
])

interface PendingRef {
  name?: string
  fromTable: string
  fromCols: string[]
  toTable: string
  toCols: string[]
  onDelete?: string
  pos: number
}

function readReferences(toks: SqlTok[], i: number): { table: string; cols: string[]; onDelete?: string; next: number } {
  // toks[i] is REFERENCES
  const q = readQualified(toks, i + 1)
  const list = readNameList(toks, q.next)
  let next = list.next
  let onDelete: string | undefined
  while (isWord(toks[next], 'ON', 'MATCH', 'DEFERRABLE', 'INITIALLY') || isWord(toks[next - 1], 'MATCH')) {
    if (isWord(toks[next], 'ON') && isWord(toks[next + 1], 'DELETE')) {
      const act: string[] = []
      let j = next + 2
      while (isWord(toks[j], 'CASCADE', 'SET', 'NULL', 'DEFAULT', 'RESTRICT', 'NO', 'ACTION')) act.push(toks[j++].text.toLowerCase())
      onDelete = act.join(' ')
      next = j
    } else next++
  }
  return { table: qualifiedToKey(q.parts), cols: list.names, onDelete, next }
}

export function parseSql(src: string): ErdSchema {
  const starts = lineStarts(src)
  const lineAt = (pos: number) => posOf(starts, pos).line
  const toks = sqlTokens(src)
  const tables: ErdTable[] = []
  const pending: PendingRef[] = []
  const errors: ErdProblem[] = []
  const warnings: ErdProblem[] = []
  const lookup = () => tableIndex(tables)

  // Split statements on `;` and on Oracle's lone `/` terminator. Scripts often leave
  // the terminator out, so CREATE … TABLE / ALTER TABLE / COMMENT ON outside any
  // parentheses also starts a new statement.
  const stmts: SqlTok[][] = [[]]
  let parenDepth = 0
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k]
    if (isPunc(t, '(')) parenDepth++
    else if (isPunc(t, ')')) parenDepth = Math.max(0, parenDepth - 1)
    const startsStatement =
      parenDepth === 0 &&
      ((isWord(t, 'CREATE') && toks.slice(k + 1, k + 6).some((x) => isWord(x, 'TABLE'))) ||
        (isWord(t, 'ALTER') && isWord(toks[k + 1], 'TABLE')) ||
        (isWord(t, 'COMMENT') && isWord(toks[k + 1], 'ON')))
    if (startsStatement && stmts[stmts.length - 1].length) stmts.push([])
    const loneSlash =
      isPunc(t, '/') &&
      src.slice(starts[lineAt(t.pos) - 1], src.indexOf('\n', t.pos) < 0 ? src.length : src.indexOf('\n', t.pos)).trim() === '/'
    if (isPunc(t, ';') || loneSlash) {
      stmts.push([])
      parenDepth = 0
    } else stmts[stmts.length - 1].push(t)
  }

  for (const s of stmts) {
    if (!s.length) continue
    if (isWord(s[0], 'CREATE')) {
      let i = 1
      while (i < s.length && !isWord(s[i], 'TABLE') && isWord(s[i], 'OR', 'REPLACE', 'GLOBAL', 'LOCAL', 'TEMPORARY', 'TEMP', 'UNLOGGED', 'PRIVATE', 'SHARDED', 'DUPLICATED', 'BLOCKCHAIN', 'IMMUTABLE')) i++
      if (!isWord(s[i], 'TABLE')) continue
      i++
      if (isWord(s[i], 'IF') && isWord(s[i + 1], 'NOT') && isWord(s[i + 2], 'EXISTS')) i += 3
      const q = readQualified(s, i)
      if (!q.parts.length) {
        errors.push({ ...posOf(starts, s[i]?.pos ?? s[0].pos), message: 'CREATE TABLE: expected a table name' })
        continue
      }
      const table: ErdTable = {
        name: q.parts[q.parts.length - 1],
        schema: q.parts.length > 1 ? q.parts[q.parts.length - 2] : undefined,
        columns: [],
        line: lineAt(s[0].pos),
      }
      i = q.next
      if (!isPunc(s[i], '(')) {
        warnings.push({ line: table.line, message: `Table "${tableKey(table)}" has no column list (CREATE TABLE … AS?) — skipped` })
        continue
      }
      // Find the matching close paren of the column list.
      let depth = 0
      let end = i
      for (; end < s.length; end++) {
        if (isPunc(s[end], '(')) depth++
        else if (isPunc(s[end], ')') && --depth === 0) break
      }
      if (depth !== 0) {
        errors.push({ ...posOf(starts, s[i].pos), message: `CREATE TABLE ${tableKey(table)}: missing closing ")"` })
      }
      if (tables.some((x) => tableKey(x).toLowerCase() === tableKey(table).toLowerCase())) {
        warnings.push({ line: table.line, message: `Table "${tableKey(table)}" is defined more than once` })
      }
      tables.push(table)
      for (const item of splitTopLevel(s.slice(i + 1, end))) parseTableItem(table, item)
      continue
    }

    if (isWord(s[0], 'ALTER') && isWord(s[1], 'TABLE')) {
      let i = 2
      while (isWord(s[i], 'ONLY', 'IF', 'EXISTS')) i++
      const q = readQualified(s, i)
      const table = lookup()(qualifiedToKey(q.parts))
      i = q.next
      // Oracle: ADD ( CONSTRAINT … , … )   PostgreSQL: ADD CONSTRAINT …, ADD …
      const rest = s.slice(i)
      const actions = splitTopLevel(rest)
      for (let a of actions) {
        if (!isWord(a[0], 'ADD')) continue
        a = a.slice(1)
        if (isPunc(a[0], '(') && isPunc(a[a.length - 1], ')')) {
          for (const inner of splitTopLevel(a.slice(1, -1))) applyAlter(q.parts, table, inner, s[0].pos)
        } else applyAlter(q.parts, table, a, s[0].pos)
      }
      continue
    }

    if (isWord(s[0], 'COMMENT') && isWord(s[1], 'ON') && isWord(s[2], 'TABLE', 'COLUMN')) {
      const q = readQualified(s, 3)
      const isTok = s[q.next]
      const text = s[q.next + 1]
      if (!isWord(isTok, 'IS') || text?.kind !== 'str') continue
      if (isWord(s[2], 'TABLE')) {
        const t = lookup()(qualifiedToKey(q.parts))
        if (t) t.note = text.text
      } else {
        const col = q.parts[q.parts.length - 1]
        const t = lookup()(qualifiedToKey(q.parts.slice(0, -1)))
        const c = t && findColumn(t, col)
        if (c) c.note = text.text
      }
    }
  }

  function applyAlter(parts: string[], table: ErdTable | undefined, a: SqlTok[], pos: number) {
    const addColumn = isWord(a[0], 'COLUMN')
    if (!addColumn && !isWord(a[0], 'CONSTRAINT', 'PRIMARY', 'FOREIGN', 'UNIQUE')) return
    if (!table) {
      warnings.push({ line: lineAt(pos), message: `ALTER TABLE: table "${parts.join('.')}" is not defined` })
      return
    }
    parseTableItem(table, addColumn ? a.slice(isWord(a[1], 'IF') ? 4 : 1) : a)
  }

  function parseTableItem(table: ErdTable, item: SqlTok[]) {
    let i = 0
    let constraintName: string | undefined
    if (isWord(item[0], 'CONSTRAINT')) {
      constraintName = item[1]?.text
      i = 2
    }
    const head = item[i]
    if (isWord(head, 'PRIMARY') && isWord(item[i + 1], 'KEY')) {
      for (const n of readNameList(item, i + 2).names) {
        const c = findColumn(table, n)
        if (c) Object.assign(c, { pk: true, notNull: true })
      }
      return
    }
    if (isWord(head, 'UNIQUE')) {
      const { names } = readNameList(item, isWord(item[i + 1], 'KEY') ? i + 2 : i + 1)
      if (names.length === 1) {
        const c = findColumn(table, names[0])
        if (c) c.unique = true
      }
      return
    }
    if (isWord(head, 'FOREIGN') && isWord(item[i + 1], 'KEY')) {
      const from = readNameList(item, i + 2)
      if (!isWord(item[from.next], 'REFERENCES')) return
      const ref = readReferences(item, from.next)
      pending.push({
        name: constraintName,
        fromTable: tableKey(table),
        fromCols: from.names,
        toTable: ref.table,
        toCols: ref.cols,
        onDelete: ref.onDelete,
        pos: item[0].pos,
      })
      return
    }
    if (isWord(head, 'CHECK', 'EXCLUDE', 'LIKE', 'PERIOD', 'SUPPLEMENTAL', 'SCOPE', 'REF')) return
    if (constraintName) return // unknown table constraint
    if (!isIdent(head)) return

    // Column definition
    const col: ErdColumn = { name: head.text, type: '', pk: false, notNull: false, unique: false, increment: false }
    i++
    const typeToks: SqlTok[] = []
    let depth = 0
    while (i < item.length) {
      const t = item[i]
      if (depth === 0 && t.kind === 'word' && COLUMN_STOP.has(t.text.toUpperCase())) break
      if (isPunc(t, '(')) depth++
      if (isPunc(t, ')')) depth--
      typeToks.push(t)
      i++
    }
    col.type = tokText(typeToks)
    if (/^(small|big)?serial\d?$/i.test(col.type)) col.increment = true

    while (i < item.length) {
      const t = item[i]
      if (isWord(t, 'CONSTRAINT')) {
        i += 2
      } else if (isWord(t, 'NOT') && isWord(item[i + 1], 'NULL')) {
        col.notNull = true
        i += 2
      } else if (isWord(t, 'NULL')) {
        i++
      } else if (isWord(t, 'PRIMARY') && isWord(item[i + 1], 'KEY')) {
        col.pk = true
        col.notNull = true
        i += 2
      } else if (isWord(t, 'UNIQUE')) {
        col.unique = true
        i++
      } else if (isWord(t, 'REFERENCES')) {
        const ref = readReferences(item, i)
        pending.push({
          fromTable: tableKey(table),
          fromCols: [col.name],
          toTable: ref.table,
          toCols: ref.cols.slice(0, 1),
          onDelete: ref.onDelete,
          pos: t.pos,
        })
        i = ref.next
      } else if (isWord(t, 'DEFAULT')) {
        i++
        if (isWord(item[i], 'ON') && isWord(item[i + 1], 'NULL')) i += 2 // Oracle DEFAULT ON NULL
        const d: SqlTok[] = []
        let dd = 0
        while (i < item.length && !(dd === 0 && item[i].kind === 'word' && DEFAULT_STOP.has(item[i].text.toUpperCase()))) {
          if (isPunc(item[i], '(')) dd++
          if (isPunc(item[i], ')')) dd--
          d.push(item[i++])
        }
        col.default = tokText(d)
      } else if (isWord(t, 'GENERATED')) {
        // GENERATED { ALWAYS | BY DEFAULT [ON NULL] } AS IDENTITY  |  GENERATED ALWAYS AS (expr) [STORED]
        i++
        while (i < item.length && !isWord(item[i], 'IDENTITY') && !isPunc(item[i], '(')) i++
        if (isWord(item[i], 'IDENTITY')) {
          col.increment = true
          i++
        }
      } else if (isWord(t, 'IDENTITY', 'AUTO_INCREMENT')) {
        col.increment = true
        i++
      } else if (isPunc(t, '(')) {
        // skip parenthesised options, e.g. CHECK (…) or IDENTITY (START WITH 1)
        let dd = 0
        do {
          if (isPunc(item[i], '(')) dd++
          if (isPunc(item[i], ')')) dd--
          i++
        } while (i < item.length && dd > 0)
      } else i++
    }
    table.columns.push(col)
  }

  const refs: ErdRef[] = pending.map((p) => ({
    name: p.name,
    from: { table: p.fromTable, columns: p.fromCols },
    to: { table: p.toTable, columns: p.toCols },
    kind: 'many-to-one',
    onDelete: p.onDelete,
    line: lineAt(p.pos),
  }))

  if (!tables.length && !errors.length && src.trim()) {
    errors.push({
      line: 1,
      message: /^\s*(Table|Ref)\b[^;]*[{:]/im.test(src)
        ? 'This looks like DBML, not SQL — switch to the DBML tab'
        : 'No CREATE TABLE statements found',
    })
  }
  return finishSchema(tables, refs, errors, warnings)
}

/* ------------------------------------------------------------------ */
/* DBML parser                                                         */
/* ------------------------------------------------------------------ */

type DbmlTok = { kind: 'word' | 'str' | 'expr' | 'num' | 'punc' | 'nl'; text: string; pos: number }

function dbmlTokens(src: string): DbmlTok[] {
  const toks: DbmlTok[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === '\n') {
      toks.push({ kind: 'nl', text: '\n', pos: i })
      i++
    } else if (/\s/.test(ch)) {
      i++
    } else if (src.startsWith('//', i)) {
      while (i < src.length && src[i] !== '\n') i++
    } else if (src.startsWith('/*', i)) {
      const end = src.indexOf('*/', i + 2)
      i = end < 0 ? src.length : end + 2
    } else if (src.startsWith("'''", i)) {
      const end = src.indexOf("'''", i + 3)
      const stop = end < 0 ? src.length : end
      toks.push({ kind: 'str', text: src.slice(i + 3, stop), pos: i })
      i = end < 0 ? src.length : end + 3
    } else if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1
      while (j < src.length && src[j] !== ch && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1
      const text = src.slice(i + 1, j).replace(/\\(.)/g, '$1')
      toks.push({ kind: ch === '`' ? 'expr' : ch === '"' ? 'word' : 'str', text, pos: i })
      i = j + 1
    } else if (/[A-Za-z_\u0080-￿]/.test(ch)) {
      let j = i + 1
      while (j < src.length && /[\w$#\u0080-￿]/.test(src[j])) j++
      toks.push({ kind: 'word', text: src.slice(i, j), pos: i })
      i = j
    } else if (/[\d-]/.test(ch) && /^-?\d/.test(src.slice(i, i + 2)) && !(ch === '-' && /[\w)]/.test(src[i - 1] ?? ''))) {
      let j = i + 1
      while (j < src.length && /[\d.]/.test(src[j])) j++
      toks.push({ kind: 'num', text: src.slice(i, j), pos: i })
      i = j
    } else if (src.startsWith('<>', i)) {
      toks.push({ kind: 'punc', text: '<>', pos: i })
      i += 2
    } else {
      toks.push({ kind: 'punc', text: ch, pos: i })
      i++
    }
  }
  return toks
}

const REL_OPS = ['>', '<', '-', '<>']

export function parseDbml(src: string): ErdSchema {
  const starts = lineStarts(src)
  const at = (pos: number) => posOf(starts, pos)
  const toks = dbmlTokens(src)
  const tables: ErdTable[] = []
  const refs: ErdRef[] = []
  const errors: ErdProblem[] = []
  const warnings: ErdProblem[] = []
  const aliases = new Map<string, string>()
  let i = 0

  const peek = (o = 0) => toks[i + o]
  const w = (t: DbmlTok | undefined, word: string) => !!t && t.kind === 'word' && t.text.toLowerCase() === word
  const p = (t: DbmlTok | undefined, c: string) => !!t && t.kind === 'punc' && t.text === c
  const skipNl = () => {
    while (peek()?.kind === 'nl') i++
  }
  const fail = (t: DbmlTok | undefined, message: string) => {
    errors.push(t ? { ...at(t.pos), message } : { line: starts.length, message })
  }
  const restOfLine = () => {
    while (i < toks.length && peek().kind !== 'nl') i++
  }

  /** Skip a `{ … }` block (Project, Enum, TableGroup, Note, indexes, …). */
  function skipBlock(): boolean {
    skipNl()
    if (!p(peek(), '{')) return false
    let depth = 0
    const open = peek()
    while (i < toks.length) {
      const t = toks[i++]
      if (p(t, '{')) depth++
      else if (p(t, '}') && --depth === 0) return true
    }
    fail(open, 'Missing closing "}"')
    return true
  }

  /** Read `a.b.c` (or `a.(x, y)` for composite columns). */
  function readEndpoint(): { table: string; columns: string[] } | null {
    const parts: string[] = []
    if (peek()?.kind !== 'word') return null
    parts.push(toks[i++].text)
    while (p(peek(), '.')) {
      i++
      if (p(peek(), '(')) {
        i++
        const cols: string[] = []
        while (i < toks.length && !p(peek(), ')')) {
          if (peek().kind === 'word') cols.push(peek().text)
          i++
        }
        i++
        return { table: parts.join('.'), columns: cols }
      }
      if (peek()?.kind !== 'word') return null
      parts.push(toks[i++].text)
    }
    if (parts.length < 2) return null
    return { table: parts.slice(0, -1).join('.'), columns: [parts[parts.length - 1]] }
  }

  /** Read `[ a, b: c, … ]` into a list of [key, valueTokens]. */
  function readSettings(): [string, DbmlTok[]][] {
    const out: [string, DbmlTok[]][] = []
    if (!p(peek(), '[')) return out
    const open = toks[i++]
    let cur: DbmlTok[] = []
    let depth = 0
    while (i < toks.length) {
      const t = toks[i++]
      if (t.kind === 'nl') continue
      if (p(t, '(')) depth++
      if (p(t, ')')) depth--
      if (depth === 0 && (p(t, ',') || p(t, ']'))) {
        if (cur.length) {
          const colon = cur.findIndex((x) => p(x, ':'))
          const keyToks = colon < 0 ? cur : cur.slice(0, colon)
          out.push([keyToks.map((x) => x.text.toLowerCase()).join(' '), colon < 0 ? [] : cur.slice(colon + 1)])
        }
        cur = []
        if (p(t, ']')) return out
      } else cur.push(t)
    }
    fail(open, 'Missing closing "]"')
    return out
  }

  const valueText = (v: DbmlTok[]) =>
    v.map((t) => (t.kind === 'expr' ? t.text : t.kind === 'str' ? `'${t.text}'` : t.text)).join(' ')

  function parseRefBody(name?: string, line?: number) {
    const start = peek()
    const from = readEndpoint()
    const op = peek()
    if (!from || !op || op.kind !== 'punc' || !REL_OPS.includes(op.text)) {
      fail(start, 'Ref: expected "table.column > table.column"')
      restOfLine()
      return
    }
    i++
    const to = readEndpoint()
    if (!to) {
      fail(peek() ?? op, 'Ref: expected "table.column" after the relationship operator')
      restOfLine()
      return
    }
    let onDelete: string | undefined
    for (const [k, v] of readSettings()) if (k === 'delete') onDelete = valueText(v)
    pushRef(from, op.text, to, line ?? at(start.pos).line, name, onDelete)
  }

  function pushRef(
    from: { table: string; columns: string[] },
    op: string,
    to: { table: string; columns: string[] },
    line: number,
    name?: string,
    onDelete?: string,
  ) {
    if (op === '<') [from, to] = [to, from]
    refs.push({
      name,
      from,
      to,
      kind: op === '-' ? 'one-to-one' : op === '<>' ? 'many-to-many' : 'many-to-one',
      onDelete,
      line,
    })
  }

  function parseTable() {
    const kw = toks[i++]
    const nameParts: string[] = []
    if (peek()?.kind !== 'word') {
      fail(peek() ?? kw, 'Table: expected a table name')
      restOfLine()
      return
    }
    nameParts.push(toks[i++].text)
    while (p(peek(), '.') && peek(1)?.kind === 'word') {
      nameParts.push(toks[i + 1].text)
      i += 2
    }
    const table: ErdTable = {
      name: nameParts[nameParts.length - 1],
      schema: nameParts.length > 1 ? nameParts.slice(0, -1).join('.') : undefined,
      columns: [],
      line: at(kw.pos).line,
    }
    if (w(peek(), 'as') && peek(1)?.kind === 'word') {
      aliases.set(peek(1).text.toLowerCase(), tableKey(table))
      i += 2
    }
    readSettings() // headercolor, note …
    skipNl()
    if (!p(peek(), '{')) {
      fail(peek() ?? kw, `Table ${tableKey(table)}: expected "{"`)
      restOfLine()
      return
    }
    const open = toks[i++]
    tables.push(table)
    for (;;) {
      skipNl()
      const t = peek()
      if (!t) {
        fail(open, `Table ${tableKey(table)}: missing closing "}"`)
        return
      }
      if (p(t, '}')) {
        i++
        return
      }
      if (w(t, 'note') && (p(peek(1), ':') || p(peek(1), '{'))) {
        i++
        if (p(peek(), ':')) i++
        skipNl()
        if (p(peek(), '{')) {
          i++
          skipNl()
          if (peek()?.kind === 'str') table.note = peek().text
          while (i < toks.length && !p(peek(), '}')) i++
          i++
        } else if (peek()?.kind === 'str') {
          table.note = toks[i++].text
        }
        continue
      }
      if (w(t, 'indexes') && (p(peek(1), '{') || peek(1)?.kind === 'nl')) {
        i++
        skipNl()
        if (!p(peek(), '{')) continue
        i++
        // Each line: col [settings] or (a, b) [settings]
        for (;;) {
          skipNl()
          if (!peek() || p(peek(), '}')) {
            i++
            break
          }
          const cols: string[] = []
          if (p(peek(), '(')) {
            i++
            while (i < toks.length && !p(peek(), ')')) {
              if (peek().kind === 'word') cols.push(peek().text)
              i++
            }
            i++
          } else if (peek().kind === 'word') cols.push(toks[i++].text)
          else i++
          const settings = readSettings().map(([k]) => k)
          const isPk = settings.includes('pk') || settings.includes('primary key')
          for (const n of cols) {
            const c = findColumn(table, n)
            if (c && isPk) Object.assign(c, { pk: true, notNull: true })
            if (c && settings.includes('unique') && cols.length === 1) c.unique = true
          }
          restOfLine()
        }
        continue
      }
      if (t.kind !== 'word') {
        fail(t, `Table ${tableKey(table)}: expected a column name`)
        restOfLine()
        continue
      }
      // column: name type [settings]
      i++
      const col: ErdColumn = { name: t.text, type: '', pk: false, notNull: false, unique: false, increment: false }
      const typeToks: DbmlTok[] = []
      while (i < toks.length && peek().kind !== 'nl' && !p(peek(), '[') && !p(peek(), '}')) typeToks.push(toks[i++])
      col.type = typeToks
        .map((x) => x.text)
        .join(' ')
        .replace(/\s*([(),.\[\]])\s*/g, '$1')
      if (!col.type) fail(t, `Column ${t.text}: missing type`)
      for (const [k, v] of readSettings()) {
        if (k === 'pk' || k === 'primary key') Object.assign(col, { pk: true, notNull: true })
        else if (k === 'not null') col.notNull = true
        else if (k === 'unique') col.unique = true
        else if (k === 'increment') col.increment = true
        else if (k === 'default') col.default = valueText(v)
        else if (k === 'note') col.note = v[0]?.text
        else if (k === 'ref') {
          const op = v[0]
          const save = i
          // Re-parse the endpoint tokens in place.
          const sub = v.slice(1)
          const idx = toks.indexOf(sub[0])
          if (op && op.kind === 'punc' && REL_OPS.includes(op.text) && idx >= 0) {
            i = idx
            const to = readEndpoint()
            i = save
            if (to) pushRef({ table: tableKey(table), columns: [col.name] }, op.text, to, at(t.pos).line)
            else fail(op, `Column ${col.name}: invalid ref target`)
          } else fail(v[0] ?? t, `Column ${col.name}: ref needs ">", "<", "-" or "<>"`)
        }
      }
      table.columns.push(col)
      if (peek() && peek().kind !== 'nl' && !p(peek(), '}')) {
        fail(peek(), `Unexpected "${peek().text}"`)
        restOfLine()
      }
    }
  }

  while (i < toks.length) {
    skipNl()
    const t = peek()
    if (!t) break
    if (w(t, 'table') && !w(peek(1), 'group') && !(peek(1)?.kind === 'word' && peek(1).text.toLowerCase() === 'tablegroup')) {
      parseTable()
    } else if (w(t, 'ref')) {
      i++
      let name: string | undefined
      if (peek()?.kind === 'word' && !p(peek(1), '.')) name = toks[i++].text
      if (p(peek(), ':')) {
        i++
        parseRefBody(name)
      } else {
        skipNl()
        if (!p(peek(), '{')) {
          fail(peek() ?? t, 'Ref: expected ":" or "{"')
          restOfLine()
          continue
        }
        i++
        for (;;) {
          skipNl()
          if (!peek()) {
            fail(t, 'Ref: missing closing "}"')
            break
          }
          if (p(peek(), '}')) {
            i++
            break
          }
          parseRefBody(name)
          restOfLine()
        }
      }
    } else if (
      ['project', 'enum', 'tablegroup', 'note', 'tablepartial', 'records'].includes(t.text.toLowerCase()) &&
      t.kind === 'word'
    ) {
      i++
      while (i < toks.length && !p(peek(), '{') && peek().kind !== 'nl') i++
      if (!skipBlock()) restOfLine()
    } else {
      fail(t, `Unexpected "${t.text}" — expected Table, Ref, Enum or Project`)
      restOfLine()
    }
  }

  // Resolve table aliases in refs.
  for (const r of refs) {
    for (const end of [r.from, r.to]) end.table = aliases.get(end.table.toLowerCase()) ?? end.table
  }
  if (!tables.length && /\bcreate\s+(\w+\s+)*table\b/i.test(src)) {
    errors.length = 0
    errors.push({ line: 1, message: 'This looks like SQL, not DBML — switch to the SQL DDL tab' })
  } else if (!tables.length && !errors.length && src.trim()) errors.push({ line: 1, message: 'No tables found' })
  return finishSchema(tables, refs, errors, warnings)
}

/* ------------------------------------------------------------------ */
/* Generators                                                          */
/* ------------------------------------------------------------------ */

const d2q = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

/** D2 crow's-foot arrowheads for each relationship end. */
function arrowheads(r: ErdRef, schema: ErdSchema): [string, string] {
  const fromTable = schema.tables.find((t) => tableKey(t) === r.from.table)
  const required = !!fromTable && r.from.columns.every((c) => fromTable && findColumn(fromTable, c)?.notNull)
  const one = required ? 'cf-one-required' : 'cf-one'
  if (r.kind === 'many-to-many') return ['cf-many', 'cf-many']
  if (r.kind === 'one-to-one') return ['cf-one', one]
  return ['cf-many', one]
}

export function toD2(schema: ErdSchema, refs: ErdRef[], direction: 'right' | 'down'): string {
  const lines = [`direction: ${direction}`, '']
  const fkCols = new Set(
    refs.filter((r) => !r.inferred).flatMap((r) => r.from.columns.map((c) => `${r.from.table}.${c}`)),
  )
  for (const t of schema.tables) {
    const key = tableKey(t)
    lines.push(`${d2q(key)}: {`, '  shape: sql_table')
    for (const c of t.columns) {
      const cons = [c.pk && 'primary_key', fkCols.has(`${key}.${c.name}`) && 'foreign_key', c.unique && !c.pk && 'unique'].filter(
        Boolean,
      )
      const label = c.type + (c.notNull && !c.pk ? ' NOT NULL' : '')
      const extra = cons.length ? ` {constraint: [${cons.join('; ')}]}` : ''
      lines.push(`  ${d2q(c.name)}: ${d2q(label)}${extra}`)
    }
    lines.push('}')
  }
  lines.push('')
  for (const r of refs) {
    const from = schema.tables.find((t) => tableKey(t) === r.from.table)!
    const to = schema.tables.find((t) => tableKey(t) === r.to.table)!
    const fc = r.from.columns.find((c) => findColumn(from, c))
    const tc = r.to.columns.find((c) => findColumn(to, c))
    const a = fc ? `${d2q(r.from.table)}.${d2q(fc)}` : d2q(r.from.table)
    const b = tc ? `${d2q(r.to.table)}.${d2q(tc)}` : d2q(r.to.table)
    const [sh, th] = arrowheads(r, schema)
    const style = [`source-arrowhead.shape: ${sh}`, `target-arrowhead.shape: ${th}`]
    if (r.inferred) style.push('style.stroke-dash: 4', 'style.opacity: 0.7')
    lines.push(`${a} -> ${b}: {${style.join('; ')}}`)
  }
  return lines.join('\n') + '\n'
}

/* ---- DBML ---- */

const SIMPLE = /^[A-Za-z_][\w$]*$/
const dbmlName = (s: string) => (SIMPLE.test(s) ? s : `"${s.replace(/"/g, '\\"')}"`)
const dbmlTable = (t: { schema?: string; name: string }) =>
  t.schema ? `${dbmlName(t.schema)}.${dbmlName(t.name)}` : dbmlName(t.name)
const dbmlKey = (key: string, tables: ErdTable[]) => {
  const t = tables.find((x) => tableKey(x) === key)
  return t ? dbmlTable(t) : dbmlName(key)
}
const dbmlStr = (s: string) => (s.includes('\n') ? `'''${s}'''` : `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`)
const dbmlType = (t: string) => (/^[\w$]+(\([\d\s,]*\))?(\[\])?$/.test(t) ? t : `"${t.replace(/"/g, '\\"')}"`)

function dbmlDefault(v: string): string {
  if (/^-?\d+(\.\d+)?$/.test(v) || /^(true|false|null)$/i.test(v)) return v.toLowerCase() === v ? v : v.toLowerCase()
  if (/^'.*'$/s.test(v)) return v.replace(/''/g, "\\'")
  return '`' + v.replace(/`/g, '') + '`'
}

export function toDbml(schema: ErdSchema): string {
  const out: string[] = []
  for (const t of schema.tables) {
    out.push(`Table ${dbmlTable(t)} {`)
    const width = Math.max(...t.columns.map((c) => dbmlName(c.name).length), 0)
    for (const c of t.columns) {
      const s: string[] = []
      if (c.pk) s.push('pk')
      if (c.increment) s.push('increment')
      if (c.notNull && !c.pk) s.push('not null')
      if (c.unique && !c.pk) s.push('unique')
      if (c.default !== undefined) s.push(`default: ${dbmlDefault(c.default)}`)
      if (c.note) s.push(`note: ${dbmlStr(c.note)}`)
      out.push(`  ${dbmlName(c.name).padEnd(width)} ${dbmlType(c.type || 'unknown')}${s.length ? ` [${s.join(', ')}]` : ''}`)
    }
    if (t.note) out.push('', `  Note: ${dbmlStr(t.note)}`)
    out.push('}', '')
  }
  const ops: Record<RefKind, string> = { 'many-to-one': '>', 'one-to-one': '-', 'many-to-many': '<>' }
  for (const r of schema.refs) {
    const end = (e: ErdRef['from']) =>
      e.columns.length === 1
        ? `${dbmlKey(e.table, schema.tables)}.${dbmlName(e.columns[0])}`
        : `${dbmlKey(e.table, schema.tables)}.(${e.columns.map(dbmlName).join(', ')})`
    const settings = r.onDelete ? ` [delete: ${r.onDelete}]` : ''
    out.push(`Ref${r.name ? ' ' + dbmlName(r.name) : ''}: ${end(r.from)} ${ops[r.kind]} ${end(r.to)}${settings}`)
  }
  return out.join('\n').trimEnd() + '\n'
}

/* ---- SQL DDL ---- */

/** Map a column type to the target dialect. Unknown types pass through unchanged. */
export function mapType(type: string, dialect: Dialect): string {
  const m = type.trim().match(/^([A-Za-z][\w\s]*?)\s*(\(([^)]*)\))?\s*(\[\])?$/)
  if (!m) return type
  const base = m[1].toLowerCase().replace(/\s+/g, ' ')
  const args = m[3]?.replace(/\s*(byte|char)\s*$/i, '').trim()
  const withArgs = (name: string) => (args ? `${name}(${args})` : name)
  if (m[4]) return dialect === 'postgresql' ? type : 'CLOB'

  if (dialect === 'oracle') {
    const map: Record<string, string> = {
      int: 'NUMBER(10)', integer: 'NUMBER(10)', int4: 'NUMBER(10)', serial: 'NUMBER(10)',
      smallint: 'NUMBER(5)', int2: 'NUMBER(5)', smallserial: 'NUMBER(5)', tinyint: 'NUMBER(3)',
      bigint: 'NUMBER(19)', int8: 'NUMBER(19)', bigserial: 'NUMBER(19)',
      boolean: 'NUMBER(1)', bool: 'NUMBER(1)',
      text: 'CLOB', string: 'VARCHAR2(4000)', json: 'CLOB', jsonb: 'CLOB', xml: 'XMLTYPE',
      bytea: 'BLOB', uuid: 'RAW(16)',
      real: 'BINARY_FLOAT', float4: 'BINARY_FLOAT', 'double precision': 'BINARY_DOUBLE', float8: 'BINARY_DOUBLE', double: 'BINARY_DOUBLE',
      datetime: 'TIMESTAMP', timestamptz: 'TIMESTAMP WITH TIME ZONE',
      'timestamp without time zone': 'TIMESTAMP', 'timestamp with time zone': 'TIMESTAMP WITH TIME ZONE',
      time: 'VARCHAR2(8)',
    }
    if (map[base]) return map[base]
    if (['varchar', 'character varying', 'nvarchar', 'varchar2', 'nvarchar2'].includes(base))
      return args ? `${base.startsWith('n') ? 'NVARCHAR2' : 'VARCHAR2'}(${args})` : 'VARCHAR2(4000)'
    if (['numeric', 'decimal', 'number', 'money'].includes(base)) return withArgs('NUMBER')
    if (['char', 'character', 'bpchar'].includes(base)) return withArgs('CHAR')
    if (base === 'float') return withArgs('FLOAT')
    return type.toUpperCase()
  }

  const map: Record<string, string> = {
    varchar2: 'varchar', nvarchar2: 'varchar', nvarchar: 'varchar', string: 'text',
    clob: 'text', nclob: 'text', long: 'text', blob: 'bytea', raw: 'bytea', 'long raw': 'bytea',
    binary_float: 'real', binary_double: 'double precision', double: 'double precision',
    datetime: 'timestamp', xmltype: 'xml', int: 'integer', tinyint: 'smallint',
  }
  if (base === 'number') {
    if (!args) return 'numeric'
    const [p, s] = args.split(',').map((x) => parseInt(x))
    if (!s) return p <= 4 ? 'smallint' : p <= 9 ? 'integer' : p <= 18 ? 'bigint' : `numeric(${p})`
    return `numeric(${p},${s})`
  }
  if (base === 'raw' && args === '16') return 'uuid'
  if (['varchar2', 'nvarchar2', 'nvarchar'].includes(base)) return withArgs('varchar')
  if (base === 'nchar') return withArgs('char')
  if (map[base]) return map[base]
  return type.toLowerCase()
}

const ORACLE_RESERVED = new Set(
  (
    'access add all alter and any as asc audit between by char check cluster column comment compress connect ' +
    'create current date decimal default delete desc distinct drop else exclusive exists file float for from ' +
    'grant group having identified immediate in increment index initial insert integer intersect into is level ' +
    'like lock long maxextents minus mlslabel mode modify noaudit nocompress not nowait null number of offline on ' +
    'online option or order pctfree prior public raw rename resource revoke row rowid rownum rows select session ' +
    'set share size smallint start successful synonym sysdate table then to trigger uid union unique update user ' +
    'validate values varchar varchar2 view whenever where with'
  ).split(' '),
)
const PG_RESERVED = new Set(['user', 'order', 'group', 'table', 'select', 'from', 'where', 'check', 'default', 'column', 'limit', 'offset', 'primary', 'references', 'end', 'desc', 'asc', 'all', 'analyse', 'analyze', 'and', 'any', 'array', 'as', 'both', 'case', 'cast', 'collate', 'constraint', 'create', 'current_date', 'current_user', 'distinct', 'do', 'else', 'except', 'false', 'for', 'foreign', 'grant', 'having', 'in', 'into', 'leading', 'not', 'null', 'on', 'only', 'or', 'placing', 'returning', 'some', 'symmetric', 'then', 'to', 'trailing', 'true', 'union', 'unique', 'using', 'when', 'window', 'with'])

function sqlIdent(name: string, dialect: Dialect): string {
  const reserved = dialect === 'oracle' ? ORACLE_RESERVED : PG_RESERVED
  if (/^[A-Za-z_][\w$#]*$/.test(name) && !reserved.has(name.toLowerCase())) return name
  return `"${name.replace(/"/g, '""')}"`
}

function sqlTableName(key: string, schema: ErdSchema, dialect: Dialect): string {
  const t = schema.tables.find((x) => tableKey(x) === key)
  if (!t) return sqlIdent(key, dialect)
  return t.schema ? `${sqlIdent(t.schema, dialect)}.${sqlIdent(t.name, dialect)}` : sqlIdent(t.name, dialect)
}

const sqlStr = (s: string) => `'${s.replace(/'/g, "''")}'`

function sqlDefault(v: string, dialect: Dialect): string {
  const low = v.toLowerCase()
  if (dialect === 'oracle') {
    if (low === 'true') return '1'
    if (low === 'false') return '0'
    if (low === 'now()' || low === 'current_timestamp') return 'SYSTIMESTAMP'
  } else if (low === 'sysdate' || low === 'systimestamp') return 'CURRENT_TIMESTAMP'
  return v
}

export function toSql(schema: ErdSchema, dialect: Dialect): string {
  const out: string[] = []
  const comments: string[] = []
  const shortName = (s: string) => s.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').slice(0, dialect === 'oracle' ? 30 : 63)

  for (const t of schema.tables) {
    const name = sqlTableName(tableKey(t), schema, dialect)
    const body: string[] = []
    for (const c of t.columns) {
      let line = `  ${sqlIdent(c.name, dialect)} `
      const serial = /^(small|big)?serial\d?$/i.test(c.type)
      let type = mapType(c.type || 'varchar(255)', dialect)
      if (dialect === 'postgresql' && serial) type = c.type.toLowerCase()
      line += type
      if (c.increment && !(dialect === 'postgresql' && serial)) line += ' GENERATED BY DEFAULT AS IDENTITY'
      if (c.default !== undefined && !c.increment) line += ` DEFAULT ${sqlDefault(c.default, dialect)}`
      if (c.notNull && !c.pk) line += ' NOT NULL'
      if (c.unique && !c.pk) line += ' UNIQUE'
      body.push(line)
      if (c.note) comments.push(`COMMENT ON COLUMN ${name}.${sqlIdent(c.name, dialect)} IS ${sqlStr(c.note)};`)
    }
    const pk = t.columns.filter((c) => c.pk)
    if (pk.length) {
      body.push(`  CONSTRAINT ${sqlIdent(shortName(`pk_${t.name}`), dialect)} PRIMARY KEY (${pk.map((c) => sqlIdent(c.name, dialect)).join(', ')})`)
    }
    out.push(`CREATE TABLE ${name} (\n${body.join(',\n')}\n);`, '')
    if (t.note) comments.push(`COMMENT ON TABLE ${name} IS ${sqlStr(t.note)};`)
  }

  const used = new Set<string>()
  for (const r of schema.refs) {
    if (r.kind === 'many-to-many') {
      out.push(`-- ${r.from.table} <> ${r.to.table}: many-to-many needs a junction table`)
      continue
    }
    const from = schema.tables.find((t) => tableKey(t) === r.from.table)!
    let cname = r.name ?? shortName(`fk_${from.name}_${r.from.columns.join('_')}`)
    while (used.has(cname.toLowerCase())) cname += '_'
    used.add(cname.toLowerCase())
    let onDelete = r.onDelete ? ` ON DELETE ${r.onDelete.toUpperCase()}` : ''
    if (dialect === 'oracle' && !/^ ON DELETE (CASCADE|SET NULL)$/.test(onDelete)) onDelete = ''
    out.push(
      `ALTER TABLE ${sqlTableName(r.from.table, schema, dialect)} ADD CONSTRAINT ${sqlIdent(cname, dialect)}\n` +
        `  FOREIGN KEY (${r.from.columns.map((c) => sqlIdent(c, dialect)).join(', ')})\n` +
        `  REFERENCES ${sqlTableName(r.to.table, schema, dialect)} (${r.to.columns.map((c) => sqlIdent(c, dialect)).join(', ')})${onDelete};`,
    )
  }
  if (comments.length) out.push('', ...comments)
  return out.join('\n').trim() + '\n'
}

/* ------------------------------------------------------------------ */
/* Samples                                                             */
/* ------------------------------------------------------------------ */

export const SAMPLES: Record<'postgresql' | 'oracle' | 'dbml', string> = {
  postgresql: `-- Paste PostgreSQL CREATE TABLE statements.
CREATE TABLE customers (
  id          BIGSERIAL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL UNIQUE,
  full_name   VARCHAR(120) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id     SERIAL PRIMARY KEY,
  sku    VARCHAR(40) NOT NULL UNIQUE,
  name   TEXT NOT NULL,
  price  NUMERIC(12, 2) NOT NULL CHECK (price >= 0)
);

CREATE TABLE orders (
  id           BIGSERIAL PRIMARY KEY,
  customer_id  BIGINT NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  status       VARCHAR(20) NOT NULL DEFAULT 'new',
  placed_at    TIMESTAMPTZ
);

CREATE TABLE order_items (
  order_id    BIGINT NOT NULL,
  product_id  INT NOT NULL,
  quantity    INT NOT NULL DEFAULT 1,
  PRIMARY KEY (order_id, product_id),
  CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES products (id)
);

COMMENT ON TABLE orders IS 'One row per checkout';
`,
  oracle: `-- Paste Oracle CREATE TABLE statements.
CREATE TABLE departments (
  dept_id    NUMBER(10) GENERATED BY DEFAULT AS IDENTITY,
  dept_name  VARCHAR2(100 CHAR) NOT NULL,
  CONSTRAINT pk_departments PRIMARY KEY (dept_id)
);

CREATE TABLE employees (
  emp_id      NUMBER(10) NOT NULL,
  dept_id     NUMBER(10),
  manager_id  NUMBER(10),
  full_name   VARCHAR2(150 CHAR) NOT NULL,
  email       VARCHAR2(255) CONSTRAINT uq_emp_email UNIQUE,
  hired_on    DATE DEFAULT SYSDATE NOT NULL,
  salary      NUMBER(12,2),
  CONSTRAINT pk_employees PRIMARY KEY (emp_id)
) TABLESPACE users;

ALTER TABLE employees ADD CONSTRAINT fk_emp_dept
  FOREIGN KEY (dept_id) REFERENCES departments (dept_id);

ALTER TABLE employees ADD CONSTRAINT fk_emp_manager
  FOREIGN KEY (manager_id) REFERENCES employees (emp_id);

CREATE TABLE job_history (
  emp_id      NUMBER(10) NOT NULL REFERENCES employees,
  start_date  DATE NOT NULL,
  end_date    DATE,
  dept_id     NUMBER(10),
  CONSTRAINT pk_job_history PRIMARY KEY (emp_id, start_date)
);

COMMENT ON TABLE employees IS 'All staff';
`,
  dbml: `// Write DBML — https://dbml.dbdiagram.io/docs
Table users {
  id integer [pk, increment]
  username varchar(50) [not null, unique]
  role varchar(20) [default: 'member']
  created_at timestamp [default: \`now()\`]
}

Table posts {
  id integer [pk, increment]
  title varchar(200) [not null]
  body text [note: 'Markdown content']
  user_id integer [not null, ref: > users.id]
  status varchar(20)
}

Table tags {
  id integer [pk]
  name varchar(40) [unique]
}

Table post_tags {
  post_id integer
  tag_id integer

  indexes {
    (post_id, tag_id) [pk]
  }
}

Ref: post_tags.post_id > posts.id [delete: cascade]
Ref: post_tags.tag_id > tags.id
`,
}

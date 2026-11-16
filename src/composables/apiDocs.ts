/**
 * API documentation generator: turns an endpoint URL, headers and example
 * request/response JSON into field tables, Markdown, cURL and OpenAPI 3 YAML.
 * Everything runs locally — nothing is sent anywhere.
 */

export type SectionKey = 'path' | 'query' | 'headers' | 'request' | 'response' | 'error'

export interface DocField {
  path: string
  type: string
  format?: string
  example: string
  depth: number
  /** Guessed from the field name; the user can override it. */
  description: string
  required: boolean
}

export interface ApiInput {
  title: string
  description: string
  method: string
  url: string
  headers: string
  request: string
  responseStatus: string
  response: string
  errorStatus: string
  error: string
}

/** User edits to a field, keyed by `${section}:${path}`. */
export type Overrides = Record<string, { description?: string; required?: boolean }>

/* ---------- JSON helpers ---------- */

/** Parse JSON; on failure return the 1-based line/column of the problem. */
export function parseJson(src: string):
  | { ok: true; value: unknown; empty: boolean }
  | { ok: false; message: string; line?: number; column?: number } {
  if (!src.trim()) return { ok: true, value: undefined, empty: true }
  try {
    return { ok: true, value: JSON.parse(src), empty: false }
  } catch (err) {
    const message = (err as Error).message
    const lc = message.match(/line (\d+) column (\d+)/)
    if (lc) return { ok: false, message, line: +lc[1], column: +lc[2] }
    const pos = message.match(/position (\d+)/)
    if (pos) {
      const before = src.slice(0, +pos[1]).split('\n')
      return { ok: false, message, line: before.length, column: before[before.length - 1].length + 1 }
    }
    return { ok: false, message }
  }
}

/* ---------- field naming ---------- */

const ABBREVIATIONS: Record<string, string> = {
  id: 'ID',
  no: 'number',
  num: 'number',
  amt: 'amount',
  ccy: 'currency',
  cur: 'currency',
  dt: 'date',
  acc: 'account',
  acct: 'account',
  txn: 'transaction',
  trx: 'transaction',
  ref: 'reference',
  desc: 'description',
  qty: 'quantity',
  msg: 'message',
  addr: 'address',
  tel: 'telephone',
  dob: 'date of birth',
  cif: 'CIF',
  otp: 'OTP',
  url: 'URL',
  api: 'API',
  ip: 'IP',
  khr: 'KHR',
  usd: 'USD',
}

/** "accountNo" / "account_no" / "X-Request-Id" → "Account number" / "X request ID". */
function humanize(name: string): string {
  const words = name
    .replace(/\[\]$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_\-.]+/)
    .filter(Boolean)
    .map((w) => ABBREVIATIONS[w.toLowerCase()] ?? w.toLowerCase())
  const text = words.join(' ')
  return text ? text[0].toUpperCase() + text.slice(1) : name
}

function lastSegment(path: string): string {
  return path.split('.').pop()!.replace(/\[\]$/, '')
}

/* ---------- type detection ---------- */

function detectFormat(v: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'date'
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(v)) return 'date-time'
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return 'email'
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return 'uuid'
  if (/^https?:\/\//.test(v)) return 'uri'
  return undefined
}

function typeOf(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return v.length ? `array<${typeOf(v[0])}>` : 'array'
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number'
  return typeof v
}

function exampleOf(v: unknown): string {
  if (v === null) return 'null'
  if (typeof v === 'object') return ''
  const s = String(v)
  return s.length > 48 ? s.slice(0, 45) + '…' : s
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Union of keys across all object items, so optional properties still show up. */
function mergeItems(items: unknown[]): { merged: Record<string, unknown>; partial: Set<string> } {
  const objects = items.filter(isObject)
  const merged: Record<string, unknown> = {}
  for (const item of objects) for (const [k, c] of Object.entries(item)) if (!(k in merged)) merged[k] = c
  const partial = new Set(Object.keys(merged).filter((k) => objects.some((o) => !(k in o))))
  return { merged, partial }
}

/** Flatten a JSON value into rows: `data.items[].amount`. */
export function flattenJson(value: unknown, requiredByDefault: boolean): DocField[] {
  const out: DocField[] = []
  const walk = (v: unknown, path: string, depth: number, optional = false) => {
    if (path) {
      out.push({
        path,
        type: typeOf(v),
        format: typeof v === 'string' ? detectFormat(v) : undefined,
        example: exampleOf(v),
        depth,
        description: humanize(lastSegment(path)),
        required: requiredByDefault && v !== null && !optional,
      })
    }
    if (isObject(v)) {
      for (const [k, child] of Object.entries(v)) walk(child, path ? `${path}.${k}` : k, path ? depth + 1 : 0)
    } else if (Array.isArray(v) && isObject(v[0])) {
      const { merged, partial } = mergeItems(v)
      const base = path ? `${path}[]` : '[]'
      for (const [k, child] of Object.entries(merged)) walk(child, `${base}.${k}`, path ? depth + 1 : 0, partial.has(k))
    }
  }
  walk(value, '', 0)
  return out
}

/* ---------- URL & headers ---------- */

export interface ParsedUrl {
  server: string
  path: string
  pathParams: DocField[]
  queryParams: DocField[]
}

export function parseUrl(raw: string): ParsedUrl {
  const url = raw.trim()
  const m = url.match(/^(https?:\/\/[^/?#]+)?([^?#]*)(?:\?([^#]*))?/) ?? []
  const server = m[1] ?? ''
  const path = m[2] || '/'
  const query = m[3] ?? ''

  const pathParams: DocField[] = []
  // Accept both {accountId} and :accountId; normalise to {accountId}.
  const normalised = path.replace(/:([A-Za-z_]\w*)/g, '{$1}')
  for (const [, name] of normalised.matchAll(/\{([^}]+)\}/g)) {
    pathParams.push({ path: name, type: 'string', example: '', depth: 0, description: humanize(name), required: true })
  }

  const queryParams: DocField[] = []
  for (const part of query.split('&').filter(Boolean)) {
    const [k, v = ''] = part.split('=')
    const name = decodeURIComponent(k)
    const value = decodeURIComponent(v.replace(/\+/g, ' '))
    const isNum = value !== '' && !isNaN(Number(value))
    queryParams.push({
      path: name,
      type: isNum ? (Number.isInteger(Number(value)) ? 'integer' : 'number') : value === 'true' || value === 'false' ? 'boolean' : 'string',
      format: detectFormat(value),
      example: value,
      depth: 0,
      description: humanize(name),
      required: false,
    })
  }
  return { server, path: normalised, pathParams, queryParams }
}

export function parseHeaders(raw: string): DocField[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l.includes(':'))
    .map((l) => {
      const i = l.indexOf(':')
      const name = l.slice(0, i).trim()
      return {
        path: name,
        type: 'string',
        example: l.slice(i + 1).trim(),
        depth: 0,
        description: HEADER_HINTS[name.toLowerCase()] ?? humanize(name),
        required: true,
      }
    })
}

const HEADER_HINTS: Record<string, string> = {
  'content-type': 'Media type of the request body',
  accept: 'Media type the client accepts',
  authorization: 'Access token for authentication',
  'x-request-id': 'Unique ID to trace the request',
  'x-correlation-id': 'Correlation ID to trace the request across services',
  'x-api-key': 'API key issued to the client',
  'accept-language': 'Preferred response language',
}

/* ---------- applying user edits ---------- */

export function applyOverrides(section: SectionKey, fields: DocField[], overrides: Overrides): DocField[] {
  return fields.map((f) => {
    const o = overrides[`${section}:${f.path}`]
    return o ? { ...f, description: o.description ?? f.description, required: o.required ?? f.required } : f
  })
}

/* ---------- Markdown ---------- */

export interface DocModel {
  input: ApiInput
  url: ParsedUrl
  headers: DocField[]
  pathParams: DocField[]
  queryParams: DocField[]
  request?: { fields: DocField[]; json: string }
  response?: { fields: DocField[]; json: string }
  error?: { fields: DocField[]; json: string }
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
const typeLabel = (f: DocField) => (f.format ? `${f.type} (${f.format})` : f.type)

function mdTable(fields: DocField[], withRequired: boolean): string {
  const head = withRequired
    ? '| Field | Type | Required | Description | Example |\n|---|---|---|---|---|'
    : '| Field | Type | Description | Example |\n|---|---|---|---|'
  const rows = fields.map((f) => {
    const name = `\`${cell(f.path)}\``
    const ex = f.example ? `\`${cell(f.example)}\`` : ''
    return withRequired
      ? `| ${name} | ${typeLabel(f)} | ${f.required ? 'Yes' : 'No'} | ${cell(f.description)} | ${ex} |`
      : `| ${name} | ${typeLabel(f)} | ${cell(f.description)} | ${ex} |`
  })
  return [head, ...rows].join('\n')
}

const pretty = (json: string) => {
  try {
    return JSON.stringify(JSON.parse(json), null, 2)
  } catch {
    return json
  }
}

export function buildCurl(m: DocModel): string {
  const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`
  const lines = [`curl -X ${m.input.method} ${q(m.input.url.trim() || '/')}`]
  for (const h of m.headers) lines.push(`  -H ${q(`${h.path}: ${h.example}`)}`)
  if (m.request) lines.push(`  -d ${q(pretty(m.request.json))}`)
  return lines.join(' \\\n')
}

export function buildMarkdown(m: DocModel): string {
  const { input } = m
  const out: string[] = []
  out.push(`# ${input.title.trim() || `${input.method} ${m.url.path}`}`)
  if (input.description.trim()) out.push(input.description.trim())

  out.push('## Endpoint')
  out.push('```http\n' + `${input.method} ${m.url.path}` + '\n```')
  if (m.url.server) out.push(`**Base URL:** \`${m.url.server}\``)

  if (m.headers.length) out.push('## Headers', mdTable(m.headers, true))
  if (m.pathParams.length) out.push('## Path Parameters', mdTable(m.pathParams, true))
  if (m.queryParams.length) out.push('## Query Parameters', mdTable(m.queryParams, true))

  if (m.request) {
    out.push('## Request Body')
    if (m.request.fields.length) out.push(mdTable(m.request.fields, true))
    out.push('**Example**', '```json\n' + pretty(m.request.json) + '\n```')
  }
  if (m.response) {
    out.push(`## Response — ${input.responseStatus || '200'}`)
    if (m.response.fields.length) out.push(mdTable(m.response.fields, false))
    out.push('**Example**', '```json\n' + pretty(m.response.json) + '\n```')
  }
  if (m.error) {
    out.push(`## Error Response — ${input.errorStatus || '400'}`)
    if (m.error.fields.length) out.push(mdTable(m.error.fields, false))
    out.push('**Example**', '```json\n' + pretty(m.error.json) + '\n```')
  }

  out.push('## Sample Request', '```bash\n' + buildCurl(m) + '\n```')
  return out.join('\n\n') + '\n'
}

/* ---------- OpenAPI 3 ---------- */

type Schema = Record<string, unknown>

function schemaOf(v: unknown, fields: Map<string, DocField>, path: string, withRequired: boolean): Schema {
  const f = fields.get(path)
  const meta: Schema = f ? { description: f.description } : {}
  if (v === null) return { ...meta, nullable: true }
  if (Array.isArray(v)) {
    const itemPath = path ? `${path}[]` : '[]'
    const item = v.some(isObject) ? mergeItems(v).merged : v[0]
    return { type: 'array', ...meta, items: v.length ? schemaOf(item, fields, itemPath, withRequired) : {} }
  }
  if (isObject(v)) {
    const properties: Record<string, Schema> = {}
    const required: string[] = []
    for (const [k, child] of Object.entries(v)) {
      const childPath = path ? `${path}.${k}` : k
      properties[k] = schemaOf(child, fields, childPath, withRequired)
      if (withRequired && fields.get(childPath)?.required) required.push(k)
    }
    return { type: 'object', ...meta, ...(required.length ? { required } : {}), properties }
  }
  const type = typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number') : typeof v
  return { type, ...(f?.format ? { format: f.format } : {}), ...meta, example: v }
}

function typedExample(f: DocField): unknown {
  if (f.type === 'integer' || f.type === 'number') return Number(f.example)
  if (f.type === 'boolean') return f.example === 'true'
  return f.example
}

function paramSpec(f: DocField, where: 'path' | 'query' | 'header') {
  return {
    name: f.path,
    in: where,
    required: where === 'path' ? true : f.required,
    description: f.description,
    schema: { type: f.type === 'null' ? 'string' : f.type },
    ...(f.example ? { example: typedExample(f) } : {}),
  }
}

export function buildOpenApi(m: DocModel): string {
  const { input } = m
  const byPath = (fields: DocField[]) => new Map(fields.map((f) => [f.path, f]))
  const op: Schema = {
    summary: input.title.trim() || `${input.method} ${m.url.path}`,
    ...(input.description.trim() ? { description: input.description.trim() } : {}),
  }
  const params = [
    ...m.pathParams.map((f) => paramSpec(f, 'path')),
    ...m.queryParams.map((f) => paramSpec(f, 'query')),
    // Content-Type / Authorization are expressed elsewhere in OpenAPI.
    ...m.headers
      .filter((f) => !['content-type', 'accept', 'authorization'].includes(f.path.toLowerCase()))
      .map((f) => paramSpec(f, 'header')),
  ]
  if (params.length) op.parameters = params
  if (m.request) {
    const value = JSON.parse(m.request.json)
    op.requestBody = {
      required: true,
      content: { 'application/json': { schema: schemaOf(value, byPath(m.request.fields), '', true), example: value } },
    }
  }
  const responses: Schema = {}
  for (const [part, status, label] of [
    [m.response, input.responseStatus || '200', 'Successful response'],
    [m.error, input.errorStatus || '400', 'Error response'],
  ] as const) {
    if (!part) continue
    const value = JSON.parse(part.json)
    responses[status] = {
      description: label,
      content: { 'application/json': { schema: schemaOf(value, byPath(part.fields), '', false), example: value } },
    }
  }
  op.responses = Object.keys(responses).length ? responses : { '200': { description: 'Successful response' } }
  const hasBearer = m.headers.some((h) => h.path.toLowerCase() === 'authorization' && /bearer/i.test(h.example))
  if (hasBearer) op.security = [{ bearerAuth: [] }]

  const doc: Schema = {
    openapi: '3.0.3',
    info: { title: input.title.trim() || 'API', version: '1.0.0' },
    ...(m.url.server ? { servers: [{ url: m.url.server }] } : {}),
    paths: { [m.url.path]: { [input.method.toLowerCase()]: op } },
    ...(hasBearer
      ? { components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } } }
      : {}),
  }
  return toYaml(doc) + '\n'
}

/** Minimal YAML emitter (strings are JSON-quoted, which is valid YAML). */
function toYaml(v: unknown, indent = 0): string {
  const pad = '  '.repeat(indent)
  const key = (k: string) => (/^[A-Za-z_$/][\w$/{}.-]*$/.test(k) && !/^\d/.test(k) ? k : JSON.stringify(k))
  const scalar = (x: unknown) => (typeof x === 'string' ? JSON.stringify(x) : String(x))
  const isEmpty = (x: unknown) => (Array.isArray(x) ? !x.length : isObject(x) && !Object.keys(x).length)

  if (Array.isArray(v)) {
    return v
      .map((item) => {
        if (isEmpty(item)) return `${pad}- ${Array.isArray(item) ? '[]' : '{}'}`
        // "- key: value" with the remaining keys aligned under the first one.
        if (isObject(item)) return `${pad}- ${toYaml(item, indent + 1).trimStart()}`
        if (Array.isArray(item)) return `${pad}-\n${toYaml(item, indent + 1)}`
        return `${pad}- ${scalar(item)}`
      })
      .join('\n')
  }
  if (isObject(v)) {
    return Object.entries(v)
      .map(([k, x]) => {
        if (isEmpty(x)) return `${pad}${key(k)}: ${Array.isArray(x) ? '[]' : '{}'}`
        if (isObject(x) || Array.isArray(x)) return `${pad}${key(k)}:\n${toYaml(x, indent + 1)}`
        return `${pad}${key(k)}: ${scalar(x)}`
      })
      .join('\n')
  }
  return pad + scalar(v)
}

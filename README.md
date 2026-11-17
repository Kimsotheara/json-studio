# JSON Studio

A developer toolbox in the browser — format and compare JSON, XML and SQL, draw D2 diagrams and database ERDs, generate API documentation and more.

Built with **Vue 3 + TypeScript + Vite + Tailwind CSS 4**. Everything runs locally in your browser; the only tool that calls an external service is **IP Lookup**.

## Tools

| Tab | What it does |
|---|---|
| **Editor** | Edit, validate and compare JSON side by side |
| **XML** | Beautify, minify and validate XML |
| **D2** | Write D2 diagram code and see the diagram live |
| **SQL** | Format, minify and validate SQL in 14 dialects |
| **ERD** | Database diagrams from SQL `CREATE TABLE` or DBML |
| **Base64** | Encode / decode text |
| **UUID** | Generate v4 UUIDs |
| **IP Lookup** | Geolocate an IP address |
| **API Docs** | Generate API documentation from a URL and example JSON |

### Editor (JSON)
- **Code & Tree views** — edit raw JSON or browse it as a collapsible tree
- **Beautify / Minify** — pretty-print with 2-space indent or compact to one line
- **Real-time validation** — live Valid/Invalid status with error messages
- **Side-by-side compare** — diff two documents, with copy ←/→ and swap controls; or turn on **Auto-format** to mirror a beautified copy of the source
- **Status bar** — cursor position, line count, byte size

### XML
Beautify / minify / validate XML, with the same source ↔ compare layout as the JSON editor.

### D2
- Write [D2](https://d2lang.com) code on the left; the diagram renders live on the right
- Dagre or ELK layout, hand-drawn **Sketch** style, zoom
- Copy or download the diagram as **SVG**
- Syntax errors are highlighted at the exact line and column — click an error to jump to it
- Follows the app's light / dark theme

The D2 engine (WebAssembly, ~8 MB) is loaded only when the tab is first opened.

### SQL
- Format or minify SQL — Standard SQL, MySQL, MariaDB, PostgreSQL, SQLite, SQL Server, Oracle PL/SQL, DB2, BigQuery, Snowflake, Redshift, Spark, Trino, Hive
- Options: keyword case (UPPER / lower / preserve), indent (2 spaces / 4 spaces / tabs)
- **Syntax validation** against the selected dialect's grammar — the error line and column are highlighted, click to jump
- Oracle PL/SQL and Spark are formatted but not validated (no grammar available)

### ERD (database diagram)
- **Input**: SQL DDL (PostgreSQL or Oracle — paste `CREATE TABLE` / `ALTER TABLE … ADD CONSTRAINT` / `COMMENT ON`) or [DBML](https://dbml.dbdiagram.io/docs)
- **Detection**: tables, columns, types, primary / unique / not-null, defaults, identity / serial, inline and table-level foreign keys (including composite keys and Oracle `REFERENCES t` without columns). Unrelated statements (indexes, grants, storage clauses) are ignored
- **Infer** (on by default): guesses relationships that aren't declared from column names — `customer_id` → `customers.id`, or Oracle-style `dept_id` → `departments.dept_id` — drawn dashed
- **Live preview** with crow's-foot notation (1 : 1, N : 1, N : N), ELK or Dagre layout, left-to-right or top-to-bottom, zoom
- **Export** SVG, PNG (2×) or PDF — always in the light theme
- **Convert to…** DBML, PostgreSQL DDL or Oracle DDL, with type mapping (e.g. `VARCHAR2` ↔ `varchar`, `NUMBER(10)` ↔ `integer`, identity columns)
- Problems are listed under the diagram with their line number — click to jump

Rendering uses the same D2 engine as the D2 tab (loaded on first use).

### Base64 · UUID · IP Lookup
- **Base64** — Unicode-safe encode / decode
- **UUID** — generate 1–50 v4 UUIDs at once
- **IP Lookup** — geolocate any IP (or your own) via [ipapi.co](https://ipapi.co) (free tier, rate-limited)

### API Docs
Generate professional API documentation from an endpoint and example payloads — useful for Mobile Banking, CIB, WSO2, Core Banking and other integrations.

1. Enter the API name, method and URL — path parameters (`{id}` or `:id`) and query parameters are detected automatically
2. Add a description and headers (`Name: value`, one per line)
3. Paste the request body, success response and (optionally) an error response

You get:
- Field tables for headers, path / query parameters, request, response and error — with type, format (date, date-time, email, uuid, uri), required flag, description and example
- Nested fields (`data.transactionId`, `items[].qty`)
- Descriptions guessed from field names, including common banking abbreviations (`accountNo` → "Account number", `txnId` → "Transaction ID", `ccy` → "Currency")
- **Editable preview** — click any description to change it, tick *Required* where needed; edits are used in every export

Download as:

| Format | Notes |
|---|---|
| **PDF** | A4, with page numbers |
| **Word (.docx)** | Editable, uses Word's heading styles |
| **Markdown** | For Confluence, GitLab, README files |
| **OpenAPI 3 (YAML)** | Import into Swagger, Postman, WSO2 API Manager, Apigee |
| **cURL** | Ready-to-run sample request |

**Khmer support** — Word files use *Khmer OS Siemreap* for Khmer text (Word falls back to another Khmer font if it isn't installed). PDFs containing Khmer are produced through the browser's print dialog — choose **Save as PDF** — because the direct PDF library cannot shape Khmer script correctly. PDFs without Khmer download directly.

## Data & privacy
- No backend — all processing happens in the browser
- Saved locally in your browser (`localStorage`) only: theme, the API Docs draft and the ERD source
- External requests: **IP Lookup** (ipapi.co) only

## Getting started

Requires Node.js 18+.

```bash
npm install
npm run dev         # start dev server at http://localhost:5173
npm run build       # type-check + production build (output in dist/)
npm run preview     # preview the production build
npm run type-check  # type-check only
```

## Project structure

```
src/
  App.vue                  # header, tab bar, theme toggle — tools are listed in the `tabs` array
  components/
    JsonTool.vue, XmlTool.vue   # both are a CompareTool with a different format
    CompareTool.vue        # SOURCE ↔ COMPARE screen for any text format
    EditorPane.vue         # one editor pane: actions, code editor, status bar (+ JSON tree view)
    CodeArea.vue           # shared code editor: line numbers, highlighting, error markers
    JsonTreeNode.vue
    D2Tool.vue, SqlTool.vue, ErdTool.vue
    Base64Tool.vue, UuidTool.vue, IpLookupTool.vue
    ApiDocsTool.vue
    ui/                    # reusable building blocks — see below
  composables/
    useTextEditor.ts       # editor state for any format (jsonFormat, xmlFormat) + useCompare
    useClipboard.ts        # copy + "copied" flag
    download.ts            # downloadBlob / downloadText
    storage.ts             # loadStored / saveStored / useAutoSave (localStorage, never throws)
    theme.ts               # shared `dark` ref
    d2.ts                  # shared lazy-loaded D2 engine: renderD2, useD2Render (live preview)
    highlight.ts           # JSON / XML / D2 / SQL / DBML syntax highlighters
    xml.ts                 # XML validate / beautify / minify
    erd.ts                 # ERD: SQL DDL + DBML parsers, D2 / DBML / SQL generators
    apiDocs.ts             # API doc generator: field tables, Markdown, OpenAPI, cURL
    apiDocsExport.ts       # PDF and Word export
  types/index.ts           # TabKey and shared types
```

### Reusable components (`src/components/ui/`)

Build new tools from these instead of writing the markup again.

| Component | Use it for |
|---|---|
| `AppPanel` | The bordered card. Props `label`, `title`, `narrow`; slots `title`, `actions`, default, `footer` |
| `AppButton` | Text buttons: `variant="primary \| soft \| outline \| ghost"`, plus `active`, `danger`, `muted`, `href` |
| `IconButton` | Square icon button: `icon`, `title`, `danger` |
| `CopyButton` | Copy-to-clipboard with the ✓ feedback: `text`, `variant="icon \| label \| outline"` |
| `AppIcon` | Every icon by name (`copy`, `trash`, `download`, `swap`, …) — add new ones in this file |
| `SegmentedControl` | Either/or switch (Code \| Tree): `v-model`, `options`, `variant` |
| `AppSelect` | Toolbar dropdown: `v-model`, `options` |
| `ToggleSwitch` | On/off switch with a label: `v-model` |
| `TextInput`, `FieldLabel` | Form field (`multiline`, `mono`) and its caption |
| `ZoomControl` | − 100% + stepper: `v-model` |
| `DiagramPreview`, `ProblemList` | Zoomable SVG preview and the clickable error list on top of it |
| `TransferButtons` | Swap / copy → / copy ← column between two panes |
| `EmptyState` | Dashed "nothing here yet" box |

Example — a complete panel:

```vue
<AppPanel label="OUTPUT">
  <template #actions>
    <AppButton @click="format">Format</AppButton>
    <CopyButton :text="output" />
    <IconButton icon="trash" title="Clear" danger @click="output = ''" />
  </template>
  <CodeArea v-model="output" :highlight="highlightLines" />
  <template #footer>{{ output.length }} chars</template>
</AppPanel>
```

### Adding a tab
1. Create the component in `src/components/`, built from the `ui/` components
2. Add its key to `TabKey` in `src/types/index.ts`
3. Add it to the `tabs` array in `src/App.vue`

A new **text format** (YAML, TOML, …) needs no new screen: describe it as a `TextFormat` (name, validate, beautify, minify) in `useTextEditor.ts`, add a highlighter, and wrap `CompareTool` the way `XmlTool.vue` does.

Tabs are kept alive, so a tool keeps its text and settings while you visit other tabs.

Large libraries should be imported lazily (`import()` or `defineAsyncComponent`) so the first page load stays small. If a lazily imported package is used, add it to `optimizeDeps.include` in `vite.config.ts`.

## Troubleshooting

**"Failed to fetch dynamically imported module … /node_modules/.vite/deps/…"**
A package was installed while the dev server was running. Stop the server and restart it with a fresh dependency cache, then hard-reload the page:

```bash
npm run dev -- --force
```

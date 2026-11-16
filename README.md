# JSON Studio

A developer toolbox in the browser — format and compare JSON, XML and SQL, draw D2 diagrams, generate API documentation, draft emails and more.

Built with **Vue 3 + TypeScript + Vite + Tailwind CSS 4**. Everything runs locally in your browser; the only tool that calls an external service is **IP Lookup**.

## Tools

| Tab | What it does |
|---|---|
| **Editor** | Edit, validate and compare JSON side by side |
| **XML** | Beautify, minify and validate XML |
| **D2** | Write D2 diagram code and see the diagram live |
| **SQL** | Format, minify and validate SQL in 14 dialects |
| **Base64** | Encode / decode text |
| **UUID** | Generate v4 UUIDs |
| **IP Lookup** | Geolocate an IP address |
| **API Docs** | Generate API documentation from a URL and example JSON |
| **Email** | Draft emails from templates |

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

### Email
- 10 built-in templates: leave request, meeting request, follow-up, thank you, apology / delay, reminder, introduction, request for information, approval request, out of office
- **Tone**: Formal, Friendly or Short — each template has wording for each tone
- Unfilled fields are highlighted in the preview; click one to jump to its input
- Edit the final text by hand, copy it, or **Open in Mail** (`mailto:`)
- **My templates** — create your own with `{placeholders}`, or duplicate a built-in one

To add or change built-in templates, edit `src/composables/emailTemplates.ts`.

## Data & privacy
- No backend — all processing happens in the browser
- Saved locally in your browser (`localStorage`) only: theme, the API Docs draft, Email names / templates
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
  App.vue                  # header, tab bar, theme toggle
  components/
    EditorPane.vue         # JSON pane (code / tree view)
    CodeArea.vue           # shared code editor: line numbers, highlighting, error markers
    XmlTool.vue, XmlPane.vue
    D2Tool.vue
    SqlTool.vue
    Base64Tool.vue, UuidTool.vue, IpLookupTool.vue
    ApiDocsTool.vue
    EmailTool.vue
  composables/
    highlight.ts           # JSON / XML / D2 / SQL syntax highlighters
    useJsonEditor.ts, useXmlEditor.ts, xml.ts
    apiDocs.ts             # API doc generator: field tables, Markdown, OpenAPI, cURL
    apiDocsExport.ts       # PDF and Word export
    emailTemplates.ts      # built-in email templates
  types/index.ts           # TabKey and shared types
```

### Adding a tab
1. Create the component in `src/components/`
2. Add its key to `TabKey` in `src/types/index.ts`
3. Register it in the `tabs` array and the `<main>` template in `src/App.vue`

**Email always stays the last tab** — add new tabs above it.

Large libraries should be imported lazily (`import()` or `defineAsyncComponent`) so the first page load stays small. If a lazily imported package is used, add it to `optimizeDeps.include` in `vite.config.ts`.

## Troubleshooting

**"Failed to fetch dynamically imported module … /node_modules/.vite/deps/…"**
A package was installed while the dev server was running. Stop the server and restart it with a fresh dependency cache, then hard-reload the page:

```bash
npm run dev -- --force
```

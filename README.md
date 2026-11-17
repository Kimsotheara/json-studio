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

## Getting started

Requires Node.js 24 (LTS). With [nvm](https://github.com/nvm-sh/nvm), run `nvm use` in the project folder — it reads the version from `.nvmrc`.

```bash
npm install
npm run dev         # start dev server at http://localhost:5173
npm run build       # type-check + production build (output in dist/)
npm run preview     # preview the production build
npm run type-check  # type-check only
```

```bash
npm run dev -- --force
```

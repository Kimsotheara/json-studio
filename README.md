# JSON Studio

A JSON formatter, validator, and comparison tool built with **Vue 3 + TypeScript + Vite + Tailwind CSS 4**.

## Features

- **Code & Tree views** — edit raw JSON or browse it as a collapsible tree
- **Beautify / Minify** — pretty-print with 2-space indent or compact to one line
- **Real-time validation** — live Valid/Invalid status with error messages
- **Side-by-side compare** — diff two JSON documents, with copy ←/→ and swap controls
- **Status bar** — cursor position, line count, byte size
- **XML** — beautify / minify / validate XML
- **Base64** — encode / decode
- **UUID** — v4 generator
- **IP Lookup** — geolocate any IP (or your own) via ipapi.co

## Getting started

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check + production build
npm run preview  # preview the production build
```

## Project structure

```
src/
  App.vue                  # top bar, tabs, compare layout
  components/
    EditorPane.vue         # one editor pane (code/tree, toolbar, status)
    JsonTreeNode.vue       # recursive tree renderer
    XmlTool.vue            # XML beautify / minify / validate
    Base64Tool.vue
    UuidTool.vue
    IpLookupTool.vue       # IP geolocation via ipapi.co
  composables/
    useJsonEditor.ts       # buffer state, validation, beautify/minify
    xml.ts                 # XML format/validate helpers
  types/
    index.ts               # shared TypeScript types
```

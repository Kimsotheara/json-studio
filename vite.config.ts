import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  optimizeDeps: {
    // These are only imported lazily (on button click / tab open), so Vite's dev
    // server wouldn't discover them at startup. Pre-bundling them up front avoids
    // "Failed to fetch dynamically imported module" after a mid-session re-optimize.
    include: [
      'docx',
      'jspdf',
      'jspdf-autotable',
      'sql-formatter',
      'node-sql-parser/build/postgresql',
      'node-sql-parser/build/mysql',
      'node-sql-parser/build/mariadb',
      'node-sql-parser/build/sqlite',
      'node-sql-parser/build/transactsql',
      'node-sql-parser/build/db2',
      'node-sql-parser/build/bigquery',
      'node-sql-parser/build/snowflake',
      'node-sql-parser/build/redshift',
      'node-sql-parser/build/trino',
      'node-sql-parser/build/hive',
    ],
  },
})

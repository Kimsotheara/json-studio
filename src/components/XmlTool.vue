<script setup lang="ts">
import { computed, ref } from 'vue'
import { beautifyXml, minifyXml, validateXml } from '../composables/xml'

const text = ref(
  '<note>\n  <to>Tove</to>\n  <from>Jani</from>\n  <heading>Reminder</heading>\n  <body>Don\'t forget this weekend!</body>\n</note>',
)
const copied = ref(false)

const error = computed(() => validateXml(text.value))
const status = computed(() => {
  if (!text.value.trim()) return { label: 'Empty', cls: 'text-[var(--muted)]' }
  return error.value
    ? { label: 'Invalid XML', cls: 'text-[var(--red)]' }
    : { label: 'Valid XML', cls: 'text-[var(--green)]' }
})

function beautify() {
  if (!error.value) text.value = beautifyXml(text.value)
}
function minify() {
  if (!error.value) text.value = minifyXml(text.value)
}
async function copy() {
  await navigator.clipboard.writeText(text.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 900)
}
</script>

<template>
  <section
    class="flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-white"
  >
    <header class="flex items-center gap-1 border-b border-[var(--border)] px-3 py-2.5">
      <span class="text-sm font-semibold">XML Formatter</span>
      <div class="ml-auto flex gap-1">
        <button
          class="rounded-md border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-medium hover:bg-[var(--bg)]"
          @click="beautify"
        >
          Beautify
        </button>
        <button
          class="rounded-md border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-medium hover:bg-[var(--bg)]"
          @click="minify"
        >
          Minify
        </button>
        <button
          class="rounded-md px-2 py-1 text-sm text-[var(--muted)] hover:bg-[var(--gutter)]"
          title="Copy"
          @click="copy"
        >
          {{ copied ? '✓' : '⧉' }}
        </button>
        <button
          class="rounded-md px-2 py-1 text-sm text-[var(--muted)] hover:bg-[var(--gutter)]"
          title="Clear"
          @click="text = ''"
        >
          🗑
        </button>
      </div>
    </header>

    <textarea
      v-model="text"
      spellcheck="false"
      class="min-h-[420px] flex-1 resize-none whitespace-pre p-3 font-[var(--mono)] text-[12.5px] leading-[1.55] outline-none"
    ></textarea>

    <p
      v-if="error"
      class="border-t border-[var(--border)] bg-[#fafbfc] px-3 py-2 font-[var(--mono)] text-[11.5px] text-[var(--red)]"
    >
      ⚠ {{ error }}
    </p>

    <footer
      class="flex items-center border-t border-[var(--border)] bg-[#fafbfc] px-3 py-1.5 text-[11.5px] text-[var(--muted)]"
    >
      <span class="ml-auto flex items-center gap-1.5 font-semibold" :class="status.cls">
        <span class="h-2 w-2 rounded-full bg-current"></span>
        {{ status.label }}
      </span>
    </footer>
  </section>
</template>

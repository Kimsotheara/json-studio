<script setup lang="ts">
import { ref } from 'vue'

const input = ref('')
const output = ref('')
const copied = ref(false)

function encode() {
  try {
    output.value = btoa(unescape(encodeURIComponent(input.value)))
  } catch (err) {
    output.value = '⚠ ' + (err as Error).message
  }
}

function decode() {
  try {
    output.value = decodeURIComponent(escape(atob(input.value.trim())))
  } catch (err) {
    output.value = '⚠ ' + (err as Error).message
  }
}

function swap() {
  input.value = output.value
  output.value = ''
}

function clear() {
  input.value = ''
  output.value = ''
}

async function copy() {
  if (!output.value) return
  await navigator.clipboard.writeText(output.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 900)
}
</script>

<template>
  <section
    class="mx-auto flex max-w-[820px] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]"
  >
    <header class="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
      <span class="text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)]">BASE64</span>
      <h2 class="text-sm font-semibold">Encode / Decode</h2>
    </header>

    <div class="flex flex-col gap-4 p-4">
      <div>
        <label class="mb-1.5 block text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
          Input
        </label>
        <textarea
          v-model="input"
          rows="5"
          placeholder="Type or paste text / Base64…"
          class="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3 font-[family-name:var(--mono)] text-[12.5px] text-[var(--text)] caret-[var(--accent)] outline-none transition-colors focus:border-[var(--accent)]"
        ></textarea>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-[var(--tab-active-text)] transition-opacity hover:opacity-90"
          @click="encode"
        >
          Encode
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
        <button
          class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3.5 py-2 text-xs font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
          @click="decode"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
          Decode
        </button>
        <div class="ml-auto flex items-center gap-2">
          <button
            class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]"
            title="Move output to input"
            @click="swap"
          >
            ⇅ Swap
          </button>
          <button
            class="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs font-medium text-[var(--muted)] transition-colors hover:border-[var(--red)] hover:text-[var(--red)]"
            @click="clear"
          >
            Clear
          </button>
        </div>
      </div>

      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <label class="block text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
            Output
          </label>
          <button
            class="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--accent)] disabled:opacity-40"
            :disabled="!output"
            @click="copy"
          >
            <svg v-if="!copied" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            {{ copied ? 'Copied' : 'Copy' }}
          </button>
        </div>
        <textarea
          v-model="output"
          rows="5"
          placeholder="Result appears here…"
          readonly
          class="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3 font-[family-name:var(--mono)] text-[12.5px] text-[var(--text)] outline-none"
        ></textarea>
      </div>
    </div>
  </section>
</template>

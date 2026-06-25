<script setup lang="ts">
import { ref } from 'vue'

const count = ref(1)
const uuids = ref<string[]>([])
const copiedIndex = ref(-1)
const copiedAll = ref(false)

function generate() {
  const n = Math.min(50, Math.max(1, count.value || 1))
  uuids.value = Array.from({ length: n }, () => crypto.randomUUID())
}

async function copyOne(value: string, index: number) {
  await navigator.clipboard.writeText(value)
  copiedIndex.value = index
  setTimeout(() => (copiedIndex.value = -1), 900)
}

async function copyAll() {
  if (!uuids.value.length) return
  await navigator.clipboard.writeText(uuids.value.join('\n'))
  copiedAll.value = true
  setTimeout(() => (copiedAll.value = false), 900)
}
</script>

<template>
  <section
    class="mx-auto flex max-w-[820px] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]"
  >
    <header class="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
      <span class="text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)]">UUID</span>
      <h2 class="text-sm font-semibold">v4 Generator</h2>
      <button
        v-if="uuids.length"
        class="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
        @click="copyAll"
      >
        <svg v-if="!copiedAll" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
        {{ copiedAll ? 'Copied all' : 'Copy all' }}
      </button>
    </header>

    <div class="p-4">
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <button
          class="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-[var(--tab-active-text)] transition-opacity hover:opacity-90"
          @click="generate"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
          Generate
        </button>
        <div class="flex items-center gap-2 text-xs text-[var(--muted)]">
          <span>Count</span>
          <input
            v-model.number="count"
            type="number"
            min="1"
            max="50"
            class="w-[72px] rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-2.5 py-1.5 font-[family-name:var(--mono)] text-[var(--text)] caret-[var(--accent)] outline-none transition-colors focus:border-[var(--accent)]"
          />
          <span class="text-[var(--gutter-text)]">max 50</span>
        </div>
      </div>

      <div v-if="uuids.length" class="overflow-hidden rounded-lg border border-[var(--border)]">
        <button
          v-for="(id, i) in uuids"
          :key="i"
          class="group flex w-full items-center gap-3 border-b border-[var(--border)] px-3 py-2 text-left transition-colors last:border-b-0 odd:bg-[var(--panel-soft)] hover:bg-[var(--accent-soft)]"
          @click="copyOne(id, i)"
        >
          <span class="w-6 shrink-0 text-right font-[family-name:var(--mono)] text-[11px] text-[var(--gutter-text)]">{{ i + 1 }}</span>
          <span class="flex-1 font-[family-name:var(--mono)] text-[12.5px] break-all text-[var(--text)]">{{ id }}</span>
          <span class="shrink-0 text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100" :class="copiedIndex === i ? 'opacity-100 text-[var(--green)]' : ''">
            <svg v-if="copiedIndex !== i" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
        </button>
      </div>

      <div
        v-else
        class="rounded-lg border border-dashed border-[var(--border)] px-4 py-10 text-center text-[13px] text-[var(--muted)]"
      >
        Click <span class="font-semibold text-[var(--text)]">Generate</span> to create UUIDs · click any row to copy
      </div>
    </div>
  </section>
</template>

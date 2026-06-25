<script setup lang="ts">
import { ref } from 'vue'

const count = ref(1)
const uuids = ref<string[]>([])

function generate() {
  const n = Math.min(50, Math.max(1, count.value || 1))
  uuids.value = Array.from({ length: n }, () => crypto.randomUUID())
}
</script>

<template>
  <div class="max-w-[760px] rounded-xl border border-[var(--border)] bg-white p-[18px]">
    <h2 class="mb-3 text-[15px] font-semibold">UUID v4 Generator</h2>
    <div class="mb-3 flex gap-2">
      <button
        class="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium hover:bg-[var(--bg)]"
        @click="generate"
      >
        Generate
      </button>
      <input
        v-model.number="count"
        type="number"
        min="1"
        max="50"
        class="w-[90px] rounded-lg border border-[var(--border)] px-2.5 py-1.5 font-[var(--mono)] outline-none focus:border-[var(--accent)]"
      />
    </div>
    <pre
      v-if="uuids.length"
      class="m-0 rounded-lg bg-[var(--gutter)] p-3 font-[var(--mono)] text-[12.5px] break-all whitespace-pre-wrap"
      >{{ uuids.join('\n') }}</pre
    >
    <p v-else class="text-[13px] text-[var(--muted)]">Click Generate…</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const input = ref('')
const output = ref('')

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
</script>

<template>
  <div class="max-w-[760px] rounded-xl border border-[var(--border)] bg-white p-[18px]">
    <h2 class="mb-3 text-[15px] font-semibold">Base64 Encode / Decode</h2>
    <textarea
      v-model="input"
      rows="5"
      placeholder="Text or Base64…"
      class="mb-2.5 w-full resize-y rounded-lg border border-[var(--border)] p-2.5 font-[var(--mono)] text-[12.5px] outline-none focus:border-[var(--accent)]"
    ></textarea>
    <div class="mb-3 flex flex-wrap gap-2">
      <button
        class="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium hover:bg-[var(--bg)]"
        @click="encode"
      >
        Encode →
      </button>
      <button
        class="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium hover:bg-[var(--bg)]"
        @click="decode"
      >
        ← Decode
      </button>
      <button
        class="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium hover:bg-[var(--bg)]"
        @click="output = ''"
      >
        Clear
      </button>
    </div>
    <textarea
      v-model="output"
      rows="5"
      placeholder="Result…"
      readonly
      class="w-full resize-y rounded-lg border border-[var(--border)] p-2.5 font-[var(--mono)] text-[12.5px] outline-none"
    ></textarea>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TabKey } from './types'
import { useJsonEditor } from './composables/useJsonEditor'
import EditorPane from './components/EditorPane.vue'
import XmlTool from './components/XmlTool.vue'
import Base64Tool from './components/Base64Tool.vue'
import UuidTool from './components/UuidTool.vue'
import IpLookupTool from './components/IpLookupTool.vue'

const sample = JSON.stringify(
  {
    greeting: 'Welcome to JSON Studio',
    features: [
      'Tree View',
      'Code View',
      'Real-time Validation',
      'Formatting & Minification',
      'Side-by-Side Comparison',
    ],
    version: 1,
    active: true,
  },
  null,
  2,
)

const tabs: { key: TabKey; label: string }[] = [
  { key: 'editor', label: 'Editor' },
  { key: 'xml', label: 'XML' },
  { key: 'base64', label: 'Base64' },
  { key: 'uuid', label: 'UUID' },
  { key: 'iplookup', label: 'IP Lookup' },
]
const activeTab = ref<TabKey>('editor')

const compare = ref(false)
const left = useJsonEditor(sample)
const right = useJsonEditor('')

/** Lines present in one pane but not the other (1-based) — drives the diff gutter. */
function diffSet(own: string, other: string): Set<number> {
  const otherLines = new Set(other.split('\n'))
  const result = new Set<number>()
  own.split('\n').forEach((line, i) => {
    if (!otherLines.has(line)) result.add(i + 1)
  })
  return result
}

const leftDiff = computed(() =>
  compare.value ? diffSet(left.text.value, right.text.value) : undefined,
)
const rightDiff = computed(() =>
  compare.value ? diffSet(right.text.value, left.text.value) : undefined,
)

function copyRight() {
  right.text.value = left.text.value
}
function copyLeft() {
  left.text.value = right.text.value
}
function swap() {
  const tmp = left.text.value
  left.text.value = right.text.value
  right.text.value = tmp
}
</script>

<template>
  <header
    class="flex items-center gap-[18px] border-b border-[var(--border)] bg-white px-[18px] py-2.5"
  >
    <div class="flex items-center gap-2 font-bold">
      <span
        class="grid h-[22px] w-[22px] place-items-center rounded-md bg-gradient-to-br from-[var(--accent)] to-[#8f6cff] text-[11px] font-extrabold text-white"
      >
        { }
      </span>
      JSON Studio
    </div>
    <nav class="flex gap-1">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="rounded-md px-3 py-1.5 text-[13px] font-medium"
        :class="
          activeTab === t.key
            ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
            : 'text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]'
        "
        @click="activeTab = t.key"
      >
        {{ t.label }}
      </button>
    </nav>
    <div class="flex-1"></div>
    <button
      v-if="activeTab === 'editor'"
      class="flex items-center gap-2 text-[13px] text-[var(--muted)]"
      @click="compare = !compare"
    >
      Compare
      <span
        class="relative h-5 w-9 rounded-full transition-colors"
        :class="compare ? 'bg-[var(--accent)]' : 'bg-[#d6dae0]'"
      >
        <span
          class="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
          :class="compare ? 'left-[18px]' : 'left-0.5'"
        ></span>
      </span>
    </button>
  </header>

  <main class="p-4">
    <div v-if="activeTab === 'editor'" class="flex items-stretch gap-4">
      <EditorPane :editor="left" :diff-lines="leftDiff" />

      <div v-if="compare" class="flex flex-col justify-center gap-2.5">
        <button
          class="h-[34px] w-[34px] rounded-[9px] border border-[var(--border)] bg-white text-[15px] text-[var(--muted)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
          title="Copy left → right"
          @click="copyRight"
        >
          →
        </button>
        <button
          class="h-[34px] w-[34px] rounded-[9px] border border-[var(--border)] bg-white text-[15px] text-[var(--muted)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
          title="Swap"
          @click="swap"
        >
          ⇄
        </button>
        <button
          class="h-[34px] w-[34px] rounded-[9px] border border-[var(--border)] bg-white text-[15px] text-[var(--muted)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
          title="Copy right → left"
          @click="copyLeft"
        >
          ←
        </button>
      </div>

      <EditorPane v-if="compare" :editor="right" :diff-lines="rightDiff" />
    </div>

    <XmlTool v-else-if="activeTab === 'xml'" />
    <Base64Tool v-else-if="activeTab === 'base64'" />
    <UuidTool v-else-if="activeTab === 'uuid'" />
    <IpLookupTool v-else-if="activeTab === 'iplookup'" />
  </main>
</template>

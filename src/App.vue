<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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

const autoFormat = ref(true)
const left = useJsonEditor(sample)
const right = useJsonEditor('')

/** Beautify JSON text; returns '' for empty and null when it doesn't parse. */
function tryBeautify(src: string): string | null {
  const trimmed = src.trim()
  if (!trimmed) return ''
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2)
  } catch {
    return null
  }
}

// With auto-format on, mirror a beautified copy of the SOURCE pane into the
// COMPARE pane as the user types or pastes.
watch(
  [() => left.text.value, autoFormat],
  () => {
    if (!autoFormat.value) return
    const formatted = tryBeautify(left.text.value)
    if (formatted !== null) right.text.value = formatted
  },
  { immediate: true },
)

/** Dark mode (Dracula), persisted and applied to <html>. Defaults to dark. */
const storedTheme = localStorage.getItem('json-studio-theme')
const dark = ref(storedTheme ? storedTheme === 'dark' : true)
watch(
  dark,
  (on) => {
    document.documentElement.classList.toggle('dark', on)
    localStorage.setItem('json-studio-theme', on ? 'dark' : 'light')
  },
  { immediate: true },
)

/** Lines present in one pane but not the other (1-based) — drives the diff gutter. */
function diffSet(own: string, other: string): Set<number> {
  const otherLines = new Set(other.split('\n'))
  const result = new Set<number>()
  own.split('\n').forEach((line, i) => {
    if (!otherLines.has(line)) result.add(i + 1)
  })
  return result
}

// In auto-format mode both panes hold the same JSON, so the line diff would be
// pure noise — only show it when auto-format is off (manual compare).
const leftDiff = computed(() =>
  autoFormat.value ? undefined : diffSet(left.text.value, right.text.value),
)
const rightDiff = computed(() =>
  autoFormat.value ? undefined : diffSet(right.text.value, left.text.value),
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
    class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--border)] bg-[var(--panel)] px-3 py-2.5 sm:px-5"
  >
    <div class="flex shrink-0 items-center gap-2">
      <span
        class="grid h-7 w-7 place-items-center rounded-lg bg-[var(--accent)] text-[13px] font-bold text-white"
      >
        { }
      </span>
      <span class="text-[15px] font-bold tracking-tight">JSON <span class="font-normal text-[var(--muted)]">Studio</span></span>
    </div>

    <nav class="order-last -mx-1 flex w-full gap-0.5 overflow-x-auto px-1 sm:order-none sm:w-auto">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors"
        :class="
          activeTab === t.key
            ? 'bg-[var(--tab-active-bg)] text-[var(--tab-active-text)]'
            : 'text-[var(--muted)] hover:bg-[var(--ctrl-bg)] hover:text-[var(--text)]'
        "
        @click="activeTab = t.key"
      >
        {{ t.label }}
      </button>
    </nav>

    <div class="ml-auto flex shrink-0 items-center gap-3">
      <button
        v-if="activeTab === 'editor'"
        class="flex items-center gap-2 text-[13px] font-medium text-[var(--muted)]"
        title="Auto-format the SOURCE pane into the COMPARE pane"
        @click="autoFormat = !autoFormat"
      >
        Auto-format
        <span
          class="relative h-5 w-9 rounded-full transition-colors"
          :class="autoFormat ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'"
        >
          <span
            class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all"
            :class="autoFormat ? 'left-[18px]' : 'left-0.5'"
          ></span>
        </span>
      </button>

      <button
        class="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--ctrl-bg)] hover:text-[var(--text)]"
        :title="dark ? 'Switch to light mode' : 'Switch to dark mode'"
        @click="dark = !dark"
      >
        <svg v-if="!dark" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      </button>
    </div>
  </header>

  <main class="p-3 sm:p-4">
    <div
      v-if="activeTab === 'editor'"
      class="flex flex-col items-stretch gap-4 md:flex-row"
    >
      <EditorPane :editor="left" label="SOURCE" :diff-lines="leftDiff" />

      <div class="flex flex-row justify-center gap-2.5 md:flex-col">
        <button
          class="grid h-[34px] w-[34px] place-items-center rounded-[9px] border border-[var(--border)] bg-[var(--panel)] text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)]"
          title="Swap"
          @click="swap"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
          </svg>
        </button>
        <button
          class="grid h-[34px] w-[34px] place-items-center rounded-[9px] border border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
          title="Copy left → right"
          @click="copyRight"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        <button
          class="grid h-[34px] w-[34px] place-items-center rounded-[9px] border border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
          title="Copy right → left"
          @click="copyLeft"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </button>
      </div>

      <EditorPane
        :editor="right"
        label="COMPARE"
        :diff-lines="rightDiff"
        :readonly="autoFormat"
      />
    </div>

    <XmlTool v-else-if="activeTab === 'xml'" />
    <Base64Tool v-else-if="activeTab === 'base64'" />
    <UuidTool v-else-if="activeTab === 'uuid'" />
    <IpLookupTool v-else-if="activeTab === 'iplookup'" />
  </main>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useXmlEditor } from '../composables/useXmlEditor'
import { beautifyXml, validateXml } from '../composables/xml'
import XmlPane from './XmlPane.vue'

const sample =
  '<note>\n  <to>Tove</to>\n  <from>Jani</from>\n  <heading>Reminder</heading>\n  <body>Don\'t forget this weekend!</body>\n</note>'

const autoFormat = ref(true)
const left = useXmlEditor(sample)
const right = useXmlEditor('')

/** Beautify XML text; returns '' for empty and null when it's invalid. */
function tryBeautify(src: string): string | null {
  if (!src.trim()) return ''
  return validateXml(src) ? null : beautifyXml(src)
}

// With auto-format on, mirror a beautified copy of the source (left) pane into
// the compare (right) pane as the user types or pastes.
watch(
  [() => left.text.value, autoFormat],
  () => {
    if (!autoFormat.value) return
    const formatted = tryBeautify(left.text.value)
    if (formatted !== null) right.text.value = formatted
  },
  { immediate: true },
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
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-end px-1">
      <button
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
    </div>

    <div class="flex flex-col items-stretch gap-4 md:flex-row">
      <XmlPane :editor="left" label="SOURCE" />

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

      <XmlPane :editor="right" label="COMPARE" :readonly="autoFormat" />
    </div>
  </div>
</template>

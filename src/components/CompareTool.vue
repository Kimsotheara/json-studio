<script setup lang="ts">
import { computed } from 'vue'
import { useCompare, type TextFormat } from '../composables/useTextEditor'
import EditorPane from './EditorPane.vue'
import ToggleSwitch from './ui/ToggleSwitch.vue'
import TransferButtons from './ui/TransferButtons.vue'

/**
 * SOURCE ↔ COMPARE editor for any text format. To support a new format, describe
 * it as a TextFormat and pass it in — see JsonTool.vue and XmlTool.vue.
 */
const props = defineProps<{
  format: TextFormat
  /** Returns one HTML string per source line (see composables/highlight). */
  highlight: (src: string) => string[]
  /** Text the source pane starts with. */
  sample?: string
  /** Adds the Code / Tree switch. JSON only. */
  tree?: boolean
}>()

const { left, right, autoFormat, copyRight, copyLeft, swap } = useCompare(props.format, props.sample)

/** Lines present in one pane but not the other (1-based) — drives the diff gutter. */
function diffSet(own: string, other: string): Set<number> {
  const otherLines = new Set(other.split('\n'))
  const result = new Set<number>()
  own.split('\n').forEach((line, i) => {
    if (!otherLines.has(line)) result.add(i + 1)
  })
  return result
}

// In auto-format mode the compare pane is just a tidy copy of the source, so a
// line diff would be pure noise — only show it for a manual compare.
const leftDiff = computed(() => (autoFormat.value ? undefined : diffSet(left.text.value, right.text.value)))
const rightDiff = computed(() => (autoFormat.value ? undefined : diffSet(right.text.value, left.text.value)))
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-end px-1">
      <ToggleSwitch v-model="autoFormat" title="Auto-format the SOURCE pane into the COMPARE pane">
        Auto-format
      </ToggleSwitch>
    </div>

    <div class="flex flex-col items-stretch gap-4 md:flex-row">
      <EditorPane :editor="left" label="SOURCE" :highlight="highlight" :tree="tree" :diff-lines="leftDiff" />
      <TransferButtons @swap="swap" @copy-right="copyRight" @copy-left="copyLeft" />
      <EditorPane
        :editor="right"
        label="COMPARE"
        :highlight="highlight"
        :tree="tree"
        :diff-lines="rightDiff"
        :readonly="autoFormat"
      />
    </div>
  </div>
</template>

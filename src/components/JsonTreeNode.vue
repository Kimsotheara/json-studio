<script setup lang="ts">
import { ref } from 'vue'
import type { JsonValue } from '../types'

defineProps<{
  nodeKey?: string
  value: JsonValue
}>()

const open = ref(true)

function kind(v: JsonValue): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v
}

function valueClass(v: JsonValue): string {
  switch (kind(v)) {
    case 'string':
      return 'text-[var(--tok-string)]'
    case 'number':
      return 'text-[var(--tok-number)]'
    case 'boolean':
      return 'text-[var(--tok-bool)]'
    default:
      return 'text-[var(--tok-null)]'
  }
}

function entries(v: JsonValue): [string, JsonValue][] {
  if (Array.isArray(v)) return v.map((item, i) => [String(i), item])
  if (v && typeof v === 'object') return Object.entries(v)
  return []
}

function isBranch(v: JsonValue): boolean {
  return v !== null && typeof v === 'object'
}

function summary(v: JsonValue): string {
  if (Array.isArray(v)) return `[ ${v.length} ]`
  if (v && typeof v === 'object') return `{ ${Object.keys(v).length} }`
  return ''
}
</script>

<template>
  <div v-if="isBranch(value)" class="ml-3.5">
    <button class="flex items-center text-left" @click="open = !open">
      <span
        class="mr-1 inline-block w-3 text-[var(--gutter-text)] transition-transform"
        :class="open ? 'rotate-90' : ''"
      >
        ▸
      </span>
      <span v-if="nodeKey !== undefined" class="font-semibold text-[var(--tok-key)]">"{{ nodeKey }}"</span>
      <span v-if="nodeKey !== undefined" class="text-[var(--muted)]">:&nbsp;</span>
      <span class="text-[var(--gutter-text)]">{{ summary(value) }}</span>
    </button>
    <div v-show="open" class="ml-1">
      <JsonTreeNode v-for="[k, v] in entries(value)" :key="k" :node-key="k" :value="v" />
    </div>
  </div>

  <div v-else class="ml-7">
    <span v-if="nodeKey !== undefined" class="font-semibold text-[var(--tok-key)]">"{{ nodeKey }}"</span>
    <span v-if="nodeKey !== undefined" class="text-[var(--muted)]">:&nbsp;</span>
    <span :class="valueClass(value)">
      <template v-if="kind(value) === 'string'">"{{ value }}"</template>
      <template v-else>{{ value === null ? 'null' : value }}</template>
    </span>
  </div>
</template>

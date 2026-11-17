<script setup lang="ts">
import { highlightLines } from '../composables/highlight'
import { jsonFormat } from '../composables/useTextEditor'
import CompareTool from './CompareTool.vue'

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
</script>

<template>
  <CompareTool :format="jsonFormat" :highlight="highlightLines" :sample="sample" tree />
</template>

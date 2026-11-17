<script setup lang="ts">
import { highlightXmlLines } from '../composables/highlight'
import { xmlFormat } from '../composables/useTextEditor'
import CompareTool from './CompareTool.vue'

const sample =
  '<note>\n  <to>Tove</to>\n  <from>Jani</from>\n  <heading>Reminder</heading>\n  <body>Don\'t forget this weekend!</body>\n</note>'
</script>

<template>
  <CompareTool :format="xmlFormat" :highlight="highlightXmlLines" :sample="sample" />
</template>

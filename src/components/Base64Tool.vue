<script setup lang="ts">
import { ref } from 'vue'
import AppButton from './ui/AppButton.vue'
import AppIcon from './ui/AppIcon.vue'
import AppPanel from './ui/AppPanel.vue'
import CopyButton from './ui/CopyButton.vue'
import FieldLabel from './ui/FieldLabel.vue'
import TextInput from './ui/TextInput.vue'

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

function swap() {
  input.value = output.value
  output.value = ''
}

function clear() {
  input.value = ''
  output.value = ''
}
</script>

<template>
  <AppPanel narrow label="BASE64" title="Encode / Decode">
    <div class="flex flex-col gap-4 p-4">
      <div>
        <FieldLabel>Input</FieldLabel>
        <TextInput v-model="input" multiline mono rows="5" placeholder="Type or paste text / Base64…" />
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <AppButton variant="primary" size="md" @click="encode">
          Encode
          <AppIcon name="arrow-right" :size="14" :stroke-width="2.2" />
        </AppButton>
        <AppButton variant="outline" size="md" @click="decode">
          <AppIcon name="arrow-left" :size="14" :stroke-width="2.2" />
          Decode
        </AppButton>
        <div class="ml-auto flex items-center gap-2">
          <AppButton variant="outline" size="md" muted title="Move output to input" @click="swap">⇅ Swap</AppButton>
          <AppButton variant="outline" size="md" danger @click="clear">Clear</AppButton>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between">
          <FieldLabel>Output</FieldLabel>
          <CopyButton :text="output" variant="label" />
        </div>
        <TextInput v-model="output" multiline mono rows="5" placeholder="Result appears here…" readonly />
      </div>
    </div>
  </AppPanel>
</template>

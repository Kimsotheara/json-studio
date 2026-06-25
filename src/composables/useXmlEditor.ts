import { computed, ref } from 'vue'
import { beautifyXml, minifyXml, validateXml } from './xml'

/**
 * State and operations for a single XML editor pane: the text buffer,
 * byte/line counts, validation and format actions. Mirrors useJsonEditor.
 */
export function useXmlEditor(initial = '') {
  const text = ref(initial)

  const lineCount = computed(() => text.value.split('\n').length)
  const byteSize = computed(() => new Blob([text.value]).size)
  const error = computed(() => validateXml(text.value))

  const validation = computed(() => {
    if (!text.value.trim()) return { state: 'empty' as const, label: 'Empty' }
    return error.value
      ? { state: 'invalid' as const, label: 'Invalid XML' }
      : { state: 'valid' as const, label: 'Valid XML' }
  })

  function beautify() {
    if (!error.value) text.value = beautifyXml(text.value)
  }
  function minify() {
    if (!error.value) text.value = minifyXml(text.value)
  }
  function clear() {
    text.value = ''
  }

  return { text, lineCount, byteSize, error, validation, beautify, minify, clear }
}

export type XmlEditor = ReturnType<typeof useXmlEditor>

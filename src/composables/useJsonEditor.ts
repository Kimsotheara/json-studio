import { computed, ref } from 'vue'
import type { ValidationResult } from '../types'

/**
 * Encapsulates the state and operations for a single JSON editor pane:
 * the text buffer, cursor position, byte/line counts and validation.
 */
export function useJsonEditor(initial = '') {
  const text = ref(initial)
  const cursor = ref({ line: 1, col: 1 })

  const lineCount = computed(() => text.value.split('\n').length)

  const byteSize = computed(() => new Blob([text.value]).size)

  const validation = computed<ValidationResult>(() => {
    const trimmed = text.value.trim()
    if (!trimmed) return { state: 'empty', message: 'Empty' }
    try {
      JSON.parse(trimmed)
      return { state: 'valid', message: 'Valid JSON' }
    } catch (err) {
      return { state: 'invalid', message: (err as Error).message }
    }
  })

  function updateCursor(el: HTMLTextAreaElement) {
    const pos = el.selectionStart
    const before = text.value.slice(0, pos)
    cursor.value = {
      line: before.split('\n').length,
      col: pos - before.lastIndexOf('\n'),
    }
  }

  function beautify(indent = 2) {
    try {
      text.value = JSON.stringify(JSON.parse(text.value), null, indent)
      return true
    } catch {
      return false
    }
  }

  function minify() {
    try {
      text.value = JSON.stringify(JSON.parse(text.value))
      return true
    } catch {
      return false
    }
  }

  function clear() {
    text.value = ''
  }

  return {
    text,
    cursor,
    lineCount,
    byteSize,
    validation,
    updateCursor,
    beautify,
    minify,
    clear,
  }
}

export type JsonEditor = ReturnType<typeof useJsonEditor>

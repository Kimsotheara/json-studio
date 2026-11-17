import { computed, ref, watch } from 'vue'
import { beautifyXml, minifyXml, validateXml } from './xml'

/** What an editor pane needs to know about a text format. */
export interface TextFormat {
  /** Shown in the status bar: "Valid JSON", "Invalid XML". */
  name: string
  /** Error message, or null when the text is valid. Never called with blank text. */
  validate(src: string): string | null
  beautify(src: string): string
  minify(src: string): string
}

export const jsonFormat: TextFormat = {
  name: 'JSON',
  validate(src) {
    try {
      JSON.parse(src)
      return null
    } catch (err) {
      return (err as Error).message
    }
  },
  beautify: (src) => JSON.stringify(JSON.parse(src), null, 2),
  minify: (src) => JSON.stringify(JSON.parse(src)),
}

export const xmlFormat: TextFormat = {
  name: 'XML',
  validate: validateXml,
  beautify: beautifyXml,
  minify: minifyXml,
}

export interface Validation {
  state: 'valid' | 'invalid' | 'empty'
  /** "Valid JSON" / "Invalid JSON" / "Empty" */
  label: string
  /** The parser's error message when invalid. */
  message: string
}

/**
 * State and actions for one editor pane of any format: the text buffer,
 * caret position, line / byte counts, validation and format actions.
 */
export function useTextEditor(format: TextFormat, initial = '') {
  const text = ref(initial)
  const cursor = ref({ line: 1, col: 1 })

  const lineCount = computed(() => text.value.split('\n').length)
  const byteSize = computed(() => new Blob([text.value]).size)

  const validation = computed<Validation>(() => {
    if (!text.value.trim()) return { state: 'empty', label: 'Empty', message: '' }
    const error = format.validate(text.value)
    return error
      ? { state: 'invalid', label: `Invalid ${format.name}`, message: error }
      : { state: 'valid', label: `Valid ${format.name}`, message: '' }
  })

  function beautify() {
    if (validation.value.state === 'valid') text.value = format.beautify(text.value)
  }
  function minify() {
    if (validation.value.state === 'valid') text.value = format.minify(text.value)
  }
  function clear() {
    text.value = ''
  }

  return { format, text, cursor, lineCount, byteSize, validation, beautify, minify, clear }
}

export type TextEditor = ReturnType<typeof useTextEditor>

/**
 * Two editors side by side (SOURCE and COMPARE) with the swap / copy actions.
 * With auto-format on, a beautified copy of the source is mirrored into the
 * compare pane as the user types; invalid text leaves the last good copy in place.
 */
export function useCompare(format: TextFormat, sample = '') {
  const left = useTextEditor(format, sample)
  const right = useTextEditor(format, '')
  const autoFormat = ref(true)

  watch(
    [left.text, autoFormat],
    () => {
      if (!autoFormat.value) return
      const state = left.validation.value.state
      if (state === 'empty') right.text.value = ''
      else if (state === 'valid') right.text.value = format.beautify(left.text.value)
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

  return { left, right, autoFormat, copyRight, copyLeft, swap }
}

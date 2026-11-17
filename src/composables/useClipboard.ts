import { ref } from 'vue'

/**
 * Copy text to the clipboard and flag it as "copied" for a moment.
 *
 *   const { copied, copy } = useClipboard()
 *   copy(text)            // copied.value === true for ~1 s
 *
 * For lists, pass a key to know which item was copied:
 *   copy(text, index)     // copied.value === index
 */
export function useClipboard(resetMs = 900) {
  const copied = ref<string | number | boolean>(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  async function copy(text: string, key: string | number | true = true) {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      return // clipboard blocked (insecure context / permission) — nothing to flag
    }
    copied.value = key
    clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), resetMs)
  }

  return { copied, copy }
}

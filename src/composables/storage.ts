import { onBeforeUnmount, watch, type WatchSource } from 'vue'

/**
 * localStorage helpers. Storage is a per-browser convenience and can be
 * unavailable (private windows, blocked site data), so nothing here ever throws.
 */

export function loadStored<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function saveStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable — fine */
  }
}

/** Save `value()` under `key` shortly after any of `sources` changes (deep). */
export function useAutoSave(key: string, sources: WatchSource[] | object, value: () => unknown, delay = 400) {
  let timer: ReturnType<typeof setTimeout> | undefined
  watch(
    sources as WatchSource[],
    () => {
      clearTimeout(timer)
      timer = setTimeout(() => saveStored(key, value()), delay)
    },
    { deep: true },
  )
  onBeforeUnmount(() => clearTimeout(timer))
}

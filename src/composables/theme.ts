import { ref, watch } from 'vue'

/** Dark mode (Dracula), shared by the whole app, persisted and applied to <html>. Defaults to dark. */
const stored = (() => {
  try {
    return localStorage.getItem('json-studio-theme')
  } catch {
    return null
  }
})()

export const dark = ref(stored ? stored === 'dark' : true)

watch(
  dark,
  (on) => {
    document.documentElement.classList.toggle('dark', on)
    try {
      localStorage.setItem('json-studio-theme', on ? 'dark' : 'light')
    } catch {
      /* storage unavailable — fine */
    }
  },
  { immediate: true },
)

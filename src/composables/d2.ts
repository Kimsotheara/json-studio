import { onBeforeUnmount, ref, watch } from 'vue'
import type { D2 } from '@terrastruct/d2'

// The D2 WASM bundle is ~8 MB, so it is only loaded when a tab that needs it
// opens — and shared, so the D2 and ERD tabs don't each load their own copy.
let d2Instance: Promise<D2> | null = null
function getD2(): Promise<D2> {
  d2Instance ??= import('@terrastruct/d2').then((m) => new m.D2())
  return d2Instance
}

export interface D2Options {
  layout: 'dagre' | 'elk'
  dark: boolean
  /** Hand-drawn style */
  sketch?: boolean
}

/** Compile D2 code and render it to an SVG string. Throws on invalid code. */
export async function renderD2(code: string, o: D2Options): Promise<string> {
  const d2 = await getD2()
  const result = await d2.compile(code, { options: { layout: o.layout, sketch: !!o.sketch } })
  return d2.render(result.diagram, {
    ...result.renderOptions,
    sketch: !!o.sketch,
    themeID: o.dark ? 200 : 0,
    noXMLTag: true,
    pad: 40,
  })
}

/** D2 compile errors arrive as a JSON array of { errmsg }; show one per line. */
function formatD2Error(err: unknown): string {
  const msg = (err as Error)?.message ?? String(err)
  try {
    const list = JSON.parse(msg) as { errmsg?: string }[]
    if (Array.isArray(list)) return list.map((e) => e.errmsg ?? JSON.stringify(e)).join('\n')
  } catch {
    /* not JSON — use as-is */
  }
  return msg
}

/**
 * Live preview: re-renders (debounced) whenever the code or options change.
 * On an error the last good SVG is kept so the preview doesn't flash away mid-edit.
 */
export function useD2Render(code: () => string, options: () => D2Options, delay = 350) {
  const svg = ref('')
  const error = ref('')
  const rendering = ref(false)

  // Each render gets a sequence number so a slow, stale render never
  // overwrites the result of a newer one.
  let seq = 0
  async function render() {
    const id = ++seq
    const src = code()
    if (!src.trim()) {
      svg.value = ''
      error.value = ''
      rendering.value = false
      return
    }
    rendering.value = true
    try {
      const out = await renderD2(src, options())
      if (id !== seq) return
      svg.value = out
      error.value = ''
    } catch (err) {
      if (id !== seq) return
      error.value = formatD2Error(err)
    } finally {
      if (id === seq) rendering.value = false
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  watch(
    [code, options],
    () => {
      clearTimeout(timer)
      timer = setTimeout(render, delay)
    },
    { immediate: true, deep: true },
  )
  onBeforeUnmount(() => clearTimeout(timer))

  return { svg, error, rendering }
}

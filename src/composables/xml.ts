/** Validate XML using the browser's DOMParser. Returns an error message or null. */
export function validateXml(xml: string): string | null {
  if (!xml.trim()) return null
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const err = doc.querySelector('parsererror')
  return err ? err.textContent?.trim() || 'Invalid XML' : null
}

/** Pretty-print XML with the given indent unit (default two spaces). */
export function beautifyXml(xml: string, indent = '  '): string {
  // Put every tag on its own line first.
  const withBreaks = xml
    .replace(/\r?\n/g, '')
    .replace(/>\s*</g, '><')
    .replace(/></g, '>\n<')

  let pad = 0
  const out: string[] = []
  for (const raw of withBreaks.split('\n')) {
    const line = raw.trim()
    if (!line) continue

    const isClosing = /^<\//.test(line)
    const isSelfContained = /^<[^>]+\/>$/.test(line) // <tag/>
    const isDeclaration = /^<\?|^<!/.test(line) // <?xml ?> or <!-- -->
    const hasInlineClose = /^<([\w:-]+)(\s[^>]*)?>.*<\/\1>$/.test(line) // <a>x</a>

    if (isClosing) pad = Math.max(pad - 1, 0)

    out.push(indent.repeat(pad) + line)

    if (
      !isClosing &&
      !isSelfContained &&
      !isDeclaration &&
      !hasInlineClose &&
      /^<[^!?]/.test(line)
    ) {
      pad++
    }
  }
  return out.join('\n')
}

/** Collapse XML to a single line. */
export function minifyXml(xml: string): string {
  return xml
    .replace(/\r?\n/g, '')
    .replace(/>\s+</g, '><')
    .trim()
}

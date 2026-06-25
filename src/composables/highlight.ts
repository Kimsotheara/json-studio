/**
 * Lightweight JSON syntax highlighter.
 *
 * Produces one HTML string per source line, with tokens wrapped in
 * `<span class="tk-*">` so the code overlay can colour keys, strings,
 * numbers, booleans, null and punctuation. JSON strings never span
 * multiple lines, so highlighting line-by-line is both correct and cheap.
 */

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' }
const escape = (s: string) => s.replace(/[&<>]/g, (c) => ESC[c])

const TOKEN =
  /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}\[\],])/g

function highlightLine(line: string): string {
  return escape(line).replace(TOKEN, (match, str, colon, keyword, num, punc) => {
    if (str !== undefined) {
      // A string immediately followed by a colon is an object key.
      return colon !== undefined
        ? `<span class="tk-key">${str}</span>${colon}`
        : `<span class="tk-str">${str}</span>`
    }
    if (keyword !== undefined) {
      return `<span class="${keyword === 'null' ? 'tk-null' : 'tk-bool'}">${keyword}</span>`
    }
    if (num !== undefined) return `<span class="tk-num">${num}</span>`
    if (punc !== undefined) return `<span class="tk-punc">${punc}</span>`
    return match
  })
}

export function highlightLines(src: string): string[] {
  return src.split('\n').map(highlightLine)
}

/* ---- XML ---- */

function highlightXmlLine(line: string): string {
  return escape(line).replace(
    /(&lt;!--.*?--&gt;)|(&lt;[!?/]?)([\w:.-]+)(.*?)(\/?&gt;)/g,
    (_match, comment, open, name, attrs, close) => {
      if (comment !== undefined) return `<span class="tk-null">${comment}</span>`
      const attrHtml = (attrs || '').replace(
        /([\w:.-]+)(=)("[^"]*")/g,
        (_a: string, attrName: string, eq: string, value: string) =>
          `<span class="tk-bool">${attrName}</span><span class="tk-punc">${eq}</span><span class="tk-str">${value}</span>`,
      )
      return `<span class="tk-punc">${open}</span><span class="tk-key">${name}</span>${attrHtml}<span class="tk-punc">${close}</span>`
    },
  )
}

export function highlightXmlLines(src: string): string[] {
  return src.split('\n').map(highlightXmlLine)
}

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

/* ---- D2 ---- */

const D2_TOKEN =
  /(#.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(&lt;-&gt;|--&gt;|-&gt;|&lt;-|--)|([\w.\-$]+)(\s*:)|([{}\[\];])/g

function highlightD2Line(line: string): string {
  return escape(line).replace(D2_TOKEN, (match, comment, str, arrow, key, colon, punc) => {
    if (comment !== undefined) return `<span class="tk-null">${comment}</span>`
    if (str !== undefined) return `<span class="tk-str">${str}</span>`
    if (arrow !== undefined) return `<span class="tk-num">${arrow}</span>`
    if (key !== undefined) return `<span class="tk-key">${key}</span><span class="tk-punc">${colon}</span>`
    if (punc !== undefined) return `<span class="tk-punc">${punc}</span>`
    return match
  })
}

export function highlightD2Lines(src: string): string[] {
  return src.split('\n').map(highlightD2Line)
}

/* ---- SQL ---- */

const SQL_KEYWORDS = new Set(
  (
    'select from where and or not in is null as on join inner left right full outer cross ' +
    'group by order having limit offset union all distinct insert into values update set ' +
    'delete create table alter drop index view primary key foreign references default ' +
    'case when then else end exists between like ilike asc desc with returning top fetch ' +
    'next rows only over partition count sum avg min max cast coalesce true false begin ' +
    'commit rollback transaction grant revoke truncate database schema if procedure function'
  ).split(' '),
)

const SQL_TOKEN =
  /(--.*$|\/\*.*?\*\/)|('(?:''|[^'])*'?|"(?:""|[^"])*"?|`[^`]*`?)|\b(\d+(?:\.\d+)?)\b|([A-Za-z_]\w*)|([(),;*=<>!+\-\/%.]+)/g

function sqlToken(comment?: string, str?: string, num?: string, word?: string, punc?: string): string {
  if (comment !== undefined) return `<span class="tk-null">${escape(comment)}</span>`
  if (str !== undefined) return `<span class="tk-str">${escape(str)}</span>`
  if (num !== undefined) return `<span class="tk-num">${num}</span>`
  if (word !== undefined)
    return SQL_KEYWORDS.has(word.toLowerCase()) ? `<span class="tk-bool">${word}</span>` : word
  return `<span class="tk-punc">${escape(punc ?? '')}</span>`
}

// Tokenize the raw line (so `<`/`>` operators match) and escape every piece,
// including the gaps between tokens.
function highlightSqlLine(line: string): string {
  let out = ''
  let last = 0
  for (const m of line.matchAll(SQL_TOKEN)) {
    out += escape(line.slice(last, m.index)) + sqlToken(m[1], m[2], m[3], m[4], m[5])
    last = m.index + m[0].length
  }
  return out + escape(line.slice(last))
}

export function highlightSqlLines(src: string): string[] {
  return src.split('\n').map(highlightSqlLine)
}

/* ---- DBML ---- */

const DBML_KEYWORDS = new Set(
  'table ref enum project note indexes tablegroup as pk increment unique not null default primary key delete update cascade restrict headercolor'.split(' '),
)

const DBML_TOKEN =
  /(\/\/.*$)|('(?:\\.|[^'\\])*'?|"(?:\\.|[^"\\])*"?|`[^`]*`?)|\b(\d+(?:\.\d+)?)\b|([A-Za-z_]\w*)|(<>|[<>\-](?=\s)|[{}\[\]():,.])/g

function highlightDbmlLine(line: string): string {
  let out = ''
  let last = 0
  for (const m of line.matchAll(DBML_TOKEN)) {
    const [, comment, str, num, word, punc] = m
    let html: string
    if (comment !== undefined) html = `<span class="tk-null">${escape(comment)}</span>`
    else if (str !== undefined) html = `<span class="tk-str">${escape(str)}</span>`
    else if (num !== undefined) html = `<span class="tk-num">${num}</span>`
    else if (word !== undefined)
      html = DBML_KEYWORDS.has(word.toLowerCase()) ? `<span class="tk-bool">${word}</span>` : escape(word)
    else html = `<span class="tk-punc">${escape(punc ?? '')}</span>`
    out += escape(line.slice(last, m.index)) + html
    last = m.index + m[0].length
  }
  return out + escape(line.slice(last))
}

export function highlightDbmlLines(src: string): string[] {
  return src.split('\n').map(highlightDbmlLine)
}

/**
 * PDF and Word (.docx) export for the API documentation.
 *
 * Both formats are rendered from the same outline of blocks, so they always
 * contain the same content as the Markdown. The PDF/Word libraries are large,
 * so they're imported only when the user clicks a download button.
 *
 * Khmer: Word shapes Khmer itself, so the .docx only needs a Khmer
 * complex-script font. jsPDF cannot shape Khmer (subscript consonants and
 * vowel signs come out wrong even with a Khmer font embedded), so documents
 * containing Khmer are printed through the browser, which shapes it correctly.
 */
import { buildCurl, type DocField, type DocModel } from './apiDocs'

type Block =
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'label'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }

const pretty = (json: string) => {
  try {
    return JSON.stringify(JSON.parse(json), null, 2)
  } catch {
    return json
  }
}

function fieldTable(fields: DocField[], withRequired: boolean): Block {
  const type = (f: DocField) => (f.format ? `${f.type} (${f.format})` : f.type)
  return withRequired
    ? {
        kind: 'table',
        head: ['Field', 'Type', 'Required', 'Description', 'Example'],
        rows: fields.map((f) => [f.path, type(f), f.required ? 'Yes' : 'No', f.description, f.example]),
      }
    : {
        kind: 'table',
        head: ['Field', 'Type', 'Description', 'Example'],
        rows: fields.map((f) => [f.path, type(f), f.description, f.example]),
      }
}

function outline(m: DocModel): Block[] {
  const { input } = m
  const blocks: Block[] = [{ kind: 'h1', text: input.title.trim() || `${input.method} ${m.url.path}` }]
  if (input.description.trim()) blocks.push({ kind: 'p', text: input.description.trim() })

  blocks.push({ kind: 'h2', text: 'Endpoint' }, { kind: 'code', text: `${input.method} ${m.url.path}` })
  if (m.url.server) blocks.push({ kind: 'p', text: `Base URL: ${m.url.server}` })

  if (m.headers.length) blocks.push({ kind: 'h2', text: 'Headers' }, fieldTable(m.headers, true))
  if (m.pathParams.length) blocks.push({ kind: 'h2', text: 'Path Parameters' }, fieldTable(m.pathParams, true))
  if (m.queryParams.length) blocks.push({ kind: 'h2', text: 'Query Parameters' }, fieldTable(m.queryParams, true))

  const body = (title: string, part: DocModel['request'], withRequired: boolean) => {
    if (!part) return
    blocks.push({ kind: 'h2', text: title })
    if (part.fields.length) blocks.push(fieldTable(part.fields, withRequired))
    blocks.push({ kind: 'label', text: 'Example' }, { kind: 'code', text: pretty(part.json) })
  }
  body('Request Body', m.request, true)
  body(`Response — ${input.responseStatus || '200'}`, m.response, false)
  body(`Error Response — ${input.errorStatus || '400'}`, m.error, false)

  blocks.push({ kind: 'h2', text: 'Sample Request' }, { kind: 'code', text: buildCurl(m) })
  return blocks
}

/* ---------- Khmer ---------- */

/** Khmer and Khmer Symbols Unicode blocks. */
const KHMER = /[\u1780-\u17FF\u19E0-\u19FF]/

/** Khmer fonts in order of preference: common in Cambodia, then Windows, macOS, Google. */
const KHMER_FONT = 'Khmer OS Siemreap'
const KHMER_FONT_STACK = `'${KHMER_FONT}', 'Khmer OS', 'Khmer UI', 'Khmer Sangam MN', 'Noto Sans Khmer', 'Leelawadee UI'`

export function hasKhmer(m: DocModel): boolean {
  return outline(m).some((b) => KHMER.test(b.kind === 'table' ? [...b.head, ...b.rows.flat()].join(' ') : b.text))
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function printHtml(m: DocModel, title: string): string {
  const body = outline(m)
    .map((b) => {
      if (b.kind === 'h1') return `<h1>${esc(b.text)}</h1>`
      if (b.kind === 'h2') return `<h2>${esc(b.text)}</h2>`
      if (b.kind === 'label') return `<div class="label">${esc(b.text)}</div>`
      if (b.kind === 'p') return `<p>${esc(b.text)}</p>`
      if (b.kind === 'code') return `<pre>${esc(b.text)}</pre>`
      const head = b.head.map((h) => `<th>${esc(h)}</th>`).join('')
      const rows = b.rows.map((r) => `<tr>${r.map((c, i) => `<td${i === 0 ? ' class="mono"' : ''}>${esc(c)}</td>`).join('')}</tr>`)
      return `<table><thead><tr>${head}</tr></thead><tbody>${rows.join('')}</tbody></table>`
    })
    .join('\n')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
  @page { size: A4; margin: 18mm 17mm;
    @bottom-left { content: "${esc(title).replace(/"/g, '')}"; font: 8pt sans-serif; color: #999; }
    @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt sans-serif; color: #999; } }
  body { font: 10pt/1.6 Arial, ${KHMER_FONT_STACK}, sans-serif; color: #222; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 4pt; }
  h2 { font-size: 13pt; margin: 18pt 0 6pt; break-after: avoid; }
  p { margin: 0 0 6pt; color: #444; }
  .label { font-size: 7.5pt; font-weight: bold; color: #888; text-transform: uppercase; margin: 8pt 0 3pt; }
  pre, .mono { font-family: Consolas, Menlo, monospace, ${KHMER_FONT_STACK}; }
  pre { background: #f4f4f2; padding: 6pt 8pt; font-size: 8.5pt; line-height: 1.45; white-space: pre-wrap; word-break: break-all; margin: 0 0 8pt; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 6pt; }
  th, td { border: 0.5pt solid #ddd; padding: 3pt 5pt; text-align: left; vertical-align: top; }
  th { background: #f0f0ec; }
  tr { break-inside: avoid; }
</style></head><body>${body}</body></html>`
}

/**
 * Print through a hidden iframe so the browser renders (and shapes) Khmer.
 * The user picks "Save as PDF" in the print dialog.
 */
async function printPdf(m: DocModel, filename: string) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(frame)
  await new Promise<void>((resolve) => {
    frame.onload = () => resolve()
    frame.srcdoc = printHtml(m, filename)
  })
  const win = frame.contentWindow!
  await win.document.fonts?.ready
  // Chrome names the PDF after the top document's title, so borrow it briefly.
  const prevTitle = document.title
  document.title = filename
  win.focus()
  win.print()
  document.title = prevTitle
  setTimeout(() => frame.remove(), 1000)
}

/* ---------- PDF ---------- */

/** Returns 'print' when the browser print dialog was used instead of a direct download. */
export async function downloadPdf(m: DocModel, filename: string): Promise<'download' | 'print'> {
  if (hasKhmer(m)) {
    await printPdf(m, filename)
    return 'print'
  }
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 48
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const width = pageW - margin * 2
  let y = margin

  const ensure = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage()
      y = margin
    }
  }
  const text = (s: string, size: number, style: 'normal' | 'bold', color: number, gapAfter: number) => {
    doc.setFont('helvetica', style).setFontSize(size).setTextColor(color)
    const lineH = size * 1.35
    for (const line of doc.splitTextToSize(s, width) as string[]) {
      ensure(lineH)
      doc.text(line, margin, y + size)
      y += lineH
    }
    y += gapAfter
  }

  for (const b of outline(m)) {
    if (b.kind === 'h1') text(b.text, 20, 'bold', 20, 6)
    else if (b.kind === 'h2') {
      y += 10
      ensure(40) // keep a heading together with what follows
      text(b.text, 13, 'bold', 20, 4)
    } else if (b.kind === 'label') text(b.text.toUpperCase(), 8, 'bold', 120, 2)
    else if (b.kind === 'p') text(b.text, 10, 'normal', 70, 6)
    else if (b.kind === 'code') {
      doc.setFont('courier', 'normal').setFontSize(8.5).setTextColor(30)
      const lineH = 11
      const lines = b.text.split('\n').flatMap((l) => (doc.splitTextToSize(l || ' ', width - 16) as string[]))
      y += 2
      for (const line of lines) {
        ensure(lineH)
        doc.setFillColor(244, 244, 242).rect(margin, y, width, lineH, 'F')
        doc.text(line, margin + 8, y + 8.5)
        y += lineH
      }
      y += 10
    } else {
      autoTable(doc, {
        startY: y,
        head: [b.head],
        body: b.rows,
        theme: 'grid',
        margin: { left: margin, right: margin },
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, textColor: 40, lineColor: 220, lineWidth: 0.5 },
        headStyles: { fillColor: [240, 240, 236], textColor: 60, fontStyle: 'bold' },
        columnStyles: { 0: { font: 'courier' } },
      })
      // autoTable records where the table ended on the document.
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
    }
  }

  // Footer on every page.
  const title = m.input.title.trim() || 'API Documentation'
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(150)
    doc.text(title, margin, pageH - 24)
    doc.text(`Page ${i} of ${pages}`, pageW - margin, pageH - 24, { align: 'right' })
  }
  doc.save(`${filename}.pdf`)
  return 'download'
}

/* ---------- Word (.docx) ---------- */

export async function downloadDocx(m: DocModel, filename: string) {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
    ShadingType,
    AlignmentType,
    Footer,
    PageNumber,
  } = await import('docx')

  const shade = (fill: string) => ({ type: ShadingType.CLEAR, color: 'auto', fill })
  // Word uses the `cs` (complex script) font for Khmer characters.
  const MONO = { ascii: 'Consolas', hAnsi: 'Consolas', cs: KHMER_FONT }
  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = []

  for (const b of outline(m)) {
    if (b.kind === 'h1') children.push(new Paragraph({ text: b.text, heading: HeadingLevel.TITLE }))
    else if (b.kind === 'h2')
      children.push(new Paragraph({ text: b.text, heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 } }))
    else if (b.kind === 'label')
      children.push(
        new Paragraph({
          spacing: { before: 160, after: 60 },
          children: [new TextRun({ text: b.text.toUpperCase(), bold: true, size: 16, color: '777777' })],
        }),
      )
    else if (b.kind === 'p') children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun(b.text)] }))
    else if (b.kind === 'code') {
      b.text.split('\n').forEach((line) =>
        children.push(
          new Paragraph({
            shading: shade('F4F4F2'),
            spacing: { after: 0, line: 260 },
            children: [new TextRun({ text: line || ' ', font: MONO, size: 17, sizeComplexScript: 18 })],
          }),
        ),
      )
      children.push(new Paragraph({ text: '' }))
    } else {
      const cell = (s: string, header: boolean, mono: boolean) =>
        new TableCell({
          shading: header ? shade('EFEFEA') : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: s, bold: header, size: 18, sizeComplexScript: 19, font: mono && !header ? MONO : undefined })],
            }),
          ],
        })
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ tableHeader: true, children: b.head.map((h) => cell(h, true, false)) }),
            ...b.rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, false, i === 0)) })),
          ],
        }),
      )
    }
  }

  const doc = new Document({
    creator: 'JSON Studio',
    title: m.input.title.trim() || 'API Documentation',
    styles: {
      default: {
        document: { run: { font: { ascii: 'Calibri', hAnsi: 'Calibri', cs: KHMER_FONT }, size: 21, sizeComplexScript: 22 } },
        // Headings use their own theme fonts; give them the Khmer font too.
        title: { run: { font: { ascii: 'Calibri Light', hAnsi: 'Calibri Light', cs: KHMER_FONT } } },
        heading2: { run: { font: { ascii: 'Calibri Light', hAnsi: 'Calibri Light', cs: KHMER_FONT } } },
      },
    },
    sections: [
      {
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 16, color: '999999' }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${filename}.docx`
  a.click()
  URL.revokeObjectURL(a.href)
}

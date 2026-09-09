/* ═══════════════════════════════════════════════════════════
   تصدير جدول — Excel وصورة وطباعة/PDF.

   بلا أي اعتمادية جديدة، وده مقصود: كل مكتبة تصدير بتضيف نص ميجا
   على الحزمة، ومكتبات الـPDF تحديدًا بتحتاج خطًا عربيًا مضمَّنًا
   ومحرّك تشكيل عشان الحروف ما تطلعش مفكّكة — تكلفة كبيرة لميزة
   المتصفح نفسه بيعملها أحسن.

   فالطرق التلاتة بتتّكل على اللي المتصفح بيعرفه:
     Excel  ← ملف xlsx حقيقي (zip مخزَّن + XML) مكتوب هنا بالكامل.
     PDF    ← طباعة الصفحة، والمستخدم بيحفظها PDF من نافذة الطباعة.
              التشكيل العربي والاتجاه بيطلعوا صح لأن المحرّك هو نفسه.
     صورة   ← رسم على كانفاس بـ`fillText`، والمتصفح بيشكّل الحروف.
   ═══════════════════════════════════════════════════════════ */

export interface Sheet {
  /**
   * اسم الملف بلا امتداد — **لاتيني**.
   * المتصفح بيتجاهل خاصية `download` لو الاسم فيه محارف غير آمنة،
   * والملف بينزل باسم «download» بلا امتداد. العنوان العربي بيعيش
   * في `title` وبيظهر جوّه الملف نفسه.
   */
  file: string
  /** العنوان المعروض — تبويب الورقة في Excel وترويسة الصورة والطباعة */
  title: string
  headers: string[]
  rows: string[][]
  /** صف الإجماليات، لو موجود */
  totals?: string[]
}

/* ═══════════════════ تنزيل ═══════════════════ */

const save = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  /* الإفراج الفوري بيلغي التنزيل في بعض المتصفحات */
  setTimeout(() => URL.revokeObjectURL(url), 4_000)
}

/* ═══════════════════ xlsx ═══════════════════

   ملف xlsx = أرشيف zip فيه أربع ملفات XML. الأرشيف هنا بيتكتب
   بطريقة «مخزَّن» (بلا ضغط)، وده مسموح في المواصفة وExcel بيقراه
   عادي — وبيوفّر علينا محرّك ضغط كامل. الحجم أكبر، والجدول اللي
   بيتصدّر من شاشة مش ميجابايتات أصلًا.                            */

const CRC = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

const crc32 = (buf: Uint8Array): number => {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

interface Entry { name: string; data: Uint8Array }

const zip = (entries: Entry[]): Blob => {
  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  const u16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff]
  const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]

  for (const e of entries) {
    const name = enc.encode(e.name)
    const crc = crc32(e.data)
    const local = Uint8Array.from([
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(e.data.length), ...u32(e.data.length),
      ...u16(name.length), ...u16(0), ...name,
    ])
    chunks.push(local, e.data)
    central.push(Uint8Array.from([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(e.data.length), ...u32(e.data.length),
      ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
      ...name,
    ]))
    offset += local.length + e.data.length
  }

  const dir = central.reduce((n, c) => n + c.length, 0)
  const end = Uint8Array.from([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(entries.length), ...u16(entries.length), ...u32(dir), ...u32(offset), ...u16(0),
  ])
  return new Blob([...chunks, ...central, end], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** رقم صافٍ؟ الأرقام بتتكتب كأرقام عشان Excel يجمعها */
const isNum = (s: string) => s !== '' && /^-?\d+(\.\d+)?$/.test(s)

const cellXml = (v: string, ref: string, style: number) =>
  isNum(v)
    ? `<c r="${ref}" s="${style}"><v>${v}</v></c>`
    : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`

const colRef = (i: number): string => {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - m) / 26)
  }
  return s
}

export function exportXlsx(sheet: Sheet): void {
  const enc = new TextEncoder()
  const all = [sheet.headers, ...sheet.rows, ...(sheet.totals ? [sheet.totals] : [])]
  const lastRow = all.length
  const lastCol = colRef(Math.max(0, sheet.headers.length - 1))

  const rowsXml = all
    .map((cells, ri) => {
      /* أنماط: 1 ترويسة، 2 إجماليات، 0 عادي */
      const style = ri === 0 ? 1 : sheet.totals && ri === lastRow - 1 ? 2 : 0
      const tds = cells.map((v, ci) => cellXml(v ?? '', `${colRef(ci)}${ri + 1}`, style)).join('')
      return `<row r="${ri + 1}">${tds}</row>`
    })
    .join('')

  /* `rightToLeft="1"` بيخلي الورقة نفسها تفتح من اليمين في Excel،
     وبدونه الجدول العربي بيتقري بالمقلوب. */
  const sheetXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews>` +
    `<cols>${sheet.headers.map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="22" customWidth="1"/>`).join('')}</cols>` +
    `<sheetData>${rowsXml}</sheetData>` +
    `<autoFilter ref="A1:${lastCol}${lastRow}"/>` +
    `</worksheet>`

  const styles =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="3">` +
    `<font><sz val="11"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="11"/><name val="Calibri"/></font>` +
    `</fonts>` +
    `<fills count="4">` +
    `<fill><patternFill patternType="none"/></fill>` +
    `<fill><patternFill patternType="gray125"/></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FF144547"/></patternFill></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FFE6EFEC"/></patternFill></fill>` +
    `</fills>` +
    `<borders count="1"><border/></borders>` +
    `<cellStyleXfs count="1"><xf/></cellStyleXfs>` +
    `<cellXfs count="3">` +
    `<xf xfId="0"/>` +
    `<xf xfId="0" fontId="1" fillId="2" applyFont="1" applyFill="1"/>` +
    `<xf xfId="0" fontId="2" fillId="3" applyFont="1" applyFill="1"/>` +
    `</cellXfs>` +
    /* بعض القارئات بتحذّر لو مفيش نمط افتراضي مسمّى */
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`

  const files: Entry[] = [
    {
      name: '[Content_Types].xml',
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        `</Types>`,
      ),
    },
    {
      name: '_rels/.rels',
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
      ),
    },
    {
      name: 'xl/workbook.xml',
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
        `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets><sheet name="${esc(sheet.title).slice(0, 28)}" sheetId="1" r:id="rId1"/></sheets>` +
        `</workbook>`,
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: enc.encode(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`,
      ),
    },
    { name: 'xl/styles.xml', data: enc.encode(styles) },
    { name: 'xl/worksheets/sheet1.xml', data: enc.encode(sheetXml) },
  ]

  save(zip(files), `${sheet.file}.xlsx`)
}

/* ═══════════════════ صورة ═══════════════════ */

const readVar = (name: string, fallback: string): string => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

/**
 * الجدول كصورة PNG.
 *
 * الرسم يدوي لا لقطة شاشة: `fillText` بيخلي المتصفح يشكّل العربي
 * ويوزّعه بالاتجاه الصح، والصورة بتطلع نضيفة بضعف الدقة بدل ما تبقى
 * لقطة مضغوطة لجزء من صفحة.
 */
export function exportPng(sheet: Sheet): void {
  const dpr = 2
  const pad = 28
  const rowH = 34
  const headH = 40
  /* الخط من التوكن لا مكتوبًا هنا: الصورة المصدَّرة لازم تطلع بنفس
     خط الشاشة، ولو اتكتب هنا بالإيد هيفضل قديمًا لما الهوية تتغيّر. */
  const font = readVar('--ft', 'system-ui, sans-serif')

  const probe = document.createElement('canvas').getContext('2d')
  if (!probe) return
  probe.font = `13px ${font}`

  /* عرض كل عمود = أعرض نص فيه، بحدّ أقصى عشان اسم مشروع طويل
     ما يبلعش الصورة */
  const widths = sheet.headers.map((h, i) => {
    probe.font = `600 13px ${font}`
    let w = probe.measureText(h).width
    probe.font = `13px ${font}`
    for (const r of sheet.rows) w = Math.max(w, probe.measureText(r[i] ?? '').width)
    if (sheet.totals) {
      probe.font = `700 13px ${font}`
      w = Math.max(w, probe.measureText(sheet.totals[i] ?? '').width)
      probe.font = `13px ${font}`
    }
    return Math.min(260, Math.ceil(w) + 26)
  })

  const bodyRows = sheet.rows.length + (sheet.totals ? 1 : 0)
  const W = widths.reduce((a, b) => a + b, 0) + pad * 2
  const H = pad * 2 + 46 + headH + bodyRows * rowH

  const cv = document.createElement('canvas')
  cv.width = W * dpr
  cv.height = H * dpr
  const c = cv.getContext('2d')
  if (!c) return
  c.scale(dpr, dpr)
  c.direction = 'rtl'
  c.textBaseline = 'middle'

  const ink = readVar('--t1', '#0C2527')
  const soft = readVar('--t2', '#3E6664')
  const line = 'rgba(20,69,71,.12)'

  c.fillStyle = readVar('--mesh-bg', '#EDF3F0')
  c.fillRect(0, 0, W, H)

  c.fillStyle = ink
  c.font = `700 17px ${font}`
  c.textAlign = 'right'
  c.fillText(sheet.title, W - pad, pad + 12)

  /* الأعمدة بتتحسب من اليمين لليسار: أول عمود في التعريف هو أول
     عمود تشوفه العين في جدول عربي. */
  const x0 = W - pad
  const edges: number[] = []
  let cur = x0
  for (const w of widths) { edges.push(cur); cur -= w }

  const top = pad + 46
  c.fillStyle = 'rgba(20,69,71,.07)'
  c.fillRect(pad, top, W - pad * 2, headH)

  c.fillStyle = ink
  c.font = `600 13px ${font}`
  sheet.headers.forEach((h, i) => c.fillText(h, edges[i] - 13, top + headH / 2))

  let y = top + headH
  c.font = `13px ${font}`
  sheet.rows.forEach((row, ri) => {
    if (ri % 2 === 1) {
      c.fillStyle = 'rgba(255,255,255,.45)'
      c.fillRect(pad, y, W - pad * 2, rowH)
    }
    c.strokeStyle = line
    c.lineWidth = 1
    c.beginPath(); c.moveTo(pad, y + 0.5); c.lineTo(W - pad, y + 0.5); c.stroke()
    c.fillStyle = soft
    row.forEach((v, i) => {
      const text = v ?? ''
      const max = widths[i] - 26
      let t = text
      while (c.measureText(t).width > max && t.length > 1) t = t.slice(0, -2)
      c.fillText(t === text ? text : `${t}…`, edges[i] - 13, y + rowH / 2)
    })
    y += rowH
  })

  if (sheet.totals) {
    c.fillStyle = 'rgba(20,69,71,.10)'
    c.fillRect(pad, y, W - pad * 2, rowH)
    c.fillStyle = ink
    c.font = `700 13px ${font}`
    sheet.totals.forEach((v, i) => c.fillText(v ?? '', edges[i] - 13, y + rowH / 2))
    y += rowH
  }

  cv.toBlob((b) => b && save(b, `${sheet.file}.png`), 'image/png')
}

/* ═══════════════════ طباعة / PDF ═══════════════════ */

/**
 * الطباعة بتشتغل على الصفحة نفسها، لا على نافذة جديدة.
 *
 * النافذة الجديدة بتتمنع من مانع النوافذ في نص المتصفحات، وبتفقد
 * الخطوط المحمَّلة فالعربي بيطلع بخط احتياطي. الكلاس ده بيخفي كل
 * حاجة ما عدا منطقة الطباعة، و`@media print` في الستايل بيتكفّل
 * بالباقي.
 */
export function printArea(): void {
  document.body.classList.add('printing')
  const done = () => {
    document.body.classList.remove('printing')
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  window.print()
  /* Safari أحيانًا ما بيبعتش `afterprint` */
  setTimeout(done, 1_500)
}

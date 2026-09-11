/**
 * جرد ثابت لملف الستايل، بيدوّر على **القيم الحرفية اللي المفروض
 * تكون توكنًا**.
 *
 * الفكرة: الدرِفت في الواجهة مش بيحصل من قرار غلط، بيحصل من كتابة
 * رقم بالإيد. `border-radius:12px` مكتوبة في مكان و`var(--r1)` في
 * مكان تاني، الاتنين شكلهما قريب، والفرق ما بيتشافش في المراجعة
 * بس بيتشاف في الشاشة. فالجرد بيعدّ الأرقام الحرفية ويقارنها
 * بالسلّم المعرَّف.
 *
 *   node tools/uiaudit-css.mjs
 */
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')

/* السلالم المعرَّفة في `:root` */
const SCALE = {
  radius: { '10px': '--r1', '15px': '--r2', '22px': '--r3', '28px': '--r4', '999px': '--rp' },
}

/** يشيل التعليقات عشان ما نعدّش أرقامًا في شرح */
const code = css.replace(/\/\*[\s\S]*?\*\//g, '')

const lines = css.split('\n')
const lineOf = (idx) => css.slice(0, idx).split('\n').length

const hit = (re, pick) => {
  const out = []
  let m
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  while ((m = r.exec(code))) out.push({ v: pick(m), i: m.index })
  return out
}

const group = (arr, key = (x) => x.v) => {
  const m = new Map()
  for (const x of arr) {
    const k = key(x)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(x)
  }
  return [...m.entries()].sort((a, b) => b[1].length - a[1].length)
}

const section = (title, rows, note) => {
  console.log(`\n═══ ${title} ═══`)
  if (note) console.log(note)
  if (!rows.length) { console.log('  نضيف.'); return }
  for (const [k, xs] of rows) console.log(`  ${String(k).padEnd(26)} ${String(xs.length).padStart(4)}×`)
}

/* ── ١ · نصف القطر ── */
const radii = hit(/border-radius:\s*([^;}]+)/i, (m) => m[1].trim())
const litRadii = radii.filter((x) => !x.v.includes('var(') && !x.v.includes('inherit'))
const offScale = litRadii.filter((x) => {
  const parts = x.v.split(/\s+/)
  return parts.some((p) => !(p in SCALE.radius) && p !== '0' && p !== '50%' && !p.endsWith('%'))
})

/* ── ٢ · مقاسات المربّعات (أيقونة/شارة) ── */
const boxes = []
{
  const re = /width:\s*(\d+)px;\s*height:\s*(\d+)px/g
  let m
  while ((m = re.exec(code))) boxes.push({ w: +m[1], h: +m[2], i: m.index })
}
const notSquare = boxes.filter((b) => b.w !== b.h)

/* ── ٣ · ارتفاعات التحكّم ── */
const pads = hit(/padding:\s*([^;}]+)/i, (m) => m[1].trim())
const fonts = hit(/font-size:\s*([^;}]+)/i, (m) => m[1].trim())
const gaps = hit(/(?:^|[;{])\s*gap:\s*([^;}]+)/i, (m) => m[1].trim())

/* ── ٤ · ألوان حرفية (المفروض كلها توكن) ── */
const hex = hit(/#[0-9a-fA-F]{3,8}\b/, (m) => m[0])
const rgbLit = hit(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/, (m) => m[0])

console.log('════════════════════════════════════════════')
console.log(' جرد ثابت، src/styles/index.css')
console.log(` ${lines.length} سطرًا`)
console.log('════════════════════════════════════════════')

console.log(`\n═══ نصف القطر ═══`)
console.log(`  إجمالي التصريحات: ${radii.length}`)
console.log(`  بالتوكن:          ${radii.length - litRadii.length}`)
console.log(`  حرفية:            ${litRadii.length}`)
console.log(`  خارج السلّم:      ${offScale.length}`)
section('  القيم الحرفية الأكثر تكرارًا', group(litRadii).slice(0, 14))

console.log(`\n═══ المربّعات ═══`)
console.log(`  width+height مكتوبين مع بعض: ${boxes.length}`)
console.log(`  **مش مربّع** (w ≠ h):        ${notSquare.length}`)
for (const b of notSquare.slice(0, 20)) {
  console.log(`    ${b.w}×${b.h}  ~سطر ${lineOf(b.i)}`)
}

console.log(`\n═══ السلالم المستعملة ═══`)
console.log(`  قيم padding مختلفة:   ${group(pads).length}`)
console.log(`  قيم font-size مختلفة: ${group(fonts).length}`)
console.log(`  قيم gap مختلفة:       ${group(gaps).length}`)
section('  أكثر font-size تكرارًا', group(fonts).slice(0, 12))

console.log(`\n═══ الألوان الحرفية ═══`)
console.log(`  #hex:  ${hex.length}   (${group(hex).length} قيمة مختلفة)`)
console.log(`  rgb(): ${rgbLit.length}  (${group(rgbLit).length} قيمة مختلفة)`)
section('  أكثر hex تكرارًا خارج :root', group(hex.filter((x) => lineOf(x.i) > 200)).slice(0, 10))

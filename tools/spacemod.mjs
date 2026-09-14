/**
 * كوديمود المسافات · **مش استبدال أعمى**.
 *
 * بيمشي على كل تصريح `padding`/`margin`/`gap` في الستايل، بيحوّل
 * كل قيمة حرفية للبكسل، وبيدوّر على أقرب درجة في سلّم `--sp-*`:
 *
 *   · الفرق ≤ العتبة (٢px افتراضيًّا) → **يتبدّل تلقائيًّا**
 *   · الفرق > العتبة                  → **يتساب ويتكتب في تقرير**
 *
 * السبب: القيمة اللي بعيدة عن السلّم غالبًا فيها قرار تصميم
 * حقيقي (مسافة محسوبة لمحاذاة حاجة بعينها)، والاستبدال الأعمى
 * بيكسره من غير ما حدّ ياخد باله. فالأداة بتصلّح الضوضاء
 * وبتسيب القرارات للمراجعة.
 *
 *   node tools/spacemod.mjs --dry     # تقرير بس
 *   node tools/spacemod.mjs           # يطبّق
 *   node tools/spacemod.mjs --max 3   # يغيّر العتبة
 */
import fs from 'node:fs'

const FILE = new URL('../src/styles/index.css', import.meta.url).pathname
const DRY = process.argv.includes('--dry')
const MAX = Number(process.argv[process.argv.indexOf('--max') + 1]) || 2

/** السلّم بالبكسل · لازم يفضل مطابقًا لـ`:root` */
const SCALE = [
  [2, '--sp-1'], [4, '--sp-2'], [8, '--sp-3'], [12, '--sp-4'], [16, '--sp-5'], [20, '--sp-6'],
  [24, '--sp-7'], [32, '--sp-8'], [40, '--sp-9'], [48, '--sp-10'], [64, '--sp-11'], [80, '--sp-12'],
]
const PROPS = /^(padding|margin|gap|row-gap|column-gap|padding-(block|inline)(-start|-end)?|margin-(block|inline)(-start|-end)?|padding-(top|right|bottom|left)|margin-(top|right|bottom|left))$/

const nearest = (px) => {
  let best = null
  for (const [v, name] of SCALE) {
    const d = Math.abs(v - px)
    if (!best || d < best.d) best = { v, name, d }
  }
  return best
}

const src = fs.readFileSync(FILE, 'utf8')
/** مواضع التعليقات عشان ما نلمسش أرقامًا في شرح */
const comments = []
for (const m of src.matchAll(/\/\*[\s\S]*?\*\//g)) comments.push([m.index, m.index + m[0].length])
const inComment = (i) => comments.some(([a, b]) => i >= a && i < b)

const changed = [], review = [], skipped = []
let out = '', last = 0

/* كل تصريح: اسم الخاصية ثم `:` ثم القيمة لحدّ `;` أو `}` */
for (const m of src.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/g)) {
  const [full, prop, value] = m
  if (inComment(m.index)) continue
  if (!PROPS.test(prop)) continue
  /* ⚠️ الحارس اتخفّف: كان بيرفض أي تصريح فيه `var(` أو `clamp(`،
     يعني تصريح زي `padding:var(--rail-pt) 8px` كان بيعدّي كامل
     والـ٨ الحرفية فيه تفضل. دلوقتي بنرفض اللي **ما ينفعش يتحسب**
     بس (`calc` · `env` · نسبة · auto)، والباقي بيتفكّك قطعة قطعة. */
  if (/calc\(|env\(|%/.test(value)) { skipped.push(`${prop}:${value.trim()}`); continue }

  /* ⚠️ **التفكيك لازم يحترم الأقواس.** `split(/\s+/)` على
     `padding:.15rem clamp(a, b, c) .35rem` بيكسر الـ`clamp` لتلات
     قطع، فالتصريح كله بيتساب والـ.15rem الحرفية تفضل. القسمة
     بتعدّ عمق القوس. */
  const parts = []
  { let depth = 0, cur = ''
    for (const ch of value.trim()) {
      if (ch === '(') depth++
      if (ch === ')') depth--
      if (/\s/.test(ch) && depth === 0) { if (cur) parts.push(cur); cur = '' }
      else cur += ch
    }
    if (cur) parts.push(cur) }
  let touched = false, hold = false
  const mapped = parts.map((tok) => {
    if (tok === '0') return tok
    if (/^var\(|^clamp\(|^auto$/.test(tok)) return tok   /* توكن أصلًا أو كلمة مفتاحية */
    const mm = /^(-?)([\d.]+)(px|rem|em)$/.exec(tok)
    if (!mm) { hold = true; return tok }
    const [, sign, num, unit] = mm
    if (unit === 'em') { hold = true; return tok }   /* em نسبي للخطّ لا للشبكة */
    const px = Number(num) * (unit === 'rem' ? 16 : 1)
    const n = nearest(px)
    if (n.d > MAX) {
      review.push({ prop, tok, px: Math.round(px * 100) / 100, near: n.v, d: Math.round(n.d * 100) / 100, line: src.slice(0, m.index).split('\n').length })
      hold = true
      return tok
    }
    touched = true
    return sign === '-' ? `calc(-1 * var(${n.name}))` : `var(${n.name})`
  })

  if (!touched || hold) {
    if (hold && touched) review.push({ prop, tok: value.trim(), px: null, near: null, d: null, line: src.slice(0, m.index).split('\n').length, mixed: true })
    continue
  }
  const next = `${prop}:${mapped.join(' ')}`
  changed.push({ line: src.slice(0, m.index).split('\n').length, from: `${prop}:${value.trim()}`, to: next })
  out += src.slice(last, m.index) + next
  last = m.index + full.length
}
out += src.slice(last)

console.log(`════ كوديمود المسافات · العتبة ${MAX}px ════\n`)
console.log(`اتبدّل تلقائيًّا : ${changed.length}`)
console.log(`محتاج مراجعة   : ${review.length}`)
console.log(`اتساب (توكن/نسبة/auto): ${skipped.length}\n`)

if (review.length) {
  console.log('─── محتاج قرار · الفرق أكبر من العتبة ───')
  const agg = new Map()
  for (const r of review) {
    if (r.mixed) continue
    const k = `${r.tok} (${r.px}px) → أقرب درجة ${r.near} · فرق ${r.d}`
    agg.set(k, (agg.get(k) ?? 0) + 1)
  }
  for (const [k, n] of [...agg.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}×  ${k}`)
  const mixed = review.filter((r) => r.mixed).length
  if (mixed) console.log(`\n  و${mixed} تصريح فيه قيمة على السلّم وقيمة برّاه · اتساب كامل`)
}

if (DRY) { console.log('\n(تشغيل جافّ · مفيش حاجة اتكتبت)'); process.exit(0) }
fs.writeFileSync(FILE, out)
console.log(`\n✅ اتكتب · ${changed.length} تصريح`)

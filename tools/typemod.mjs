/**
 * كوديمود الخطّ · نفس منطق `spacemod` مع فرق واحد مهم.
 *
 * القاعدة العامة: الفرق ≤ العتبة → يتبدّل · أكبر → يتساب للمراجعة.
 *
 * **الاستثناء: أي قيمة تحت ١٢px بتترفع لـ`--fs-1` مهما كان الفرق.**
 * ٨px بعيدة عن ١٢ بأربعة، فالعتبة كانت هتسيبها — لكن دي مش حالة
 * تقريب، دي **قرار أرضية اتاخد**: تلات أنظمة كورپوريت مستقلة
 * بتتفق على ١٤px كأصغر متن لواجهة كثيفة، و١٢ هي الأرضية المطلقة
 * لأي نصّ. فالرفع هنا هو الهدف لا أثر جانبي.
 *
 * **والعتبة نسبية لا ثابتة.** فرق ٢px على نصّ ١٢ = ١٧٪ وبيتشاف
 * فورًا؛ نفس الـ٢ على رقم ٤٠ = ٥٪ وما حدّش بيلاحظه. العين بتقرا
 * **نسب** الخطّ لا فروقه المطلقة، فالعتبة `max(1.2px, 12%)`.
 * بعتبة ثابتة كانت ثمانية أرقام عرض بتروح للمراجعة من غير سبب.
 *
 *   node tools/typemod.mjs --dry
 */
import fs from 'node:fs'
import path from 'node:path'

const FILE = new URL('../src/styles/index.css', import.meta.url).pathname
const DRY = process.argv.includes('--dry')
const MAX = Number(process.argv[process.argv.indexOf('--max') + 1]) || 1.2
const FLOOR = 12

const SCALE = [[12,'--fs-1'],[13,'--fs-2'],[14,'--fs-3'],[16,'--fs-4'],[18,'--fs-5'],
               [20,'--fs-6'],[24,'--fs-7'],[32,'--fs-8'],[40,'--fs-9']]
const near = (px) => SCALE.reduce((b,[v,n]) => (!b || Math.abs(v-px) < Math.abs(b.v-px)) ? {v,n} : b, null)

const src = fs.readFileSync(FILE,'utf8')
const comments=[]; for (const m of src.matchAll(/\/\*[\s\S]*?\*\//g)) comments.push([m.index,m.index+m[0].length])
const inC=(i)=>comments.some(([a,b])=>i>=a&&i<b)

const done=[], review=[], lifted=[]
let out='', last=0
for (const m of src.matchAll(/font-size\s*:\s*([^;{}]+)/g)) {
  const [full, raw] = m
  if (inC(m.index)) continue
  const v = raw.trim()
  if (/var\(|calc\(|clamp\(|inherit|%/.test(v)) continue
  const mm = /^(\.?[\d.]+)(rem|px|em)$/.exec(v)
  if (!mm) continue
  if (mm[2]==='em') continue                      /* em نسبي للأب · دور مختلف */
  const px = Number(mm[1]) * (mm[2]==='rem' ? 16 : 1)
  const n = near(px)
  const line = src.slice(0,m.index).split('\n').length
  if (px < FLOOR) {
    lifted.push({ line, from: `${v} (${Math.round(px*100)/100}px)`, to: '--fs-1 (12)' })
  } else if (Math.abs(n.v - px) > Math.max(MAX, px * 0.12)) {
    review.push({ line, px: Math.round(px*100)/100, near: n.v, d: Math.round(Math.abs(n.v-px)*100)/100 })
    continue
  } else done.push({ line, from: v, to: n.n })
  const tok = px < FLOOR ? '--fs-1' : n.n
  out += src.slice(last, m.index) + `font-size:var(${tok})`
  last = m.index + full.length
}
out += src.slice(last)

console.log(`════ كوديمود الخطّ · عتبة ${MAX}px · أرضية ${FLOOR}px ════\n`)
console.log(`اتبدّل تلقائيًّا : ${done.length}`)
console.log(`**اترفع للأرضية**: ${lifted.length}   ← نصّ كان تحت ١٢px`)
console.log(`محتاج مراجعة   : ${review.length}\n`)
if (lifted.length) {
  const agg=new Map(); for(const l of lifted) agg.set(l.from,(agg.get(l.from)??0)+1)
  console.log('─── اترفع للأرضية ───')
  for (const [k,v] of [...agg.entries()].sort((a,b)=>b[1]-a[1])) console.log(`  ${String(v).padStart(4)}×  ${k} → 12`)
}
if (review.length) {
  const agg=new Map(); for(const r of review) agg.set(`${r.px}px → أقرب ${r.near} · فرق ${r.d}`,(agg.get(`${r.px}px → أقرب ${r.near} · فرق ${r.d}`)??0)+1)
  console.log('\n─── محتاج قرار ───')
  for (const [k,v] of [...agg.entries()].sort((a,b)=>b[1]-a[1])) console.log(`  ${String(v).padStart(4)}×  ${k}`)
}
if (DRY) { console.log('\n(تشغيل جافّ)'); process.exit(0) }
fs.writeFileSync(FILE, out)
console.log(`\n✅ اتكتب · ${done.length + lifted.length} تصريح`)

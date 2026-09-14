/**
 * كوديمود الملء — بيربط ألفا السطح بسلّم من سبع درجات.
 *
 * ═══ المشكلة ═══
 *
 * كل سطح في السيستم `rgba(var(--wC), calc(N * var(--wM)))` —
 * أبيض بألفا مضروبة في معامل الثيم. المعامل مفتاح شغّال، لكن
 * **الـN مالهاش سلّم**: ٨٥ تصريحًا بـ**٣٧ قيمة مختلفة**، من
 * ٠٫١٤ لـ٠٫٩٥.
 *
 * وفيها تكرار حرفي صريح: `.4` و`.40` · `.6` و`.60` · `.8`
 * و`.80` — **نفس القيمة بهجاءين**. ده مش اختلاف تصميم، ده
 * غياب مرجع: كل واحد كتب الرقم اللي حسّه صحّ ساعتها.
 *
 * ═══ السلّم ═══
 *
 * الدرجات اتحطّت على **تجمّعات القيم الموجودة فعلًا** لا على
 * متتالية نظرية، فأكبر إزاحة ٠٫٠٨ والغالبية ≤ ٠٫٠٥.
 *
 * وده غير محسوس عمليًّا: في الفاتح، فرق ٠٫٠٧ في الألفا على أبيض
 * فوق أرضية الصفحة = **٤ درجات من ٢٥٥** · وفي الغامق `--wM`
 * تساوي ٠٫٠٨٥ فالفرق بيتقسم على اتناشر.
 *
 * ⚠️ **والمفتاح مش جديد.** `--wM` هي مفتاح قوّة الأسطح، وشغّالة
 * من الأول. اللي كان ناقص **الدرجات** — مفتاحان لنفس الحاجة
 * أسوأ من واحد.
 *
 *   node tools/fillmod.mjs --dry
 *   node tools/fillmod.mjs
 */
import fs from 'node:fs'

const FILE = 'src/styles/index.css'
const DRY = process.argv.includes('--dry')

/** [قيمة الدرجة, التوكن] */
const STEPS = [
  [0, '--fl-0'], [0.22, '--fl-1'], [0.42, '--fl-2'], [0.55, '--fl-3'],
  [0.62, '--fl-4'], [0.74, '--fl-5'], [0.84, '--fl-6'], [0.93, '--fl-7'],
]

let src = fs.readFileSync(FILE, 'utf8')

/* ⚠️ **الكوديمود لازم يستثني تعريف السلّم نفسه.**
   أول تشغيلة حوّلت `--fl-4:rgba(var(--wC),calc(.62 * var(--wM)))`
   لـ`--fl-4:var(--fl-4)` — تعريف دائري. والـCSS ما بيقعش على
   الدائرية، بيرمي المتغيّر بصمت: كل الأسطح بقت شفّافة والبِناء
   عدّى أخضر. أخطر نوع من الغلط: صامت وبيعدّي البوّابة.
   السطر اللي بيعرّف درجة بيتشال قبل الاستبدال وبيترجع بعده. */
const DEFS = []
src = src.replace(/^\s*--fl-\d:[^;]*;/gm, (m) => { DEFS.push(m); return `/*«FLDEF${DEFS.length - 1}»*/` })
const hits = new Map()
let n = 0, worst = 0

/* بنمشي على التصاريح بس · التعليقات فيها الأرقام دي في الشرح */
const out = src.replace(
  /rgba\(var\(--wC\)\s*,\s*calc\(\s*(\.?[0-9.]+)\s*\*\s*var\(--wM\)\s*\)\s*\)/g,
  (m, raw) => {
    const v = parseFloat(raw)
    if (!Number.isFinite(v)) return m
    let best = STEPS[0]
    for (const s of STEPS) if (Math.abs(s[0] - v) < Math.abs(best[0] - v)) best = s
    const d = Math.abs(best[0] - v)
    worst = Math.max(worst, d)
    hits.set(`${raw} → ${best[1]} (${best[0]})`, (hits.get(`${raw} → ${best[1]} (${best[0]})`) ?? 0) + 1)
    n++
    return `var(${best[1]})`
  },
)

console.log(`ربط ${n} تصريح · أكبر إزاحة ${worst.toFixed(3)}`)
for (const [k, c] of [...hits.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(3)}×  ${k}`)
const final = out.replace(/\/\*«FLDEF(\d+)»\*\//g, (_, i) => DEFS[+i])
if (!DRY) { fs.writeFileSync(FILE, final); console.log('\n✅ اتكتب') }
else console.log('\n(تجربة · ما اتكتبش)')

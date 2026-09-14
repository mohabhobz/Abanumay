/**
 * كوديمود ارتفاع السطر — بيربط `line-height` بسلّم من خمس درجات.
 *
 * ليه دي آخر خاصية طباعية اتظبطت: مقاس الخطّ بيبان بالعين فاتظبط
 * بدري · ارتفاع السطر ما بيبانش إلا كإحساس عام بالزحمة، فعدّى ٢٣
 * نسبة مختلفة من غير ما حدّ يشوفه.
 *
 * وهو **أهمّ من مقاس الخطّ في العربية**: W3C alreq §7.4 بيقول إن
 * الخطّ العربي محتاج تقدّمًا رأسيًّا أكبر من اللاتيني (الصواعد
 * والنوازل والتشكيل بيطلعوا برّه الجسم)، فالعلاج الصحّ **زيادة
 * التقدّم لا تكبير المقاس**.
 *
 * ⚠️ **عيلتان لا عيلة واحدة:**
 *   · **نِسب** (`--lh-flat…long`) — للنصّ المتدفّق · بتكبر مع الخطّ.
 *   · **بكسل** (`--lh-md` = ٢٠ · `--lh-xs` = ١٦) — لتحكّم بسطر
 *     واحد، وهي **جزء من حساب الارتفاع** (١٢ + ٢٠ + ١٢ = ٤٤).
 *     دي ما بتتلمسش: لو بقت نسبة، `--h-md` بيتكسر.
 *
 * الحدّ الفاصل عند ١٫٤٧٥ مقصود: `1.5` بتطلع لفوق لـ`--lh-text`
 * (١٫٦) لا لتحت لـ`--lh-ui` (١٫٤٥) — الأرضية العربية ما تتخرقش
 * بكوديمود.
 *
 *   node tools/lhmod.mjs --dry
 *   node tools/lhmod.mjs
 */
import fs from 'node:fs'

const FILE = 'src/styles/index.css'
const DRY = process.argv.includes('--dry')

/** [أقصى قيمة داخلة, التوكن] — مرتّبة تصاعديًّا */
const BANDS = [
  [0.02, '--lh-0'],
  [1.05, '--lh-flat'],
  [1.32, '--lh-head'],
  [1.475, '--lh-ui'],
  [1.70, '--lh-text'],
  [9.99, '--lh-long'],
]

let src = fs.readFileSync(FILE, 'utf8')
const hits = new Map()
let n = 0

/* بنمشي على التصاريح بس · التعليقات فيها نصّ زي `line-height:1` */
const out = src.replace(/line-height\s*:\s*([^;}\n]+)/g, (m, raw) => {
  const v = raw.trim()
  if (v.startsWith('var(') || v === 'inherit' || v === 'normal') return m
  if (/px|rem|em|%|calc|clamp|`/.test(v)) return m       // بكسل أو مشتقّ — عيلة تانية
  const num = parseFloat(v)
  if (!Number.isFinite(num)) return m
  const tok = BANDS.find(([mx]) => num <= mx)[1]
  hits.set(`${v} → ${tok}`, (hits.get(`${v} → ${tok}`) ?? 0) + 1)
  n++
  return `line-height:var(${tok})`
})

console.log(`ربط ${n} تصريح`)
for (const [k, c] of [...hits.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(3)}×  ${k}`)
if (!DRY) { fs.writeFileSync(FILE, out); console.log('\n✅ اتكتب') }
else console.log('\n(تجربة · ما اتكتبش)')

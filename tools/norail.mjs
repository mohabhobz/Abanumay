/**
 * مفيش شريط ملوّن على جنب أي عنصر.
 *
 * ⚠️ **القاعدة دي العميل قالها أكتر من مرة، وأنا كسرتها أكتر من
 * مرة.** كانت مكتوبة بالنصّ في الـCSS عند `.lgnote`: «الحالة
 * اللي العميل طلب إنها تختفي من السيستم كله» · وبرضو رجعت في
 * `.act.late` و`.btree-r.no` و`.ind-g`، وأنا نفسي ضفت واحدة
 * جديدة في `.regwho` بعد ما القاعدة كانت متكتوبة. العميل هو
 * اللي قعد يشيلها صفحة صفحة.
 *
 * **قاعدة مكتوبة في تعليق وما عليهاش فحص تفضل نيّة** · ودي
 * تالت مرّة نفس الدرس يتكرّر في أسبوع (`<select>` · التاريخ ·
 * ودلوقتي ده). الفرق إن الفحص بيمنع، والتعليق بيتمنّى.
 *
 * ممنوع:
 *   `border-inline-start` / `border-inline-end` بلون علامة
 *   `border-right` / `border-left` بلون علامة
 *   `box-shadow: inset Npx 0 0 …` (شريط رأسي بالظل)
 *
 * مسموح: الخطّ الفاصل المحايد (`--edge-1` · `--edge-d`) اللي
 * بيفصل عمودًا عن عمود في شجرة أو جدول · هو فاصل لا علامة حالة،
 * ولونه محايد بحكم التعريف.
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const CSS = fileURLToPath(new URL('../src/styles/index.css', import.meta.url))
const src = fs.readFileSync(CSS, 'utf8')

/* التعليقات مستثناة · الشرح اللي بيقول «الشريط اتشال» لازم يفضل */
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
const clean = strip(src)

/* الحياديات المسموح بيها كفاصل · أي حاجة تانية علامة */
const NEUTRAL = /var\(--edge-(1|2|d|i)\)/

const rails = []
clean.split('\n').forEach((line, i) => {
  const at = `index.css:${i + 1}`

  /* ١ · حدّ جانبي · منطقي أو فيزيائي */
  const b = /border-(inline-start|inline-end|right|left)\s*:\s*([^;}]+)/.exec(line)
  if (b && !NEUTRAL.test(b[2])) rails.push(`${at}  ${b[0].trim().slice(0, 56)}`)

  /* ٢ · شريط رأسي مرسوم بالظل · `inset ±Npx 0 0 <color>`
     ⚠️ الإزاحة الأولى غير صفر والتانية صفر = شريط على الجنب.
     و`inset 0 ±Npx 0` (فاصل أفقي) مسموح · هو خطّ بين صفّين. */
  for (const m of line.matchAll(/inset\s+(-?[\d.]+)px\s+0\s+0\s+([^,)]+(?:\([^)]*\))?[^,]*)/g)) {
    if (Number(m[1]) !== 0 && !NEUTRAL.test(m[2])) {
      rails.push(`${at}  ${m[0].trim().slice(0, 56)}`)
    }
  }
})

console.log('\n═══ الشرايط الجانبية ═══')
if (rails.length) {
  console.log(`\n🔴 شريط ملوّن على جنب عنصر · ${rails.length} موضع`)
  for (const r of rails) console.log(`   ${r}`)
  console.log('   الحالة بيقولها الوسم · والأحمر في السيستم ده للخطر وحده')
  process.exit(1)
}
console.log('\n✅ مفيش شرايط جانبية ملوّنة\n')

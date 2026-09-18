/**
 * قوائم الاختيار · قاعدتان.
 *
 * ١ · ممنوع `<select>` الأصلية في الواجهة.
 * ٢ · وممنوع `label` على قائمة جوّه شريط الأدوات.
 *
 * ⚠️ **دي قاعدة كانت مكتوبة في مكان وناقصة في التاني، وعشان كده
 * رجعت.** `Select` بتاعة شريط الأدوات اتشالت منها `<select>` من
 * زمان، والتعليق فوقها بيشرح ليه: القايمة بيرسمها **نظام التشغيل**
 * · صندوق رمادي بخطّ لاتيني وسط واجهة زجاج عربية، وشكل تالت خالص
 * في الويندوز. لكن التعليق ده كان بيحرس `filters.tsx` بس · فضل في
 * الفورمات **١١** `<select>` أصلية في تسجيل الجهة والمشروع الجديد
 * والاتفاقية والميزانية، والعميل هو اللي شافها.
 *
 * البديل: `Select` في شريط الأدوات، و`FieldSelect` جوّه الفورم ·
 * والاتنين بيفتحوا **نفس** `.fmenu`.
 *
 * والدرس: **قاعدة مكتوبة في تعليق وما عليهاش فحص تفضل نيّة.**
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name))
      : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : [])

/* التعليقات مستثناة: الشرح اللي بيقول «`<select>` اتشالت» لازم
   يفضل مكتوبًا، وهو نفسه مش عنصرًا في الشجرة. */
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

/**
 * ⚠️ **العنوان فوق القائمة ممنوع جوّه شريط الأدوات.**
 * القاعدة مكتوبة عند `.fsel-b` في الـCSS: القائمة في الشريط بتلبس
 * شكل الشريحة عشان الصفّ كله يبقى بلغة واحدة · بلا عنوان فوقها.
 * وصندوق طلبات التسجيل كان الوحيد اللي بيبعت `label`، فحقل واحد
 * طلع أطول من جيرانه وعنوانه اتعلّق فوق الصفّ · والعميل شافها.
 * `all` هو اللي بيسمّي القائمة («كل التصنيفات (5)»).
 *
 * الدرس نفسه اللي اتكرّر النهارده مرتين: **قاعدة مكتوبة في تعليق
 * وما عليهاش فحص تفضل نيّة.**
 */
const labelInToolbar = (src) => {
  const out = []
  const open = src.indexOf('ftool-f')
  if (open < 0) return out
  /* من فتح الشريط لحدّ ركن الأفعال · دي منطقة الفلاتر بالظبط */
  const end = src.indexOf('ftool-a', open)
  const seg = src.slice(open, end < 0 ? src.length : end)
  const before = src.slice(0, open).split('\n').length - 1
  const lines = seg.split('\n')
  let inTag = ''
  lines.forEach((line, i) => {
    const m = line.match(/<(MultiSelect|Select)\b/)
    if (m) inTag = m[1]
    if (inTag && /\blabel=/.test(line)) {
      out.push({ at: before + i + 1, what: inTag })
      inTag = ''
    }
    if (inTag && /\/>/.test(line)) inTag = ''
  })
  return out
}

const hits = []
const labels = []
for (const f of walk(SRC)) {
  const clean = strip(fs.readFileSync(f, 'utf8'))
  clean.split('\n').forEach((line, i) => {
    if (/<select[\s>]/.test(line)) hits.push(`${path.relative(SRC, f)}:${i + 1}`)
  })
  for (const l of labelInToolbar(clean)) {
    labels.push(`${path.relative(SRC, f)}:${l.at}  <${l.what} label=…>`)
  }
}

console.log('\n═══ قوائم الاختيار ═══')
let bad = false
if (hits.length) {
  bad = true
  console.log(`\n🔴 \`<select>\` أصلية · ${hits.length} موضع`)
  for (const h of hits) console.log(`   ${h}`)
  console.log('   البديل: <Select> في الشريط · <FieldSelect> في الفورم')
}
if (labels.length) {
  bad = true
  console.log(`\n🔴 عنوان فوق قائمة في شريط الأدوات · ${labels.length} موضع`)
  for (const l of labels) console.log(`   ${l}`)
  console.log('   الشريط صفّ واحد بلا عناوين · الاسم في `all`')
}
if (bad) process.exit(1)
console.log('\n✅ القوايم بتفتح لوحة السيستم · والشريط صفّ واحد\n')

/**
 * قواعد الواجهة اللي بقت فحصًا · خمسة.
 *
 * ١ · ممنوع `<select>` الأصلية في الواجهة.
 * ٢ · وممنوع `label` على قائمة جوّه شريط الأدوات.
 * ٣ · وممنوع `**` في نصّ JSX · ده مش ماركداون.
 * ٤ · وممنوع المساعد يختفي لمّا القراءات تفضى.
 * ٥ · وممنوع `type="date"` · تقويم المتصفّح زي قايمته بالظبط.
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

/**
 * ⚠️ **`**` في نصّ JSX بتطلع نجومًا على الشاشة.**
 * التعليقات في السيستم ده مكتوبة بماركداون، فاليد بتكمّل على
 * نفس النمط وهي بتكتب نصًّا معروضًا · وطلعت للعميل في محرّر
 * الخطة: «اللي مفتوح هو **تحديث التنفيذ**» بالنجوم.
 *
 * ⚠️ **والفحص على `.tsx` وحدها.** نصوص المساعد في `data/mock`
 * بتعدّي على `md.tsx` اللي بيحوّل `**` لعريض فعلًا · فهي ماركداون
 * مقصود لا سهو. اللي بيطلع نجومًا هو النصّ اللي بيتحطّ في JSX
 * مباشرةً. و`md.tsx` نفسه مستثنى لأنه المفسّر.
 */
const MD_OK = 'components/assistant/md.tsx'

/**
 * ⚠️ **المساعد ما بيختفيش · هو بيقول إنه مفيش حاجة.**
 * `QuickRead` و`AnalysisCard` كانوا بيرجّعوا `null` لمّا القراءات
 * تفضى · والقراءات محسوبة من **الصفوف بعد الفلتر**، يعني أول ما
 * المستخدم يضيّق النطاق لصفوف مفيهاش مشاكل، المساعد بيتشال من
 * الشاشة والتخطيط بينطّ (وفي لوحة التقارير العمود الجانبي كله).
 *
 * والأسوأ من النطّ إن الاختفاء بيتقري **عطلًا**: المستخدم بيفتكر
 * إنه كسر حاجة، لا إنه وصل لنطاق نضيف. الغياب مش إجابة.
 */
const ASSIST = ['components/assistant/QuickRead.tsx', 'components/assistant/AnalysisCard.tsx']

/**
 * ⚠️ **`<input type="date">` هي نفس عطل `<select>` بالحرف.**
 * التقويم بيرسمه **المتصفّح**: خطّ لاتيني، وأسماء أيام إنجليزية،
 * و`dd/mm/yyyy` مكتوبة في حقل عربي فاضي، وشكل تالت في الويندوز.
 * لمّا شِلنا `<select>` وكتبنا الفحص، ما سألناش عن التاريخ ·
 * فعشر مواضع فضلت نيتيف لحدّ ما العميل شافها (١٨ سبتمبر).
 *
 * والدرس اللي بيتكرّر: **الفحص بيمسك اللي اتسأل عنه بس** ·
 * فالسؤال هنا اتوسّع لكل تحكّم بترسمه المنصّة بدلنا.
 */
const DATE = /<input[^>]*type=["']date["']/

const hits = []
const labels = []
const stars = []
const vanish = []
const dates = []
for (const f of walk(SRC)) {
  const rel = path.relative(SRC, f)
  const clean = strip(fs.readFileSync(f, 'utf8'))
  clean.split('\n').forEach((line, i) => {
    if (/<select[\s>]/.test(line)) hits.push(`${rel}:${i + 1}`)
    if (DATE.test(line) || /^\s*type=["']date["']/.test(line)) dates.push(`${rel}:${i + 1}`)
    if (f.endsWith('.tsx') && rel !== MD_OK && line.includes('**')) {
      stars.push(`${rel}:${i + 1}  ${line.trim().slice(0, 70)}`)
    }
  })
  for (const l of labelInToolbar(clean)) {
    labels.push(`${rel}:${l.at}  <${l.what} label=…>`)
  }
  if (ASSIST.includes(rel)) {
    clean.split('\n').forEach((line, i) => {
      if (/readings\.length === 0\s*\)?\s*return null/.test(line)) {
        vanish.push(`${rel}:${i + 1}  ${line.trim().slice(0, 60)}`)
      }
    })
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
if (stars.length) {
  bad = true
  console.log(`\n🔴 \`**\` في نصّ JSX · ${stars.length} موضع`)
  for (const l of stars) console.log(`   ${l}`)
  console.log('   ده مش ماركداون · استعمل <b>…</b>')
}
if (vanish.length) {
  bad = true
  console.log(`\n🔴 المساعد بيختفي لمّا القراءات تفضى · ${vanish.length} موضع`)
  for (const l of vanish) console.log(`   ${l}`)
  console.log('   استعمل `empty` وقول «مفيش ملاحظات» بدل ما يتشال')
}
if (dates.length) {
  bad = true
  console.log(`\n🔴 \`type="date"\` أصلية · ${dates.length} موضع`)
  for (const d of dates) console.log(`   ${d}`)
  console.log('   البديل: <DateField> · تقويم السيستم بأرقام لاتينية')
}
if (bad) process.exit(1)
console.log('\n✅ القوايم والتواريخ والشريط والنصّ والمساعد · كلهم على القاعدة\n')

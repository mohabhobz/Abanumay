/**
 * ممنوع `<select>` الأصلية في الواجهة.
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

const hits = []
for (const f of walk(SRC)) {
  strip(fs.readFileSync(f, 'utf8')).split('\n').forEach((line, i) => {
    if (/<select[\s>]/.test(line)) hits.push(`${path.relative(SRC, f)}:${i + 1}`)
  })
}

console.log('\n═══ قوائم الاختيار ═══')
if (hits.length) {
  console.log(`\n🔴 \`<select>\` أصلية · ${hits.length} موضع`)
  for (const h of hits) console.log(`   ${h}`)
  console.log('   البديل: <Select> في الشريط · <FieldSelect> في الفورم')
  process.exit(1)
}
console.log('\n✅ كل القوائم بتفتح لوحة السيستم · مفيش قايمة نظام تشغيل\n')

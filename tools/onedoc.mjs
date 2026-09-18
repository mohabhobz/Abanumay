/**
 * قائمة المستندات مرسومة في مكان واحد.
 *
 * ⚠️ **`DocFile` كان مكوّنًا واحدًا · والقائمة حواليه كانت منسوخة.**
 * التعليق فوق `DocFile` بيقول بالنصّ إنه «الشكل الواحد لأي ملف في
 * السيستم» · وده كان صح للملف الواحد وغلط للقائمة: كل شاشة كتبت
 * جدولها بإيدها (عمود الاسم · وسم الحالة · زرار التنزيل · الصفّ
 * الباهت)، فطلعت أربع صور مختلفة لنفس القايمة، والعميل شافها.
 *
 * والدرس اللي بيتكرّر: **المكوّن الواحد بيحلّ العنصر، مش التركيب.**
 * اللي بيخلّي أربع شاشات متشابهة مش إن العنصر واحد · هو إن
 * **الجدول** واحد.
 *
 * فالقايمة بقت `DocList`، ومرجعها جدول «المرفقات» في صفحة المشروع
 * (المتّفق عليه)، والفحص ده بيمنع رسمها بره.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))

/* المكوّن نفسه · وهو الوحيد اللي بيرسم الصفّ */
const OK = new Set(['components/docs/DocList.tsx', 'components/docs/DocFile.tsx'])

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name))
      : /\.tsx$/.test(e.name) ? [path.join(d, e.name)] : [])

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

const hits = []
for (const f of walk(SRC)) {
  const rel = path.relative(SRC, f)
  if (OK.has(rel)) continue
  const clean = strip(fs.readFileSync(f, 'utf8'))
  clean.split('\n').forEach((line, i) => {
    /* عمود حالة المستند · هو توقيع الجدول المنسوخ */
    if (/className=["'`]dstat/.test(line)) hits.push(`${rel}:${i + 1}  عمود حالة المستند`)
    /* زرار التنزيل جوّه جدول · مكانه `DocList` */
    if (/<DocDownload\b/.test(line)) hits.push(`${rel}:${i + 1}  <DocDownload> بره القائمة`)
  })
}

console.log('\n═══ قوائم المستندات ═══')
if (hits.length) {
  console.log(`\n🔴 جدول مستندات مرسوم بره المكوّن · ${hits.length} موضع`)
  for (const h of hits) console.log(`   ${h}`)
  console.log('   استعمل <DocList rows={…}> · والفرق يتبعت في `extra` أو `action`')
  process.exit(1)
}
console.log('\n✅ كل قوائم المستندات من مكوّن واحد\n')

/**
 * لوحة القائمة مرسومة في مكان واحد.
 *
 * ⚠️ **دي كانت مكتوبة ست مرّات بالنسخ.** `Select` و`MultiSelect`
 * و`FieldSelect` ومنتقي الحجم ومنتقي التجميع ومنتقي الأعمدة ·
 * كلهم بيرسموا `.fmenu` و`.fopt` بإيديهم. الـCSS كان واحدًا
 * فعلًا، فتغيير لون بيوصل لكلهم · **لكن أي تغيير في البنية أو
 * السلوك كان لازم يتعمل ست مرّات**.
 *
 * والعميل طلب حاجتين في يوم واحد (١٨ سبتمبر): الخلفية تبقى
 * معتمة، والعلامة تروح آخر الصفّ. الأولى في الـCSS فوصلت لكلهم
 * من سطر · والتانية لو كانت محتاجة تتكتب في كل نسخة كان زمانها
 * اتعملت في أربعة واتنسيت في اتنين، وطلع في السيستم قايمتان
 * بعلامة على اليمين وأربعة على الشمال.
 *
 * فاللوحة بقت `components/ui/menu.tsx`، والفحص ده بيمنع أي ملف
 * تاني يرسمها. اللي عايز شكلًا مختلفًا بيبعت `extra` أو `lead`
 * أو `mark` · مش بينسخ اللوحة.
 *
 * والدرس: **الكمبوننت الواحد مش اللي CSS-ه واحد · هو اللي
 * بنية-ه واحدة.**
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))

/* ⚠️ الاستثناءات بالاسم وبسببها · مش بالصمت.
   `menu.tsx` هو اللوحة نفسها. والتلاتة التانيين قوايم **أفعال**
   (`role="menu"`) لا قوايم **اختيار**: مفيهاش `.fopt-x` أصلًا،
   وصفوفها سطران (اسم ووصف) · فهي بتستعير سطح `.fmenu` وبس. */
const OK = new Set([
  'components/ui/menu.tsx',
  /* ⚠️ التقويم بيستعير **سطح** اللوحة لا صفوفها: جواه شبكة سبعة
     أعمدة لا قائمة خيارات، ومفيهاش `.fopt` ولا خانة علامة ·
     فحشره في `MenuPanel` كان هيطلّع خصايص لحالة واحدة. */
  'components/ui/DateField.tsx',
  'components/export/ExportMenu.tsx',
  'components/shell/Crumbs.tsx',
  'components/filters/SavedViews.tsx',
])

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name))
      : /\.tsx$/.test(e.name) ? [path.join(d, e.name)] : [])

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

/* الخانة `fopt-x` هي العلامة نفسها · ومحدش غير اللوحة بيرسمها */
const MARK = /className=["'`][^"'`]*\bfopt-x\b/
const PANEL = /className=["'`][^"'`]*\bfmenu\b/

const hits = []
for (const f of walk(SRC)) {
  const rel = path.relative(SRC, f)
  if (OK.has(rel)) continue
  const clean = strip(fs.readFileSync(f, 'utf8'))
  clean.split('\n').forEach((line, i) => {
    if (MARK.test(line)) hits.push(`${rel}:${i + 1}  خانة العلامة`)
    else if (PANEL.test(line)) hits.push(`${rel}:${i + 1}  لوحة القائمة`)
  })
}

console.log('\n═══ لوحة القائمة ═══')
if (hits.length) {
  console.log(`\n🔴 قائمة مرسومة بره المكوّن · ${hits.length} موضع`)
  for (const h of hits) console.log(`   ${h}`)
  console.log('   استعمل <MenuPanel> و<MenuOpt> · وأي فرق يتبعت خاصيةً')
  process.exit(1)
}
console.log('\n✅ كل القوائم من مكوّن واحد\n')

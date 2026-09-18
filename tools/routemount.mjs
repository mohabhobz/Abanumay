/**
 * كل مسار معرَّف في `ROUTES` لازم يكون **مركَّبًا** في الراوتر.
 *
 * ⚠️ **العطل ده وقع، والعميل هو اللي مسكه (١٨ سبتمبر).** في موديول
 * الخطة كتبت `planNew` في `ROUTES`، وزرار «افتح خطة للمشروع» في
 * تاب المشروع بينادي عليه · وما عملتش الشاشة ولا ركّبت المسار.
 * الراوتر قرا `/plans/new` على إنه `/plans/:id` بـ`id = "new"`،
 * فالشاشة رجّعت «لا توجد خطة بهذا الرقم».
 *
 * ⚠️ **وليه الأدوات كلها عدّته؟**
 *
 *   `routecover` بيسأل «كل **شاشة** ليها مسار مفحوص؟» · والشاشة
 *     دي **مش موجودة**، فمفيش حاجة يشتكي منها.
 *   `linkProbe` بيفحص `<a>` المرسومة · والزرار ده `<button>`
 *     بينادي `navigate()`، فمالوش `href` يتفحص.
 *   الجولة البصرية بتزور `tools/routes.mjs` · والمسار مش فيها.
 *
 * تلات أدوات، وكل واحدة بتجاوب سؤالًا تاني · **ومحدش فيهم بيسأل
 * السؤال ده**: هل كل مسار معلَن ليه شاشة؟ الفحص ده هو السؤال.
 *
 * والدرس اللي اتكرّر النهاردة أكتر من مرة: **اللي مش متسأل عنه
 * ما بيتمسكش**، وإضافة أداة أرخص من إضافة انتباه.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))
const routesFile = fs.readFileSync(path.join(SRC, 'app/routes.ts'), 'utf8')
const appFile = fs.readFileSync(path.join(SRC, 'app/App.tsx'), 'utf8')

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

/**
 * المسارات الساكنة المعلَنة · `key: '/x'`
 * والدوال (`plan: (id) => …`) بتتقرا من **بداية قالبها** لأن
 * الجزء المتغيّر بيتركّب وقت التشغيل.
 */
const declared = new Map()
/* ساكن · `plans: '/plans'` · لازم يتركّب بالحرف */
for (const m of strip(routesFile).matchAll(/^\s{2}(\w+):\s*'(\/[^']*)'/gm)) {
  declared.set(m[1], { path: m[2], dynamic: false })
}
/* ⚠️ **دالة · `plan: (id) => `/plans/${id}`** · اللي بعد البادئة
   متغيّر، فالمقارنة بتبقى مع قالب `:param` لا مع البادئة وحدها.
   أول نسخة كانت بتقارن بالبادئة فطلعت خمس ملاحظات كدّابة
   (`/budget/doc/` · `/reports/view/` …) · وكلها مركَّبة فعلًا
   بـ`:id`. أداة بتبلّغ عن حاجة مش موجودة أسوأ من أداة ساكتة. */
for (const m of strip(routesFile).matchAll(/^\s{2}(\w+):\s*\([^)]*\)\s*=>\s*\n?\s*`(\/[^`$]*)/gm)) {
  const raw = m[2]
  const dyn = raw.endsWith('/')
  declared.set(m[1], { path: dyn ? `${raw}:x` : raw, dynamic: dyn })
}

/** المسارات المركَّبة فعلًا · `path="…"` أو `path={ROUTES.x}` */
const mounted = new Set()
const app = strip(appFile)
for (const m of app.matchAll(/path="([^"]+)"/g)) mounted.add(m[1])
for (const m of app.matchAll(/path=\{ROUTES\.(\w+)\}/g)) {
  const v = declared.get(m[1])
  if (v) mounted.add(v.path)
}
/* القوالب: path={`${ROUTES.plans}/:id`} */
for (const m of app.matchAll(/path=\{`\$\{ROUTES\.(\w+)\}([^`]*)`\}/g)) {
  const v = declared.get(m[1])
  if (v) mounted.add(v.path + m[2])
}

/**
 * مسار مركَّب بيغطّي المسار المعلَن؟
 *
 * ⚠️ **الجزء المتغيّر ما بيغطّيش مسارًا ساكنًا · ودي كانت أول
 * نسخة من الفحص ده، وطلعت خضرا والعطل قدّامها.** كتبت `covered`
 * بتقبل `:param` مقابل أي كلمة، فـ`/plans/:id` «غطّت» `/plans/new`
 * · وده **بالحرف** اللي الراوتر بيعمله: بيلقط `new` كرقم خطة
 * ويرجّع «لا توجد خطة بهذا الرقم». يعني الفحص كان بيقلّد العطل
 * بدل ما يمسكه.
 *
 * **أداة بتطمّن وهي مش شايفة أسوأ من أداة ساكتة** · نفس درس
 * `linkaudit` في ١٦ سبتمبر.
 *
 * القاعدة الصح: المسار **الساكن** لازم يلاقي تركيبًا ساكنًا
 * حرفًا بحرف · والمقارنة بـ`:param` للمسارات اللي فيها متغيّر
 * أصلًا وحدها.
 */
const covered = (want) => {
  if (mounted.has(want)) return true
  const parts = want.split('/').filter(Boolean)
  /* ساكن بالكامل · مفيش تساهل */
  if (!parts.some((x) => x.startsWith(':'))) return false
  for (const got of mounted) {
    const gp = got.split('/').filter(Boolean)
    if (gp.length !== parts.length) continue
    if (gp.every((seg, i) => seg.startsWith(':') || parts[i].startsWith(':') || seg === parts[i])) {
      return true
    }
  }
  return false
}

/* ⚠️ المسارات اللي بتتركّب من قالب الأب (`*`) أو اللي مالهاش شاشة
   بذاتها مستثناة بالاسم · والاستثناء بسببه لا بالصمت. */
const SKIP = new Set([
  /* تابات صفحة المشروع والجهة · بتتركّب بقالب `:tab` في الأب */
  'projectTab', 'entityTab',
])

const miss = []
for (const [key, val] of declared) {
  if (SKIP.has(key)) continue
  if (!val.path || val.path === '/') continue
  if (!covered(val.path)) miss.push(`${key}  →  ${val.path}`)
}

console.log('\n═══ تركيب المسارات ═══')
if (miss.length) {
  console.log(`\n🔴 مسار معلَن بلا شاشة · ${miss.length}`)
  for (const m of miss) console.log(`   ${m}`)
  console.log('   الزرار اللي بينادي عليه بيودّي لشاشة «غير موجود»')
  process.exit(1)
}
console.log(`\n✅ كل المسارات المعلَنة مركَّبة · ${declared.size} مسارًا\n`)

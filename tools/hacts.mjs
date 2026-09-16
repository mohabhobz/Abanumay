import fs from 'node:fs'
import path from 'node:path'

/* ═══════════════════════════════════════════════════════════
   عقد أفعال الترويسة · فحص

   ⚠️ **القاعدة اللي مالهاش فحص بتفضل نيّة.** اتعلّمناها مرتين في
   يومين: الشرطة الطويلة كانت ممنوعة ووصلت 243، وقاعدة «خلّي
   الأوبشنز موجودة» كانت مكتوبة في ترويسة الملف والكود تحتها بيعمل
   عكسها. فالعقد الجديد بيتولد ومعاه فحصه من أول يوم.

   والفحص بيمسك تلات انحرافات:

   1 · **زرار أساسي في شريط الأدوات.** `btn-p` جوّه `ftool-a`
       معناه إن فعل إنشاء رجع للشريط · وده اللي كان في الصرف.

   2 · **مجموعة أفعال مكتوبة بالإيد في الترويسة.** `<header>` فيه
       `btn-p` أو `btn-ghost` من غير `PageActions` معناه إن شاشة
       اخترعت ترتيبها لوحدها.

   3 · **شاشة قائمة بلا `PageActions` ولا سبب مكتوب.** الاستثناء
       مسموح (الاتفاقيات مالهاش إنشاء من الصندوق)، بس لازم يكون
       **مكتوبًا** في الملف بعلامة `PageActions` في تعليق ·
       فالقارئ التالي يعرف إنه قرار لا سهو.
   ═══════════════════════════════════════════════════════════ */

/** شاشات القوايم اللي العقد بينطبق عليها */
const LIST_PAGES = [
  'src/features/projects/list/ProjectsListPage.tsx',
  'src/features/entities/EntitiesListPage.tsx',
  'src/features/budget/BudgetPage.tsx',
  'src/features/payments/PaymentsPage.tsx',
  'src/features/agreements/AgreementsPage.tsx',
]

const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '')

/** يمسح التعليقات ويسيب مكانها مسافات · فأرقام السطور بتفضل صح */
const blank = (m) => m.replace(/[^\n]/g, ' ')
const code = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\/\/[^\n]*/g, blank)

/** جسم الترويسة · من `<header>` لحدّ `</header>` */
const headerOf = (s) => {
  const a = s.indexOf('<header>')
  if (a === -1) return ''
  const b = s.indexOf('</header>', a)
  return b === -1 ? '' : s.slice(a, b)
}

/** جسم مجموعة أدوات الشريط */
const toolsOf = (s) => {
  const a = s.indexOf('className="ftool-a"')
  if (a === -1) return ''
  return s.slice(a, a + 3000)
}

const bad = []

for (const rel of LIST_PAGES) {
  const raw = read(rel)
  if (!raw) { bad.push(`${rel}: الملف مش موجود · القايمة في الأداة قديمة`); continue }
  const src = code(raw)

  if (/btn-p/.test(toolsOf(src))) {
    bad.push(`${rel}: زرار أساسي في \`ftool-a\` · الإنشاء مكانه الترويسة`)
  }

  const head = headerOf(src)
  const hasComp = head.includes('<PageActions')
  const handMade = /btn-p|btn-ghost/.test(head)

  if (handMade && !hasComp) {
    bad.push(`${rel}: أزرار مكتوبة بالإيد في الترويسة · استعمل \`PageActions\``)
  }

  /* الاستثناء لازم يكون مكتوبًا · التعليقات مقصوصة من `src`
     فبندوّر في الخام */
  if (!hasComp && !raw.includes('PageActions')) {
    bad.push(`${rel}: مفيش \`PageActions\` ولا سبب مكتوب · لو الشاشة مالهاش إنشاء، قول ليه في تعليق`)
  }
}

/* والكومبوننت نفسه لازم يفضل الترتيب اللي العقد بيقوله */
const comp = read('src/components/shell/PageActions.tsx')
if (comp) {
  const at = (k) => comp.indexOf(k)
  const ok = at('{settings &&') < at('{secondary?.map') &&
    at('{secondary?.map') < at('{create &&')
  if (!ok) bad.push('PageActions.tsx: الترتيب اتغيّر · إعدادات ← ثانوي ← إنشاء')
}

console.log('\n═══ عقد أفعال الترويسة ═══')
if (bad.length === 0) {
  console.log(`  ${LIST_PAGES.length} شاشة قائمة · كلها على العقد`)
  console.log('\n✅ الإنشاء في الترويسة وفي الركن')
} else {
  for (const b of bad) console.log(`  ❌ ${b}`)
  console.log(`\n❌ ${bad.length} خروج عن العقد`)
  process.exit(1)
}

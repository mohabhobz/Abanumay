/**
 * مسارات الأدوات · ممنوع `.pathname` على `import.meta.url`.
 *
 * ⚠️ **العطل ده وقع فعلًا، وما ظهرش عندي أبدًا.** مجلّد المستخدم
 * اسمه «Claude Work Projects» · وفيه مسافات. و`new URL(...).pathname`
 * بيرجّع المسار **مكوَّدًا** (`Claude%20Work%20Projects`)، و`fs` ما
 * بيفكّش الترميز · فالأداة بتطيح:
 *
 *     ENOENT: no such file or directory, open
 *     '/Users/.../Claude%20Work%20Projects/.../src/styles/index.css'
 *
 * عندي في السحابة المسار `/home/claude/abanumay/app` · مفيش مسافة،
 * فالتكويد ما بيغيّرش حاجة والعطل بيفضل مستخفي. يعني **بيئة واحدة
 * مش كفاية للتأكّد** · والفاحص ده هو البديل عن إني أفتكر.
 *
 * الصحّ: `fileURLToPath(new URL(x, import.meta.url))`.
 * (تمرير كائن `URL` مباشرة لـ`fs` سليم كمان · نود بيفكّ الترميز.)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = fileURLToPath(new URL('./', import.meta.url))
const BAD = /new URL\([^)]*import\.meta\.url\s*\)\s*\.pathname/

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name))
      : e.name.endsWith('.mjs') ? [path.join(d, e.name)] : [])

const hits = []
for (const f of walk(DIR)) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (BAD.test(line)) hits.push(`${path.relative(DIR, f)}:${i + 1}`)
  })
}

if (hits.length) {
  console.log(`🔴 مسار مكوَّد · ${hits.length} موضع`)
  for (const h of hits) console.log(`   ${h}`)
  console.log('   الصحّ: fileURLToPath(new URL(x, import.meta.url))')
  process.exit(1)
}
console.log('✅ مسارات الأدوات · سليمة مع المسافات')

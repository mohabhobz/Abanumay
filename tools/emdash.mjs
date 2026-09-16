import fs from 'node:fs'
import path from 'node:path'

/* ═══════════════════════════════════════════════════════════
   الشرطة الطويلة `—` ممنوعة في السيستم كله.

   ⚠️ **القاعدة دي كانت مكتوبة وما كانش عليها فحص.** فضلت
   بتتكسر في كل شغل جديد من غير ما حد يلاحظ، لحد ما بقى فيها
   243 حالة · **تلاتة منهم في نصّ معروض** والباقي في التعليقات.
   قاعدة بلا فحص بتبقى نيّة لا قاعدة.

   والفحص بيفرّق بين الاتنين:
   · نصّ معروض   → خطأ · بيوقّف الكوميت
   · تعليق       → بيتعدّ وبيتعرض، والسقف في `ui-budget.json`
                   ما بيعلاش · يعني الشغل الجديد نضيف والقديم
                   بيتنضّف بالتدريج

   والبديل: `·` للفصل · `–` للمدى (تواريخ وأرقام) · `:` للشرح.
   ═══════════════════════════════════════════════════════════ */

const EM = String.fromCharCode(0x2014)
const ROOTS = ['src', 'tools']
const EXT = /\.(tsx?|css|mjs)$/

const walk = (d, out = []) => {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name)
    if (f.isDirectory()) walk(p, out)
    else if (EXT.test(f.name)) out.push(p)
  }
  return out
}

/** يمسح التعليقات ويسيب مكانها مسافات · فأرقام السطور بتفضل صح */
const blank = (m) => m.replace(/[^\n]/g, ' ')
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\/\/[^\n]*/g, blank)

const shown = []
let inComments = 0

for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue
  for (const file of walk(root)) {
    const src = fs.readFileSync(file, 'utf8')
    const code = stripComments(src)
    src.split('\n').forEach((line, i) => {
      if (!line.includes(EM)) return
      const codeLine = code.split('\n')[i] ?? ''
      if (codeLine.includes(EM)) shown.push({ file, n: i + 1, line: line.trim() })
      else inComments += (line.match(new RegExp(EM, 'g')) ?? []).length
    })
  }
}

console.log('\n═══ الشرطة الطويلة ═══')
console.log(`  في تعليقات: ${inComments}`)

if (shown.length === 0) {
  console.log('  في نصّ معروض: 0')
  console.log('\n✅ مفيش شرطة طويلة في نصّ معروض')
} else {
  console.log(`  في نصّ معروض: ${shown.length}\n`)
  for (const s of shown) console.log(`  ${s.file}:${s.n}\n    ${s.line.slice(0, 120)}`)
  console.log('\n❌ الشرطة الطويلة ممنوعة · استعمل `·` للفصل و`–` للمدى')
  process.exit(1)
}

/* السقف على تعليقات · ما يعلاش */
const B = 'ui-budget.json'
if (fs.existsSync(B)) {
  const b = JSON.parse(fs.readFileSync(B, 'utf8'))
  const cap = b.emDashInComments
  if (cap === undefined) {
    console.log(`\n⚠️ ضيف "emDashInComments": ${inComments} في ${B}`)
  } else if (inComments > cap) {
    console.log(`\n❌ التعليقات طلعت من ${cap} لـ${inComments} · السقف ما يعلاش`)
    process.exit(1)
  } else {
    console.log(`  السقف: ${cap} · ✅`)
  }
}

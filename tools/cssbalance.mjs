/**
 * فاحص توازن التعليقات في الـCSS — **يشتغل قبل البِناء لا بعده**.
 *
 * ليه موجود: الغلطة دي وقعت **أربع مرّات** في جولة واحدة — تعليق
 * عربي جديد بيتحطّ بعد `*/` من غير `/*`، فبوستسيإس بيقرا النصّ
 * كأنه كود ويقع البِناء. والأسوأ إن الجرد بعدها بيشتغل على dist
 * قديم ويرجع أخضر كاذب.
 *
 * البِناء بيكشفها، بس بعد ٣٠ ثانية وبرسالة بتشاور على العمود مش
 * على السبب. ده بيكشفها في جزء من الثانية وبيقول رقم السطر.
 *
 *   node tools/cssbalance.mjs
 */
import fs from 'node:fs'

const files = ['src/styles/index.css']
let bad = 0

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  let open = -1, line = 1, inStr = null
  for (let i = 0; i < src.length; i++) {
    const c = src[i], n = src[i + 1]
    if (c === '\n') line++
    if (open === -1) {
      // خارج تعليق: بنتجاهل جوّه النصوص عشان علامة الإغلاق جوّه سلسلة
      if (inStr) { if (c === inStr && src[i - 1] !== '\\') inStr = null; continue }
      if (c === '"' || c === "'") { inStr = c; continue }
      if (c === '/' && n === '*') { open = line; i++ }
      else if (c === '*' && n === '/') {
        console.log(`❌ ${f}:${line} — إغلاق تعليق \`*/\` بلا فتح`)
        bad++; i++
      }
    } else if (c === '*' && n === '/') { open = -1; i++ }
  }
  if (open !== -1) { console.log(`❌ ${f}:${open} — تعليق مفتوح ما اتقفلش`); bad++ }
}

console.log(bad ? `\n${bad} خلل في توازن التعليقات` : '✅ التعليقات متوازنة')
process.exit(bad ? 1 : 0)

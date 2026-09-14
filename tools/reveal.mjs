/**
 * بيولّد ستايل بيكشف **الطبقات العابرة** عشان الجرد يشوفها.
 *
 * ليه: التلميح وقايمة الحساب والبانلات كلهم `opacity:0` لحدّ ما
 * يحصل هوفر أو فوكس. الجرد بيزور الصفحة ويقيس، فكل ده **بره
 * القياس تمامًا** — و`deadcss.mjs` قاس المشكلة بالرقم: **٣٣٥ من
 * ٧٩٦ كلاس (٤٢٪) ما بترسمش** في المسارات.
 *
 * وده مش نظري: التلميح في الشريط الجانبي فضل بركن ٥٠٪ (كبسولة
 * بالغلط) بعد جولة الركن كلها، لأن الأداة ما شافتهوش أصلًا.
 * والعميل هو اللي شافه.
 *
 * ⚠️ **القايمة بتتولّد من الـCSS نفسه، مش مكتوبة بالإيد.** الأداة
 * بتدوّر على كل قاعدة فيها `:hover`/`:focus`/`.on` وبتخلّي
 * `opacity:1`، وبتاخد السيلكتور الهدف منها. فأي طبقة عابرة جديدة
 * بتدخل الفحص لوحدها من غير ما حد يفتكر يضيفها.
 *
 *   node tools/reveal.mjs          # يطبع الستايل
 */
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../src/styles/index.css', import.meta.url).pathname, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')

const targets = new Set()
for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const [, sel, body] = m
  if (!/opacity\s*:\s*1\b/.test(body)) continue
  if (!/:hover|:focus|:focus-visible|\.on\b|\.open\b|\.dragging/.test(sel)) continue
  /* ⚠️ `:not(...)` بيتشال الأول: محفّز جوّه نفي مش محفّز. من غيره
     `.rail:not(.open) .railitem:hover .rail-tip` بيتقصّ عند `.open`
     اللي جوّه الـ`not` ويطلع `) .railitem…` فيتترفض — وده بالظبط
     اللي خلّى التلميح يفضل خارج الكشف. */
  for (const one of sel.replace(/:not\([^)]*\)/g, '').split(',')) {
    /* الجزء اللي بعد آخر محفّز هو العنصر اللي بيظهر */
    /* ⚠️ الترتيب والـ`\b` مش تفصيلة: `\.on` من غير حدّ كلمة بيطابق
       جوّه `.open`، فسيلكتور زي `.rail:not(.open) .railitem:hover
       .rail-tip` كان بيتقصّ من غلط ويطلع `pen) …` فيتترفض ·
       والتلميح فضل خارج الكشف. الأطول الأول، وحدّ كلمة على الكل. */
    const t = one.trim().replace(/^[\s\S]*?(?::focus-visible|:hover|:focus|\.open\b|\.on\b|\.dragging\b)\s*/, '').trim()
    if (t && /^[.#\[a-zA-Z]/.test(t) && !t.includes(':')) targets.add(t)
  }
}
const list = [...targets].sort()
const out = list.length
  ? `/* اتولّد بـtools/reveal.mjs · ${list.length} طبقة عابرة */\n` +
    list.map((t) => `${t}{opacity:1!important;visibility:visible!important;pointer-events:none}`).join('\n')
  : '/* مفيش طبقات عابرة */'
if (process.argv.includes('--list')) console.error(`${list.length} طبقة: ${list.join(' · ')}`)
console.log(out)

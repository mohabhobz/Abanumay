/**
 * تغطية الجرد · **كل شاشة في التطبيق لازم يكون لها مسار مفحوص**.
 *
 * ⚠️ ده الفحص اللي بيحرس باقي الفحوص. كل الأدوات المقيسة (الركن ·
 * التقدّم · الوشوش · ارتفاع التحكّم · الطبقات العايمة · المحاذاة)
 * بتزور `tools/routes.mjs` وبس. فموديول جديد بيتبني من غير ما
 * مساره يتضاف هناك بيخلّي **كل الأدوات ترجع خضرا وهي ما زارتش
 * شاشاته أصلًا** — وده أسوأ من فحص بيسقط: ده فحص بيطمّن غلط.
 *
 * الفحص ساكن وسريع (بلا متصفّح) عشان يقدر يقعد على هوك الكوميت.
 *
 *   node tools/routecover.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { ROUTES as AUDITED } from './routes.mjs'
import { fileURLToPath } from 'node:url'

const APP = fileURLToPath(new URL('../', import.meta.url))
const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8')

/* ── ١ · خريطة `ROUTES` من `src/app/routes.ts` (القيم النصّية بس) ── */
const map = {}
for (const m of read('src/app/routes.ts').matchAll(/^\s{2}(\w+):\s*'([^']+)',/gm)) map[m[1]] = m[2]

/* ── ٢ · كل `<Route path=…>` في `App.tsx` ومعاه نوع العنصر ── */
const app = read('src/app/App.tsx')
/* ⚠️ **تعبير واحد بيقرا الصيغتين.** أول كتابة كانت تعبيرين — واحد
   للسطر الواحد وواحد للمتعدّد — ولقطوا **١١ مسارًا من ٢٠**: التسعة
   الباقيين كانوا بصيغة وسط ما دخلتش في أي تعبير منهم. وأداة تغطية
   بتفوّت نص المسارات **أخطر من غياب الأداة**: بترجع «✅ كل شاشة
   محروسة» وهي شايفة نصّهم.
   الصيغة الصحّ: نقطّع الملف عند كل `<Route`، وكل قطعة ناخد منها
   أول `path=` وأول `element=` مهما كان توزيعهم على السطور. */
const declared = []
/* ⚠️ **الأقواس بتتعدّ، ما بتتطابقش بتعبير.** `[^}]*` بتقف عند أول
   `}`، و`` path={`${ROUTES.projects}/:id`} `` جوّاها `}` في نصّها —
   فكل مسار فيه `:param` كان بيتقصّ ويتفلت. النتيجة: ١١ شاشة من ٢٠،
   والتسعة المفقودين هم **بالظبط** صفحات التفصيل اللي أي موديول
   جديد بيضيفها. الحلّ عدّاد أقواس لا تعبير. */
const braced = (str, from) => {
  let d = 0
  for (let i = from; i < str.length; i++) {
    if (str[i] === '{') d++
    else if (str[i] === '}') { d--; if (d === 0) return str.slice(from + 1, i) }
  }
  return null
}
for (const chunk of app.split('<Route').slice(1)) {
  const pm = chunk.match(/^\s*path=/)
  if (!pm) continue
  const at = pm[0].length
  let raw
  if (chunk[at] === '{') raw = braced(chunk, at)
  else { const q = chunk.slice(at).match(/^("[^"]*"|'[^']*')/); raw = q?.[1] }
  if (raw == null) continue
  const ei = chunk.indexOf('element={')
  const el = ei < 0 ? '' : (braced(chunk, ei + 'element='.length) ?? '').trim()
  declared.push({ raw: raw.trim(), el })
}

const resolve = (raw) => {
  let s = raw.replace(/^`|`$/g, '').replace(/^'|'$/g, '')
  s = s.replace(/\$\{ROUTES\.(\w+)\}/g, (_, k) => map[k] ?? `«${k}»`)
  if (/^ROUTES\.(\w+)$/.test(s)) s = map[s.replace('ROUTES.', '')] ?? s
  return s
}

const seen = new Set()
const pages = []
for (const d of declared) {
  const p = resolve(d.raw)
  if (!p.startsWith('/') || seen.has(p)) continue
  seen.add(p)
  /* ⚠️ **التحويلة مش شاشة.** `<Navigate>` ما بيرسمش حاجة، و`*`
     مسار الالتقاط. الاتنين خارج الفحص بقصد. */
  if (p === '*' || /^<Navigate/.test(d.el)) continue
  pages.push(p)
}

/* ── ٣ · هل لكل نمط مسار مفحوص واحد على الأقل؟ ── */
const rx = (p) => new RegExp('^' + p.replace(/:[^/]+/g, '[^/]+').replace(/\//g, '\\/') + '$')
const missing = pages.filter((p) => !AUDITED.some((a) => rx(p).test(a)))

const VERBOSE = process.argv.includes('--list')
console.log(`════ تغطية الجرد · ${pages.length} شاشة معرَّفة · ${AUDITED.length} مسار مفحوص ════`)
if (VERBOSE) for (const p of pages) console.log('  · ' + p)
if (!missing.length) { console.log('✅ كل شاشة لها مسار في tools/routes.mjs'); process.exit(0) }

console.log(`\n🔴 ${missing.length} شاشة مالهاش ولا مسار مفحوص:`)
for (const p of missing) console.log('  ' + p)
console.log('\n   كل الأدوات المقيسة بتزور tools/routes.mjs وبس، فالشاشات دي')
console.log('   خارج الحراسة تمامًا والفحوص هترجع خضرا من غير ما تشوفها.')
console.log('   ضيف مسارًا حقيقيًّا (بمعرّف فعلي لو فيه :param) في نفس الكوميت.')
process.exit(1)

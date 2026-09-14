/**
 * البوّابة · **وضع سقف (ratchet)**.
 *
 * القاعدة الوحيدة: كل عدّاد **ينزل أو يفضل زيه، وما يطلعش أبدًا**.
 * السقوف في `ui-budget.json` تحت الـgit، فأي طلوع بيبان في الديف
 * كقرار مكتوب لا كسهو.
 *
 * ليه فحصان؟ **البوّابة لازم تكون سريعة وإلا محدش هيشغّلها.**
 *   npm run audit        ← ثابت · أقل من ثانية · بلا متصفّح · ده هوك الكوميت
 *   npm run audit:full   ← بيضيف فحوص وقت التشغيل · محتاج build + playwright
 *   npm run audit:lock   ← بيثبّت الأرقام الجديدة كسقف بعد جولة خضرا
 *
 * الفحص الثابت بيمسك **٩٠٪ من اللي بيهمّ في كود جديد**: القيمة
 * الحرفية. والكامل بيمسك اللي ما ينفعش يتحسب من الملف: التباين
 * المركّب وتوزيع المرسوم فعلًا.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = new URL('../', import.meta.url).pathname
const BUDGET = path.join(ROOT, 'ui-budget.json')
const FULL = process.argv.includes('--full')
const LOCK = process.argv.includes('--lock')

const css = fs.readFileSync(path.join(ROOT, 'src/styles/index.css'), 'utf8')
/** يشيل التعليقات عشان ما نعدّش أرقامًا في شرح */
const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
/** بلوك `:root` مستثنى — هو مكان تعريف القيم.
 *
 * ⚠️ **المحدّد لازم يكون `:root` وحده، لا أي محدّد بيبدأ بيه.**
 * أول كتابة كانت `/:root[^{]*\{.../` — ودي بتلقّط كمان قواعد زي
 * `:root[data-theme="dark"] .fchip.on{...}` وتبلع معاها **كل
 * اللي بعدها لحدّ أول `\n}`**. النتيجة: قواعد سليمة كانت بتختفي
 * من العدّ، والعدّادات كانت **أقل من الحقيقة**.
 *
 * بان لما اتشالت قاعدة تجاوز ثيم: `blurValues` طلع من ١٠ لـ١١
 * من غير ما حدّ يضيف طمس — الرقم الجديد هو الصح، والقديم كان
 * ناقصًا. بوّابة بتعدّ ناقص أسوأ من بوّابة مش موجودة: بتدّي
 * طمأنينة كاذبة. */
const outsideRoot = bare.replace(
  /^:root(\[[^\]]*\])?(\s*,\s*:root(\[[^\]]*\])?)*\s*\{[\s\S]*?\n\}/gm, '')

const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])
const tsx = walk(path.join(ROOT, 'src')).filter((f) => /\.tsx?$/.test(f))
  .map((f) => fs.readFileSync(f, 'utf8')).join('\n')

const count = (re, s = bare) => (s.match(re) ?? []).length
const distinct = (re, s = bare) => new Set((s.match(re) ?? [])).size

/* ── العدّادات الثابتة ── */
const metrics = {
  /* قيمة حرفية في font-size · المفروض توكن */
  fontSizeLiterals: count(/font-size\s*:\s*(?:\.?\d[\d.]*)(?:rem|px|em)/g),
  /* قيمة حرفية في padding/margin/gap */
  spacingLiterals: count(/(?:^|[;{\s])(?:padding|margin|gap|row-gap|column-gap)[a-z-]*\s*:\s*[^;{}]*?(?:\.?\d[\d.]*)(?:rem|px|em)/gm),
  /* نسبة أو بكسل حرفي في line-height · المفروض توكن من العيلتين.
     ⚠️ الأرضية العربية (١٫٦) ما تتحرسش بعدّاد لوحده — العدّاد
     بيمنع الرقم الحرفي، و`tools/leading.mjs` بيقيس **النصّ اللي
     لفّ فعلًا** ويرفض أي نسبة تحت ١٫٥. الاتنين لازمين: الأول
     بيمنع الانحراف، والتاني بيمسك الخرق حتى لو اتكتب بتوكن. */
  lineHeightLiterals: count(/line-height\s*:\s*(?!var|inherit|normal)[\d.]+/g),
  /* **شريط ملوّن على حافة واحدة** — `inset Npx 0 0 0` أو
     `inset 0 Npx 0 0` بعرض أكبر من ١px.
     العميل رفض الشكل ده مرّتين، والسبب مبدئي لا ذوقي: **الحالة
     معلومة، والمعلومة تتقال بالكلام لا تترسم كحدّ.** الكارت اللي
     كان عليه شريط كان بيقول «متعثّر» في وسم وفي صفوف الفحص وفي
     سطر ملاحظة — فالشريط كان نسخة رابعة مرسومة على الحافة.
     الحدّ ١px (الحلقة) مسموح · اللي فوقه على جهة واحدة خرق. */
  edgeBars: count(/inset\s+(?:-?[2-9]|-?[1-9]\d)[\d.]*px\s+0(?:px)?\s+0(?:px)?\s+0(?:px)?|inset\s+0(?:px)?\s+(?:-?[2-9]|-?[1-9]\d)[\d.]*px\s+0(?:px)?\s+0(?:px)?/g),
  /* ألفا ملء حرفية · المفروض درجة من `--fl-0…7`.
     السطر اللي بيعرّف الدرجة نفسها مستثنى (`--fl-N:`). */
  fillLiterals: count(/(?<!--fl-\d:)rgba\(var\(--wC\)\s*,\s*calc\(/g),
  /* وصفة ظلّ خارجي حرفية · المفروض درجة من `--el-1…4`.
     الحلقة (`0 0 0 Npx`) والاتجاهي (إزاحة أفقية) و`inset`
     مستثنيين — دول مش ارتفاع. */
  /* ⚠️ الطبقة لازم تبدأ من **أول التصريح أو بعد فاصلة**، وإزاحتها
     الرأسية **مش صفر**. من غير الشرطين، `0 0 22px 2px` (نبضة
     ضوئية في keyframe — حلقة لا ارتفاع) بتتعدّ خرقًا. */
  shadowLiterals: count(/(?:box-shadow:|,)\s*0 +[1-9][\d.]*px +[\d.]+px/g),
  /* قيمة حرفية في border-radius */
  radiusLiterals: count(/border-radius\s*:\s*[^;{}]*?(?:\.?\d[\d.]*)(?:rem|px|%)/g),
  /* لون سداسي برّه :root */
  hexOutsideRoot: count(/#[0-9a-fA-F]{3,8}\b/g, outsideRoot),
  /* وصفات الزجاج · بتتعدّ **برّه `:root`** لأن جوّه هو مكان
     التعريف · لو عدّينا جوّه، إضافة `--mat-*` نفسها بتطلّع الرقم */
  blurValues: distinct(/blur\(\s*[\d.]+px\s*\)/g, outsideRoot),
  saturateValues: distinct(/saturate\(\s*[\d.]+\s*\)/g, outsideRoot),
  /* ⚠️ العدّاد ده كان `deprecatedTokens` (استعمالات `--r0` و`--r3`)
     واتشال يوم ١٢ سبتمبر: الحصر بالسطر بيّن إن **الاتنين شرعيّان**
     — `--r0` درجة لازمة لنطاق ١٢–٢٨px، و`--r3` مستعمل في المودال
     والشيت (وما ظهرش في الجرد لأنهم محتاجين تفاعل). عدّاد بيعاقب
     على استعمال سليم بيدفع الناس تكتب الرقم الحرفي هربًا منه. */
  /* `%` أو رقم برّه العزل في JSX · بيقلب بصريًّا في RTL */
  pctOutsideIsolation: count(/<\/Num>%|<\/span>%|<\/b>%/g, tsx),
  /* ستايل سطري في JSX · كل واحد فرصة لقيمة حرفية */
  inlineStyles: count(/style=\{\{/g, tsx),
  /* ⚠️ العدّاد ده **مكانش موجود** لحدّ ١٢ سبتمبر، وده كان ثغرة
     حقيقية: الجرد بيقرا الـCSS، فـ٦٦ مسافة حرفية كانت مختبية في
     الـJSX ومحدش شايفها. الفحص اللي بيقيس نص السطح بيرجع أخضر
     على نصّه التاني. */
  spacingLiteralsJsx: count(/\b(padding|margin|gap|rowGap|columnGap)[A-Za-z]*\s*:\s*'[^']*[\d.](px|rem)/g, tsx),
}

/* ── العدّادات وقت التشغيل (بتحتاج متصفّح) ── */
const runners = {
  fontSizesRendered: ['vizaudit.mjs', /font-size · (\d+) قيمة/],
  paddingsRendered: ['vizaudit.mjs', /\npadding · (\d+) قيمة/],
  shadowsRendered: ['vizaudit.mjs', /shadow · (\d+) قيمة/],
  radiusOffScale: ['radaudit.mjs', /القيم خارج السلّم ═══\n((?:  \d.*\n)*)/],
  nonTextFails: ['nontext.mjs', /✖/g],
}

if (FULL) {
  const out = {}
  for (const tool of ['vizaudit.mjs', 'radaudit.mjs', 'nontext.mjs']) {
    process.stderr.write(`… ${tool}\n`)
    try { out[tool] = execFileSync('node', [path.join(ROOT, 'tools', tool)], { encoding: 'utf8', maxBuffer: 64 << 20 }) }
    catch (e) { out[tool] = e.stdout ?? '' }
  }
  const g = (tool, re) => { const m = out[tool]?.match(re); return m ? Number(m[1]) : null }
  metrics.fontSizesRendered = g('vizaudit.mjs', /font-size · (\d+) قيمة/)
  metrics.paddingsRendered = g('vizaudit.mjs', /\n═══ padding · (\d+) قيمة/)
  metrics.shadowsRendered = g('vizaudit.mjs', /shadow · (\d+) قيمة/)
  const off = out['radaudit.mjs']?.split('═══ ٢ · القيم خارج السلّم ═══')[1]?.split('═══')[0] ?? ''
  metrics.radiusOffScale = off.includes('نضيف') ? 0 : (off.match(/^  \d[\d.]*px/gm) ?? []).length
  metrics.nonTextFails = (out['nontext.mjs']?.match(/✖/g) ?? []).length
}

/* ── المقارنة ── */
const budget = fs.existsSync(BUDGET) ? JSON.parse(fs.readFileSync(BUDGET, 'utf8')) : null

if (LOCK || !budget) {
  const next = { ...(budget ?? {}) }
  for (const [k, v] of Object.entries(metrics)) if (v !== null && v !== undefined) next[k] = v
  next._note = 'السقف · الرقم ينزل أو يثبت وما يطلعش · حدّثه بـnpm run audit:lock بعد جولة خضرا'
  next._updated = new Date().toISOString().slice(0, 10)
  fs.writeFileSync(BUDGET, JSON.stringify(next, null, 2) + '\n')
  console.log(budget ? '🔒 السقف اتثبّت على الأرقام الحالية.' : '🔒 اتعمل ui-budget.json بأرقام النهارده.')
  console.log(JSON.stringify(metrics, null, 2))
  process.exit(0)
}

let over = 0, under = 0
const rows = []
for (const [k, v] of Object.entries(metrics)) {
  if (v === null || v === undefined) continue
  const cap = budget[k]
  if (cap === undefined) { rows.push(['🆕', k, v, '—']); continue }
  if (v > cap) { over++; rows.push(['🔴', k, v, cap]) }
  else if (v < cap) { under++; rows.push(['🟢', k, v, cap]) }
  else rows.push(['  ', k, v, cap])
}
const w = Math.max(...rows.map((r) => r[1].length))
console.log(`\n${FULL ? 'الفحص الكامل' : 'الفحص الثابت'} · ${new Date().toISOString().slice(0, 10)}\n`)
console.log('    ' + 'العدّاد'.padEnd(w) + '  الآن   السقف')
for (const [f, k, v, c] of rows) console.log(`${f}  ${k.padEnd(w)} ${String(v).padStart(5)} ${String(c).padStart(7)}`)

if (over) {
  console.log(`\n🔴 **${over} عدّاد طلع فوق سقفه.**`)
  console.log('   الرقم بينزل أو يثبت، وما يطلعش. راجع الديف وشيل القيمة الحرفية،')
  console.log('   أو لو الطلوع مقصود اكتب السبب في الكوميت وشغّل npm run audit:lock.')
  process.exit(1)
}
if (under) console.log(`\n🟢 ${under} عدّاد نزل. ثبّتهم بـ**npm run audit:lock**.`)
else console.log('\n✅ كل العدّادات على سقفها.')

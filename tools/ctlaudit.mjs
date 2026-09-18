/**
 * جرد **عيلة التحكّم** — بيقيس هل كل التحكّمات المحايدة بترسم نفس
 * السطح ونفس الحدّ، في الثيمات التلاتة.
 *
 * ═══ ليه ═══
 *
 * الزرار والحقل والمنسدلة والشريحة والتاب **دور واحد**: حاجة
 * بتتضغط. فالمفروض يكون ليهم سطح واحد وحدّ واحد، ويتغيّروا من
 * مكان واحد.
 *
 * اللي كان موجود: عيلة ناقصة (`--fld-bg` و`--fld-line`) بتغطّي
 * خمس كمبوننتس، والباقي كل واحد كاتب وصفته بإيده —
 * `rgba(var(--edgeC),.07)` هنا و`.55 * var(--wM)` هناك
 * و`--edge-1` هنا و`--edge-2` هناك. مافيش خرق ظاهر للعين في
 * لقطة واحدة، بس **مافيش مقبض يتغيّر منه الكل**، والفروق
 * الصغيرة بتتراكم لحدّ ما العميل يشوفها.
 *
 * ═══ القياس ═══
 *
 * لكل تحكّم: **الملء المرسوم** و**لون الحلقة المرسوم**.
 *
 * ⚠️ **والمطلوب مش تركيبة واحدة.** العيلة فيها تلات أنواع
 * مقصودة، والفرق بينها **وظيفي**:
 *   · **محايد** — حقل ومنسدلة وشريحة · له ملء وحلقة
 *   · **هادئ**  — أيقونة بلا إطار وهي ساكنة (`.iact` `.aclose`)
 *   · **بنبرة** — الزرار الثانوي · ملء بلون العلامة
 * وفوقهم **حالات** (هوفر · مفتوح · تركيز) وهي مش انحراف.
 *
 * فالفحص بيقارن **جوّه كل نوع**: كل الكمبوننتس المحايدة لازم
 * ترسم نفس التركيبة بالظبط. الأنواع التلاتة كلها مشتقّة من
 * `--ctl-edge` و`--ctl-fill`، فمفتاح واحد بيحرّكهم مع بعض.
 *
 *   node tools/ctlaudit.mjs
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../dist/', import.meta.url))
const PORT = 4791
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }
const server = await new Promise((res) => {
  const s = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x')
    let f = path.join(ROOT, decodeURIComponent(u.pathname))
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, 'index.html')
    r.setHeader('Content-Type', MIME[path.extname(f)] ?? 'application/octet-stream')
    fs.createReadStream(f).pipe(r)
  })
  s.listen(PORT, () => res(s))
})

/** التحكّمات **المحايدة** · اللي بنبرة (`.btn-p` · `.btn-d`) عيلة تانية */
/** النوع لكل محدّد · الفحص جوّه النوع لا عبر الأنواع */
const KIND = {
  '.srch': 'محايد', '.fsel-b': 'محايد', '.fchip': 'محايد', '.fld': 'محايد',
  '.lbox': 'محايد', '.chip': 'محايد', '.psize-b': 'محايد', '.vtog-b': 'محايد',
  '.iact': 'هادئ', '.aclose': 'هادئ', '.acctbtn': 'هادئ', '.btn-ghost': 'هادئ',
  '.btn-2': 'بنبرة',
}
const CTL = Object.keys(KIND)
const ROUTES_C = ['/', '/projects', '/entities', '/payments', '/budget', '/reports', '/assistant', '/login']

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const out = {}

for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  await ctx.addInitScript((t) => { sessionStorage.setItem('ab-session', 'audit'); localStorage.setItem('ab-theme', t) }, theme)
  const page = await ctx.newPage()
  out[theme] = new Map()

  for (const route of ROUTES_C) {
    await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(600)
    const got = await page.evaluate((CTL) => {
      const res = []
      for (const sel of CTL) {
        for (const e of document.querySelectorAll(sel)) {
          const r = e.getBoundingClientRect()
          if (r.width < 20 || r.height < 14) continue
          const s = getComputedStyle(e)
          const ring = /rgba?\([^)]*\)\s+0px\s+0px\s+0px\s+1px\s+inset/.exec(s.boxShadow)
          /* الحالة مش انحراف · بنفصلها عشان ما تتعدّش تركيبة تانية */
          const st = e.matches('.on, .on *, [aria-expanded="true"]') ? 'مفتوح' : 'ساكن'
          res.push([sel, st, s.backgroundColor, ring ? ring[0].slice(0, ring[0].indexOf(')') + 1) : 'بلا حلقة'])
        }
      }
      return res
    }, CTL)
    for (const [sel, st, bg, ring] of got) {
      const k = `${KIND[sel]}|${st}`
      if (!out[theme].has(k)) out[theme].set(k, new Map())
      const m = out[theme].get(k)
      const v = `${bg}   ▸ ${ring}`
      if (!m.has(v)) m.set(v, new Set())
      m.get(v).add(sel)
    }
  }
  await ctx.close()
}
await browser.close(); server.close()

console.log('════ عيلة التحكّم · الملء والحلقة المرسومان ════')
console.log('المطلوب: **تركيبة واحدة جوّه كل نوع/حالة**\n')
let drift = 0
for (const theme of Object.keys(out)) {
  console.log(`═══ ${theme} ═══`)
  for (const [k, m] of [...out[theme].entries()].sort()) {
    const bad = m.size > 1
    if (bad) drift++
    console.log(`  ${k.padEnd(16)} ${m.size} تركيبة ${bad ? '⚠️' : '✓'}`)
    for (const [v, sels] of m) console.log(`      ${v}   ← ${[...sels].join(' ')}`)
  }
  console.log('')
}
console.log(drift === 0 ? '✅ كل نوع بتركيبة واحدة في الثيمات التلاتة' : `⚠️ ${drift} نوع/حالة فيه أكتر من تركيبة`)
process.exit(drift === 0 ? 0 : 1)

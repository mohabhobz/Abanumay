/**
 * فاحص التقدّم الرأسي — بيقيس **النصّ اللي بيلفّ فعلًا**.
 *
 * القاعدة اللي بيتحقّق منها واحدة، وهي اللي بتهمّ في العربية:
 *
 *   > أي عنصر نصّه بيتقسم على **أكتر من سطر** لازم نسبة ارتفاع
 *   > سطره ≥ ١٫٥ · والمستهدف ١٫٦ (W3C alreq §7.4 · WCAG 1.4.12).
 *
 * ليه القياس بدل الجرد بالكلاس: `line-height:1.45` على زرار سليم
 * تمامًا (سطر واحد · الصندوق هو اللي بيحدّد الارتفاع)، ونفسها على
 * فقرة **خرق**. الفرق مش في الكلاس ولا في المقاس — في إن النصّ
 * **لفّ ولا لأ**. وده ما بيتعرفش غير بالرسم.
 *
 * الكشف: **بنعدّ صناديق السطور نفسها** — `Range` على عقد النصّ
 * و`getClientRects()` بترجع مستطيلًا لكل سطر.
 *
 * ⚠️ أول كتابة قسمت `getBoundingClientRect().height` على ارتفاع
 * السطر — وده بيعدّ **الحشو** سطورًا: زرار ٤٤px بسطر ٢٠px طلع
 * «٢٫٢ سطر» وهو سطر واحد جوّه حشو ١٢+١٢. تمانية خروقات كاذبة،
 * وكلها كانت هتتصلّح بتغيير ثابت الارتفاع بلا داعٍ. **العدّ على
 * صناديق السطور لا على الصندوق الخارجي.**
 *
 *   node tools/leading.mjs
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { ROUTES } from './routes.mjs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../dist/', import.meta.url))
const PORT = 4573
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

const FLOOR = 1.5
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
await ctx.addInitScript(() => { sessionStorage.setItem('ab-session', 'audit'); localStorage.setItem('ab-theme', 'light') })
const page = await ctx.newPage()

const bad = new Map()
const ratios = new Map()
let wrapped = 0

for (const route of ROUTES) {
  await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(650)
  const got = await page.evaluate((FLOOR) => {
    const out = { bad: [], ratios: [], n: 0 }
    const key = (e) => { const c = String(e.className || '').split(' ').filter(Boolean).slice(0, 2).join('.'); return e.tagName.toLowerCase() + (c ? '.' + c : '') }
    for (const e of document.querySelectorAll('body *')) {
      const t = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)
      if (!t) continue
      const s = getComputedStyle(e)
      if (s.visibility === 'hidden' || s.opacity === '0' || s.display === 'none') continue
      const fs_ = parseFloat(s.fontSize), lh = parseFloat(s.lineHeight)
      if (!lh || !fs_) continue
      /* عدّ السطور من صناديق السطور نفسها · الحشو ما بيتعدّش */
      const rg = document.createRange()
      rg.selectNodeContents(e)
      const rects = [...rg.getClientRects()].filter((x) => x.height > 1 && x.width > 1)
      /* بنجمّع المستطيلات على محور رأسي بسماح نصف سطر · أيقونة
         سطرية بمحاذاة مختلفة مش سطرًا جديدًا */
      const tops = rects.map((x) => x.top).sort((a, b) => a - b)
      let lines = tops.length ? 1 : 0
      for (let i = 1; i < tops.length; i++) if (tops[i] - tops[i - 1] > lh * 0.5) lines++
      if (lines < 2) continue                        // سطر واحد — الصندوق هو الحاكم
      out.n++
      const r = Math.round((lh / fs_) * 100) / 100
      out.ratios.push(r)
      if (r < FLOOR) out.bad.push(`${key(e)} @${Math.round(fs_)}px نسبة=${r} · ${lines} سطور · ${JSON.stringify(e.textContent.trim().slice(0, 22))}`)
    }
    return out
  }, FLOOR)
  wrapped += got.n
  for (const x of got.bad) bad.set(x, (bad.get(x) ?? 0) + 1)
  for (const r of got.ratios) ratios.set(r, (ratios.get(r) ?? 0) + 1)
}
await browser.close(); server.close()

console.log(`════ التقدّم الرأسي · ${ROUTES.length} مسار ════`)
console.log(`عناصر نصّها لفّ فعلًا: ${wrapped}`)
console.log(`\n═══ النسب على النصّ الملفوف · ${ratios.size} قيمة ═══`)
for (const [r, n] of [...ratios.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(r).padEnd(6)} ${String(n).padStart(5)}×`)
console.log(`\n═══ تحت الأرضية (${FLOOR}) · ${bad.size} حالة فريدة ═══`)
if (!bad.size) console.log('  نضيف ✅')
for (const [k, n] of [...bad.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`  ${String(n).padStart(4)}×  ${k}`)
process.exit(bad.size ? 1 : 0)

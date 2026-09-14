/**
 * ارتفاع التحكّم · القاعدة ٦ في `CLAUDE.md`.
 *
 * «كل تحكّم تفاعلي في نفس الصفّ ارتفاعه `--h-md` بلا استثناء —
 * زرار وحقل وبحث وشريحة وتاب ومبدّل. و«صغير» = مقاس خطّ أصغر،
 * **مش صندوق أصغر**.»
 *
 * ⚠️ **القاعدة دي كانت مكتوبة من غير قياس، فاتكسرت بصمت.** لمّا
 * دخل وش ٢٨px في ترويسة الفلتر بقى الارتفاع ١٢ + ٢٨ + ١٢ =
 * **٥٢px**، والبِناء والجرد والتايبتشيك كلهم رجعوا خُضر — والعميل
 * هو اللي شاف إن الحقل أطول من جاره. أي قاعدة بلا أداة بتقيسها
 * هي **نيّة** لا عقد.
 *
 * والقيمة بتتقرا من `:root` وقت التشغيل، فتغيير `--h-md` ما
 * بيحتاجش تحديث هنا.
 *
 *   node tools/ctlheight.mjs
 *   node tools/ctlheight.mjs --selftest
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { ROUTES } from './routes.mjs'

const ROOT = new URL('../dist/', import.meta.url).pathname
const PORT = 4859
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

const SELFTEST = process.argv.includes('--selftest')
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
await ctx.addInitScript(() => { sessionStorage.setItem('ab-session', 'audit'); localStorage.setItem('ab-theme', 'light') })
const page = await ctx.newPage()

/* اللي القاعدة بتحكمه: التحكّم اللي بيقف في صفّ مع غيره */
const SEL = '.fsel-b, .srch, .btn, .psize-b, .fchip, .seg-b, .tab, .tgl'
/* ⚠️ استثناءات **موصوفة بدورها لا بكلاسها**: التحكّم اللي جوّه
   خليّة جدول أو جوّه كارت صغير بيتبع كثافة مكانه لا صفّ الأدوات ·
   واللي جوّه قايمة منسدلة صفّ قايمة لا صفّ أدوات. */
const EXEMPT = '.tbl, .fmenu, .payq, .pcard, .ecard, .cl-menu, .apanel, .modal'

const bad = new Map()
const seen = new Map()
let target = 44

for (const route of ROUTES) {
  await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(550)
  const got = await page.evaluate(([SEL, EXEMPT, selftest]) => {
    if (selftest) {
      /* الضابط السالب: بيرجّع الغلطة الحقيقية اللي حصلت — وش
         جوّه ترويسة الفلتر بحشو ١٢ بدل ٨ */
      const st = document.createElement('style')
      st.textContent = '.fsel-b:has(.fsel-face){padding-block:12px}'
      document.head.append(st)
    }
    const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--h-md')) || 44
    const out = []
    for (const el of document.querySelectorAll(SEL)) {
      if (!el.offsetParent) continue
      if (el.closest(EXEMPT)) continue
      const r = el.getBoundingClientRect()
      if (r.height < 1) continue
      out.push([Math.round(r.height), String(el.className || el.tagName).slice(0, 26), el.textContent.trim().slice(0, 18)])
    }
    return { h, out }
  }, [SEL, EXEMPT, SELFTEST])
  target = got.h
  for (const [hh, cls, txt] of got.out) {
    seen.set(hh, (seen.get(hh) ?? 0) + 1)
    if (hh !== Math.round(target)) bad.set(`${cls}|${txt}`, `${route}  ·  ${hh}px  ·  ${cls}  ·  ${txt}`)
  }
}

await browser.close(); server.close()

const total = [...seen.values()].reduce((a, b) => a + b, 0)
console.log(`════ ارتفاع التحكّم · ${total} عنصر · الهدف ${Math.round(target)}px (--h-md) ════`)
console.log('الارتفاعات المرسومة: ' + [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}px ×${v}`).join(' · '))

if (SELFTEST) {
  if (!bad.size) { console.log('\n❌ الضابط السالب رجع أخضر · الفحص أعمى'); process.exit(1) }
  console.log(`\n✅ الضابط السالب مسك ${bad.size} حالة`)
  process.exit(0)
}
if (!bad.size) { console.log('\n✅ كل تحكّم على --h-md'); process.exit(0) }
console.log(`\n⚠️ ${bad.size} تحكّم برّه --h-md:`)
for (const v of bad.values()) console.log('  ' + v)
process.exit(1)

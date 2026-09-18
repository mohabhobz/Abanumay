/**
 * طول السطر المرسوم — المقياس الطباعي ٤٥–٨٥ حرفًا في السطر.
 *
 * ⚠️ **بيتقاس على النصّ اللي بيلفّ فعلًا وحده.** عنوان في سطر
 * واحد طوله ١٢٠ حرفًا مش خرق: القارئ مش بيرجع لأول السطر. الخرق
 * هو الفقرة اللي عينك بتضيع وهي راجعة لأولها — يعني **أكتر من
 * سطرين**، وكل سطر أطول من ٨٥.
 *
 *   node tools/linelen.mjs
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { ROUTES } from './routes.mjs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../dist/', import.meta.url))
const PORT = 4847
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

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
await ctx.addInitScript(() => { sessionStorage.setItem('ab-session', 'audit'); localStorage.setItem('ab-theme', 'light') })
const page = await ctx.newPage()
const bad = new Map()
let wrapped = 0

for (const route of ROUTES) {
  await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  const got = await page.evaluate(() => {
    const out = []
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let n
    while ((n = walk.nextNode())) {
      const t = n.textContent
      if (!t || t.trim().length < 60) continue
      const el = n.parentElement
      if (!el || !el.offsetParent) continue
      const rg = document.createRange(); rg.selectNodeContents(n)
      const rects = [...rg.getClientRects()].filter((x) => x.width > 1 && x.height > 1)
      if (rects.length < 2) continue
      /* تجميع الصناديق على المحور الرأسي · أيقونة سطرية مش سطر */
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 20
      const tops = []
      for (const r of rects) if (!tops.some((y) => Math.abs(y - r.top) < lh * 0.5)) tops.push(r.top)
      if (tops.length < 3) continue
      /* حرف/سطر = طول النصّ ÷ عدد السطور المرسومة */
      const per = Math.round(t.trim().length / tops.length)
      out.push([per, tops.length, String(el.className || el.tagName).slice(0, 24), t.trim().slice(0, 40)])
    }
    return out
  })
  for (const [per, lines, cls, txt] of got) {
    wrapped++
    if (per > 85) {
      const k = `${cls}|${txt}`
      if (!bad.has(k)) bad.set(k, `${route}  ·  ${cls}  ·  ${per} حرفًا × ${lines} سطور  ·  ${txt}`)
    }
  }
}
await browser.close(); server.close()

console.log(`════ طول السطر · ${wrapped} فقرة بتلفّ على ٣ سطور فأكتر ════`)
if (!bad.size) { console.log('✅ كلها داخل ٨٥ حرفًا') ; process.exit(0) }
console.log(`\n⚠️ ${bad.size} فقرة فوق ٨٥ حرفًا في السطر:`)
for (const v of bad.values()) console.log('  ' + v)

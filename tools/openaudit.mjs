/**
 * جرد **الطبقات اللي ما بتترسمش غير بالتفاعل** — القوايم المنسدلة
 * والمودالات والبانلات.
 *
 * ليه أداة لوحدها: `reveal.mjs` بيكشف اللي مخفي بـ`opacity` في
 * الـCSS · لكن معظم البوب أبس في السيستم **مش في الـDOM أصلًا**
 * لحدّ ما رياكت ترسمها. فمفيش ستايل يقدر يكشفها — لازم **تتفتح**.
 *
 * وده مش تحسين كمالي: `deadcss.mjs` قاس إن **٣٣٥ من ٧٩٦ كلاس
 * (٤٢٪)** ما بترسمش في الجرد، ومعظمهم هنا. يعني كل جولة شكل عدّت
 * كانت بتفحص ٥٨٪ من السطح وترجع خضرا.
 *
 * الطريقة: بتلاقي المحفّزات (`aria-haspopup` · `aria-expanded` ·
 * كلاسات معروفة)، بتضغط كل واحد، بتقارن الـDOM قبل وبعد، وبتقيس
 * **العقد الجديدة وحدها**. وبعدين `Escape` وتفتح اللي بعده.
 *
 *   node tools/openaudit.mjs           # كل المسارات
 *   node tools/openaudit.mjs /projects # مسار واحد
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { ROUTES } from './routes.mjs'
import { fileURLToPath } from 'node:url'

const ONLY = process.argv[2] && process.argv[2].startsWith('/') ? process.argv[2] : null
const ROOT = fileURLToPath(new URL('../dist/', import.meta.url))
const PORT = 4565
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

/** المحفّزات: المعياري أولًا، وبعدين كلاسات السيستم المعروفة */
const TRIGGERS = [
  '[aria-haspopup]', '[aria-expanded]',
  '.acctbtn', '.fsel-b', '.fchip', '.cl-more', '.fcust-h', '.qr-fold',
  '.railgrip-b', '.bulkx', '.gpeek-h', '.htile-go', '.kpi-go', '.fview-x',
]

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
await ctx.addInitScript(() => { sessionStorage.setItem('ab-session', 'audit'); localStorage.setItem('ab-theme', 'light') })
await ctx.addInitScript(() => {
  const k = () => { const st = document.createElement('style'); st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}'; document.head.appendChild(st) }
  document.head ? k() : document.addEventListener('DOMContentLoaded', k)
})
const page = await ctx.newPage()

/* السلالم بتتقرا من `:root` · نفس مبدأ `radaudit` */
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(600)
const SCALE = await page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement)
  const px = (n) => {
    const v = cs.getPropertyValue(n).trim(); if (!v) return 0
    const d = document.createElement('div'); d.style.cssText = 'position:absolute;visibility:hidden;width:' + v
    document.body.appendChild(d); const w = parseFloat(getComputedStyle(d).width); d.remove()
    return Math.round(w * 10) / 10
  }
  const R = {}; for (const n of ['--r-hair', '--r0', '--ric', '--r1', '--r2', '--r3']) R[px(n)] = n
  const SP = []; for (let i = 1; i <= 12; i++) SP.push(px('--sp-' + i))
  const FS = []; for (let i = 1; i <= 9; i++) FS.push(Math.round(px('--fs-' + i) * 100) / 100)
  /* ارتفاع السطر **عيلتان**: نِسب بلا وحدة · وبكسل للتحكّم
     (`--lh-md` = جزء من حساب `--h-md`). لازم نقرا الاتنين، وإلا
     زرار سليم بيتعدّ خرقًا لأن ٢٠ ÷ ١٤ = ١٫٤٣ مش درجة نسبة. */
  const LH = ['--lh-0', '--lh-flat', '--lh-head', '--lh-ui', '--lh-text', '--lh-long']
    .map((n) => parseFloat(cs.getPropertyValue(n)))
  const LHPX = ['--lh-md', '--lh-xs'].map((n) => px(n))
  return { R, SP, FS, LH, LHPX }
})

const bad = { rad: new Map(), sp: new Map(), fs: new Map(), lh: new Map() }
const seenPanels = new Set()
let opened = 0

const routes = ONLY ? [ONLY] : ROUTES
for (const route of routes) {
  await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(700)

  const handles = []
  for (const sel of TRIGGERS) handles.push(...await page.$$(sel))
  /* كل محفّز مرة واحدة */
  const uniq = []
  for (const h of handles) {
    const id = await h.evaluate((e) => e.outerHTML.slice(0, 80)).catch(() => null)
    if (id && !uniq.some((u) => u.id === id)) uniq.push({ id, h })
  }

  for (const { h } of uniq.slice(0, 18)) {
    const before = await page.evaluate(() => document.querySelectorAll('body *').length)
    try { await h.click({ timeout: 1200 }) } catch { continue }
    await page.waitForTimeout(350)
    const got = await page.evaluate(([SCALE, before]) => {
      const all = [...document.querySelectorAll('body *')]
      if (all.length <= before) return null
      /* العقد الجديدة: اللي ظهرت بعد الضغط · بنقيسها كلها وبنسيب
         اللي كانت موجودة، لأن مقارنة العقد بالمرجع مش مضمونة بعد
         إعادة الرسم · فبناخد اللي جوّه أي حاوية بوب أب */
      const pop = all.filter((e) => e.matches('[role=menu],[role=listbox],[role=dialog],.fmenu,.fopt,.modal,.acct,.fcust,.gpeek,.pop,.fviews,.fprev,.bulkdock,.cl-menu'))
      const scope = new Set()
      for (const p of pop) { scope.add(p); for (const c of p.querySelectorAll('*')) scope.add(c) }
      if (!scope.size) return null
      const num = (v, side) => { const n = parseFloat(v); return Number.isFinite(n) ? (String(v).includes('%') ? n / 100 * side : n) : 0 }
      const key = (e) => { const c = String(e.className || '').split(' ').filter(Boolean).slice(0, 2).join('.'); return e.tagName.toLowerCase() + (c ? '.' + c : '') }
      const out = { panel: pop[0] ? key(pop[0]) : '?', rad: [], sp: [], fs: [], lh: [], n: scope.size }
      for (const e of scope) {
        const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue
        const st = getComputedStyle(e); if (st.visibility === 'hidden' || st.opacity === '0') continue
        const side = Math.min(r.width, r.height)
        if (st.getPropertyValue('--r-exempt').trim() !== '1') {
          const cor = [st.borderTopLeftRadius, st.borderTopRightRadius, st.borderBottomRightRadius, st.borderBottomLeftRadius].map((v) => Math.round(num(v.split(' ')[0], side) * 10) / 10)
          const mx = Math.max(...cor)
          const partial = new Set(cor).size > 1, isDot = Math.abs(mx - side / 2) <= 0.6, hair = mx <= 2
          if (mx > 0 && mx < 100 && !partial && !isDot && !hair) {
            const ratio = mx / side
            if (!SCALE.R[mx]) out.rad.push(`${key(e)} (${Math.round(r.width)}×${Math.round(r.height)}) ركن=${mx} برّه السلّم`)
            else if (ratio > 0.45 || (side <= 80 && ratio < 0.12)) out.rad.push(`${key(e)} ركن=${mx} نسبة=${Math.round(ratio * 100)}%`)
          }
        }
        for (const q of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
          const n = Math.round(parseFloat(st[q]) * 10) / 10
          if (n > 0 && !SCALE.SP.includes(n)) out.sp.push(`${key(e)} ${q}=${n}`)
        }
        if (st.display.includes('flex') || st.display.includes('grid'))
          for (const q of ['rowGap', 'columnGap']) {
            const n = Math.round(parseFloat(st[q]) * 10) / 10
            if (n > 0 && !SCALE.SP.includes(n)) out.sp.push(`${key(e)} ${q}=${n}`)
          }
        const hasText = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
        if (hasText) {
          const f = Math.round(parseFloat(st.fontSize) * 100) / 100
          if (!SCALE.FS.includes(f)) out.fs.push(`${key(e)} ${f}px`)
          /* ارتفاع السطر: النسبة لازم تكون درجة · والملفوف ≥ ١٫٥ */
          const lh = parseFloat(st.lineHeight)
          if (lh && f) {
            const ratio = Math.round((lh / f) * 100) / 100
            const rg = document.createRange(); rg.selectNodeContents(e)
            const tops = [...rg.getClientRects()].filter((x) => x.height > 1 && x.width > 1).map((x) => x.top).sort((a, b) => a - b)
            let lines = tops.length ? 1 : 0
            for (let i = 1; i < tops.length; i++) if (tops[i] - tops[i - 1] > lh * 0.5) lines++
            if (lines >= 2 && ratio < 1.5) out.lh.push(`${key(e)} @${Math.round(f)}px نسبة=${ratio} · ملفوف`)
            else if (!SCALE.LH.some((x) => Math.abs(x - ratio) < 0.02) && !SCALE.LHPX.some((x) => Math.abs(x - lh) < 0.6)) out.lh.push(`${key(e)} نسبة=${ratio} (${lh}px) برّه السلّم`)
          }
        }
      }
      return out
    }, [SCALE, before])
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(180)
    if (!got) continue
    opened++
    seenPanels.add(got.panel)
    for (const x of got.rad) bad.rad.set(x, (bad.rad.get(x) ?? 0) + 1)
    for (const x of got.sp) bad.sp.set(x, (bad.sp.get(x) ?? 0) + 1)
    for (const x of got.fs) bad.fs.set(x, (bad.fs.get(x) ?? 0) + 1)
    for (const x of got.lh) bad.lh.set(x, (bad.lh.get(x) ?? 0) + 1)
  }
}
await browser.close(); server.close()

const show = (t, m) => {
  console.log(`\n═══ ${t} · ${m.size} حالة فريدة ═══`)
  if (!m.size) { console.log('  نضيف ✅'); return }
  for (const [k, n] of [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24)) console.log(`  ${String(n).padStart(4)}×  ${k}`)
}
console.log(`════ جرد الطبقات التفاعلية ════`)
console.log(`فُتح: ${opened} طبقة · أنواع: ${[...seenPanels].join(' · ')}`)
show('الركن', bad.rad)
show('المسافة', bad.sp)
show('الخطّ', bad.fs)
show('ارتفاع السطر', bad.lh)

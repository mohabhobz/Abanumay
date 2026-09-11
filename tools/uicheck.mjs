/**
 * فحص الشاشات، **بيدوّر على الكسر لا على الدرِفت**.
 *
 * `uiaudit.mjs` بيقول إن الزرار ارتفاعه مختلف من صفحة لصفحة.
 * `contrast.mjs` بيقول إن نصًّا ما بيتقري. الاتنين ما بيقولوش إن
 * صفحة بترمي خطأ في الكونسول، ولا إن نصًّا اتقصّ من غير نقط، ولا
 * إن عنصرًا خرج برّه الشاشة. ده اللي السكربت ده بيعمله:
 *
 *   · أخطاء الكونسول وأخطاء الصفحة على كل مسار
 *   · تمرير أفقي على مستوى الصفحة (ممنوع، الجدول بس بيتزحلق)
 *   · نصّ اتقصّ من غير `text-overflow: ellipsis`
 *   · عنصر خرج برّه عرض المنظر
 *   · أرقام عربية-هندية (السيستم كله لاتيني)
 *   · لقطة لكل مسار تحت `.shots/`
 *
 *   node tools/uicheck.mjs                 # ثيم فاتح
 *   node tools/uicheck.mjs --themes        # التلاتة
 *   node tools/uicheck.mjs --shots         # يحفظ اللقطات كمان
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { ROUTES } from './routes.mjs'

const ROOT = new URL('../dist/', import.meta.url).pathname
const SHOTS = new URL('../.shots/', import.meta.url).pathname
const PORT = 4456
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.woff2': 'font/woff2' }


const srv = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname))
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, 'index.html')
  r.setHeader('Content-Type', MIME[path.extname(f)] ?? 'application/octet-stream')
  fs.createReadStream(f).pipe(r)
})
await new Promise((r) => srv.listen(PORT, r))

const themes = process.argv.includes('--themes') ? ['light', 'dark', 'green'] : ['light']
const wantShots = process.argv.includes('--shots')
if (wantShots) fs.mkdirSync(SHOTS, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
let problems = 0

for (const theme of themes) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  await ctx.addInitScript((t) => {
    sessionStorage.setItem('ab-session', 'check')
    localStorage.setItem('ab-theme', t)
  }, theme)
  const page = await ctx.newPage()

  for (const route of ROUTES) {
    const errs = []
    const onMsg = (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_(NAME|CONNECTION)/.test(m.text())) errs.push(m.text().slice(0, 160)) }
    const onErr = (e) => errs.push('PAGEERROR ' + String(e).slice(0, 160))
    page.on('console', onMsg)
    page.on('pageerror', onErr)

    await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1100)

    const o = await page.evaluate(() => {
      const out = { overflowX: false, clipped: [], offscreen: [], arabicDigits: [] }
      out.overflowX = document.documentElement.scrollWidth > window.innerWidth + 2
      /* اللوحة المقفولة (المساعد) بتتحطّ برّه المنظر عن قصد،
         ومحتواها لسه `offsetParent` ليه قيمة. اللي جوّه طبقة
         شفّافة أو مخفيّة ما بيتحسبش. */
      const hidden = (e) => {
        let q = e
        while (q && q !== document.body) {
          const s = getComputedStyle(q)
          if (s.opacity === '0' || s.visibility === 'hidden' || q.getAttribute('aria-hidden') === 'true' || q.hasAttribute('inert')) return true
          q = q.parentElement
        }
        return false
      }
      for (const e of document.querySelectorAll('.btn,.tag,.fseg,.fchip,.fsel-b,.tab,.sub,.mut,.tbl td,.tbl th,.ptitle,.hd-t')) {
        if (e.offsetParent === null || hidden(e)) continue
        const cs = getComputedStyle(e)
        const scrolls = cs.overflowX === 'auto' || cs.overflowX === 'scroll'
        if (e.scrollWidth > e.clientWidth + 2 && cs.textOverflow !== 'ellipsis' && !scrolls) {
          out.clipped.push(`${String(e.className).split(' ').slice(0, 2).join('.')} ${e.scrollWidth}>${e.clientWidth} "${e.textContent.trim().slice(0, 18)}"`)
        }
        const q = e.getBoundingClientRect()
        /* اللي جوّه حاوية بتتزحلق أفقيًا مسموح يخرج عن المنظر */
        const inScroller = e.closest('.tblwrap,[style*="overflow"]')
        if (!inScroller && (q.right > window.innerWidth + 2 || q.left < -2)) out.offscreen.push(String(e.className).split(' ')[0])
      }
      /* الأرقام كلها لاتينية، قاعدة ثابتة في السيستم */
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let n
      while ((n = w.nextNode())) {
        if (/[٠-٩۰-۹]/.test(n.textContent)) {
          out.arabicDigits.push(n.textContent.trim().slice(0, 30))
          if (out.arabicDigits.length > 4) break
        }
      }
      out.clipped = [...new Set(out.clipped)].slice(0, 6)
      out.offscreen = [...new Set(out.offscreen)].slice(0, 4)
      return out
    })

    page.off('console', onMsg)
    page.off('pageerror', onErr)

    const hit = errs.length || o.overflowX || o.clipped.length || o.offscreen.length || o.arabicDigits.length
    if (hit) {
      problems += 1
      console.log(`\n🔴 ${theme} ${route}`)
      if (errs.length) console.log(`   كونسول: ${[...new Set(errs)].join(' · ')}`)
      if (o.overflowX) console.log('   تمرير أفقي على الصفحة')
      for (const c of o.clipped) console.log(`   قصّ بلا نقط: ${c}`)
      if (o.offscreen.length) console.log(`   خرج عن المنظر: ${o.offscreen.join(' · ')}`)
      if (o.arabicDigits.length) console.log(`   أرقام عربية-هندية: ${o.arabicDigits.join(' · ')}`)
    }
    if (wantShots) await page.screenshot({ path: `${SHOTS}${theme}${route.replace(/\//g, '_') || '_'}.png` })
  }
  await ctx.close()
}

console.log(`\n═══ ${problems} صفحة فيها ملاحظة عبر ${themes.length}×${ROUTES.length} ═══`)
await browser.close()
srv.close()

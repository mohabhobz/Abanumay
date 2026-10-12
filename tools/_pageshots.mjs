/* full-page segments of every audited route for the eye review (11 Oct) */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { chromium } from 'playwright'
import { ROUTES } from './routes.mjs'
const OUT = process.argv[2] ?? '/tmp/claude-0/pages'
fs.mkdirSync(OUT, { recursive: true })
const DIST = path.resolve('dist')
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' }
const srv = http.createServer((q, r) => { let f = path.join(DIST, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html'); r.setHeader('Content-Type', MIME[path.extname(f)] ?? 'application/octet-stream'); fs.createReadStream(f).pipe(r) })
await new Promise((r) => srv.listen(0, r))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const PUBLIC = ['/login', '/forgot', '/entities/register', '/entities/register/account']
const slug = (r) => r.replace(/^\//, '').replace(/[/?&=,]+/g, '_') || 'home'
const index = []
let next = 0
await Promise.all([0, 1, 2].map(async () => {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } })
  await c.addInitScript((pub) => { if (pub.some((x) => location.pathname === x) && !location.search.includes('as=')) sessionStorage.removeItem('ab-session'); else sessionStorage.setItem('ab-session', 'omar'); localStorage.setItem('ab-theme', 'light'); const k = () => { const st = document.createElement('style'); st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}'; document.head.appendChild(st) }; document.head ? k() : document.addEventListener('DOMContentLoaded', k) }, PUBLIC)
  for (;;) {
    const i = next++; if (i >= ROUTES.length) break
    const route = ROUTES[i]; const p = await c.newPage()
    try {
      await p.goto(`http://localhost:${srv.address().port}${route}`, { waitUntil: 'domcontentloaded' })
      await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(700)
      const H = await p.evaluate(() => { const sc = [...document.querySelectorAll('.screen, main, .viewstack')].find((e) => e.scrollHeight > e.clientHeight + 5); return sc ? sc.scrollHeight : document.documentElement.scrollHeight })
      const segs = Math.min(8, Math.ceil(H / 820))
      const files = []
      for (let k = 0; k < segs; k++) {
        await p.evaluate((y) => { const sc = [...document.querySelectorAll('.screen, main, .viewstack')].find((e) => e.scrollHeight > e.clientHeight + 5); if (sc) sc.scrollTop = y; else window.scrollTo(0, y) }, k * 820)
        await p.waitForTimeout(150)
        const f = `${String(i).padStart(3, '0')}_${slug(route)}_${k}.jpg`
        await p.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 80 }); files.push(f)
      }
      index.push({ i, route, files, H })
    } catch (e) { index.push({ i, route, err: String(e).slice(0, 80) }) }
    await p.close()
  }
  await c.close()
}))
await b.close(); srv.close()
index.sort((a, b) => a.i - b.i)
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1))
console.log(index.length, index.reduce((n, x) => n + (x.files?.length ?? 0), 0), index.filter((x) => x.err))

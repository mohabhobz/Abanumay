/* Alignment & spacing audit (11 Oct · after the client found misalignments the token gates can't
   see). Visits every audited route, runs `lib/alignprobe.js` on the drawn page, groups the
   findings by component (kind + selector path) and writes them to `tools/out/align.json`.
   `--shots` then revisits the first place of each group and crops it with the spot outlined.

     node tools/alignaudit.mjs                 # all routes
     node tools/alignaudit.mjs --routes /budget
     node tools/alignaudit.mjs --shots         # + crops in tools/out/align/ */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const PROBE = fs.readFileSync(fileURLToPath(new URL('./lib/alignprobe.js', import.meta.url)), 'utf8')
const OUT = fileURLToPath(new URL('./out/', import.meta.url))
fs.mkdirSync(OUT + 'align', { recursive: true })

import http from 'node:http'
import path from 'node:path'
import { chromium } from 'playwright'
import { pickRoutes } from './lib/sweep.mjs'

/* own loop, not \`sweep\` · a fresh page per route: one page carried across 216 routes ran out of
   renderer memory and every later visit failed with «Page crashed» */
const DIST = fileURLToPath(new URL('../dist/', import.meta.url))
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' }
const srv = http.createServer((q, r) => {
  let f = path.join(DIST, decodeURIComponent(new URL(q.url, 'http://x').pathname))
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html')
  r.setHeader('Content-Type', MIME[path.extname(f)] ?? 'application/octet-stream')
  fs.createReadStream(f).pipe(r)
})
await new Promise((r) => srv.listen(0, r))
const PORT = srv.address().port
const W = Number(process.argv[process.argv.indexOf('--w') + 1]) || 1440
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const PUBLIC = ['/login', '/forgot', '/entities/register', '/entities/register/account']
const mkctx = async () => {
  const c = await browser.newContext({ viewport: { width: W, height: 900 } })
  await c.addInitScript((pub) => {
    if (pub.some((x) => location.pathname === x) && !location.search.includes('as=')) sessionStorage.removeItem('ab-session')
    else sessionStorage.setItem('ab-session', 'omar')
    localStorage.setItem('ab-theme', 'light')
    const k = () => { const st = document.createElement('style'); st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}'; document.head.appendChild(st) }
    document.head ? k() : document.addEventListener('DOMContentLoaded', k)
  }, PUBLIC)
  return c
}
const routes = pickRoutes()
const found = []
const failed = []
let next = 0, visits = 0
const t0 = Date.now()
await Promise.all([0, 1, 2].map(async () => {
  const c = await mkctx()
  for (;;) {
    const i = next++
    if (i >= routes.length) break
    const route = routes[i]
    const p = await c.newPage()
    try {
      await p.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'domcontentloaded' })
      await p.evaluate(() => document.fonts.ready)
      await p.waitForTimeout(600)
      const got = await p.evaluate(`(function(){ ${PROBE}\n; return alignProbe(null) })()`)
      found.push(...got.map((f) => ({ route, ...f })))
      visits++
      if (visits % 25 === 0) process.stdout.write(`  ${visits}/${routes.length}\n`)
    } catch (e) { failed.push({ route, why: String(e).slice(0, 100) }) }
    await p.close()
  }
  await c.close()
}))
await browser.close(); srv.close()
if (failed.length) console.log('🔴 failed', failed)
const res = { visits }

/* group · the same component on many routes is one finding with many places */
const groups = new Map()
for (const f of found) {
  const key = `${f.kind}|${f.path}`
  const g = groups.get(key) ?? { kind: f.kind, path: f.path, places: [], max: 0 }
  g.places.push({ route: f.route, text: f.text, rect: f.rect, d: f.d, extra: Object.fromEntries(Object.entries(f).filter(([k]) => !['kind', 'path', 'text', 'rect', 'route', 'theme', 'd'].includes(k))) })
  g.max = Math.max(g.max, Math.abs(f.d ?? 0))
  groups.set(key, g)
}
const list = [...groups.values()].sort((a, b) => b.places.length - a.places.length)
fs.writeFileSync(OUT + 'align.json', JSON.stringify({ at: new Date().toISOString(), visits: res.visits, groups: list }, null, 1))

const byKind = {}
for (const g of list) byKind[g.kind] = (byKind[g.kind] ?? 0) + 1
console.log(`\nalign · ${res.visits} visits · ${found.length} raw · ${list.length} groups · ${Math.round((Date.now() - t0) / 1000)}s`)
console.log(byKind)

if (process.argv.includes('--shots')) {
  const { chromium } = await import('playwright')
  const http = await import('node:http')
  const path = await import('node:path')
  const DIST = fileURLToPath(new URL('../dist/', import.meta.url))
  const srv = http.createServer((q, r) => {
    let f = path.join(DIST, decodeURIComponent(new URL(q.url, 'http://x').pathname))
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html')
    const ext = path.extname(f)
    r.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg' }[ext] ?? 'application/octet-stream')
    fs.createReadStream(f).pipe(r)
  })
  await new Promise((r) => srv.listen(0, r))
  const port = srv.address().port
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } })
  await c.addInitScript((pub) => { if (pub.some((x) => location.pathname === x) && !location.search.includes('as=')) sessionStorage.removeItem('ab-session'); else sessionStorage.setItem('ab-session', 'omar'); localStorage.setItem('ab-theme', 'light'); const k = () => { const st = document.createElement('style'); st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}'; document.head.appendChild(st) }; document.head ? k() : document.addEventListener('DOMContentLoaded', k) }, PUBLIC)
  const p = await c.newPage()
  let cur = ''
  for (const [i, g] of list.entries()) {
    const pl = g.places[0]
    if (pl.route !== cur) { await p.goto(`http://localhost:${port}${pl.route}`, { waitUntil: 'domcontentloaded' }).catch(() => {}); await p.waitForTimeout(900); cur = pl.route }
    /* the spot is the marked elements · cropped around their union, each outlined */
    const ms = pl.marks?.length ? pl.marks : [pl.rect]
    const r = { x: Math.min(...ms.map((m) => m.x)), y: Math.min(...ms.map((m) => m.y)) }
    r.w = Math.max(...ms.map((m) => m.x + m.w)) - r.x; r.h = Math.max(...ms.map((m) => m.y + m.h)) - r.y
    const st = await p.evaluate(([u, ms]) => {
      document.querySelectorAll('.__amark').forEach((n) => n.remove())
      const sc = [...document.querySelectorAll('.screen, main, .viewstack')].find((e) => e.scrollHeight > e.clientHeight + 5)
      let top = 0
      if (sc) { sc.scrollTop = Math.max(0, u.y - 200); top = sc.scrollTop } else { window.scrollTo(0, Math.max(0, u.y - 200)); top = scrollY }
      const col = ['#e00', '#06f', '#e0a000', '#0a0', '#a0f']
      ms.forEach((m, i) => {
        const d = document.createElement('div'); d.className = '__amark'
        Object.assign(d.style, { position: 'fixed', left: m.x - 1 + 'px', top: m.y - top - 1 + 'px', width: m.w + 2 + 'px', height: m.h + 2 + 'px', outline: `1.5px solid ${col[i % 5]}`, zIndex: 99999, pointerEvents: 'none' })
        document.body.append(d)
      })
      return top
    }, [r, ms])
    await p.waitForTimeout(120)
    const pad = 50
    const vy = r.y - st
    const clip = { x: Math.max(0, r.x - pad), y: Math.max(0, vy - pad), width: 0, height: 0 }
    clip.width = Math.min(r.w + pad * 2, 1440 - clip.x)
    clip.height = Math.max(40, Math.min(r.h + pad * 2, 900 - clip.y))
    g.shot = `align/${String(i).padStart(3, '0')}-${g.kind}.png`
    await p.screenshot({ path: OUT + g.shot, clip }).catch(() => { g.shot = null })
  }
  await b.close(); srv.close()
  fs.writeFileSync(OUT + 'align.json', JSON.stringify({ at: new Date().toISOString(), visits: res.visits, groups: list }, null, 1))
  console.log('shots →', OUT + 'align/')
}

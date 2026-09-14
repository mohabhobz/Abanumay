/**
 * الأشخاص · الوش جنب الاسم.
 *
 * ⚠️ **الأداة بتدوّر على الأسماء في الـDOM، مش على الكلاسات.**
 * لو فحصنا «كل `.prs` جوّاه وش» هيرجع أخضر دايمًا — `.prs` هي
 * الكمبوننت اللي بيحطّ الوش أصلًا، فالفحص بيتحقّق من نفسه.
 * السؤال الصح: **فين أسماء السجلّ مرسومة، ومين فيهم بلا وش؟**
 * فالأداة بتقرا الرَّوستر من `src/data/people.ts` وتدوّر على كل
 * اسم فيه في كل مسار.
 *
 *   node tools/people.mjs
 *   node tools/people.mjs --selftest   ← لازم يمسك
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { ROUTES } from './routes.mjs'

const APP = new URL('../', import.meta.url).pathname
const ROOT = path.join(APP, 'dist/')
const PORT = 4853
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' }

/* ── الجزء الساكن: مين في الرَّوستر ولسّه بلا صورة ── */
const src = fs.readFileSync(path.join(APP, 'src/data/people.ts'), 'utf8')
const roster = [...src.matchAll(/\{ name: '([^']+)', slug: '([^']+)'/g)].map((m) => ({ name: m[1], slug: m[2] }))
const have = new Set(
  fs.existsSync(path.join(APP, 'src/assets/people'))
    ? fs.readdirSync(path.join(APP, 'src/assets/people')).map((f) => f.replace(/\.\w+$/, ''))
    : [],
)
const missing = [...new Set(roster.filter((r) => !have.has(r.slug)).map((r) => `${r.name} · ${r.slug}`))]

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

const withFace = new Map()
const noFace = new Map()
const boxes = new Map()
let faces = 0
let initialsOnly = 0

const NAMES = [...new Set(roster.map((r) => r.name))]

for (const route of ROUTES) {
  await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  /* ⚠️ **القوايم مقفولة، والقوايم هي المكان الأهم.** فحص الصفحة
     الساكنة بيفوّت خيارات الفلتر كلها — وهي بالظبط اللي العميل
     طلبها. فالأداة بتفتح كل فلتر أشخاص وتقيس وهو مفتوح. */
  const triggers = await page.$$('.fsel .fsel-b')
  for (let i = 0; i < triggers.length; i++) {
    try { await triggers[i].click({ timeout: 700 }) } catch { continue }
    await page.waitForTimeout(200)
    const got = await scan(page, NAMES, SELFTEST)
    collect(route, got)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(90)
  }
  collect(route, await scan(page, NAMES, SELFTEST))
}

function collect(route, got) {
  for (const r of got.rows) {
    const key = `${route}  ·  ${r.cls}  ·  ${r.name}`
    if (r.face) { withFace.set(key, 1); if (r.img) faces++; else initialsOnly++ }
    else noFace.set(key, 1)
  }
  for (const b of got.boxes) boxes.set(`${b.w}×${b.h} · ركن ${b.r}`, (boxes.get(`${b.w}×${b.h} · ركن ${b.r}`) ?? 0) + 1)
}

async function scan(page, names, selftest) {
  return page.evaluate(([names, selftest]) => {
    if (selftest) {
      /* الضابط السالب: بيشيل الوش من خيارات القوايم · الأداة
         لازم تلاقي أسماء بلا وش */
      for (const f of document.querySelectorAll('.fopt .av,.fopt .pht')) f.remove()
    }
    const rows = []
    const boxes = []
    for (const el of document.querySelectorAll('img.pht,span.av')) {
      const r = el.getBoundingClientRect()
      if (r.width < 1) continue
      boxes.push({ w: Math.round(r.width), h: Math.round(r.height), r: getComputedStyle(el).borderRadius })
    }
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let n
    while ((n = walk.nextNode())) {
      const t = n.textContent.trim()
      if (!t) continue
      const name = names.find((x) => t === x)
      if (!name) continue
      const el = n.parentElement
      if (!el || !el.offsetParent) continue
      if (el.closest('[aria-hidden="true"]')) continue
      /* الوش المجاور: في نفس العنصر أو في تلات آباء فوقه */
      let hop = el, face = null
      for (let i = 0; i < 4 && hop; i++, hop = hop.parentElement) {
        face = hop.querySelector('img.pht,span.av')
        if (face) break
      }
      rows.push({
        name,
        cls: String(el.className || el.tagName).slice(0, 22),
        face: Boolean(face),
        img: face ? face.tagName === 'IMG' : false,
      })
    }
    return { rows, boxes }
  }, [names, selftest])
}

await browser.close(); server.close()

console.log('════ الأشخاص · الوش جنب الاسم ════\n')
console.log(`الرَّوستر: ${new Set(roster.map((r) => r.slug)).size} شخص · الصور الموجودة: ${have.size}`)
if (missing.length) {
  console.log(`\n📷 ${missing.length} لسّه بلا صورة (بيرجعوا لحروفهم الأوّلية):`)
  for (const m of missing) console.log('  ' + m)
  console.log(`  ← ارمي الملف في src/assets/people/<slug>.jpg وهو بيتلقّط لوحده`)
}

console.log(`\nمواضع الاسم المرسومة: ${withFace.size + noFace.size}`)
console.log(`  ✅ ومعاه وش: ${withFace.size}   (صورة ${faces} · حروف ${initialsOnly})`)
console.log(`  ⚪ بلا وش: ${noFace.size}`)

console.log('\nمقاسات الوش المرسومة:')
for (const [k, v] of [...boxes.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k}  ×${v}`)

if (noFace.size) {
  console.log('\n⚪ أسماء بلا وش (برّه النطاق المتّفق عليه · للعلم لا خرق):')
  for (const k of [...noFace.keys()].slice(0, 40)) console.log('  ' + k)
}

/* ⚠️ **البوّابة على الهندسة لا على العدد.** «كام اسم معاه وش» رقم
   بيتحرّك مع الداتا؛ اللي ما ينفعش يتحرّك هو إن كل الوشوش من
   نفس السلّم. مقاس رابع معناه إن حدّ رسم وشًّا بإيده. */
const sizes = [...boxes.keys()]
const ok = sizes.every((s) => /^(28×28|30×30|34×34) /.test(s))
if (!ok) { console.log('\n⚠️ مقاس وش برّه السلّم (٢٨ · ٣٠ · ٣٤)'); process.exit(1) }
if (SELFTEST) {
  if (noFace.size === 0) { console.log('\n❌ الضابط السالب رجع أخضر · الفحص أعمى'); process.exit(1) }
  console.log(`\n✅ الضابط السالب مسك ${noFace.size} اسمًا بلا وش`)
}
console.log('\n✅ كل الوشوش من السلّم')

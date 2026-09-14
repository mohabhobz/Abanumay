/**
 * جرد نصف القطر · **بيقيس المنحنى في سياقه لا كرقم مجرّد**.
 *
 * الرقم وحده ما بيقولش حاجة: ١٦ على صندوق ٣٢ دايرة، وعلى كارت
 * ٤٠٠ شعرة. فالجرد ده بيقيس لكل عنصر:
 *
 *   · الركن مقابل **مقاسه**            (النسبة، هي اللي العين بتشوفها)
 *   · الركن مقابل **ركن أبوه والحشو**  (التراكز، inner = outer − padding)
 *   · الركن مقابل **باقي أفراد دوره**  (الدرِفت)
 *   · أركان العنصر الأربعة مع بعضها     (الركن المختلط)
 *
 *   node tools/radaudit.mjs
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { ROUTES } from './routes.mjs'

const ROOT = new URL('../dist/', import.meta.url).pathname
const PORT = 4497
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

/* ═══ السلّم بعد جولة الركن · ١٢ سبتمبر ٢٠٢٦ ═══
   الأداة بقت **بتفحص القاعدة لا القايمة**: كل عنصر ليه ركن متوقَّع
   من مقاسه، والخرق هو الاختلاف عن المتوقَّع — مش مجرّد رقم برّه
   قايمة. ده اللي بيمنع «فحص أخضر وسلّم ناقص». */
/* ⚠️ **السلّم ما بيتكتبش هنا، بيتقرا من `:root` وقت التشغيل.**
   بقى مشتقًّا من مفتاح واحد (`--r-base`)، فأي رقم مكتوب في الأداة
   بيبوظ أول ما المفتاح يتحرّك — والأداة بترجع خضرا وهي بتقارن
   بسلّم مش موجود. ده نفس المرض اللي `uiaudit-css` وقع فيه لما
   السلّم اتغيّر والأداة فضلت بتدوّر على ١٠/١٥/٢٢/٢٨.
   **الأداة بتقرا الحقيقة، ما بتفترضهاش.** */
let SCALE = {}
/** ═══ ليه نسبة لا قيمة متوقَّعة ═══
    أول محاولة كانت بتحسب «الركن المتوقَّع» من نطاق المقاس وتعتبر
    أي اختلاف خرقًا. ده طلّع ٢٧ سطرًا أغلبها ضوضاء: تولبار عرضه
    ١٤٣٧ وارتفاعه ٧٣ اتحسب «خرق» لأن أصغر ضلعه ٧٣، وهو أصلًا حاوية
    لا تحكّم · و`--h-md` (٤٤) كان بيوقع على حدّ النطاق فكل زرار في
    السيستم بيتحسب خرقًا.

    الشرط الحقيقي اللي العين بتشوفه **نسبة**: تحت ١٢٪ الركن بيبان
    حادًّا غريبًا جنب جيرانه، وفوق ٤٥٪ الشكل بيبطّل يكون مستطيلًا
    وبيتحوّل كبسولة بالغلط. ما بينهم مساحة قرار، مش خرق. */
const RATIO_MAX = 0.45   /* فوقها الشكل بقى كبسولة بالغلط */
const RATIO_MIN = 0.12   /* تحتها الركن حادّ غريب — **بس على العناصر الصغيرة** */
const SMALL = 80         /* فوق ٨٠px النسبة الصغيرة طبيعية: كارت ٨٠٠ بركن ٢٤ = ٣٪ وده صحّ */
/** دايرة: نصف القطر = نصّ الضلع · دور مشروع (نقطة · صورة · أفاتار) */
const isDot = (r, side) => Math.abs(r - side / 2) <= 0.6
/** الشعرة بتتقصّ لنصّ الضلع على أي عنصر أنحف من ٤px */
const isHairClamp = (r, side) => r <= 2 && (r === 2 || Math.abs(r - side / 2) <= 0.6)
/** الكبسولة والقيم الموروثة مقبولة دايمًا */
const onSystem = (r, side) => {
  if (r >= 100 || isDot(r, side) || isHairClamp(r, side)) return true
  if (SCALE[r] === undefined) return false          /* رقم برّه السلّم = خرق دايمًا */
  const ratio = r / side
  if (ratio > RATIO_MAX) return false
  return side > SMALL || ratio >= RATIO_MIN
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
await ctx.addInitScript(() => { sessionStorage.setItem('ab-session', 'audit'); localStorage.setItem('ab-theme', 'light') })
await ctx.addInitScript(() => {
  const k = () => { const st = document.createElement('style'); st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}'; document.head.appendChild(st) }
  document.head ? k() : document.addEventListener('DOMContentLoaded', k)
})
/* ── كشف الطبقات العابرة ──
   التلميح والقوايم المنبثقة `opacity:0` لحدّ الهوفر، فالجرد كان
   بيعدّي عليهم. `reveal.mjs` بيولّد ستايل بيكشفهم **من الـCSS
   نفسه** لا من قايمة مكتوبة. شغّل بـ`--reveal`. */
let REVEAL = ''
if (process.argv.includes('--reveal')) {
  const { execFileSync } = await import('node:child_process')
  REVEAL = execFileSync('node', [new URL('./reveal.mjs', import.meta.url).pathname], { encoding: 'utf8' })
  await ctx.addInitScript((cssText) => {
    const put = () => { const st = document.createElement('style'); st.textContent = cssText; document.head.appendChild(st) }
    document.head ? put() : document.addEventListener('DOMContentLoaded', put)
  }, REVEAL)
}
const page = await ctx.newPage()

/* ── السلّم بيتقرا من الصفحة نفسها قبل أي قياس ── */
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(500)
{
  const tok = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement)
    /* التوكن `calc()` فما ينفعش يتقرا كرقم · بيتحطّ على عنصر
       ويتقاس عرضه المحسوب، وده بيدّي القيمة النهائية بالبكسل */
    const px = (n) => {
      const v = cs.getPropertyValue(n).trim()
      if (!v) return 0
      const probe = document.createElement('div')
      probe.style.cssText = 'position:absolute;visibility:hidden;width:' + v
      document.body.appendChild(probe)
      const w = parseFloat(getComputedStyle(probe).width)
      probe.remove()
      return Number.isFinite(w) ? Math.round(w * 10) / 10 : 0
    }
    return { '--r-hair': px('--r-hair'), '--r0': px('--r0'), '--ric': px('--ric'),
             '--r1': px('--r1'), '--r2': px('--r2'), '--r3': px('--r3'), base: px('--r-base') }
  })
  for (const [name, v] of Object.entries(tok)) if (name !== 'base' && v > 0) SCALE[v] = name
  console.log('السلّم المقروء من :root · الأساس ' + tok.base + 'px')
  console.log('  ' + Object.entries(SCALE).sort((a, b) => a[0] - b[0])
    .map(([v, n]) => n + ' ' + v).join('  ·  ') + '\n')
}

const byValue = new Map()      // قيمة → {n, ex}
const offScale = new Map()     // قيمة خارج السلّم
const mixed = new Map()        // أركان مختلطة على نفس العنصر
const nesting = []             // أب/ابن
const ratios = new Map()       // دور → [{r, size}]
const roleDrift = new Map()    // دور → set(قيم)

for (const route of ROUTES) {
  await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(700)
  const got = await page.evaluate(() => {
    const key = (e) => {
      const c = String(e.className || '').split(' ').filter(Boolean).slice(0, 2).join('.')
      return e.tagName.toLowerCase() + (c ? '.' + c : '')
    }
    const num = (v, side) => {
      const n = parseFloat(v)
      if (!Number.isFinite(n)) return 0
      return String(v).includes('%') ? (n / 100) * side : n
    }
    const out = { all: [], nest: [] }
    const els = [...document.querySelectorAll('body *')]
    for (const e of els) {
      const r = e.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) continue
      const s = getComputedStyle(e)
      if (s.visibility === 'hidden' || s.opacity === '0') continue
      /* استثناء مكتوب في الـCSS نفسه (`--r-exempt:1`) · حاليًّا
         أعمدة الجراف الرأسية وحدها */
      if (s.getPropertyValue('--r-exempt').trim() === '1') continue
      const side = Math.min(r.width, r.height)
      const corners = [s.borderTopRightRadius, s.borderTopLeftRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius]
        .map((v) => Math.round(num(v.split(' ')[0], side) * 10) / 10)
      const max = Math.max(...corners)
      if (max <= 0) continue
      const uniq = [...new Set(corners)]
      /* ركن على بعض الجهات = **وصلة مقصودة** (تذييل ملزوق · لوح
         مقسوم · صفّ جدول في طرفه). النسبة مالهاش معنى عليه لأن
         الركن بيطابق الأب لا بيتناسب مع الجسم. */
      const partial = uniq.length > 1
      out.all.push({
        k: key(e), corners, uniq: uniq.length, max, partial,
        w: Math.round(r.width), h: Math.round(r.height), side: Math.round(side),
        ratio: Math.round((max / side) * 100),
      })

      /* التراكز: أقرب جدّ له ركن، والمسافة بين حافتيهما */
      let p = e.parentElement, depth = 0
      while (p && depth < 4) {
        const pr = p.getBoundingClientRect()
        const ps = getComputedStyle(p)
        const pside = Math.min(pr.width, pr.height)
        const pmax = Math.max(...[ps.borderTopRightRadius, ps.borderTopLeftRadius, ps.borderBottomRightRadius, ps.borderBottomLeftRadius].map((v) => num(v.split(' ')[0], pside)))
        if (pmax > 2 && pside > 2) {
          /* المسافة الحقيقية بين الحافتين على الجهتين العلويتين */
          const gapTop = Math.round(r.top - pr.top)
          const gapSide = Math.round(Math.min(Math.abs(r.left - pr.left), Math.abs(pr.right - r.right)))
          const gap = Math.min(gapTop, gapSide)
          if (gap >= 0 && gap <= 40 && pmax < 100 && max < 100) {
            out.nest.push({ child: key(e), parent: key(p), cr: Math.round(max), pr: Math.round(pmax), gap,
              ideal: Math.max(0, Math.round(pmax) - gap), err: Math.round(max) - Math.max(0, Math.round(pmax) - gap) })
          }
          break
        }
        p = p.parentElement; depth++
      }
    }
    return out
  })

  for (const it of got.all) {
    const v = it.max >= 100 ? 'كبسولة' : it.max
    const rec = byValue.get(v) ?? { n: 0, ex: new Set() }
    rec.n++; if (rec.ex.size < 3) rec.ex.add(`${it.k} ${it.side}px`)
    byValue.set(v, rec)

    if (it.max > 0 && !it.partial && !onSystem(it.max, it.side)) {
      const key = `${it.max}px على ضلع ${it.side} = ${Math.round((it.max / it.side) * 100)}%`
      const o = offScale.get(key) ?? { n: 0, ex: new Set() }
      o.n++; if (o.ex.size < 4) o.ex.add(`${it.k} (${it.w}×${it.h}) ${route}`)
      offScale.set(key, o)
    }
    if (it.uniq > 1) {
      const m = mixed.get(it.k) ?? { n: 0, shapes: new Set(), ex: new Set() }
      m.n++; m.shapes.add(it.corners.join('/')); if (m.ex.size < 2) m.ex.add(route)
      mixed.set(it.k, m)
    }
    const role = it.k.split('.')[1] ?? it.k
    if (!roleDrift.has(role)) roleDrift.set(role, new Map())
    const dm = roleDrift.get(role)
    dm.set(it.max >= 100 ? 'كبسولة' : it.max, (dm.get(it.max >= 100 ? 'كبسولة' : it.max) ?? 0) + 1)
    if (it.max < 100) {
      if (!ratios.has(it.side <= 24 ? '≤24' : it.side <= 40 ? '25–40' : it.side <= 80 ? '41–80' : it.side <= 200 ? '81–200' : '>200')) ratios.set(it.side <= 24 ? '≤24' : it.side <= 40 ? '25–40' : it.side <= 80 ? '41–80' : it.side <= 200 ? '81–200' : '>200', new Map())
      const band = ratios.get(it.side <= 24 ? '≤24' : it.side <= 40 ? '25–40' : it.side <= 80 ? '41–80' : it.side <= 200 ? '81–200' : '>200')
      band.set(it.max, (band.get(it.max) ?? 0) + 1)
    }
  }
  for (const n of got.nest) nesting.push({ ...n, route })
}
await browser.close(); server.close()

const ar = (n) => String(n)

console.log('════════ جرد نصف القطر · ' + ROUTES.length + ' مسارًا ════════\n')

console.log('═══ ١ · كل قيمة مرسومة ═══')
for (const [v, r] of [...byValue.entries()].sort((a, b) => b[1].n - a[1].n)) {
  const tok = SCALE[v] ? `  ← ${SCALE[v]}` : v === 'كبسولة' ? '  ← --rp' : '  · دايرة أو قصّ شعرة'
  console.log(`  ${String(v).padEnd(10)} ${String(r.n).padStart(6)}×${tok.padEnd(20)} ${[...r.ex].join(' | ')}`)
}

console.log('\n═══ ٢ · القيم خارج السلّم ═══')
if (!offScale.size) console.log('  نضيف.')
for (const [v, r] of [...offScale.entries()].sort((a, b) => b[1].n - a[1].n)) {
  console.log(`  ${String(v).padEnd(46)} ${String(r.n).padStart(5)}×   ${[...r.ex].join('\n' + ' '.repeat(56))}`)
}

console.log('\n═══ ٣ · النسبة: الركن مقابل مقاس العنصر ═══')
console.log('  (١٢ على مربّع ٢٤ = ٥٠٪ = دايرة · فوق ٤٠٪ الشكل بيفقد ركنه)')
for (const band of ['≤24', '25–40', '41–80', '81–200', '>200']) {
  const m = ratios.get(band); if (!m) continue
  const rows = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r}px ×${n}`).join(' · ')
  console.log(`  ضلع ${band.padEnd(8)} → ${rows}`)
}

console.log('\n═══ ٤ · التراكز · ركن الابن مقابل (ركن الأب − المسافة) ═══')
const nagg = new Map()
for (const n of nesting) {
  const k = `${n.parent} ⟶ ${n.child}`
  const a = nagg.get(k) ?? { n: 0, pr: n.pr, cr: n.cr, gap: n.gap, ideal: n.ideal, err: n.err, routes: new Set() }
  a.n++; a.routes.add(n.route); nagg.set(k, a)
}
const bad = [...nagg.entries()].filter(([, a]) => Math.abs(a.err) >= 4).sort((a, b) => Math.abs(b[1].err) - Math.abs(a[1].err))
console.log(`  أزواج متداخلة مقيسة: ${nagg.size} · منها **${bad.length}** فرقها ≥ ٤px عن التراكز\n`)
console.log('  ' + 'الأب ⟶ الابن'.padEnd(46) + 'أب  مسافة  المثالي  الفعلي  الفرق')
for (const [k, a] of bad.slice(0, 28)) {
  console.log(`  ${k.padEnd(46)}${String(a.pr).padStart(3)}${String(a.gap).padStart(7)}${String(a.ideal).padStart(9)}${String(a.cr).padStart(8)}${(a.err > 0 ? '+' : '') + a.err}`)
}

console.log('\n═══ ٥ · الركن المختلط (أركان مختلفة على نفس العنصر) ═══')
if (!mixed.size) console.log('  نضيف.')
for (const [k, m] of [...mixed.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 20)) {
  console.log(`  ${k.padEnd(28)} ${String(m.n).padStart(5)}×   ${[...m.shapes].slice(0, 3).join('  |  ')}`)
}

console.log('\n═══ ٦ · درِفت الدور (نفس الكلاس بأكتر من ركن) ═══')
let drift = 0
for (const [role, m] of [...roleDrift.entries()].sort((a, b) => b[1].size - a[1].size)) {
  if (m.size < 2) continue
  drift++
  if (drift <= 20) console.log(`  ${role.padEnd(24)} ${[...m.entries()].map(([v, n]) => `${v}×${n}`).join(' · ')}`)
}
console.log(`  إجمالي الأدوار بأكتر من ركن: ${drift}`)

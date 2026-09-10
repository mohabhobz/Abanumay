/**
 * جرد الواجهة وقت التشغيل — **بيقيس نفس الكمبوننت في كل مكان
 * ويقول فين اختلف**.
 *
 * الجرد الثابت (`uiaudit-css.mjs`) بيقول إن فيه ٨٥ مقاس خط في
 * الملف. لكنه ما بيقولش إن **زرار** في صفحة ارتفاعه ٣٢ وفي صفحة
 * تانية ٣٦ — لأن الارتفاع بيتحسب من الحشو والخط والحدود مع بعض.
 * ده بيتقاس من الصفحة المرسومة بس.
 *
 * فالسكربت ده بيمشي على كل المسارات في التلات ثيمات، وبيجمع لكل
 * **دور** (زرار · تاب · شريحة · وسم · حقل · صندوق أيقونة …) كل
 * القيم المحسوبة، وبيطلع:
 *
 *   · كام قيمة مختلفة لنفس الدور (الدرِفت)
 *   · أمثلة على كل قيمة وفين لقاها (عشان تتصلّح)
 *   · صناديق الأيقونات المستطيلة (w ≠ h)
 *   · نصف قطر الابن الأكبر من الأب (الركن المقطوع)
 *   · العناصر اللي بتتقصّ على حدود حاويتها
 *
 *   node tools/uiaudit.mjs            # كل المسارات، ثيم فاتح
 *   node tools/uiaudit.mjs --themes   # التلاتة
 *   node tools/uiaudit.mjs --json out.json
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const ROOT = new URL('../dist/', import.meta.url).pathname
const PORT = 4455
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.woff2': 'font/woff2' }

const ROUTES = [
  '/', '/projects', '/projects/20940', '/projects/20940/agreement', '/projects/20940/payments',
  '/entities', '/entities/694', '/entities/694/docs', '/entities/694/banks', '/entities/694/log',
  '/budget', '/payments', '/agreements',
  '/reports', '/reports/build', '/reports/catalog', '/reports/coverage',
  '/reports/view/budget', '/reports/screen/budget', '/reports/screen/closing',
  '/reports/process/p1', '/assistant', '/account',
]

/**
 * الأدوار — كل صف: اسم الدور، المُحدِّد، والخصائص اللي المفروض
 * تكون موحَّدة فيه. المُحدِّد بيتكتب مرة واحدة هنا، فلو اتغيّر
 * في الستايل بيتغيّر هنا كمان — الجرد جزء من النظام لا أداة برّه.
 */
const ROLES = [
  { key: 'زرار أساسي', sel: '.btn', props: ['height', 'borderRadius', 'fontSize', 'paddingBlock', 'paddingInline'] },
  { key: 'تاب', sel: '.tabs .tab', props: ['height', 'borderRadius', 'fontSize', 'paddingInline'] },
  { key: 'شريحة أدوات', sel: '.fchip', props: ['height', 'borderRadius', 'fontSize', 'paddingInline'] },
  { key: 'شريحة حالة', sel: '.fseg', props: ['height', 'borderRadius', 'fontSize', 'paddingInline'] },
  { key: 'وسم', sel: '.tag', props: ['height', 'borderRadius', 'fontSize', 'paddingInline'] },
  { key: 'حقل اختيار', sel: '.fsel .fsel-b', props: ['height', 'borderRadius', 'fontSize'] },
  { key: 'بحث', sel: '.srch', props: ['height', 'borderRadius', 'fontSize'] },
  { key: 'خيار في قائمة', sel: '.fopt', props: ['borderRadius', 'fontSize', 'paddingBlock', 'paddingInline'] },
  { key: 'قائمة منسدلة', sel: '.fmenu', props: ['borderRadius', 'padding'] },
  { key: 'كارت زجاج', sel: '.glass', props: ['borderRadius'] },
  { key: 'ترويسة جدول', sel: '.tbl thead th', props: ['height', 'fontSize', 'paddingInline'] },
  { key: 'خلية جدول', sel: '.tbl tbody td', props: ['height', 'fontSize', 'paddingInline'] },
  { key: 'عنوان صفحة', sel: '.ptitle', props: ['fontSize', 'fontWeight'] },
  { key: 'عنوان سكشن', sel: '.hd-t, .head h2, .head-t', props: ['fontSize', 'fontWeight'] },
  { key: 'نصّ مساعد', sel: '.sub', props: ['fontSize'] },
]

/**
 * السلالم المعلَنة في `docs/UI_STANDARDS.md`.
 * القيمة اللي برّه السلّم خطأ، لا استثناء.
 */
const SCALE = {
  radius: [0, 10, 15, 22, 28, 999],
  control: [28, 34, 42],
  iconBox: [24, 30, 38, 44],
  space: [0, 2, 4, 6, 8, 12, 16, 22, 32, 48],
  font: [11.2, 12.16, 13.12, 14.4, 16.8, 24, 33.6], // rem→px عند 16px
}

/** صناديق الأيقونات — المفروض مربّعة دايمًا */
const ICON_BOX = '.catc-i,.rbc-i,.rpk-i,.badge,.lrfind>.badge,.htile-ic,.aclose,.vtog button,.aifold,.fopt-x,.rpp-n,.catsum-s>b'

const serve = () => new Promise((res) => {
  const s = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x')
    let f = path.join(ROOT, decodeURIComponent(u.pathname))
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, 'index.html')
    r.setHeader('Content-Type', MIME[path.extname(f)] ?? 'application/octet-stream')
    fs.createReadStream(f).pipe(r)
  })
  s.listen(PORT, () => res(s))
})

const server = await serve()
const themes = process.argv.includes('--themes') ? ['light', 'dark', 'green'] : ['light']
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })

/** role → prop → value → [{route, sample}] */
const bag = {}
const squares = []
const nested = []
const clipped = []
const cta = []
const tabs = []
const drop = []
const primary = []
const steps = []
const nums = { total: 0, noTabular: 0 }

for (const theme of themes) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  await ctx.addInitScript((t) => {
    sessionStorage.setItem('ab-session', 'audit')
    localStorage.setItem('ab-theme', t)
  }, theme)
  const page = await ctx.newPage()

  for (const route of ROUTES) {
    await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(900)

    const found = await page.evaluate(({ ROLES, ICON_BOX }) => {
      const px = (v) => Math.round(parseFloat(v) || 0)
      const out = { roles: {}, squares: [], nested: [], clipped: [] }

      for (const r of ROLES) {
        const els = [...document.querySelectorAll(r.sel)].filter((e) => e.offsetParent !== null)
        if (!els.length) continue
        out.roles[r.key] = {}
        for (const p of r.props) {
          const vals = new Set()
          for (const e of els) {
            const cs = getComputedStyle(e)
            let v
            if (p === 'height') v = `${Math.round(e.getBoundingClientRect().height)}px`
            else if (p === 'paddingBlock') v = `${px(cs.paddingTop)}/${px(cs.paddingBottom)}`
            else if (p === 'paddingInline') v = `${px(cs.paddingInlineStart)}/${px(cs.paddingInlineEnd)}`
            else v = cs[p]
            vals.add(String(v).trim())
          }
          out.roles[r.key][p] = [...vals]
        }
      }

      /* صناديق يفترض إنها مربّعة */
      for (const e of document.querySelectorAll(ICON_BOX)) {
        if (e.offsetParent === null) continue
        const b = e.getBoundingClientRect()
        if (b.width < 8 || b.height < 8) continue
        if (Math.abs(b.width - b.height) > 1.5) {
          out.squares.push({ cls: e.className?.baseVal ?? e.className ?? e.tagName,
            w: Math.round(b.width), h: Math.round(b.height) })
        }
      }

      /* ركن الابن أصغر من ركن الأب وحاويته بتقصّ.
         شرط لازم: الابن **بيرسم فعلًا** عند الركن — خلفية أو ظلّ
         خارجي أو حدّ، أو هو نفسه حاوية بتقصّ/بتتزحلق. ابن شفّاف
         ركنه صفر ما بيبانش أصلًا، وتعليمه إنذار كاذب بيقفل
         التقرير. (نفس درس `.fsegs` في الجرد رقم ١.) */
      const rad = (e) => Math.round(parseFloat(getComputedStyle(e).borderTopLeftRadius) || 0)
      const paintsAtEdge = (e) => {
        const s = getComputedStyle(e)
        if (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)') return true
        if (s.backgroundImage && s.backgroundImage !== 'none') return true
        if (s.boxShadow && s.boxShadow !== 'none' && !/inset/.test(s.boxShadow)) return true
        if (parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderBottomWidth) > 0) return true
        if (s.overflow !== 'visible') return true      /* حاوية بتقصّ لنفسها */
        return false
      }
      for (const parent of document.querySelectorAll('.glass,.tblock,.fmenu,.chrome')) {
        const pr = rad(parent)
        if (!pr) continue
        const clip = getComputedStyle(parent).overflow !== 'visible'
        if (!clip) continue
        for (const kid of parent.children) {
          const kr = rad(kid)
          const kb = kid.getBoundingClientRect(), pb = parent.getBoundingClientRect()
          const touches = Math.abs(kb.top - pb.top) < 2 || Math.abs(kb.bottom - pb.bottom) < 2
          if (touches && kr < pr - 2 && paintsAtEdge(kid)) {
            out.nested.push({ parent: String(parent.className).split(' ')[0], kid: String(kid.className).split(' ')[0] || kid.tagName, pr, kr })
          }
        }
      }

      /* أكتر من دعوة أساسية في الشاشة */
      out.primary = document.querySelectorAll('.btn-p').length

      /* الاستِبر: القطعة اللي وسط الشريط المفروض أركانها قائمة من
         الجهتين، واللي على الطرف مدوّرة من برّه بس */
      out.steps = []
      for (const bar of document.querySelectorAll('.vsteps,.steps,.agr-steps,.fsegs,.seg')) {
        const kids = [...bar.children].filter((k) => k.offsetParent !== null)
        if (kids.length < 2) continue
        kids.forEach((k, i) => {
          const cs = getComputedStyle(k)
          const r = [cs.borderTopRightRadius, cs.borderBottomRightRadius,
            cs.borderTopLeftRadius, cs.borderBottomLeftRadius].map((v) => Math.round(parseFloat(v) || 0))
          const mid = i > 0 && i < kids.length - 1
          if (mid && r.some((x) => x > 2)) {
            out.steps.push({ bar: String(bar.className).split(' ')[0], i, r: r.join('/') })
          }
        })
      }

      /* الأرقام في الجداول: أرقام مصفوفة؟ وفيه فاصل بين رقمين؟ */
      out.nums = { noTabular: 0, total: 0 }
      for (const td of document.querySelectorAll('.tbl td.num, .tbl td .num')) {
        out.nums.total += 1
        if (!getComputedStyle(td).fontVariantNumeric.includes('tabular-nums')) out.nums.noTabular += 1
      }

      /* عنصر بيتقصّ على حدّ حاويته (سبب اختفاء الهوفر) */
      for (const e of document.querySelectorAll('.qread,.qr-list,.tblwrap,.fmenu-l,.aiscroll')) {
        if (e.offsetParent === null) continue
        const cs = getComputedStyle(e)
        if (cs.overflow === 'visible') continue
        const pt = Math.round(parseFloat(cs.paddingTop) || 0)
        const first = e.firstElementChild
        /* الحاوية اللي بتتزحلق أفقيًا بس: المتصفح بيحوّل المحور
           التاني لـ`auto` تلقائيًا، فما ينفعش نعتبرها قاصّة رأسيًا.
           اللي يهمّنا هو القصّ الرأسي الحقيقي — إما `hidden` صريح
           أو محتوى بيفيض فوق الارتفاع. */
        const clipsY = cs.overflowY === 'hidden' || e.scrollHeight > e.clientHeight + 1
        if (first && pt < 4 && clipsY) {
          out.clipped.push({ cls: String(e.className).split(' ')[0], paddingTop: pt })
        }
      }
      /* ألوان الدعوة للفعل — نفس الدور بألوان مختلفة */
      out.cta = []
      for (const e of document.querySelectorAll('.btn')) {
        if (e.offsetParent === null) continue
        const cs = getComputedStyle(e)
        const variant = [...e.classList].find((c) => /^btn-/.test(c)) ?? 'btn'
        out.cta.push({ variant, bg: cs.backgroundColor, color: cs.color })
      }
      /* التابات */
      out.tabs = []
      for (const e of document.querySelectorAll('.tabs .tab')) {
        if (e.offsetParent === null) continue
        const cs = getComputedStyle(e)
        out.tabs.push({ on: e.classList.contains('on') || e.getAttribute('aria-selected') === 'true',
          bg: cs.backgroundColor, color: cs.color })
      }
      /* نمط القائمة المنسدلة: أصلية ولا مرسومة */
      out.drop = {
        native: document.querySelectorAll('select').length,
        custom: document.querySelectorAll('[aria-haspopup="menu"],[aria-haspopup="listbox"]').length,
      }
      return out
    }, { ROLES, ICON_BOX })

    for (const [role, props] of Object.entries(found.roles)) {
      bag[role] ??= {}
      for (const [p, vals] of Object.entries(props)) {
        bag[role][p] ??= new Map()
        for (const v of vals) {
          if (!bag[role][p].has(v)) bag[role][p].set(v, new Set())
          bag[role][p].get(v).add(`${route}${themes.length > 1 ? `·${theme}` : ''}`)
        }
      }
    }
    for (const s of found.squares) squares.push({ ...s, route, theme })
    for (const x of found.cta) cta.push({ ...x, route, theme })
    for (const x of found.tabs) tabs.push({ ...x, route, theme })
    if (found.drop.native || found.drop.custom) drop.push({ ...found.drop, route, theme })
    if (found.primary > 1) primary.push({ route, theme, n: found.primary })
    for (const x of found.steps) steps.push({ ...x, route, theme })
    nums.total += found.nums.total; nums.noTabular += found.nums.noTabular
    for (const n of found.nested) nested.push({ ...n, route, theme })
    for (const c of found.clipped) clipped.push({ ...c, route, theme })
  }
  await ctx.close()
}
await browser.close()
server.close()

/* ═══ التقرير ═══ */
const uniq = (arr, k) => [...new Map(arr.map((x) => [k(x), x])).values()]

console.log('═══════════════════════════════════════════════')
console.log(' جرد الواجهة وقت التشغيل')
console.log(` ${ROUTES.length} مسارًا × ${themes.length} ثيم`)
console.log('═══════════════════════════════════════════════')

let drift = 0
for (const [role, props] of Object.entries(bag)) {
  const bad = Object.entries(props).filter(([, m]) => m.size > 1)
  if (!bad.length) continue
  console.log(`\n▸ ${role}`)
  for (const [p, m] of bad) {
    drift += m.size - 1
    const vals = [...m.entries()].sort((a, b) => b[1].size - a[1].size)
    console.log(`   ${p}: ${m.size} قيم مختلفة`)
    for (const [v, routes] of vals.slice(0, 6)) {
      const r = [...routes]
      console.log(`      ${String(v).padEnd(12)} ← ${r.slice(0, 3).join(' ')}${r.length > 3 ? ` +${r.length - 3}` : ''}`)
    }
  }
}

console.log(`\n═══ خارج السلّم المعلَن ═══`)
{
  const near = (v, list) => list.some((x) => Math.abs(x - v) < 1.2)
  const check = (roleKey, prop, list, label) => {
    const m = bag[roleKey]?.[prop]
    if (!m) return
    const off = [...m.keys()].map((v) => parseFloat(v)).filter((v) => !Number.isNaN(v) && !near(v, list))
    if (off.length) {
      drift += off.length
      console.log(`  ${roleKey} · ${label}: ${[...new Set(off)].join(' · ')}px خارج [${list.join(' ')}]`)
    }
  }
  for (const r of ['زرار أساسي', 'تاب', 'شريحة أدوات', 'شريحة حالة', 'وسم', 'بحث']) check(r, 'height', SCALE.control, 'الارتفاع')
  check('حقل اختيار', 'height', SCALE.control, 'الارتفاع')
  for (const r of Object.keys(bag)) check(r, 'borderRadius', SCALE.radius, 'نصف القطر')
}

console.log(`\n═══ أكتر من دعوة أساسية في الشاشة ═══`)
if (!primary.length) console.log('  نضيف.')
for (const x of uniq(primary, (v) => v.route)) { drift += 1; console.log(`  ${x.route}  ${x.n} × .btn-p`) }

console.log(`\n═══ الاستِبر: قطعة وسط الشريط مدوّرة ═══`)
{
  const st = uniq(steps, (x) => `${x.bar}:${x.r}`)
  if (!st.length) console.log('  نضيف.')
  for (const x of st.slice(0, 12)) { drift += 1; console.log(`  ${x.bar} [${x.i}]  أركان ${x.r}   ${x.route}`) }
}

console.log(`\n═══ أرقام الجداول ═══`)
console.log(`  خلايا رقمية: ${nums.total} · بلا tabular-nums: ${nums.noTabular}`)
if (nums.noTabular) drift += 1

console.log(`\n═══ ألوان الدعوة للفعل ═══`)
{
  const byVar = new Map()
  for (const x of cta) {
    const k = `${x.variant} · ${x.theme}`
    if (!byVar.has(k)) byVar.set(k, new Map())
    const m = byVar.get(k)
    const v = `${x.bg} / ${x.color}`
    if (!m.has(v)) m.set(v, new Set())
    m.get(v).add(x.route)
  }
  for (const [k, m] of [...byVar].sort()) {
    if (m.size > 1) { drift += m.size - 1 }
    console.log(`  ${k.padEnd(22)} ${m.size} لون`)
    for (const [v, rs] of m) console.log(`     ${v}  ← ${[...rs].slice(0, 3).join(' ')}`)
  }
}

console.log(`\n═══ التابات ═══`)
{
  const m = new Map()
  for (const x of tabs) {
    const k = `${x.on ? 'مختار' : 'عادي'} · ${x.theme}`
    if (!m.has(k)) m.set(k, new Set())
    m.get(k).add(`${x.bg} / ${x.color}`)
  }
  for (const [k, s] of [...m].sort()) console.log(`  ${k.padEnd(18)} ${[...s].join('   ')}`)
}

console.log(`\n═══ نمط القوائم المنسدلة ═══`)
{
  const nat = drop.reduce((a, x) => a + x.native, 0)
  const cus = drop.reduce((a, x) => a + x.custom, 0)
  console.log(`  <select> أصلية: ${nat}`)
  console.log(`  مرسومة (aria-haspopup): ${cus}`)
  const both = drop.filter((x) => x.native && x.custom)
  console.log(`  صفحات فيها النمطان معًا: ${uniq(both, (x) => x.route).length}`)
  for (const x of uniq(both, (v) => v.route).slice(0, 10)) console.log(`     ${x.route}  (${x.native} أصلية · ${x.custom} مرسومة)`)
}

console.log(`\n═══ صناديق مستطيلة (المفروض مربّعة) ═══`)
const sq = uniq(squares, (x) => `${x.cls}:${x.w}x${x.h}`)
if (!sq.length) console.log('  نضيف.')
for (const s of sq) console.log(`  ${String(s.cls).padEnd(20)} ${s.w}×${s.h}   ${s.route}`)

console.log(`\n═══ ركن الابن أصغر من ركن الأب ═══`)
const nd = uniq(nested, (x) => `${x.parent}>${x.kid}`)
if (!nd.length) console.log('  نضيف.')
for (const n of nd.slice(0, 20)) console.log(`  ${n.parent} (${n.pr}px) > ${n.kid} (${n.kr}px)   ${n.route}`)

console.log(`\n═══ حاوية بتقصّ بلا حشو علوي ═══`)
const cl = uniq(clipped, (x) => x.cls)
if (!cl.length) console.log('  نضيف.')
for (const c of cl) console.log(`  ${c.cls}  padding-top:${c.paddingTop}px   ${c.route}`)

console.log(`\n═══════════════════════════════════════════════`)
console.log(` إجمالي الانحراف: ${drift} قيمة زايدة عن الموحَّد`)
console.log('═══════════════════════════════════════════════')

if (process.argv.includes('--json')) {
  const f = process.argv[process.argv.indexOf('--json') + 1]
  const plain = {}
  for (const [role, props] of Object.entries(bag)) {
    plain[role] = {}
    for (const [p, m] of Object.entries(props)) plain[role][p] = Object.fromEntries([...m].map(([v, s]) => [v, [...s]]))
  }
  fs.writeFileSync(f, JSON.stringify({ roles: plain, squares: sq, nested: nd, clipped: cl }, null, 1))
  console.log(`\nJSON → ${f}`)
}

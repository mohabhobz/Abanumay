/**
 * محاذاة ترويسة العمود — لازم تطابق محاذاة قيمه.
 *
 * ⚠️ في RTL الغلطة دي **بتتشاف كعمود مكسور**: عمود الأرقام
 * محاذاته يسار (عشان الخانات تتسطر فوق بعض)، وترويسته ورثت
 * محاذاة الجدول العامة (يمين) — فالعنوان في ناحية والأرقام في
 * الناحية التانية، والعين بتربط العنوان بالعمود اللي جنبه.
 *
 *   node tools/thalign.mjs
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { ROUTES } from './routes.mjs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../dist/', import.meta.url))
const PORT = 4841
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
let checked = 0

/* ⚠️ **ضابط سالب.** الأداة دي رجعت أخضر بعد أربع إعادات كتابة،
   وأخضر من أداة اتعدّلت لسّه ما بيعنيش إنها بتشوف. `--selftest`
   بيقلب محاذاة ترويسة العمود الرقمي في المتصفّح: لو رجعت أخضر
   وهي مقلوبة، فالفحص أعمى لا السيستم سليم. */
const SELFTEST = process.argv.includes('--selftest')

for (const route of ROUTES) {
  await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'domcontentloaded' })
  if (SELFTEST) await page.addStyleTag({ content: '.tbl th.n{text-align:right !important}' })
  await page.waitForTimeout(600)
  const got = await page.evaluate(() => {
    const out = []
    for (const tbl of document.querySelectorAll('table')) {
      const ths = [...tbl.querySelectorAll('thead th')]
      const row = tbl.querySelector('tbody tr')
      if (!row) continue
      const tds = [...row.children]
      ths.forEach((th, i) => {
        const td = tds[i]; if (!td) return
        /* ⚠️ **بنقيس موضع الحبر لا خاصية `text-align`.**
           `th` افتراضها `center` من المتصفّح، والمحاذاة الحقيقية
           جاية من فليكس جوّاها — فالقراءة المصرَّحة بتقول
           «ترويسة center · قيمة right» على ٦١ عمود كلهم مظبوطين.
           القياس الصح: **فين الحبر فعلًا جوّه الخانة.** */
        /* ⚠️ **الذرّة = أصغر صندوق مرسوم، لا عقدة النصّ.**
           الوسم (`.tag`) صندوق له حشوه: نصّه بعيد عن حافة الخانة
           بـ٢٠px (١٢ حشو الخانة + ٨ حشو الوسم)، فقياس النصّ وحده
           بيقول «مش ملزوق» والوسم نفسه ملزوق تمامًا. وبالعكس، لو
           قِسنا الأبناء المباشرين وحدهم، `.th-t` بتملا الترويسة
           فبتطلع «مالية» وتخرج من الفحص.
           فالقاعدة: **الابن اللي بيملا صندوق أبوه مش ذرّة — انزل
           جوّاه.** واللي مش بيملاه صندوقه هو الذرّة. */
        /* ⚠️ **الإطار المرجعي بينزل مع النزول.** زرار الملف
           (`.dfile-b`) حشوه ٨px على الجهات الأربعة عشان ارتفاعه
           يساوي ارتفاع الصفّ — فالمصغَّرة جوّاه ملزوقة في حافة
           **الزرار** لا حافة الخانة. لو قِسنا بحافة الخانة بيطلع
           فرق ٨px ونتقرا «غير مصفوف» وهو مصفوف تمامًا. فالمقارنة
           بتبقى مع صندوق حشو **آخر عنصر مالي** نزلنا جوّاه. */
        let frame = null
        const atoms = (el, depth) => {
          const rb = el.getBoundingClientRect()
          const cs2 = getComputedStyle(el)
          const pl = parseFloat(cs2.paddingLeft) || 0
          const pr = parseFloat(cs2.paddingRight) || 0
          const innerW = rb.width - pl - pr
          frame = { left: rb.left + pl, right: rb.right - pr }
          const out = []
          for (const node of el.childNodes) {
            if (node.nodeType === 3) {
              if (!node.textContent.trim()) continue
              const rg = document.createRange(); rg.selectNodeContents(node)
              out.push(...[...rg.getClientRects()].filter((x) => x.width > 0.5 && x.height > 0.5))
            } else if (node.nodeType === 1) {
              const cr = node.getBoundingClientRect()
              if (cr.width < 0.5 || cr.height < 0.5) continue
              const ncs = getComputedStyle(node)
              if (ncs.visibility === 'hidden' || ncs.opacity === '0') continue
              /* ⚠️ **مقبض تغيير العرض مش محتوى.** `.thgrip` عنصر فاضي
                 ملزوق في حافة الترويسة، ولمّا دخل القياس كذرّة بقى
                 الاتّحاد ماسك الحافتين — فترويسة عمود رقمي محاذاتها
                 يسار فعلًا (فراغ اليسار ١٢ زي قيمها بالظبط) اتقرت
                 «يمين»، وطلعت ستّ حالات كاذبة.

                 والشرط **«بيرسم» لا «فيه نصّ»**: أول كتابة شالت أي
                 عنصر بلا نصّ، فشالت معاها مصغَّرة الملف (`.dthumb`)
                 — وهي مربّع ٣٤px مرسوم بالكامل بمحتوًى مولَّد من
                 الـCSS، ملزوق في يمين الخانة. من غيرها العمود بيتقرا
                 «قيمة center» وهو مصفوف مظبوط. */
              const paints = node.textContent.trim()
                /* ⚠️ `tagName` لعنصر SVG **بحروف صغيرة** (`svg` لا
                   `SVG`) — المقارنة بالكبيرة كانت بتسقط سهم الشجرة
                   في عمود «البند»، فالقيمة تتقرا «center» وهي ملزوقة
                   في اليمين بسهمها. `matches` بيشيل الفخّ. */
                || node.matches('svg,img,canvas') || node.querySelector('svg,img,canvas')
                || (ncs.backgroundImage && ncs.backgroundImage !== 'none')
                || !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(ncs.backgroundColor)
                || (ncs.boxShadow && ncs.boxShadow !== 'none')
                || parseFloat(ncs.borderTopWidth) > 0 || parseFloat(ncs.borderLeftWidth) > 0
              if (!paints) continue
              if (cr.width >= innerW - 1 && depth < 5) out.push(...atoms(node, depth + 1))
              else out.push(cr)
            }
          }
          return out
        }
        const ink = (cell) => {
          frame = null
          const use = atoms(cell, 0)
          if (!use.length || !frame) return null
          const r = { left: frame.left, right: frame.right, width: frame.right - frame.left }
          const cs = { paddingLeft: '0', paddingRight: '0' }
          const l = Math.min(...use.map((x) => x.left)), rr = Math.max(...use.map((x) => x.right))
          /* ⚠️ **المحاذاة = الحافة اللي الحبر ملزوق فيها، لا مقارنة
             الفراغين.** المقارنة (`gapL < gapR ← يسار`) بتنهار على
             أول نصّ طويل: عمود المنطقة محاذاته يمين والقيمة «المنطقة
             الشرقية» بتملا الخانة، ففراغ اليسار ٠٫٣ وفراغ اليمين ١٢
             فبتترجم «يسار» وهي ملزوقة في اليمين بالظبط زي ترويستها.
             ده كان **مصدر الخمس حالات الكاذبة كلها** — كلهم
             `gapR = 12` بالمليمتر، يعني كلهم مظبوطين.

             القياس الصحّ: صندوق الحشو. الحبر ملزوق في اليمين لو
             حافته اليمنى على `right − padding-right`، وفي اليسار لو
             حافته اليسرى على `left + padding-left`. ولو ملزوق في
             الاتنين فالنصّ مالي الخانة والمحاذاة مالهاش معنى. */
          const padL = parseFloat(cs.paddingLeft) || 0
          const padR = parseFloat(cs.paddingRight) || 0
          const T = 2.5
          /* ⚠️ **المحتوى اللي بيملا الخانة مالوش محاذاة.** ترويسة
             «مدة التنفيذ الفعلية بالأيام» في عمود ١٢٠px أعرض من
             خانتها، فبتتقصّ بنقط — وفي RTL الفايض بيخرج من الشمال
             والحافة اليمنى بتفضل مكانها **مهما كانت `text-align`**.
             فالأداة قرتها «يمين» وهي `text-align:left` فعلًا، وطلعت
             تلات حالات كاذبة. اللي بيملا بيخرج من الفحص. */
          if (rr - l >= r.width - padL - padR - 1) return 'full'
          const atL = Math.abs(l - (r.left + padL)) <= T
          const atR = Math.abs(rr - (r.right - padR)) <= T
          /* الفايض بيعدّي الحافة (`overflow:hidden` بيقصّ الرسم لا
             الصندوق) · الفايض من ناحية = ملزوق في التانية */
          const overL = l < r.left + padL - T
          const overR = rr > r.right - padR + T
          if (atL && atR) return 'full'
          if (overL && overR) return 'full'
          if (atR || overL) return 'right'
          if (atL || overR) return 'left'
          return 'center'
        }
        const ha = ink(th), da = ink(td)
        if (!ha || !da || ha === 'full' || da === 'full') return
        out.push([ha === da, `${th.textContent.trim().slice(0, 18)} · ترويسة ${ha} · قيمة ${da}`])
      })
    }
    return out
  })
  for (const [ok, msg] of got) { checked++; if (!ok) bad.set(`${route} · ${msg}`, 1) }
}
await browser.close(); server.close()

console.log(`════ محاذاة ترويسة العمود · ${checked} عمود ════`)
if (!bad.size) { console.log('✅ كل ترويسة بمحاذاة قيمها'); process.exit(0) }
console.log(`\n⚠️ ${bad.size} عمود ترويسته مخالفة:`)
for (const k of bad.keys()) console.log('  ' + k)
process.exit(1)

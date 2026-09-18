/**
 * فاحص **التعتيم** للطبقات العايمة.
 *
 * السؤال اللي بيجاوب عليه: *لمّا طبقة تفتح فوق المحتوى، هل المحتوى
 * اللي تحتها بيبان من خلالها؟*
 *
 * ═══ ليه ده مش سؤال ألوان ═══
 *
 * سطوح السيستم مبنية على `rgba(var(--wC), N * var(--wM))` — أبيض
 * بألفا مضروبة في معامل الثيم. وده **صحّ للكارت**: الكارت بيرتفع
 * عن الصفحة بلمسة ضوء، وفي الغامق اللمسة لازم تبقى خفيفة (`--wM`
 * ≈ ٠٫٠٨٥) وإلا الكارت يبقى بقعة بيضا.
 *
 * لكن الطبقة العايمة **بتغطّي** لا بترفع. ولمّا نفس الوصفة تتحطّ
 * عليها، الفاتح بيدّي ٩٢٪ أبيض (معتم عمليًّا فالمشكلة مش بتبان)
 * والغامق بيدّي **٨٪** — يعني القايمة شفّافة والنصّ اللي تحتها
 * بيتقرا من خلالها. **نفس السطر بيتصرّف صحّ في ثيم وغلط في التاني**،
 * وده بالظبط اللي بيخلّي الجرد بثيم واحد يرجع أخضر.
 *
 * ═══ القياس ═══
 *
 * مش بنقرا الألفا من الـCSS — بنصوّر. لكل طبقة مفتوحة:
 *   ١ · لقطة للطبقة والمحتوى ورَاها.
 *   ٢ · نخفي المحتوى كله (`visibility`) ونسيب الطبقة، بنفس خلفية
 *       رمادية ثابتة، ونصوّر تاني.
 *   ٣ · نقارن البكسلات. **أي فرق = تسريب**، وبنقيس نسبته.
 *
 * الخلفية الرمادية الثابتة في اللقطتين ضرورية: من غيرها تدرّج
 * الصفحة نفسه بيطلع فرقًا ويدّي إنذارًا كاذبًا.
 *
 *   node tools/overlay.mjs            # عيّنة ممثّلة · أقل من دقيقة
 *   node tools/overlay.mjs --all      # ٢٩ مسارًا · بطيء
 *   node tools/overlay.mjs /entities  # مسار واحد
 *
 * ⚠️ العيّنة مقصودة: الطبقات دي **كمبوننتس عامّة** (نفس `.fmenu`
 * على كل صفحة قايمة)، فزيادة المسارات بتزوّد الزمن لا التغطية.
 * وكل لقطة بتستنّى تحميل الخطوط، فالسويب الكامل بياخد دقايق —
 * وفحص محدّش بيشغّله مش فحص.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { PNG } from 'pngjs'
import { ROUTES } from './routes.mjs'
import { fileURLToPath } from 'node:url'

const ONLY = process.argv[2] && process.argv[2].startsWith('/') ? process.argv[2] : null
const ALL = process.argv.includes('--all')
/** عيّنة فيها كل أنواع الطبقات مرّة على الأقل */
const SAMPLE = ['/entities', '/projects', '/budget', '/assistant']
const ROOT = fileURLToPath(new URL('../dist/', import.meta.url))
const PORT = 4641
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

const TRIGGERS = ['[aria-haspopup]', '[aria-expanded]', '.acctbtn', '.fsel-b', '.fchip', '.cl-more', '.fcust-h', '.gpeek-h', '.fview-x', '.bulkx']
/** الطبقات العايمة · اللي **بتغطّي** المحتوى لا اللي بترتفع عنه */
const LAYERS = '[role=menu],[role=dialog],[role=listbox],.fmenu,.modal,.acct,.gpeek,.fprev,.pop,.cl-menu,.bulkdock,.rail-tip'
/** نسبة البكسلات المختلفة اللي بعدها بنعدّها تسريبًا */
/* متوسّط انحراف القناة.
   الحدّ ٨٪ مش رقمًا مزاجيًّا — هو **بين القياسين**: نفس القايمة
   على نفس الصفحة اتقاست بالوصفة القديمة والجديدة:
       فاتح · قبل ٣٫٣٪ · بعد ٣٫٣٪   (الفاتح مكانش فيه مشكلة)
       غامق · قبل ٣٢٫٧٪ · بعد ٣٫٢٪  ← ده اللي العميل شافه
   الـ٣٫٣٪ الباقية مش تسريب: هي إزاحة `backdrop-filter` نفسها
   (الطمس بياخد عيّنة من اللي ورَا الطبقة، فلمّا المحتوى يتشال
   لون الطمس بيتغيّر). ٨٪ بتفصل الاتنين بهامش مريح. */
const LIMIT = 0.08

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const bad = new Map()
let checked = 0

const shoot = async (page, box) => {
  const b = { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) }
  if (b.width < 8 || b.height < 8) return null
  return PNG.sync.read(await page.screenshot({ clip: b }))
}
/**
 * ⚠️ **المقياس متوسّط الفرق لا عدد البكسلات المختلفة.**
 * أول كتابة عدّت البكسلات اللي اتغيّرت أكتر من عتبة صغيرة —
 * فرجّعت ٩٣–١٠٠٪ لكل طبقة، حتى المعتمة. السبب: `backdrop-filter`
 * بتاخد عيّنة من اللي ورَا الطبقة، ولمّا المحتوى يتشال الطمس نفسه
 * بيتغيّر · فحتى طبقة ٩٢٪ معتمة بتزحزح **كل** بكسل بمقدار ضئيل.
 * العدّ بيقول «١٠٠٪ اتغيّروا» والحقيقة إن كل واحد اتغيّر بدرجة
 * واحدة من ٢٥٥. المتوسّط بيفرّق بين الزحزحة والتسريب.
 */
const diff = (a, b) => {
  if (!a || !b || a.data.length !== b.data.length) return null
  let sum = 0, n = 0
  for (let i = 0; i < a.data.length; i += 4) {
    sum += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])
    n++
  }
  return sum / (n * 3) / 255
}

for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  await ctx.addInitScript((t) => { sessionStorage.setItem('ab-session', 'audit'); localStorage.setItem('ab-theme', t) }, theme)
  await ctx.addInitScript(() => {
    const k = () => { const st = document.createElement('style'); st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}'; document.head.appendChild(st) }
    document.head ? k() : document.addEventListener('DOMContentLoaded', k)
  })
  const page = await ctx.newPage()

  for (const route of (ONLY ? [ONLY] : ALL ? ROUTES : SAMPLE)) {
    await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(650)
    /* الخلفية الرمادية مرّة واحدة للصفحة · كانت بتتحقن لكل طبقة
       فبتتكدّس عشرات وسوم ستايل وتبطّئ الرسم */
    await page.addStyleTag({ content: 'html,body{background:#7d7d7d!important}' })
    const handles = []
    for (const sel of TRIGGERS) handles.push(...await page.$$(sel))
    const uniq = []
    for (const h of handles) {
      const id = await h.evaluate((e) => e.outerHTML.slice(0, 70)).catch(() => null)
      if (id && !uniq.some((u) => u.id === id)) uniq.push({ id, h })
    }

    for (const { h } of uniq.slice(0, ALL ? 10 : 6)) {
      try { await h.click({ timeout: 1000 }) } catch { continue }
      await page.waitForTimeout(300)
      /* ⚠️ **الترشيح قبل السقف لا بعده.** أول كتابة أخدت أول
         أربع طبقات وبعدين رمت الصغيرة — والأربعة الأوائل في
         ترتيب الـDOM كانوا تلميحات ٤٠×٢٦، فالقايمة الحقيقية
         اللي ورَاهم عمرها ما اتقاست: الأداة رجّعت «٠ قياس ·
         معتمة ✅». سقف على قايمة غير مرشّحة = فحص فاضي بيرجع
         أخضر — ونفس الغلطة اللي الملف ده كله موجود عشانها. */
      const allL = await page.$$(LAYERS)
      const boxed = []
      for (const L of allL) {
        const bx = await L.boundingBox().catch(() => null)
        /* الشاشة الكاملة مش طبقة عايمة · اللوح الواسع بيرسم خلفيته
           بنفسه جوّه، فإخفاء المحتوى بيفضّيه والقياس بيبقى بلا معنى */
        const vp = 1600 * 1000
        if (!bx || bx.width < 90 || bx.height < 40 || bx.width * bx.height >= vp * 0.8) continue
        /* ⚠️ **الابن جوّه طبقة مش طبقة.** `.fmenu-l` (القايمة
           الداخلية) ليها `role=listbox` فبتتمسك بالمحدّد، ومالهاش
           خلفية خاصة بيها — فإخفاء المحتوى بيشيل خلفية أبوها
           وبتطلع ٤٧٪ «تسريب» وهي سليمة تمامًا. التعتيم مسؤولية
           الطبقة الخارجية وحدها. */
        const inside = await L.evaluate((e, sel) => !!e.parentElement?.closest(sel), LAYERS)
        if (inside) continue
        boxed.push({ L, bx, ar: bx.width * bx.height })
      }
      boxed.sort((x, y) => y.ar - x.ar)
      for (const { L, bx: box } of boxed.slice(0, 3)) {
        const a = await shoot(page, box)
        await L.evaluate((e) => {
          const st = document.createElement('style'); st.id = 'ovhide'
          st.textContent = 'body *{visibility:hidden!important}'
          document.head.appendChild(st)
          e.style.setProperty('visibility', 'visible', 'important')
          for (const c of e.querySelectorAll('*')) c.style.setProperty('visibility', 'visible', 'important')
        })
        await page.waitForTimeout(120)
        const b = await shoot(page, box)
        await L.evaluate((e) => {
          document.getElementById('ovhide')?.remove()
          e.style.removeProperty('visibility')
          for (const c of e.querySelectorAll('*')) c.style.removeProperty('visibility')
        })
        const d = diff(a, b)
        if (d === null) continue
        checked++
        if (d > LIMIT) {
          const key = `${theme} · ${await L.evaluate((e) => e.tagName.toLowerCase() + '.' + String(e.className || '').split(' ').filter(Boolean).slice(0, 2).join('.'))}`
          const prev = bad.get(key)
          if (!prev || d > prev.d) bad.set(key, { d, route })
        }
      }
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForTimeout(150)
    }
  }
  await ctx.close()
}
await browser.close(); server.close()

console.log(`════ تعتيم الطبقات العايمة · ${checked} قياس ════`)
console.log(`الحدّ: متوسّط انحراف القناة أقل من ${LIMIT * 100}٪ لمّا المحتوى ورَاها يتشال\n`)
if (!bad.size) { console.log('  معتمة ✅'); process.exit(0) }
console.log(`═══ بتسرّب · ${bad.size} طبقة ═══`)
for (const [k, v] of [...bad.entries()].sort((a, b) => b[1].d - a[1].d))
  console.log(`  ${(v.d * 100).toFixed(1).padStart(5)}٪  ${k}   ${v.route}`)
process.exit(1)

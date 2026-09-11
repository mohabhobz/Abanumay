/**
 * جرد الواجهة وقت التشغيل، **بيقيس نفس الكمبوننت في كل مكان
 * ويقول فين اختلف**.
 *
 * الجرد الثابت (`uiaudit-css.mjs`) بيقول إن فيه ٨٥ مقاس خط في
 * الملف. لكنه ما بيقولش إن **زرار** في صفحة ارتفاعه ٣٢ وفي صفحة
 * تانية ٣٦، لأن الارتفاع بيتحسب من الحشو والخط والحدود مع بعض.
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
import { ROUTES } from './routes.mjs'

const ROOT = new URL('../dist/', import.meta.url).pathname
const PORT = 4455
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.woff2': 'font/woff2' }


/**
 * الأدوار، كل صف: اسم الدور، المُحدِّد، والخصائص اللي المفروض
 * تكون موحَّدة فيه. المُحدِّد بيتكتب مرة واحدة هنا، فلو اتغيّر
 * في الستايل بيتغيّر هنا كمان، الجرد جزء من النظام لا أداة برّه.
 */
const ROLES = [
  /* مقاسان للزرار قرار تصميم لا درِفت، بس كل مقاس لازم يكون
     قيمة واحدة. فالدور بينقسم بدل ما الأداة تعدّهم اختلافًا. */
  { key: 'زرار', sel: '.btn:not(.btn-sm)', props: ['height', 'borderRadius', 'fontSize', 'paddingBlock', 'paddingInline'] },
  { key: 'زرار صغير', sel: '.btn.btn-sm', props: ['height', 'borderRadius', 'fontSize', 'paddingBlock', 'paddingInline'] },
  { key: 'تاب', sel: '.tabs .tab', props: ['height', 'borderRadius', 'fontSize', 'paddingInline'] },
  { key: 'شريحة أدوات', sel: '.fchip', props: ['height', 'borderRadius', 'fontSize', 'paddingInline'] },
  { key: 'وسم', sel: '.tag', props: ['height', 'borderRadius', 'fontSize', 'paddingInline'] },
  { key: 'حقل اختيار', sel: '.fsel .fsel-b', props: ['height', 'borderRadius', 'fontSize'] },
  { key: 'بحث', sel: '.srch', props: ['height', 'borderRadius', 'fontSize'] },
  { key: 'خيار في قائمة', sel: '.fopt', props: ['borderRadius', 'fontSize', 'paddingBlock', 'paddingInline'] },
  { key: 'قائمة منسدلة', sel: '.fmenu', props: ['borderRadius', 'padding'] },
  { key: 'كارت زجاج', sel: '.glass', props: ['borderRadius'] },
  /* أعمدة التحديد ومنتقي الأعمدة عرضها ثابت ودورها مختلف، تستثنى. وارتفاع الخلية بيتحدّد بالمحتوى (سطر ولا سطرين)، فاللي
     يتقاس هو الحشو اللي الستايل بيتحكّم فيه فعلًا. */
  { key: 'ترويسة جدول', sel: '.tbl thead th:not(.tchk):not(.tcolx)', props: ['height', 'fontSize', 'paddingInline'] },
  { key: 'خلية جدول', sel: '.tbl tbody td:not(.tchk):not(.tcolx)', props: ['fontSize', 'paddingBlock', 'paddingInline'] },
  { key: 'عنوان صفحة', sel: '.ptitle', props: ['fontSize', 'fontWeight'] },
  { key: 'عنوان سكشن', sel: '.hd-t, .head h2, .head-t', props: ['fontSize', 'fontWeight'] },
  { key: 'نصّ مساعد', sel: '.sub', props: ['fontSize'] },
]

/**
 * السلالم المعلَنة في `docs/UI_STANDARDS.md`.
 * القيمة اللي برّه السلّم خطأ، لا استثناء.
 */
const SCALE = {
  radius: [0, 4, 12, 16, 24, 32, 999],
  /* **قيمة واحدة**. كان فيه تلاتة (٢٨ · ٣٤ · ٤٢)، والسلّم اللي
     فيه تلات درجات للشيء الواحد مش سلّم، هو إذن بالاختلاف.
     ٤٤ = الحدّ الأدنى للهدف اللمسي في WCAG 2.5.5، والتحكّم
     بيوصله **بجسمه** لا بحيلة «مقاس + مسافة». */
  control: [44],
  /* ٢٠ لا ١٨: سطر الوسم بقى ١٦ عشان ذيل الياء العربي يلاقي مكانه
     جوّه الكبسولة بدل ما يلزق في حافتها. ٢ + ١٦ + ٢. */
  label: [20],
  badge: [24],
  iconBox: [24, 30, 38, 44],
  space: [0, 2, 4, 6, 8, 12, 16, 22, 32, 48],
  font: [11.2, 12.16, 13.12, 14.4, 16.8, 24, 33.6], // rem→px عند 16px
}

/** صناديق الأيقونات، المفروض مربّعة دايمًا */
/**
 * صناديق الأيقونات · **حاوية مرسومة جوّاها علامة واحدة**.
 *
 * `.rpp-n` و`.catsum-s>b` كانوا في القايمة دي وهمّ **نصّ**: رقم
 * عنوان ورقم إحصائي، مالهمش خلفية ولا حدّ ولا ركن. الفحص كان
 * بيقيس عرضهم وطولهم ويقول «مش مربّع» · وطبعًا مش مربّع، هو
 * سطر. تلات صفوف حمرا كل مرة معناها إن اللي بيقرا الجرد بيتعلّم
 * يعدّي على الأحمر، وده أخطر من الخطأ نفسه.
 *
 * القاعدة: يدخل هنا اللي **مرسوم كصندوق** ومحتواه علامة، مش أي
 * عنصر فيه رقم.
 */
const ICON_BOX = '.catc-i,.rbc-i,.rpk-i,.badge,.lrfind>.badge,.htile-ic,.aclose,.vtog button,.aifold,.fopt-x'

/**
 * فحص الشبكة «المتساوية» · **بيتقاس على أكتر من عرض، والمحدّدات
 * بتتقرا من الملف لا من المتصفّح**.
 *
 * غلطتان في أول نسختين منه، والاتنين بيرجّعوا «نضيف» والبَق قدّامهم:
 *
 * ١) كان بيقيس على ١٦٠٠ بس. و`repeat(4,1fr)` عند ١٦٠٠ بتدّي خانات
 *    متساوية فعلًا · المساحة الحرّة أكبر من كل حدّ أدنى فالخوارزمية
 *    بتوزّع بالتساوي. المشكلة بتظهر عند ١٤٤٠ لمّا سطر طويل في خانة
 *    يبقى أعرض من نصيبها. يعني فحص **مرهون بالعرض**، وعرض واحد
 *    فيه معناه أخضر دايمًا.
 *
 * ٢) كان بيقرا `document.styleSheets[].cssRules` من جوّه الصفحة،
 *    والمتصفّح بيرمي `SecurityError` عليها · والـ`try/catch` كان
 *    بيبلعها في صمت، فالفحص بيلفّ على **صفر قاعدة** ويطلع أخضر.
 *    المحدّدات بقت بتتقرا من `src/styles/index.css` في نود
 *    مباشرةً: نفس المصدر اللي بنصلّح فيه، وما فيش أمان أصل بينهم.
 */
const GRID_WIDTHS = [1600, 1440, 1180]

/**
 * المحدّدات اللي الورقة بتقول عنها «خانات متساوية»، **ومعاها عدد
 * خاناتها**.
 *
 * العدد مش تفصيلة · هو اللي بيفرّق بين القاعدة اللي شغّالة دلوقتي
 * والقاعدة التانية لنفس المحدّد جوّه ميديا-كويري. `.dtop` مثلًا
 * عندها `1fr 1fr` في الموبايل و`1.45fr 1fr 1fr` على الديسكتوب.
 * من غير العدد، الفحص بيقرا القاعدة الأولى ويقيس الحالة التانية
 * ويقول «مش متساوية» · وهي مقصودة كده. الفحص بيشتغل بس لمّا عدد
 * الخانات المرسومة = عدد الخانات في القاعدة المتساوية.
 */
const EQ_GRID_SELECTORS = (() => {
  const css = fs.readFileSync(new URL('../src/styles/index.css', import.meta.url), 'utf8')
  const re = /([^{}@]+)\{[^{}]*grid-template-columns\s*:\s*(repeat\(\s*(\d+)\s*,\s*1fr\s*\)|1fr(?:\s+1fr)+)\s*[;}]/g
  const out = new Map()
  for (const m of css.matchAll(re)) {
    const sel = m[1].split('\n').pop().trim()
    if (!sel || sel.startsWith('@')) continue
    const n = m[3] ? Number(m[3]) : m[2].trim().split(/\s+/).length
    if (!out.has(sel)) out.set(sel, new Set())
    out.get(sel).add(n)
  }
  return [...out].map(([sel, ns]) => ({ sel, ns: [...ns] }))
})()

/** بيشتغل جوّه الصفحة · بياخد المحدّدات من برّه */
const gridProbe = (sels) => {
  const out = []
  for (const { sel, ns } of sels) {
    let list = []
    try { list = [...document.querySelectorAll(sel)] } catch { continue }
    for (const g of list) {
      const cs = getComputedStyle(g)
      if (cs.display !== 'grid' && cs.display !== 'inline-grid') continue
      /* القيمة المحسوبة بتيجي «175.969px 243.797px …» ·
         `Number('175.969px')` بيرجّع NaN، والفلتر كان بيرميهم كلهم
         فالمصفوفة بتطلع فاضية والفحص بيعدّي. `parseFloat` بياخد
         الرقم ويسيب الوحدة. */
      const tracks = cs.gridTemplateColumns.split(' ')
        .map((t) => parseFloat(t)).filter((n) => !Number.isNaN(n))
      if (tracks.length < 2) continue
      /* القاعدة المتساوية هي اللي شغّالة؟ لو العدد مختلف يبقى في
         قاعدة تانية لنفس المحدّد بتحكم دلوقتي · مش شغلنا. */
      if (!ns.includes(tracks.length)) continue
      const lo = Math.min(...tracks), hi = Math.max(...tracks)
      if (hi - lo <= 1) continue
      out.push({ cls: String(g.className).split(' ')[0] || g.tagName, sel,
        tracks: tracks.map((t) => Math.round(t)).join(' · ') })
    }
  }
  return out
}

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
const dots = new Map()
const edgeRings = new Map()
const edgePartial = new Map()
const rowsMix = []
const gridsMix = []
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
         شرط لازم: الابن **بيرسم فعلًا** عند الركن، خلفية أو ظلّ
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

      /* ══ الجيران في نفس الصفّ ══
         الفحص اللي فوق بيقارن كل دور **بنفسه** عبر الشاشات. وده
         بيدّي انحرافًا صفرًا وشريط الأدوات فيه بحث ٣٣ وحقل ٢٨
         وشريحة ٢٨ ومبدّل ٣٠ وزرار ٣٤، كل واحد ثابت مع نفسه
         ومختلف عن جاره. اللي المستخدم بيشوفه هو **الصفّ**، فلازم
         يتقاس كصفّ. */
      out.rows = []
      const CTRL = '.btn,.fchip,.tab,.srch,.fsel .fsel-b,.vtog'
      for (const row of document.querySelectorAll('.ftool-r,.ftool-f,.ftool-a,.tabs,.head-a,.hd-a')) {
        const kids = [...row.querySelectorAll(CTRL)].filter((e) => e.offsetParent !== null)
        if (kids.length < 2) continue
        const seen = new Map()
        for (const e of kids) {
          const h = Math.round(e.getBoundingClientRect().height)
          if (!seen.has(h)) seen.set(h, String(e.className).split(' ')[0] || e.tagName)
        }
        if (seen.size > 1) {
          out.rows.push({ row: String(row.className).split(' ')[0],
            vals: [...seen.entries()].map(([h, c]) => `${c}:${h}`).join(' · ') })
        }
      }

      /* أكتر من دعوة أساسية في الشاشة */
      out.primary = document.querySelectorAll('.btn-p').length

      /* ══ العلامات الدائرية ══
         الفحص اللي كان هنا كان بيدوّر على `.vsteps,.steps,.agr-steps`، **تلات أسماء مش موجودة في الـCSS أصلًا**. فكان بيلفّ على
         صفر عنصر ويطلع أخضر كل مرة، وإحنا فاكرين إن الاستِبر
         متفحوصة. الانحراف الحقيقي (نقطة ١٦ في الاتفاقية و١٥ في
         الدفعات و١٠ في اتنين ميّتين) عدّى من تحته ٢٣ صفحة × ٣ ثيمات.

         الفحص ده بيقيس اللي المستخدم بيشوفه: كل دايرة صغيرة مرسومة
         كعلامة، قطرها ومين رسمها. مش بيحكم، بيجرد. والجرد هو اللي
         بيخلّي «١٦ و١٥» تبان في سطر واحد. */
      out.dots = []
      for (const e of document.querySelectorAll('span,i,b,em,div')) {
        const bx = e.getBoundingClientRect()
        if (!bx.width || bx.width > 24 || Math.abs(bx.width - bx.height) > 0.6) continue
        if (e.offsetParent === null) continue
        const cs = getComputedStyle(e)
        /* دايرة فعلًا: نصف القطر ≥ نصف العرض */
        if ((parseFloat(cs.borderTopLeftRadius) || 0) < bx.width / 2 - 0.6) continue
        /* لازم تكون **مرسومة**: لون أو إطار. الفاضية مش علامة. */
        const painted = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.boxShadow !== 'none'
        if (!painted || cs.backgroundImage !== 'none') continue
        const cls = String(e.className?.baseVal ?? e.className ?? '').split(' ')[0]
        if (!cls) continue
        out.dots.push(`${cls}:${Math.round(bx.width)}`)
      }
      out.dots = [...new Set(out.dots)]

      /* ══ الحافة ══
         ملاحظة العميل: «اليمين واضح وتحت مش ظاهر». السبب مكانش
         حافة ناقصة، كان إن **الحافة الشعرية الواحدة مكتوبة
         بأربعتاشر قوّة** في الستايل، فكارتان جنب بعض ليهم حافتان
         مختلفتان فعلًا، وعلى خلفية متدرّجة واحدة بتبان والتانية
         بتختفي.

         الفحص ده بيمسك التنين:
           أ · **صندوق حافته على بعض الجهات بس**، خلفية وركن
               ومعاه `inset` من جهة واحدة بلا حلقة كاملة
           ب · **جرد قوّات الحافة**، المفروض خمس درجات لا أكتر */
      out.edges = { partial: [], rings: [] }
      for (const e of document.querySelectorAll('*')) {
        if (e.offsetParent === null) continue
        const cs = getComputedStyle(e)
        const sh = cs.boxShadow
        if (!sh || sh === 'none' || !sh.includes('inset')) continue
        /* خلية الجدول مستثناة: ركنها المدوّر جايّ من بلاطة الجدول
           (`--slab`) لا من كونها صندوقًا، وخطّها العلوي **فاصل صفوف**.
           الخلية مش صندوق قائم بذاته. */
        if (e.tagName === 'TD' || e.tagName === 'TH') continue
        const b = e.getBoundingClientRect()
        if (b.width < 24 || b.height < 16) continue

        /* الظلال بتتفصل بفاصلة برّه الأقواس */
        const parts = []
        let depth = 0, cur = ''
        for (const ch of sh) {
          if (ch === '(') depth++
          if (ch === ')') depth--
          if (ch === ',' && depth === 0) { parts.push(cur); cur = '' } else cur += ch
        }
        parts.push(cur)

        let ring = null, sided = 0
        for (const raw of parts) {
          const t = raw.trim()
          if (!t.includes('inset')) continue
          const nums = t.replace(/rgba?\([^)]*\)/g, '').match(/-?\d*\.?\d+px/g) ?? []
          const [x, y, blur, spread] = nums.map((v) => parseFloat(v))
          const col = (t.match(/rgba?\([^)]*\)/) ?? [''])[0]
          if (x === 0 && y === 0 && (blur ?? 0) === 0 && (spread ?? 0) > 0) ring = col
          else if ((blur ?? 0) === 0 && (x !== 0 || y !== 0)) sided += 1
        }
        const painted = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none'
        const rounded = (parseFloat(cs.borderTopLeftRadius) || 0) >= 8
        if (ring) out.edges.rings.push(ring)
        /* صندوق = مرسوم ومدوّر. الفاصل بين إخوة مش صندوق. */
        else if (sided && painted && rounded) {
          out.edges.partial.push(`${String(e.className).split(' ')[0] || e.tagName}  ${Math.round(b.width)}×${Math.round(b.height)}`)
        }
      }
      out.edges.rings = [...new Set(out.edges.rings)]
      out.edges.partial = [...new Set(out.edges.partial)]

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
           اللي يهمّنا هو القصّ الرأسي الحقيقي، إما `hidden` صريح
           أو محتوى بيفيض فوق الارتفاع. */
        const clipsY = cs.overflowY === 'hidden' || e.scrollHeight > e.clientHeight + 1
        if (first && pt < 4 && clipsY) {
          out.clipped.push({ cls: String(e.className).split(' ')[0], paddingTop: pt })
        }
      }
      /* ألوان الدعوة للفعل، نفس الدور بألوان مختلفة */
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
    for (const w of GRID_WIDTHS) {
      await page.setViewportSize({ width: w, height: 1000 })
      await page.waitForTimeout(160)
      for (const g of await page.evaluate(gridProbe, EQ_GRID_SELECTORS)) gridsMix.push({ ...g, route, theme, w })
    }
    await page.setViewportSize({ width: 1600, height: 1000 })
    for (const x of found.cta) cta.push({ ...x, route, theme })
    for (const x of found.tabs) tabs.push({ ...x, route, theme })
    if (found.drop.native || found.drop.custom) drop.push({ ...found.drop, route, theme })
    if (found.primary > 1) primary.push({ route, theme, n: found.primary })
    for (const r of found.edges?.rings ?? []) if (!edgeRings.has(r)) edgeRings.set(r, `${route}·${theme}`)
    for (const x of found.edges?.partial ?? []) if (!edgePartial.has(x)) edgePartial.set(x, route)
    for (const d of found.dots ?? []) {
      const [cls, px] = d.split(':')
      if (!dots.has(cls)) dots.set(cls, new Map())
      if (!dots.get(cls).has(px)) dots.get(cls).set(px, route)
    }
    nums.total += found.nums.total; nums.noTabular += found.nums.noTabular
    for (const n of found.nested) nested.push({ ...n, route, theme })
    for (const c of found.clipped) clipped.push({ ...c, route, theme })
    for (const r of found.rows ?? []) rowsMix.push({ ...r, route, theme })
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
  for (const r of ['زرار', 'زرار صغير', 'تاب', 'شريحة أدوات', 'شريحة حالة', 'بحث']) check(r, 'height', SCALE.control, 'الارتفاع')
  /* الوسم تسمية غير تفاعلية، سلّمه لوحده، مالوش دعوة بالهدف اللمسي */
  check('وسم', 'height', SCALE.label, 'الارتفاع')
  check('حقل اختيار', 'height', SCALE.control, 'الارتفاع')
  for (const r of Object.keys(bag)) check(r, 'borderRadius', SCALE.radius, 'نصف القطر')
}

console.log(`\n═══ ارتفاعات مختلفة في نفس الصفّ ═══`)
{
  const u = uniq(rowsMix, (x) => `${x.row}|${x.vals}`)
  if (!u.length) console.log('  نضيف.')
  for (const x of u) { drift += 1; console.log(`  .${x.row.padEnd(10)} ${x.vals}   ← ${x.route}`) }
}

console.log(`\n═══ شبكة «متساوية» وخاناتها مش متساوية ═══`)
{
  const u = uniq(gridsMix, (x) => `${x.sel}|${x.w}`)
  if (!u.length) console.log('  نضيف.')
  for (const g of u.slice(0, 20)) {
    console.log(`  ${String(g.cls).padEnd(14)} ${g.sel}`)
    console.log(`  ${''.padEnd(14)} ${g.tracks}   @${g.w}   ${g.route}·${g.theme}`)
  }
}

console.log(`\n═══ أكتر من دعوة أساسية في الشاشة ═══`)
if (!primary.length) console.log('  نضيف.')
for (const x of uniq(primary, (v) => v.route)) { drift += 1; console.log(`  ${x.route}  ${x.n} × .btn-p`) }

console.log(`\n═══ العلامات الدائرية، كل نقطة وقطرها ═══`)
{
  const rows = [...dots.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  if (!rows.length) console.log('  مفيش.')
  for (const [cls, sizes] of rows) {
    const many = sizes.size > 1
    /* نفس الاسم بقطرين = انحراف مؤكّد. أسماء مختلفة بأقطار مختلفة
       جرد بس، العلامة ممكن تبقى معاني مختلفة فعلًا. */
    if (many) drift += 1
    const v = [...sizes.entries()].map(([px, r]) => `${px}px (${r})`).join('  ·  ')
    console.log(`  ${many ? '🔴' : '  '} ${cls.padEnd(12)} ${v}`)
  }
}

console.log(`\n═══ الحافة: صندوق مرسوم من بعض جهاته ═══`)
{
  if (!edgePartial.size) console.log('  نضيف، كل صندوق حلقته كاملة.')
  for (const [x, r] of [...edgePartial].slice(0, 14)) { drift += 1; console.log(`  🔴 ${x}   ${r}`) }
}

console.log(`\n═══ الحافة: كام قوّة مختلفة للحلقة ═══`)
{
  /* الحياد بس. الحافة الملوّنة (حالة) محور تاني. */
  const neutral = [...edgeRings].filter(([c]) => {
    const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (!m) return false
    const [r, g, b] = [+m[1], +m[2], +m[3]]
    return Math.abs(r - g) < 60 && Math.abs(g - b) < 60
  })
  console.log(`  محايدة: ${neutral.length} · ملوّنة (حالة): ${edgeRings.size - neutral.length}`)
  for (const [c, w] of neutral.slice(0, 12)) console.log(`     ${c.padEnd(30)} ${w}`)
  /* السلّم خمس درجات × تلات ثيمات، كل ثيم بيحسب ألفا تانية */
  if (neutral.length > 5 * themes.length) drift += 1
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

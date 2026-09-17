/**
 * جرد الحقول اللي المفروض تبقى لينك · ك-2
 *
 * مظفر طلب **جرد** لا تصليح نقطة: «كل الحقول اللي المفروض تبقى
 * لينك في كل الشاشات». والجرد بالعين على ٧٥ مسار × ٣ ثيمات مستحيل،
 * وبالقراءة في الكود كذّاب · الحقل بيتولد من كمبوننت، والاسم
 * بيتحطّ في `KV` أو في خلية جدول أو في وسم، فالبحث النصّي بيلاقي
 * ربعهم.
 *
 * فالأداة **بتسوق الشاشة** زي باقي الجرد، وبتدوّر على تلات أشكال:
 *
 *   ١ · **معرّف مكتوب نصًّا** · `prj-2026-20852` أو `SR-2026-11407`
 *       أو `AG-2026-3101` … المعرّف اللي بيتعرض ودايمًا له صفحة،
 *       فلو مش جوّه رابط يبقى المستخدم بيقراه وبينسخه بإيده.
 *
 *   ٢ · **صفّ علاقة في `KV` بلا رابط** · المفتاح اسم كيان تاني
 *       («الجهة» · «المشروع» · «الاتفاقية» · «المالك» …) والقيمة
 *       نصّ ساكت · وده بالظبط اللي ك-1 كانت عليه.
 *
 *   ٣ · **رابط كذّاب** · `<a>` بلا `href`. شكله رابط وسلوكه زرار:
 *       ما بيتفتحش في تاب جديد، ولا بيتنسخ، ولا بيوصله الكيبورد.
 *
 * ⚠️ **والنتيجة قايمة للمراجعة لا قايمة أخطاء.** فيه حقول بتتعرض
 * نصًّا **عن قصد**: المعرّف في ترويسة الصفحة اللي إنت فيها أصلًا
 * (رابط لنفسك)، والاسم جوّه جملة سردية في السجل. فالأداة بتقول
 * «شوف دول»، وبتستنى استثناءات مكتوبة في `ALLOW`.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { ROUTES, PUBLIC_ROUTES } from './routes.mjs'

const ROOT = new URL('../dist/', import.meta.url).pathname
const PORT = 4461
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.mp4': 'video/mp4' }

const srv = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname))
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, 'index.html')
  r.setHeader('Content-Type', MIME[path.extname(f)] ?? 'application/octet-stream')
  fs.createReadStream(f).pipe(r)
})
await new Promise((r) => srv.listen(PORT, r))

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
await ctx.addInitScript(([pub]) => {
  if (pub.includes(location.pathname + location.search)) sessionStorage.removeItem('ab-session')
  else sessionStorage.setItem('ab-session', 'check')
  localStorage.setItem('ab-theme', 'light')
}, [PUBLIC_ROUTES])
const page = await ctx.newPage()

const found = []

for (const route of ROUTES) {
  await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(120)

  const hits = await page.evaluate(() => {
    /* المعرّفات اللي كل واحد فيها له صفحة في الراوتر */
    const ID = /\b(?:prj-\d{4}-\d{4,6}|SR-\d{4}-\d{4,6}|AG-\d{4}-\d{3,6}|RG-\d{3,6}|BG-\d{4}-[A-Z]{2}|PF-\d{4}-\d{3})\b/
    /* مفاتيح `KV` اللي بتسمّي **كيانًا تاني** له صفحة */
    const REL = ['الجهة', 'الجهة المستفيدة', 'المشروع', 'الاتفاقية', 'الطلب',
      'الميزانية', 'المحفظة', 'المالك', 'مشرف المنح', 'الحساب البنكي', 'الحساب المعتمد']

    const out = []
    const inLink = (el) => Boolean(el.closest('a[href]'))
    /* ⚠️ **المخفيّ مش بلاغ.** ورقة الطباعة (`.fppage`) موجودة في
       الـDOM طول الوقت وفيها نسخة تانية من كل صفّ بمعرّفه · فالجرد
       كان بيبلّغ عن الورقة اللي محدش بيشوفها على الشاشة، ويطلع
       رقمًا مضاعفًا لمشكلة نصّها مش موجودة. والورقة بتتطبع على ورق،
       والورق مالوش روابط أصلًا. */
    const seen = (el) => Boolean(el.getClientRects().length)
    const near = (el) => {
      const t = (el.textContent || '').trim()
      return t.length > 60 ? `${t.slice(0, 60)}…` : t
    }

    /* ١ · معرّف نصّي **والسجلّ مالوش رابط في صفّه**.
       ⚠️ النسخة الأولى كانت بتبلّغ عن كل معرّف مش جوّه `<a>` ·
       ٢٢٩ بلاغًا، وتسعة أعشارهم كدب: في قايمة المشاريع الكود
       `<Mono>` ساكت **وجنبه عمود الاسم وهو رابط حقيقي لنفس
       المشروع**. رابط تاني لنفس المكان في نفس الصفّ ما بيزوّدش
       حاجة، بيزوّد هدفين لنفس الوجهة.
       فالسؤال الصح مش «المعرّف رابط؟» هو **«السجلّ ده يتوصّل
       من صفّه؟»**. */
    for (const el of document.querySelectorAll('td,dd,span,b,p,div')) {
      if (el.children.length > 0) continue
      const t = (el.textContent || '').trim()
      if (!t || !ID.test(t) || inLink(el) || !seen(el)) continue
      /* ⚠️ **المعرّف جوّه كارت مستند هو رقم الملف لا وجهة.**
         «الاتفاقية.pdf · AG-2026-3107» بيقول **إيه الورقة دي**،
         زي رقم مكتوب على ورقة مطبوعة · ورابط عليه كان هيودّي
         لصفحة الاتفاقية من جوّه كارت بيعاين ملفها، يعني هدفان
         مختلفان في عنصر واحد. */
      if (el.closest('.dfile')) continue
      const row = el.closest('tr,li,.pcard,.ecard,.acard,.qread,.glass')
      if (row && row.querySelector('a[href]')) continue
      out.push({ kind: 'معرّف نصّي بلا مدخل في صفّه', say: t })
    }

    /* ٢ · صفّ علاقة في `KV` بلا رابط */
    for (const dt of document.querySelectorAll('dl.kv > div > dt, dl.kv dt')) {
      const k = (dt.textContent || '').trim()
      if (!REL.includes(k) || !seen(dt)) continue
      /* ⚠️ **`nextElementSibling` لا `parentElement.querySelector`.**
         `KV` بتلفّ كل زوج في `div`، لكن فيه `dl.kv` مكتوبة بإيدها
         بأزواج مسطّحة · وساعتها `querySelector('dd')` بترجّع **أول
         `dd` في القايمة كلها** لا الـ`dd` بتاعة المفتاح ده. وده كان
         بيطلّع بلاغًا بيقول «الجهة المستفيدة: اسم المشروع» ·
         بلاغ عن حاجة مش موجودة، وأسوأ من السكوت. */
      const dd = dt.nextElementSibling?.tagName === 'DD'
        ? dt.nextElementSibling
        : dt.parentElement?.querySelector(':scope > dd')
      if (!dd) continue
      if (dd.querySelector('a[href]')) continue
      const v = near(dd)
      /* القيمة الفاضية أو «مفيش» مش علاقة ناقصة، هي غياب معلن */
      if (!v || /^(مفيش|بلا|-)/.test(v)) continue
      out.push({ kind: 'علاقة بلا رابط', say: `${k}: ${v}` })
    }

    /* ٣ · رابط كذّاب */
    for (const a of document.querySelectorAll('a:not([href])')) {
      if (!seen(a)) continue
      out.push({ kind: 'رابط بلا href', say: near(a) })
    }
    return out
  }).catch(() => [])

  for (const h of hits) found.push({ route, ...h })
}

await browser.close()
srv.close()

/* ⚠️ الاستثناءات **مكتوبة بسببها**، مش بالسكوت عنها: الأداة اللي
   بتستني بلا سبب بتبقى قايمة سوداء تكبر مع الوقت ومحدش فاهم ليه. */
const ALLOW = [
  /* ⚠️ **المعرّف في صفحته هو.** رابط بيودّي لنفس الشاشة اللي إنت
     فيها = وعد كاذب: المستخدم بيدوس وما بيحصلش حاجة فيفتكر إن
     الشاشة علّقت. والمطابقة بالمعرّف كامل داخل المسار، لا بقصّة
     من المعرّف. */
  {
    kind: 'معرّف نصّي بلا مدخل في صفّه',
    when: (f) => {
      const id = (f.say.match(/[A-Za-z]{2,3}-[\dA-Z-]+/) ?? [''])[0]
      return Boolean(id) && f.route.includes(id)
    },
  },
  /* ⚠️ **شاشة «اتبعت» عامّة.** الجهة اللي لسه مالهاش حساب بتشوف
     رقم طلبها، وصفحة الطلب **جوّه النظام** · فالرابط كان هيودّيها
     لشاشة دخول. الرقم هنا مرجع تتصل بيه، لا وجهة. */
  { kind: 'معرّف نصّي بلا مدخل في صفّه', when: (f) => f.route.includes('step=sent') },
]

const kept = found.filter((f) => !ALLOW.some((a) => a.kind === f.kind && a.when(f)))

const byKind = new Map()
for (const f of kept) byKind.set(f.kind, [...(byKind.get(f.kind) ?? []), f])

console.log(`\n════ جرد اللينكات · ${ROUTES.length} مسار ════\n`)
if (kept.length === 0) {
  console.log('✅ مفيش حقل علاقة أو معرّف معروض بلا رابط\n')
} else {
  for (const [kind, list] of byKind) {
    console.log(`── ${kind} · ${list.length} ──`)
    const seen = new Set()
    for (const f of list) {
      const key = `${f.route}|${f.say}`
      if (seen.has(key)) continue
      seen.add(key)
      console.log(`   ${f.route}\n     ${f.say}`)
    }
    console.log('')
  }
  console.log(`المجموع: ${kept.length} · دي قايمة **للمراجعة** لا قايمة أخطاء.\n`)
}

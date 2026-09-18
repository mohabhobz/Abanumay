/**
 * زيارة واحدة للصفحة · كل الفحوص عليها.
 *
 * ═══ المشكلة اللي الملف ده بيحلّها ═══
 *
 * القياس قبل ما يتكتب: `uicheck` لوحده **١م٥٠ث** لـ٧٩ مسار في ثيم
 * واحد. و`user time` فيها **٥٫٦ث** بس · يعني ٩٥٪ من الوقت
 * **استنّى**، لا حساب. والسبب سطران:
 *
 *   await page.goto(...)
 *   await page.waitForTimeout(1100)      // و2500 في `contrast`
 *
 * وفي ٢١ أداة بتفتح متصفّحًا، كل واحدة:
 *   · بتشغّل سيرفر خاص بيها
 *   · بتفتح كروميوم خاص بيها
 *   · **وبتلفّ على نفس الـ٧٩ مسار × ٣ ثيمات بصفحة واحدة تسلسليًا**
 *
 * يعني الجولة الكاملة (`contrast` + `uicheck` + `linkaudit`)
 * بتزور نفس الـ٢٣٧ صفحة **تلات مرات**، وبتدفع تمن الانتظار تلات
 * مرات · قرابة نصّ ساعة.
 *
 * ═══ التلات تغييرات ═══
 *
 * ١ · **زيارة واحدة، كل الفحوص عليها.** الفحص بقى «بروب» بيشتغل
 *     على صفحة محمَّلة، مش برنامجًا بيمشي على المسارات بنفسه.
 *     فتمن التحميل بيتدفع **مرة**.
 *
 * ٢ · **مسارات متوازية.** طابور شغل و`lanes` صفحات بتسحب منه ·
 *     الانتظار بيتراكب مع الانتظار، والسكرين شوت بيتفكّ في نود
 *     وقت ما اللاين التاني مستنّي.
 *
 * ⚠️ **٣ · الاستنّى بقى إشارة لا رقم.** `waitForTimeout(2500)` رقم
 *     مخترَع: كبير أوي على صفحة بسيطة فبيضيّع وقتًا، وصغير أوي
 *     على صفحة تقيلة فبيقيس وهي لسه بترسم. البديل إشارة حقيقية:
 *     **الخطوط جاهزة** (`document.fonts.ready`) و**إطاران
 *     متتاليان** اترسموا. الخطوط تحديدًا هي اللي كان الرقم مستنّيها
 *     · الصفحة اللي بتتقاس قبل ما الخطّ يحمّل بتدّي مقاسات غلط.
 *
 * ═══ والنتيجة اتّاكدت لا اتفترضت ═══
 * `npm run sweep:verify` بيشغّل الطريقين على نفس البِناء وبيقارن
 * العدد · لأن سرعة بتغيّر النتيجة مش سرعة، دي أداة تانية.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { ROUTES as ALL_ROUTES, PUBLIC_ROUTES } from '../routes.mjs'

const DIST = new URL('../../dist/', import.meta.url).pathname
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.mp4': 'video/mp4',
}

export const THEMES = ['light', 'dark', 'green']

/** سيرفر ستاتيك على بورت حرّ · الأداة ما بتحجزش رقمًا ثابتًا */
async function serve() {
  const srv = http.createServer((q, r) => {
    let f = path.join(DIST, decodeURIComponent(new URL(q.url, 'http://x').pathname))
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html')
    r.setHeader('Content-Type', MIME[path.extname(f)] ?? 'application/octet-stream')
    fs.createReadStream(f).pipe(r)
  })
  await new Promise((r) => srv.listen(0, r))
  return { srv, port: srv.address().port }
}

/**
 * الصفحة استقرّت؟
 *
 * ⚠️ **الحكاية دي اتقاست تلات مرات قبل ما تستقرّ، وكل مرة كشفت
 * حاجة.**
 *
 * **المحاولة ١ · خطوط + إطارين.** شغّلت فاحص التباين مرتين على
 * **نفس البِناء** فطلع «١ ملاحظة» و«٧ ملاحظات» · أداة بترجّع
 * إجابتين لنفس السؤال، ودي أسوأ من غيابها لأن اللي بعدها بيتعلّم
 * يتجاهلها.
 *
 * **المحاولة ٢ · نستنّى الحركات تخلص + نصوّر لحد ما الصورة تثبت.**
 * بقت أبطأ من القديم. والقياس قال ليه:
 *
 *     /projects   anims: 5   كلها infinite   shots-to-stable: 13
 *     /           anims: 6   كلها infinite   shots-to-stable: 13
 *
 * رصيف «اسأل أبانمي» فيه أربع حركات **لا نهائية** (`aipulse` ·
 * `aisheen` · `aiglow` · `aicaret`) شغّالة في كل صفحة تقريبًا ·
 * فالحركات ما بتخلصش أبدًا، والصورة ما بتثبتش أبدًا.
 *
 * ⚠️ **والأهمّ إن ده كان بيفسد القياس القديم كمان.** التوهّج
 * النابض بيغيّر بكسلات الخلفية كل إطار، والـ٢٥٠٠ مللي ما كانتش
 * بتثبّته · كانت بتقع على طور عشوائي منه. يعني نتيجة «٤٫٣٥ تحت
 * الحدّ» ممكن تكون طور، لا لونًا.
 *
 * **المحاولة ٣ · نجمّد بدل ما نستنّى.** الحركة المنتهية بتتودّى
 * لآخرها (ده اللي المستخدم بيشوفه مستقرًّا)، واللانهائية بتتوقّف
 * عند طور ثابت · فالصفحة بتبقى **نفس البكسلات في كل تشغيلة**،
 * وأسرع كمان لأن مفيش استنّى أصلًا.
 */
const settle = (page, ms) =>
  page.evaluate(
    (extra) =>
      new Promise((done) => {
        const freeze = () => {
          if (document.getAnimations) {
            for (const a of document.getAnimations()) {
              try {
                const t = a.effect && a.effect.getTiming()
                /* المنتهية لآخرها · واللانهائية عند الصفر */
                if (t && t.iterations === Infinity) { a.pause(); a.currentTime = 0 }
                else a.finish()
              } catch { /* حركة مش قابلة للتحكّم · تُترك */ }
            }
          }
          requestAnimationFrame(() =>
            requestAnimationFrame(() => (extra ? setTimeout(done, extra) : done())))
        }
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(freeze)
        else freeze()
      }),
    ms,
  )

/**
 * صورة مستقرّة · حارس تاني على نفس المرض.
 *
 * `settle` بيقول «جمّدت»، والمقارنة بتقول **هل فعلًا ثبتت**.
 * بعد التجميد الصفحة بتعدّي من أول مقارنة، فالتمن بقى صورة زيادة
 * واحدة لا تلاتاشر.
 */
async function steadyShot(page, tries = 2) {
  let a = await page.screenshot()
  for (let i = 0; i < tries; i++) {
    const b = await page.screenshot()
    if (a.equals(b)) return b
    a = b
  }
  return a
}

/** فلتر المسارات من سطر الأوامر · `--routes a,b` بيقارن بالاحتواء */
export function pickRoutes(argv = process.argv) {
  const at = argv.indexOf('--routes')
  if (at < 0) return ALL_ROUTES
  const want = (argv[at + 1] ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  if (!want.length) return ALL_ROUTES
  const hit = ALL_ROUTES.filter((r) => want.some((w) => r.includes(w)))
  return hit.length ? hit : ALL_ROUTES
}

export function pickThemes(argv = process.argv) {
  return argv.includes('--themes') || argv.includes('--all') ? THEMES : ['light']
}

const num = (argv, flag, dflt) => {
  const at = argv.indexOf(flag)
  return at >= 0 ? Number(argv[at + 1]) || dflt : dflt
}

/**
 * يمرّ على (ثيم × مسار) بالتوازي، وينادي كل بروب على كل صفحة.
 *
 * البروب: `{ name, shot?, run(page, ctx) -> findings[] }`
 * و`ctx` فيه `{ route, theme, shot }` · و`shot` بايت السكرين شوت
 * لو **بروب واحد على الأقل** طلبها، وإلا `null` ومفيش تصوير أصلًا.
 */
export async function sweep({ probes, routes, themes, lanes, view, settleMs = 0, onVisit }) {
  const rs = routes ?? pickRoutes()
  const ts = themes ?? pickThemes()
  const n = lanes ?? num(process.argv, '--lanes', 6)
  const wantShot = probes.some((p) => p.shot)
  /* ⚠️ **المنظر واحد ومعلَن.** الأدوات القديمة كانت بتقيس بعرضين
     مختلفين من غير ما حد ياخد باله: `contrast` بـ1440 و`uicheck`
     بـ1600 · فحاجة بتتقصّ عند 1440 كانت بتعدّي، لأن اللي بيفحص
     القصّ كان بيبصّ من شاشة أوسع. الرقم الأضيق هو الأمانة. */
  const vp = view ?? {
    width: num(process.argv, '--w', 1440),
    height: num(process.argv, '--h', 900),
  }

  const { srv, port } = await serve()
  const browser = await chromium.launch({
    executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  })

  /** النتايج مجمَّعة باسم البروب */
  const out = new Map(probes.map((p) => [p.name, []]))
  let visits = 0

  for (const theme of ts) {
    /* ⚠️ السياق **بيحمل الثيم**، فلازم سياق لكل ثيم · والجلسة
       بتتحقن هنا لأن `/entities/register` و`/entities/portal` ليهم
       غلاف عام لجهة مالهاش حساب، وبجلسة محقونة الغلاف ده ما
       بيترسمش ولا مرة (شوف `PUBLIC_ROUTES`). */
    const mk = async () => {
      const c = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 })
      await c.addInitScript(([t, pub]) => {
        if (pub.includes(location.pathname + location.search)) sessionStorage.removeItem('ab-session')
        else sessionStorage.setItem('ab-session', 'omar')
        localStorage.setItem('ab-theme', t)
      }, [theme, PUBLIC_ROUTES])
      return { c, p: await c.newPage() }
    }

    const pool = await Promise.all(Array.from({ length: Math.min(n, rs.length) }, mk))
    let next = 0

    await Promise.all(pool.map(async ({ p }) => {
      for (;;) {
        const i = next++
        if (i >= rs.length) return
        const route = rs[i]

        const errs = []
        const onErr = (e) => errs.push(String(e))
        p.on('pageerror', onErr)
        try {
          await p.goto(`http://localhost:${port}${route}`, { waitUntil: 'domcontentloaded' })
          await settle(p, settleMs)
        } catch {
          p.off('pageerror', onErr)
          continue
        }

        const shot = wantShot ? await steadyShot(p) : null
        const ctx = { route, theme, shot, errs }
        for (const probe of probes) {
          const found = await probe.run(p, ctx).catch(() => [])
          if (found?.length) out.get(probe.name).push(...found.map((f) => ({ route, theme, ...f })))
        }
        p.off('pageerror', onErr)
        visits += 1
        onVisit?.(visits, ts.length * rs.length)
      }
    }))

    await Promise.all(pool.map(({ c }) => c.close()))
  }

  await browser.close()
  srv.close()
  return { findings: out, visits, routes: rs, themes: ts }
}

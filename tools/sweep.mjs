/**
 * الفحص البصري كله · زيارة واحدة لكل صفحة.
 *
 *   npm run sweep                      # ثيم فاتح · سريع
 *   npm run sweep -- --themes          # التلاتة · قبل الكوميت
 *   npm run sweep -- --routes /budget  # المسارات المتأثّرة وحدها
 *   npm run sweep -- --lanes 8         # مسارات متوازية أكتر
 *
 * ⚠️ **بيحلّ محلّ تلات تشغيلات كانت بتزور نفس الصفحات.**
 * `contrast` و`uicheck` و`linkaudit` كانوا بيفتحوا تلات متصفّحات
 * وبيلفّوا على نفس الـ٧٩ مسار × ٣ ثيمات، وكل واحد بيدفع تمن
 * التحميل والانتظار من أوله. الأدوات القديمة لسه موجودة للتشخيص
 * على صفحة واحدة، لكن **الجولة الكاملة مكانها هنا**.
 */
import { sweep, pickRoutes, pickThemes } from './lib/sweep.mjs'
import { contrastProbe, uiProbe, linkProbe } from './probes.mjs'

const t0 = Date.now()

/** `--only` بيشغّل بروبًا واحدًا · للتشخيص السريع */
const only = (() => {
  const at = process.argv.indexOf('--only')
  return at >= 0 ? (process.argv[at + 1] ?? '') : ''
})()

const ALL = [contrastProbe, uiProbe, linkProbe]
const probes = only ? ALL.filter((p) => p.name === only) : ALL

const routes = pickRoutes()
const themes = pickThemes()

process.stdout.write(`\n════ الفحص البصري · ${themes.length}×${routes.length} صفحة ════\n`)

const { findings, visits } = await sweep({ probes, routes, themes })

let total = 0
for (const p of probes) {
  const list = findings.get(p.name) ?? []
  total += list.length
  const head = { contrast: 'التباين', ui: 'سلامة الشاشة', links: 'اللينكات' }[p.name] ?? p.name
  if (list.length === 0) {
    console.log(`✅ ${head} · مفيش ملاحظات`)
    continue
  }
  console.log(`\n🔴 ${head} · ${list.length} ملاحظة`)
  /* ⚠️ مجمَّعة بالمسار: نفس الملاحظة بتتكرّر في التلات ثيمات،
     وطباعتها تلاتة بتخلّي القايمة تبان أكبر تلات مرات من حجمها */
  const by = new Map()
  for (const f of list) {
    const k = `${f.route}|${f.say}`
    if (!by.has(k)) by.set(k, { ...f, themes: [] })
    by.get(k).themes.push(f.theme)
  }
  for (const f of [...by.values()].slice(0, 40)) {
    console.log(`   ${f.route}  [${f.themes.join(',')}]`)
    console.log(`     ${f.say}`)
  }
  if (by.size > 40) console.log(`   … و${by.size - 40} كمان`)
}

const secs = ((Date.now() - t0) / 1000).toFixed(1)
console.log(`\n════ ${total === 0 ? '✅ نضيف' : `🔴 ${total} ملاحظة`} · ${visits} زيارة في ${secs}ث ════\n`)
process.exit(total === 0 ? 0 : 1)

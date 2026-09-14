/**
 * ينقل المسافات من الستايل السطري في الـJSX للكلاسات والتوكنز.
 *
 *   ١ · `marginTop`/`marginBottom`/`gap` لوحدهم في الستايل
 *       → بيتشالوا ويتحطّ الكلاس المعدِّل في `className`
 *   ٢ · أي قيمة مسافة حرفية باقية (ستايل مخلوط أو حشو مركّب)
 *       → بتتبدّل بـ`var(--sp-N)` · مربوطة بالسلّم حتى لو فضلت سطرية
 *
 *   node tools/spacejsx.mjs --dry
 */
import fs from 'node:fs'
import path from 'node:path'

const DRY = process.argv.includes('--dry')
const SCALE = [[2,'--sp-1'],[4,'--sp-2'],[8,'--sp-3'],[12,'--sp-4'],[16,'--sp-5'],[20,'--sp-6'],
               [24,'--sp-7'],[32,'--sp-8'],[40,'--sp-9'],[48,'--sp-10'],[64,'--sp-11'],[80,'--sp-12']]
/** درجات المعدِّلات · الأربعة الأولى بس ليها كلاس */
const MOD = { 4:'1', 8:'2', 12:'3', 16:'4' }
const near = (px) => SCALE.reduce((b,[v,n]) => (!b || Math.abs(v-px) < Math.abs(b.v-px)) ? {v,n} : b, null)
const toPx = (t) => { const m=/^(-?[\d.]+)(px|rem)$/.exec(t); return m ? Number(m[1])*(m[2]==='rem'?16:1) : null }

const walk = (d) => fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)])
const files = walk(new URL('../src/',import.meta.url).pathname).filter(f=>f.endsWith('.tsx'))

let moved=0, bound=0, held=[]
for (const f of files) {
  let src = fs.readFileSync(f,'utf8'), orig = src

  /* ── ١ · ستايل فيه خاصية مسافة واحدة بس ── */
  src = src.replace(/className="([^"]*)"\s+style=\{\{\s*(marginTop|marginBottom|gap):\s*'([^']+)'\s*\}\}/g,
    (m, cls, prop, val) => {
      const px = toPx(val); if (px === null) return m
      const n = near(px); const step = MOD[n.v]
      if (!step) return m
      const pre = prop === 'marginTop' ? 'mt' : prop === 'marginBottom' ? 'mb' : 'gp'
      moved++
      return `className="${cls} ${pre}-${step}"`
    })

  /* ── ٢ · أي قيمة مسافة حرفية باقية تتربط بالسلّم ── */
  src = src.replace(/\b(padding|margin|gap|rowGap|columnGap)([A-Za-z]*)\s*:\s*'([^']+)'/g,
    (m, base, suffix, val) => {
      if (/var\(|%|auto|calc\(/.test(val)) return m
      const parts = val.trim().split(/\s+/)
      let ok = true
      const mapped = parts.map((t) => {
        if (t === '0') return t
        const px = toPx(t); if (px === null) { ok = false; return t }
        const n = near(px)
        if (Math.abs(n.v - px) > 2) { ok = false; return t }
        return `var(${n.n})`
      })
      if (!ok) { held.push(`${f.replace(/^.*\/src\//,'')} · ${base}${suffix}: ${val}`); return m }
      bound++
      return `${base}${suffix}: '${mapped.join(' ')}'`
    })

  /* تنضيف: `style={{}}` فاضي */
  src = src.replace(/\s+style=\{\{\s*\}\}/g,'')
  if (src !== orig && !DRY) fs.writeFileSync(f, src)
}
console.log(`اتنقل لكلاس معدِّل : ${moved}`)
console.log(`اتربط بتوكن سطريًّا: ${bound}`)
console.log(`محتاج مراجعة      : ${held.length}`)
for (const h of held.slice(0,12)) console.log('  · '+h)
if (DRY) console.log('\n(تشغيل جافّ)')

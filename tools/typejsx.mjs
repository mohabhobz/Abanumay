/**
 * نفس منطق `typemod` بس على الستايل السطري في الـJSX.
 *
 * ⚠️ الجرد بيقرا الـCSS، فالمقاسات دي كانت **مختبية** — نفس
 * الثغرة اللي `spacingLiteralsJsx` كشفها في المسافات.
 *
 *   node tools/typejsx.mjs --dry
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const DRY = process.argv.includes('--dry')
const FLOOR = 12
const SCALE = [[12,'--fs-1'],[13,'--fs-2'],[14,'--fs-3'],[16,'--fs-4'],[18,'--fs-5'],
               [20,'--fs-6'],[24,'--fs-7'],[32,'--fs-8'],[40,'--fs-9']]
const near = (px) => SCALE.reduce((b,[v,n]) => (!b || Math.abs(v-px) < Math.abs(b.v-px)) ? {v,n} : b, null)
const walk = (d) => fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)])
const files = walk(fileURLToPath(new URL('../src/', import.meta.url))).filter(f=>f.endsWith('.tsx'))
let done=0, lifted=0; const review=[]
for (const f of files) {
  const orig = fs.readFileSync(f,'utf8')
  const next = orig.replace(/fontSize:\s*'([^']+)'/g, (m, v) => {
    const mm = /^(\.?[\d.]+)(rem|px)$/.exec(v.trim()); if (!mm) return m
    const px = Number(mm[1]) * (mm[2]==='rem' ? 16 : 1)
    const n = near(px)
    if (px < FLOOR) { lifted++; return `fontSize: 'var(--fs-1)'` }
    if (Math.abs(n.v-px) > Math.max(1.2, px*0.12)) { review.push(`${f.replace(/^.*\/src\//,'')} ${v}`); return m }
    done++; return `fontSize: 'var(${n.n})'`
  })
  if (next !== orig && !DRY) fs.writeFileSync(f, next)
}
console.log(`اتبدّل: ${done} · اترفع للأرضية: ${lifted} · مراجعة: ${review.length}`)
for (const r of review.slice(0,10)) console.log('  · '+r)
if (DRY) console.log('(تشغيل جافّ)')

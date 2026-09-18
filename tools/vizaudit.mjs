/**
 * جرد بصري مستقل — بيقيس التوزيع الفعلي للقيم المرسومة على الشاشة،
 * من غير ما يفترض سلّمًا. الهدف: نشوف كام قيمة مختلفة بتتنفّذ فعلًا
 * لكل خاصية مرئية، لا نتأكد من قايمة مكتوبة.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { ROUTES } from './routes.mjs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../dist/', import.meta.url))
const PORT = 4471
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.woff2': 'font/woff2' }

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
const themes = ['light', 'dark', 'green']

/** prop -> value -> {n, ex:Set} */
const H = {}
const bump = (prop, val, ex) => {
  H[prop] ??= new Map()
  const m = H[prop]
  if (!m.has(val)) m.set(val, { n: 0, ex: new Set() })
  const e = m.get(val); e.n++; if (e.ex.size < 4) e.ex.add(ex)
}

const smallTargets = []
const tinyText = []
const lowLineHeight = []
const longMeasure = []

for (const theme of themes) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
  await ctx.addInitScript((t) => {
    sessionStorage.setItem('ab-session', 'audit')
    localStorage.setItem('ab-theme', t)
  }, theme)
  await ctx.addInitScript(() => {
    const kill = () => {
      const st = document.createElement('style')
      st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}'
      document.head.appendChild(st)
    }
    if (document.head) kill(); else document.addEventListener('DOMContentLoaded', kill)
  })
  const page = await ctx.newPage()

  for (const route of ROUTES) {
    await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(700)
    const res = await page.evaluate(() => {
      const out = { h: [], small: [], tiny: [], lh: [], meas: [] }
      const sel = (el) => {
        const c = String(el.className || '').split(' ').filter(Boolean).slice(0, 2).join('.')
        return el.tagName.toLowerCase() + (c ? '.' + c : '')
      }
      const px = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null }
      const all = [...document.querySelectorAll('body *')]
      for (const el of all) {
        const r = el.getBoundingClientRect()
        if (r.width < 1 || r.height < 1) continue
        const s = getComputedStyle(el)
        if (s.visibility === 'hidden' || s.opacity === '0') continue
        const k = sel(el)

        /* ⚠️ **النصّ جوّه SVG له viewBox مقاسه مش بكسل شاشة.**
           `getComputedStyle` بترجّع القيمة المصرّح بيها (٨px)،
           والمرسوم فعلًا = ٨ ÷ عرض الـviewBox × عرض العنصر —
           يعني ٢١px على حلقة ٣٣٥. من غير التحويل ده الأداة بتعدّ
           رقم الحلقة «نصًّا تحت ١٢» وهو ضعف الأرضية.
           نفس غلطة قياس المصرَّح بدل المرسوم اللي الملف ده كله
           بيتفاداها. */
        const svgOwner = el.ownerSVGElement
        let svgK = 1
        if (svgOwner) {
          const vb = svgOwner.viewBox?.baseVal
          const w = svgOwner.getBoundingClientRect().width
          if (vb && vb.width > 0 && w > 0) svgK = w / vb.width
        }

        /* حجم الخط — على العناصر اللي فيها نص مباشر بس */
        const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0)
        if (hasText) {
          const fs = px(s.fontSize) * svgK
          out.h.push(['font-size', fs.toFixed(2) + 'px' + (svgOwner ? ' (svg)' : ''), k])
          const lh = px(s.lineHeight)
          if (lh) out.h.push(['line-height-ratio', (lh / fs).toFixed(2), k + ' @' + fs.toFixed(0)])
          if (fs < 12) out.tiny.push([k, fs.toFixed(2), el.textContent.trim().slice(0, 30)])
          if (lh && lh / fs < 1.25 && fs < 24) out.lh.push([k, fs.toFixed(1), (lh / fs).toFixed(2)])
          out.h.push(['font-weight', s.fontWeight, k])
          out.h.push(['color', s.color, k])
          const txt = el.textContent.trim()
          if (txt.length > 120 && r.width > 300) {
            const chars = Math.round(r.width / (fs * 0.5))
            if (chars > 85) out.meas.push([k, Math.round(r.width), chars])
          }
        }

        /* ⚠️ العنصر اللي **بيحدّد** مقاسًا تحت الأرضية من غير ما
           يكون فيه نصّ مباشر — زي `<small>` بتلفّ `<span>`. أول
           كتابة فحصت اللي فيه نصّ مباشر بس، فـ`small` على ستايل
           المتصفّح (١٠٫٨px) عدّت، وبان الرمز جوّاها (١١٫٢px) لوحده:
           العرَض اتمسك والسبب فلت. */
        {
          const f = px(s.fontSize) * svgK
          const pf = el.parentElement ? px(getComputedStyle(el.parentElement).fontSize) * svgK : f
          if (f < 12 && Math.abs(f - pf) > 0.05 && el.textContent.trim() && !hasText)
            out.tiny.push([k + ' ⟵ يحدّد', f.toFixed(2), el.textContent.trim().slice(0, 30)])
        }

        /* نصف القطر */
        const radii = [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius]
        const uniq = [...new Set(radii)]
        for (const v of uniq) { const n = px(v); if (n && n > 0) out.h.push(['radius', (n > 100 ? 'pill' : n.toFixed(0) + 'px'), k]) }

        /* الحشو */
        for (const p of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
          const n = px(s[p]); if (n && n > 0) out.h.push(['padding', n.toFixed(0) + 'px', k])
        }
        /* الفجوة */
        if (s.display.includes('flex') || s.display.includes('grid')) {
          for (const p of ['rowGap', 'columnGap']) { const n = px(s[p]); if (n && n > 0) out.h.push(['gap', n.toFixed(0) + 'px', k]) }
        }
        /* الخلفية والحافة */
        if (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)') out.h.push(['bg', s.backgroundColor, k])
        const bw = px(s.borderTopWidth)
        if (bw && bw > 0) { out.h.push(['border-width', bw.toFixed(2) + 'px', k]); out.h.push(['border-color', s.borderTopColor, k]) }
        if (s.boxShadow && s.boxShadow !== 'none') out.h.push(['shadow', s.boxShadow.slice(0, 60), k])
        out.h.push(['font-family', s.fontFamily.split(',')[0].replace(/["']/g, ''), k])

        /* أهداف اللمس */
        const clickable = el.matches('button, a, [role=button], [role=tab], [role=menuitem], input, select, summary, [onclick], [tabindex]:not([tabindex="-1"])')
        if (clickable && (r.width < 24 || r.height < 24)) {
          out.small.push([k, Math.round(r.width) + '×' + Math.round(r.height), (el.getAttribute('aria-label') || el.textContent.trim()).slice(0, 24)])
        }
      }
      return out
    })
    for (const [p, v, k] of res.h) bump(p, v, `${k} ${route}`)
    for (const x of res.small) smallTargets.push([theme, route, ...x])
    for (const x of res.tiny) tinyText.push([theme, route, ...x])
    for (const x of res.lh) lowLineHeight.push([theme, route, ...x])
    for (const x of res.meas) longMeasure.push([theme, route, ...x])
  }
  await ctx.close()
}
await browser.close(); server.close()

const show = (prop, limit = 40) => {
  const m = H[prop]; if (!m) return
  const rows = [...m.entries()].sort((a, b) => b[1].n - a[1].n)
  console.log(`\n═══ ${prop} · ${rows.length} قيمة مختلفة ═══`)
  for (const [v, e] of rows.slice(0, limit)) {
    console.log(`  ${String(v).padEnd(34)} ${String(e.n).padStart(6)}×   ${[...e.ex].slice(0, 2).join(' | ')}`)
  }
  if (rows.length > limit) console.log(`  … و${rows.length - limit} قيمة تانية`)
}

console.log('════ جرد بصري مستقل · ' + ROUTES.length + ' مسار × 3 ثيم ════')
for (const p of ['font-size', 'line-height-ratio', 'font-weight', 'font-family', 'radius', 'padding', 'gap', 'border-width', 'shadow']) show(p)
show('color', 60); show('bg', 60); show('border-color', 60)

const uniqRows = (arr, keyIdx) => {
  const seen = new Map()
  for (const r of arr) { const k = r.slice(2).join('|'); if (!seen.has(k)) seen.set(k, r) }
  return [...seen.values()]
}
console.log(`\n═══ أهداف لمس أصغر من ٢٤×٢٤ · ${uniqRows(smallTargets).length} حالة فريدة (من ${smallTargets.length}) ═══`)
for (const r of uniqRows(smallTargets).slice(0, 30)) console.log('  ' + r.join(' · '))
console.log(`\n═══ نص أصغر من ١٢px · ${uniqRows(tinyText).length} حالة فريدة ═══`)
for (const r of uniqRows(tinyText).slice(0, 30)) console.log('  ' + r.join(' · '))
console.log(`\n═══ ارتفاع سطر أقل من ١.٢٥ · ${uniqRows(lowLineHeight).length} حالة فريدة ═══`)
for (const r of uniqRows(lowLineHeight).slice(0, 30)) console.log('  ' + r.join(' · '))
console.log(`\n═══ سطر أطول من ٨٥ حرفًا · ${uniqRows(longMeasure).length} حالة فريدة ═══`)
for (const r of uniqRows(longMeasure).slice(0, 20)) console.log('  ' + r.join(' · '))

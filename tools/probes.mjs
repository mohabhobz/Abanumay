import { PNG } from 'pngjs'

/**
 * الفحوص كـ«بروبات» على صفحة محمَّلة · شوف `lib/sweep.mjs`.
 *
 * ⚠️ **كل بروب هنا هو نفس منطق الأداة القديمة بالحرف.** النقل ده
 * سرعة لا إعادة تصميم: لو المنطق اتغيّر مع السرعة، مش هنعرف
 * الاختلاف في النتيجة جه من التسريع ولا من فحص جديد ·
 * و`sweep:verify` بيقارن العدد بالقديم عشان ده بالظبط.
 */

/* ═══════════════════ التباين ═══════════════════ */

const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** جمع صناديق النصّ من الصفحة · نفس كود `contrast.mjs` */
const textBoxes = () => {
  const out = []
  const walk = (el) => {
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim().length > 1) {
        const r = document.createRange(); r.selectNodeContents(n)
        const rect = r.getBoundingClientRect()
        if (rect.width < 6 || rect.height < 6 || rect.top < 0 || rect.bottom > 900 || rect.left < 0 || rect.right > 1440) continue
        if (el.ownerSVGElement || el.tagName === 'svg') continue
        const own = el.getBoundingClientRect()
        if (own.width <= 1 || own.height <= 1) continue
        const cx = Math.round(rect.left + rect.width / 2)
        const cy = Math.round(rect.top + rect.height / 2)
        const hit = document.elementFromPoint(cx, cy)
        if (!hit || (hit !== el && !el.contains(hit) && !hit.contains(el))) continue
        const cs = getComputedStyle(el)
        const eb = el.getBoundingClientRect()
        const lines0 = [...r.getClientRects()].sort((a, c) => a.top - c.top)
        const lines = lines0.map((q) => ({ t: Math.round(q.top), b: Math.round(q.bottom) }))
        const gaps = []
        const push = (t, b) => { if (b - t >= 2) gaps.push([Math.round(t), Math.round(b)]) }
        if (lines.length) {
          push(eb.top + 1, lines[0].t - 1)
          for (let i = 1; i < lines.length; i++) push(lines[i - 1].b + 1, lines[i].t - 1)
          push(lines[lines.length - 1].b + 1, eb.bottom - 1)
        }
        const sides = []
        if (lines.length) {
          const ps = parseFloat(cs.paddingInlineStart) || 0
          const pe = parseFloat(cs.paddingInlineEnd) || 0
          const L = lines0[0], R = lines0[lines0.length - 1]
          const yy = [Math.round(L.top + L.height * 0.35), Math.round(L.top + L.height * 0.65)]
          if (ps >= 5 && L.left - eb.left >= 4) sides.push({ x0: Math.round(eb.left + 2), x1: Math.round(L.left - 2), yy })
          if (pe >= 5 && eb.right - R.right >= 4) sides.push({ x0: Math.round(R.right + 2), x1: Math.round(eb.right - 2), yy })
        }
        const composite = () => {
          let acc = [0, 0, 0], a = 0, q = el
          while (q) {
            const qs = getComputedStyle(q)
            if (qs.backgroundImage && qs.backgroundImage !== 'none') return null
            const m = qs.backgroundColor.match(/[\d.]+/g)
            if (m) {
              const [r0, g0, b0] = m.slice(0, 3).map(Number)
              const al = m[3] !== undefined ? Number(m[3]) : 1
              if (al > 0) { const k = (1 - a) * al; acc = [acc[0] + r0 * k, acc[1] + g0 * k, acc[2] + b0 * k]; a += k }
              if (a >= 0.995) break
            }
            q = q.parentElement
          }
          if (a <= 0) return null
          return acc.map((v) => Math.round(v / a))
        }
        out.push({
          cssBg: composite(), t: n.textContent.trim().slice(0, 22), color: cs.color,
          size: parseFloat(cs.fontSize), weight: cs.fontWeight,
          x: Math.round(rect.left), y: Math.round(rect.top),
          w: Math.round(rect.width), h: Math.round(rect.height), gaps, sides,
          tall: gaps.some(([a2, b2]) => b2 - a2 >= 4),
          cls: (el.className && typeof el.className === 'string') ? el.className.split(' ')[0] : el.tagName.toLowerCase(),
        })
      } else if (n.nodeType === 1) walk(n)
    }
  }
  walk(document.body)
  return out
}

export const contrastProbe = {
  name: 'contrast',
  /* ⚠️ البروب ده وحده هو اللي بيطلب صورة · ولو مش في القايمة،
     `sweep` ما بيصوّرش أصلًا، والزيارة بتخفّ. */
  shot: true,
  async run(page, ctx) {
    const items = await page.evaluate(textBoxes)
    const png = PNG.sync.read(ctx.shot)
    const px = (x, y) => { const i = (png.width * y + x) << 2; return [png.data[i], png.data[i + 1], png.data[i + 2]] }
    const parse = (s) => s.match(/\d+/g).slice(0, 3).map(Number)
    const bad = []
    for (const it of items) {
      const fg = parse(it.color)
      const counts = new Map()
      const band = (y0, y1) => {
        for (let y = y0; y < y1; y++) {
          if (y < 0 || y >= png.height) continue
          for (let x = it.x; x < it.x + it.w; x += 2) {
            if (x < 0 || x >= png.width) continue
            const k = px(x, y).join(','); counts.set(k, (counts.get(k) ?? 0) + 1)
          }
        }
      }
      const strip = (s0) => {
        for (const y of s0.yy) {
          if (y < 0 || y >= png.height) continue
          for (let x = s0.x0; x <= s0.x1; x++) {
            if (x < 0 || x >= png.width) continue
            const k = px(x, y).join(','); counts.set(k, (counts.get(k) ?? 0) + 1)
          }
        }
      }
      if (it.tall) { for (const [a, b] of it.gaps) band(a, b) }
      else if (it.sides?.length) { for (const sd of it.sides) strip(sd) }
      else if (it.gaps?.length) { for (const [a, b] of it.gaps) band(a, b) }
      else if (it.cssBg) { counts.set(it.cssBg.join(','), 1) }
      else { band(it.y - 4, it.y - 1); band(it.y + it.h + 1, it.y + it.h + 4) }
      if (!counts.size) continue
      const bg = [...counts.entries()].sort((a, z) => z[1] - a[1])[0][0].split(',').map(Number)
      if (fg.join() === bg.join()) continue
      const r = ratio(fg, bg)
      const large = it.size >= 24 || (it.size >= 18.66 && Number(it.weight) >= 700)
      const need = large ? 3 : 4.5
      if (r < need) {
        bad.push({ say: `${r.toFixed(2)} (<${need}) ${it.cls} ${it.size}px "${it.t}"  fg ${fg.join(',')} / bg ${bg.join(',')}` })
      }
    }
    return bad
  },
}

/* ═══════════════════ سلامة الشاشة ═══════════════════ */

const uiScan = () => {
  const out = { overflowX: false, clipped: [], offscreen: [], arabicDigits: [], notFound: '' }
  const empty = document.querySelector('.empty .t')
  if (empty && /غير موجود|لا يوجد|غير متاح/.test(empty.textContent || '')) {
    out.notFound = (empty.textContent || '').trim().slice(0, 60)
  }
  out.overflowX = document.documentElement.scrollWidth > window.innerWidth + 2
  const hidden = (e) => {
    let q = e
    while (q && q !== document.body) {
      const s = getComputedStyle(q)
      if (s.opacity === '0' || s.visibility === 'hidden' || q.getAttribute('aria-hidden') === 'true' || q.hasAttribute('inert')) return true
      q = q.parentElement
    }
    return false
  }
  for (const e of document.querySelectorAll('.btn,.tag,.fchip,.fsel-b,.tab,.sub,.mut,.tbl td,.tbl th,.ptitle,.hd-t')) {
    if (e.offsetParent === null || hidden(e)) continue
    const cs = getComputedStyle(e)
    const scrolls = cs.overflowX === 'auto' || cs.overflowX === 'scroll'
    if (e.scrollWidth > e.clientWidth + 2 && cs.textOverflow !== 'ellipsis' && !scrolls) {
      out.clipped.push(`${String(e.className).split(' ').slice(0, 2).join('.')} ${e.scrollWidth}>${e.clientWidth} "${e.textContent.trim().slice(0, 18)}"`)
    }
    const q = e.getBoundingClientRect()
    const inScroller = e.closest('.tblwrap,[style*="overflow"]')
    if (!inScroller && (q.right > window.innerWidth + 2 || q.left < -2)) out.offscreen.push(String(e.className).split(' ')[0])
  }
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n
  while ((n = w.nextNode())) {
    if (/[٠-٩۰-۹]/.test(n.textContent)) {
      out.arabicDigits.push(n.textContent.trim().slice(0, 30))
      if (out.arabicDigits.length > 4) break
    }
  }
  out.clipped = [...new Set(out.clipped)].slice(0, 6)
  out.offscreen = [...new Set(out.offscreen)].slice(0, 4)
  return out
}

export const uiProbe = {
  name: 'ui',
  async run(page, ctx) {
    const o = await page.evaluate(uiScan)
    const say = []
    if (ctx.errs.length) say.push(`كونسول: ${[...new Set(ctx.errs)].join(' · ').slice(0, 160)}`)
    if (o.overflowX) say.push('تمرير أفقي على الصفحة')
    for (const c of o.clipped) say.push(`قصّ بلا نقط: ${c}`)
    if (o.offscreen.length) say.push(`خرج عن المنظر: ${o.offscreen.join(' · ')}`)
    if (o.arabicDigits.length) say.push(`أرقام عربية-هندية: ${o.arabicDigits.join(' · ')}`)
    if (o.notFound) say.push(`🔴 المسار بيرجّع «${o.notFound}» · المعرّف في routes.mjs ميّت`)
    return say.map((s) => ({ say: s }))
  },
}

/* ═══════════════════ جرد اللينكات ═══════════════════ */

const linkScan = () => {
  const ID = /\b(?:prj-\d{4}-\d{4,6}|SR-\d{4}-\d{4,6}|AG-\d{4}-\d{3,6}|RG-\d{3,6}|BG-\d{4}-[A-Z]{2}|PF-\d{4}-\d{3})\b/
  const REL = ['الجهة', 'الجهة المستفيدة', 'المشروع', 'الاتفاقية', 'الطلب',
    'الميزانية', 'المحفظة', 'المالك', 'مشرف المنح', 'الحساب البنكي', 'الحساب المعتمد']
  const out = []
  const inLink = (el) => Boolean(el.closest('a[href]'))
  const seen = (el) => Boolean(el.getClientRects().length)
  const near = (el) => {
    const t = (el.textContent || '').trim()
    return t.length > 60 ? `${t.slice(0, 60)}…` : t
  }
  for (const el of document.querySelectorAll('td,dd,span,b,p,div')) {
    if (el.children.length > 0) continue
    const t = (el.textContent || '').trim()
    if (!t || !ID.test(t) || inLink(el) || !seen(el)) continue
    if (el.closest('.dfile')) continue
    const row = el.closest('tr,li,.pcard,.ecard,.acard,.qread,.glass')
    if (row && row.querySelector('a[href]')) continue
    out.push({ kind: 'معرّف نصّي بلا مدخل في صفّه', say: t })
  }
  for (const dt of document.querySelectorAll('dl.kv > div > dt, dl.kv dt')) {
    const k = (dt.textContent || '').trim()
    if (!REL.includes(k) || !seen(dt)) continue
    const dd = dt.nextElementSibling?.tagName === 'DD'
      ? dt.nextElementSibling
      : dt.parentElement?.querySelector(':scope > dd')
    if (!dd || dd.querySelector('a[href]')) continue
    const v = near(dd)
    if (!v || /^(مفيش|بلا|-)/.test(v)) continue
    out.push({ kind: 'علاقة بلا رابط', say: `${k}: ${v}` })
  }
  for (const a of document.querySelectorAll('a:not([href])')) {
    if (!seen(a)) continue
    out.push({ kind: 'رابط بلا href', say: near(a) })
  }
  return out
}

/* الاستثناءات · مكتوبة بسببها · شوف `linkaudit.mjs` للشرح الكامل */
const LINK_ALLOW = [
  (f) => {
    const id = (f.say.match(/[A-Za-z]{2,3}-[\dA-Z-]+/) ?? [''])[0]
    return f.kind === 'معرّف نصّي بلا مدخل في صفّه' && Boolean(id) && f.route.includes(id)
  },
  (f) => f.route.includes('step=sent'),
  (f) => f.route.startsWith('/entities/portal'),
]

export const linkProbe = {
  name: 'links',
  /* ⚠️ اللينكات **ثيم واحد كفاية**: الروابط مش بتتغيّر بالثيم،
     فتشغيلها ٣ مرات تلات أضعاف الشغل لنفس النتيجة بالحرف. */
  lightOnly: true,
  async run(page, ctx) {
    if (ctx.theme !== 'light') return []
    const hits = await page.evaluate(linkScan)
    return hits
      .map((h) => ({ ...h, route: ctx.route }))
      .filter((h) => !LINK_ALLOW.some((a) => a(h)))
      .map((h) => ({ say: `${h.kind} · ${h.say}` }))
  },
}

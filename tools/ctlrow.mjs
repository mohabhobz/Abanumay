/**
 * صفّ التحكّم · القاعدة ٦ في `CLAUDE.md` مقيسة على **المرسوم**.
 *
 *   node tools/ctlrow.mjs                    # ثيم فاتح · كل المسارات
 *   node tools/ctlrow.mjs --themes           # الثيمين
 *   node tools/ctlrow.mjs --routes /entities/settings
 *   node tools/ctlrow.mjs --selftest         # بيحقن الغلطتين المعروفتين ولازم يمسكهم
 *   node tools/ctlrow.mjs --json out.json    # كل ملاحظة بمكانها
 *
 * ⚠️ **ليه أداة تانية جنب `ctlheight`.** `ctlheight` بيقيس قايمة
 * كلاسات مكتوبة (`SEL`)، فالحقل `.fld` والمنسدلة `.fldsel-b`
 * والترقيم `.pgn` كانوا **برّه السؤال**: الفورمات كلها على ٣٦
 * وهي خضرا، وزرار «أضف» في إعدادات المناطق طاير في تالت عمود
 * بعيد عن حقله والأداة ما شافتوش. دي بالظبط «فحص بيتحقّق من
 * قايمة مكتوبة» اللي آخر `CLAUDE.md` بيحذّر منه.
 *
 * فالأداة دي **ما عندهاش قايمة كلاسات**. بتلمّ كل تحكّم مرسوم
 * فعلًا بدوره (`input` · `select` · `textarea` · `button` ·
 * `[role=button|tab|switch|combobox]`)، وبتطلع لـ«وشّه» المرسوم
 * (أول أب ليه أرضية أو حلقة أو إطار · يعني `.fld` حوالين الـ`input`
 * لا الـ`input` نفسه)، وبعدين بتسأل سؤالين:
 *
 *   (أ) الارتفاع · كل وشّ تحكّم = `--h-md` مقروءة من `:root` وقت التشغيل
 *   (ب) الصفّ · التحكّمات اللي بتتراكب رأسيًّا جوّه نفس الحاوية:
 *       · ارتفاعاتها مختلفة؟  ← «صفّ مكسور»
 *       · حقل وزرار الفعل اللي جنبه بينهم أكتر من `--sp-4` فاضي؟
 *         ← «زرار طاير»
 *
 * **الاستثناء علامة في الـCSS لا قايمة هنا** (نفس نمط `--r-exempt`):
 *
 *   .tbl{--h-exempt:"خلية جدول · بتتبع ارتفاع الصفّ"}
 *
 * والعلامة بتتورّث، فالحاوية بتعلن عن كل اللي جوّاها بسبب واحد.
 * الأداة بتطبع كل استثناء بسببه وعدده، عشان الاستثناء يفضل
 * **مرئيًّا** لا مدفونًا. والاستثناء بيشيل السؤال (أ) بس · (ب)
 * بيتسأل على الكل، لأن الصفّ المكسور مكسور حتى جوّه كارت.
 *
 * EXIT ≠ 0 على أي ملاحظة (الدرس من DQ-025: أداة بتطبع أحمر
 * وبترجع صفر = أخضر كاذب في البوّابة).
 */
import fs from 'node:fs'
import { sweep, pickRoutes, pickThemes } from './lib/sweep.mjs'

/* ═══ القياس جوّه الصفحة · دالة واحدة للجولة وللضابط السالب ═══ */
function measure() {
  const root = getComputedStyle(document.documentElement)
  const H = parseFloat(root.getPropertyValue('--h-md')) || 44
  /* `--sp-4` بتتحسب بالطول مش بتتقري نصًّا: قيمتها `calc(...)` */
  const probeGap = document.createElement('div')
  probeGap.style.cssText = 'position:absolute;visibility:hidden;width:var(--sp-4)'
  document.body.append(probeGap)
  const GAP = probeGap.getBoundingClientRect().width || 12
  probeGap.remove()

  /* ⚠️ الخانة والراديو **علامة اختيار** مش تحكّم صفّ · وشّها
     مربّع ١٦–٢٠ جنب نصّ، والقاعدة ٦ ما بتتكلّمش عنه */
  const SEL = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]),'
    + 'select,textarea,button,a[href],[role=button],[role=tab],[role=switch],[role=combobox]'

  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) return false
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false
    return true
  }
  const painted = (el) => {
    const s = getComputedStyle(el)
    const bg = s.backgroundColor
    const hasBg = bg && !/rgba?\([^)]*,\s*0\)$/.test(bg) && bg !== 'transparent'
    const hasImg = s.backgroundImage && s.backgroundImage !== 'none'
    const hasSh = s.boxShadow && s.boxShadow !== 'none'
    const hasBd = ['Top', 'Right', 'Bottom', 'Left'].some((k) => parseFloat(s[`border${k}Width`]) > 0 && s[`border${k}Style`] !== 'none')
    return hasBg || hasImg || hasSh || hasBd
  }
  /* المنتقي (قايمة · تقويم) حقل حتى لو اتكتب `<button>`: بيشيل قيمة */
  const isField = (el) => el.matches('input,select,textarea,[role=combobox],[aria-haspopup=listbox],[aria-haspopup=dialog],[aria-haspopup=grid]')

  /* الوشّ المرسوم · الحقل الخام جوّه `.fld` وشّه الـ`.fld`. بيطلع
     لحد تلات مستويات ويقف عند أول أب مرسوم **مالوش تحكّم تاني
     جوّاه غير نفسه** (عشان ما يطلعش لكارت فيه تلات حقول) */
  const face = (el) => {
    if (painted(el) || !isField(el)) return el
    let cur = el
    for (let i = 0; i < 3 && cur.parentElement; i++) {
      const p = cur.parentElement
      if (p === document.body) break
      const inner = p.querySelectorAll(SEL)
      const others = [...inner].filter((x) => x !== el && !el.contains(x) && visible(x)
        && !x.matches('button,[role=button]'))
      if (others.length) break
      if (painted(p)) return p
      cur = p
    }
    return el
  }

  const exemptOf = (el) => {
    const v = getComputedStyle(el).getPropertyValue('--h-exempt').trim()
    return v && v !== '0' && v !== 'none' ? v.replace(/^["']|["']$/g, '') : ''
  }
  const sig = (el) => {
    const c = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.') : ''
    return el.tagName.toLowerCase() + (c ? '.' + c : '')
  }
  const txt = (el) => (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.value || '')
    .replace(/\s+/g, ' ').trim().slice(0, 22)

  /* سطور النصّ المرسومة جوّه الوشّ · من صناديق السطور لا من
     الارتفاع (درس `leading`: الارتفاع ÷ السطر بيعدّ الحشو سطرًا) */
  const lines = (el) => {
    const tops = []
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent.trim()) continue
      const rg = document.createRange(); rg.selectNodeContents(n)
      for (const rr of rg.getClientRects()) {
        if (rr.height < 1) continue
        const mid = rr.top + rr.height / 2
        if (!tops.some((t) => Math.abs(t - mid) < rr.height / 2)) tops.push(mid)
      }
    }
    return tops.length
  }
  /* زرار جوّه مجموعة مرسومة (`role=group` · مبدّل العرض) جزء من
     وشّ المجموعة: المبدّل هو التحكّم اللي في الصفّ، والإبهام جوّاه */
  const groupFace = (el) => {
    const p = el.parentElement
    if (!p || !painted(p)) return null
    const role = p.getAttribute('role')
    if (!['group', 'radiogroup', 'tablist', 'toolbar'].includes(role ?? '')) return null
    const kids = [...p.querySelectorAll(SEL)]
    return kids.length >= 2 && kids.every((k) => k.matches('button,[role=button],[role=tab],[role=radio]')) ? p : null
  }
  /* ⚠️ **الحقل جوّه حقل.** `<span class="fld"><DateField/></span>`:
     التقويم لابس `.fld` بنفسه، والغلاف مرسوم حواليه تاني · فاللي
     بيتشاف صندوق ٥٢ جوّاه صندوق ٣٦. الغلاف المرسوم اللي مالوش
     محتوى غير التحكّم ده هو الوشّ الحقيقي */
  const wrapFace = (f) => {
    let cur = f, best = f
    for (let i = 0; i < 3; i++) {
      const p = cur.parentElement
      if (!p || p === document.body) break
      /* خلية الجدول وعنصر القايمة والقسم **مكان** التحكّم لا وشّه */
      if (p.matches('td,th,tr,li,section,article,form,fieldset,dialog')) break
      if ((p.textContent || '').trim() !== (f.textContent || '').trim()) break
      if ([...p.querySelectorAll(SEL)].some((x) => !f.contains(x) && visible(x))) break
      if (p.getBoundingClientRect().height > H * 2) break
      cur = p
      if (painted(p)) best = p
    }
    return best
  }
  /* رابط جوّه جملة · زرار بلا وشّ مرسوم وأبوه فيه نصّ مباشر: ده
     كلمة بتتنقر جوّه فقرة، مش تحكّم في صفّ أدوات */
  const inProse = (el) => {
    if (painted(el)) return false
    const s = getComputedStyle(el)
    const p = el.parentElement
    if (s.display.startsWith('inline') && p && [...p.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return true
    /* أو نصّ بس بلا حشو ولا وشّ (`.lnk` · «نسيت كلمة المرور»): شكله
       رابط، وصندوقه سطره */
    const flat = ['Top', 'Bottom'].every((k) => parseFloat(s[`padding${k}`]) === 0)
    return flat && !el.querySelector('img,svg,input') && !!el.textContent.trim()
  }

  /* ١ · اللمّ · كل اللي بيتضغط أو بيتكتب فيه ومرسوم فعلًا */
  const seen = new Set()
  let ctls = []
  const skip = { svg: 0, prose: 0, tile: 0 }
  for (const el of document.querySelectorAll(SEL)) {
    if (!visible(el)) continue
    if (el.closest('[aria-hidden="true"],[inert]')) continue
    /* ⚠️ علامة جراف (`<g role=button>`) بيانات بتتنقر مش صندوق
       تحكّم · مقاسها من الداتا */
    if (el instanceof SVGElement) { skip.svg++; continue }
    if (inProse(el)) { skip.prose++; continue }
    const f = wrapFace(groupFace(el) ?? face(el))
    if (seen.has(f)) continue
    seen.add(f)
    ctls.push({ el: f, src: el, field: isField(el) })
  }
  /* التحكّم اللي جوّه وشّ تحكّم تاني جزء منه (زرار التقويم جوّه
     حقل التاريخ · «×» جوّه البحث) · الوشّ الكبير هو اللي بيتقاس */
  ctls = ctls.filter((c) => !ctls.some((o) => o !== c && o.el !== c.el && o.el.contains(c.el)))

  const out = { H, GAP, total: 0, dist: {}, height: [], exempt: {}, skip, rows: [], orphans: [], shifted: [] }
  const rowable = []
  for (const c of ctls) {
    const r = c.el.getBoundingClientRect()
    c.r = r
    c.h = Math.round(r.height)
    /* ⚠️ وشّ بسطرين نصّ أو فيه تكستاريا = **بلاطة** (خطوة في
       ستيبر · ملف · كارت بيتنقر)، مقاسها من محتواها. التكستاريا
       مستثناة في العقد نفسه (`.fld-a` بتكبر بالمحتوى) */
    if (c.el.matches('textarea') || c.el.querySelector('textarea') || lines(c.el) > 1) { skip.tile++; continue }
    out.total++
    out.dist[c.h] = (out.dist[c.h] ?? 0) + 1
    const ex = exemptOf(c.el)
    if (ex) { out.exempt[ex] = (out.exempt[ex] ?? 0) + 1; continue }
    rowable.push(c)
    if (c.h !== Math.round(H)) out.height.push({ h: c.h, sig: sig(c.el), txt: txt(c.src) })
  }
  ctls = rowable

  /* ٢ · الصفوف · نفس الحاوية = أقرب أب مشترك على بعد ≤ ٤ مستويات
     من الاتنين، وتراكب رأسي ≥ نصّ الأقصر */
  const depthTo = (a, anc) => { let d = 0; for (let x = a; x && x !== anc; x = x.parentElement) d++; return d }
  const lca = (a, b) => { for (let x = a; x; x = x.parentElement) if (x.contains(b)) return x; return null }
  const par = ctls.map((_, i) => i)
  const find = (i) => (par[i] === i ? i : (par[i] = find(par[i])))
  const pairs = []
  /* ⚠️ طبقة ثابتة (`position:fixed`) صفّ لوحدها: زرار «اسأل أبانمي»
     العايم وزرار الحساب في الريل على نفس الارتفاع بالصدفة، مش في
     صفّ واحد */
  const layer = (el) => { for (let x = el; x; x = x.parentElement) if (getComputedStyle(x).position === 'fixed') return x; return null }
  /* والسطح واحد: كارت (سطح مرسوم أعلى من صفّين) بيقفل على اللي
     جوّاه · زرار في كارت الملفات وزرار في كارت المساعد جنبه على نفس
     الارتفاع مش صفّ */
  const surf = (el) => {
    for (let x = el.parentElement; x && x !== document.body; x = x.parentElement) {
      if (painted(x) && x.getBoundingClientRect().height > H * 2) return x
    }
    return null
  }
  ctls.forEach((c) => { c.layer = layer(c.el); c.surf = surf(c.el) })
  const LAND = 'nav,main,header,footer,aside,dialog,[role=dialog],[role=navigation],[role=banner],[role=contentinfo],[role=complementary],[role=region]'
  for (let i = 0; i < ctls.length; i++) {
    for (let j = i + 1; j < ctls.length; j++) {
      const a = ctls[i], b = ctls[j]
      const ov = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
      if (ov < Math.min(a.r.height, b.r.height) / 2) continue
      if (a.layer !== b.layer) continue
      if (a.surf !== b.surf) continue
      /* والمنطقة الدلالية واحدة: الريل (`nav`) وشريط القرار مش صفّ
         حتى لو اتقابلوا على نفس الارتفاع */
      if (a.el.closest(LAND) !== b.el.closest(LAND)) continue
      const c = lca(a.el, b.el)
      if (!c || c === document.body || c === document.documentElement) continue
      if (depthTo(a.el, c) > 4 || depthTo(b.el, c) > 4) continue
      par[find(i)] = find(j)
      pairs.push([i, j, c])
    }
  }
  const groups = new Map()
  ctls.forEach((c, i) => { const g = find(i); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(c) })
  for (const g of groups.values()) {
    if (g.length < 2) continue
    const hs = [...new Set(g.map((c) => c.h))].sort((a, b) => a - b)
    if (hs[hs.length - 1] - hs[0] > 1) {
      out.rows.push({ hs, items: g.map((c) => `${sig(c.el)}=${c.h}`).slice(0, 6).join(' · ') })
    } else {
      /* (د) **صفّ مزاح (12 أكتوبر · العميل بعته تاني).** نفس الارتفاع
         بس الحواف مش على خطّ واحد: منسدلة فوقها تسمية جنب بحث مالوش
         تسمية، والصفّ `align-items:center` فيوسّط الغلاف الأطول ·
         التحكّم نفسه بينزل ٩px عن جاره. (ب) ما كانش بيشوفه لأنه
         بيقارن الارتفاعات بس، والارتفاعات متساوية */
      const tops = g.map((c) => c.r.top)
      const d = Math.max(...tops) - Math.min(...tops)
      if (d > 1.5) out.shifted.push({ d: Math.round(d), items: g.map((c) => `${sig(c.el)}@${Math.round(c.r.top - Math.min(...tops))}`).slice(0, 6).join(' · ') })
    }
  }

  /* ٣ · الزرار الطاير · حقل وزرار متجاورين في نفس الصفّ (مفيش
     تحكّم تالت بينهم) والمسافة أكبر من `--sp-4` **وفاضية**:
     مفيش نصّ ولا صورة ولا سطح مرسوم في الشريحة اللي بينهم */
  const blockers = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue
    const rg = document.createRange(); rg.selectNodeContents(n)
    for (const rr of rg.getClientRects()) if (rr.width > 0 && rr.height > 0) blockers.push({ r: rr, el: n.parentElement })
  }
  for (const el of document.querySelectorAll('img,svg,canvas,video')) {
    const rr = el.getBoundingClientRect(); if (rr.width > 0) blockers.push({ r: rr, el })
  }
  for (const [i, j, c] of pairs) {
    const a = ctls[i], b = ctls[j]
    if (a.field === b.field) continue
    const f = a.field ? a : b, btn = a.field ? b : a
    if (!btn.src.matches('button,[role=button]')) continue
    /* خلايا الصفّ الواحد في جدول · المسافة بينهم هي العمود نفسه */
    if (c.matches('tr,tbody,thead,table')) continue
    const [L, R] = f.r.left < btn.r.left ? [f, btn] : [btn, f]
    const gap = R.r.left - L.r.right
    if (gap <= GAP + 0.5) continue
    /* تحكّم تالت بينهم = مش متجاورين */
    const between = ctls.some((o) => o !== a && o !== b && o.r.left >= L.r.right - 1 && o.r.right <= R.r.left + 1
      && Math.min(o.r.bottom, L.r.bottom) - Math.max(o.r.top, L.r.top) > 0)
    if (between) continue
    const top = Math.max(L.r.top, R.r.top), bot = Math.min(L.r.bottom, R.r.bottom)
    const hit = blockers.some(({ r, el }) => r.left < R.r.left - 1 && r.right > L.r.right + 1 && r.top < bot && r.bottom > top
      && !L.el.contains(el) && !R.el.contains(el))
    if (hit) continue
    /* فاصل معلَن (`<span class="pc-sp"/>` بـ`flex:1`) = المؤلّف قال
       «الفعل ده في آخر الشريط» · زي «تصدير» في آخر جملة التقرير.
       الطاير هو اللي **ما حدّش قاله**: مسار شبكة فاضي أو سقف عرض */
    const spacer = [...c.querySelectorAll('*')].some((el) => {
      if (el.children.length || (el.textContent || '').trim()) return false
      if (!(parseFloat(getComputedStyle(el).flexGrow) > 0)) return false
      const rr = el.getBoundingClientRect()
      return rr.left >= L.r.right - 1 && rr.right <= R.r.left + 1 && rr.width > gap / 2
    })
    if (spacer) continue
    const s = getComputedStyle(c)
    out.orphans.push({ gap: Math.round(gap), field: sig(f.el), btn: `${sig(btn.el)} «${txt(btn.src)}»`, box: `${sig(c)} (${s.display})` })
  }

  /* (ج) **حقل الملاحظة جنب فعله (DQ-048).** حقل سبب الإعادة (`.payact-n`)
     لازم يكون على نفس السطر مع زرار بيحتاج ملاحظة (`[data-needs-note]`)
     وعلى بعد ≤ --sp-4 · الدوك اللي بيلفّ كان بيسيب الحقل في السطر الأول
     و«إعادة» في التاني، والسؤالين (أ) و(ب) ما بيشوفوش ده لأنهم مش صفّ */
  out.pairs = []
  for (const fld of document.querySelectorAll('.payact-n')) {
    const fr = fld.getBoundingClientRect()
    if (fr.width < 1) continue
    const bs = [...document.querySelectorAll('button[data-needs-note]')].map((b) => ({ b, r: b.getBoundingClientRect() })).filter((x) => x.r.width > 0)
    if (!bs.length) continue
    const same = bs.filter((x) => Math.min(fr.bottom, x.r.bottom) - Math.max(fr.top, x.r.top) > fr.height / 2)
    const gapOf = (r) => Math.max(0, r.left - fr.right, fr.left - r.right)
    const best = same.length ? Math.min(...same.map((x) => gapOf(x.r))) : null
    if (best === null || best > GAP + 0.5) out.pairs.push({ field: sig(fld), btn: txt(bs[0].b), gap: best === null ? 'سطر تاني' : Math.round(best) })
  }
  return out
}

/* ═══ الضابط السالب · الغلطتان اللي مهاب مسكهم بعينه ═══ */
function inject() {
  const host = document.createElement('div')
  host.id = 'ctlrow-selftest'
  /* تحت آخر الصفحة · عشان نصّ الصفحة ما يقعش في الفجوة فيخبّي الطاير */
  host.style.cssText = `position:absolute;top:${document.documentElement.scrollHeight + 80}px;left:0;width:1000px`
  /* ١ · حقل ٣٦ (٨ + ٢٠ + ٨) جنب زرار ٤٤ · صفّ مكسور + ارتفاع */
  const r1 = document.createElement('div')
  r1.style.cssText = 'display:flex;gap:var(--sp-3);align-items:end'
  r1.innerHTML = '<span data-t="f36" style="display:flex;padding:var(--sp-3) var(--sp-4);box-shadow:inset 0 0 0 1px #888">'
    + '<input style="height:var(--lh-md);border:0" aria-label="اختبار"></span>'
    + '<button style="height:var(--h-md);box-shadow:inset 0 0 0 1px #888">أضف</button>'
  /* ٢ · حقل وزرار على الـ٤٤ بس الزرار طاير ٦٠٠px في مساحة فاضية */
  const r2 = document.createElement('div')
  r2.style.cssText = 'display:flex;gap:600px;align-items:end;margin-top:var(--sp-5)'
  r2.innerHTML = '<span style="display:flex;width:200px;padding:var(--pb-md) var(--sp-4);box-shadow:inset 0 0 0 1px #888">'
    + '<input style="height:var(--lh-md);border:0;min-width:0" aria-label="اختبار٢"></span>'
    + '<button style="height:var(--h-md);box-shadow:inset 0 0 0 1px #888">طاير</button>'
  /* ٣ · الضابط الموجب: نفس التركيبة سليمة · لازم ما تتمسكش */
  const r3 = document.createElement('div')
  r3.style.cssText = 'display:flex;gap:var(--sp-3);align-items:end;margin-top:var(--sp-5)'
  r3.innerHTML = '<span style="display:flex;width:200px;padding:var(--pb-md) var(--sp-4);box-shadow:inset 0 0 0 1px #888">'
    + '<input style="height:var(--lh-md);border:0;min-width:0" aria-label="سليم"></span>'
    + '<button style="height:var(--h-md);box-shadow:inset 0 0 0 1px #888">سليم</button>'
  /* ٤ · حقل جوّه حقل: غلاف مرسوم حوالين منتقي تاريخ لابس وشّه ·
     الغلاف هو اللي بيتشاف (٨ + ٣٦ + ٨ = ٥٢) */
  const r4 = document.createElement('div')
  r4.style.cssText = 'display:flex;margin-top:var(--sp-5)'
  r4.innerHTML = '<span data-t="wrap" style="display:block;width:200px;padding:var(--sp-3);box-shadow:inset 0 0 0 1px #888">'
    + '<button aria-haspopup="dialog" style="display:block;width:100%;height:36px;box-shadow:inset 0 0 0 1px #888">غلاف</button></span>'
  /* ٥ · حقل ملاحظة في سطر و«إعادة» في السطر اللي تحته (DQ-048) */
  const r5 = document.createElement('div')
  r5.style.cssText = 'display:flex;flex-direction:column;gap:var(--sp-3);margin-top:var(--sp-5);width:400px'
  r5.innerHTML = '<label class="payact-n" style="display:flex"><input aria-label="سبب" style="height:var(--h-md)"></label>'
    + '<button data-needs-note="" style="height:var(--h-md)">إعادة مفصولة</button>'
  /* ٦ · منسدلة فوقها تسمية جنب بحث بلا تسمية في صفّ موسَّط (العميل · 12 أكتوبر) */
  const r6 = document.createElement('div')
  r6.style.cssText = 'display:flex;gap:var(--sp-3);align-items:center;margin-top:var(--sp-5)'
  r6.innerHTML = '<span style="display:block;width:200px;height:var(--h-md);box-shadow:inset 0 0 0 1px #888"><input aria-label="بحث مزاح" style="height:var(--lh-md);border:0"></span>'
    + '<div><span style="display:block;font-size:12px">تسمية</span><button aria-haspopup="listbox" style="display:block;height:var(--h-md);box-shadow:inset 0 0 0 1px #888">منسدلة مزاحة</button></div>'
  host.append(r1, r2, r3, r4, r5, r6)
  document.body.append(host)
}

const argOf = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null }
const SELFTEST = process.argv.includes('--selftest')

if (SELFTEST) {
  const probe = {
    name: 'ctlrow',
    async run(page) {
      const base = await page.evaluate(measure)
      await page.evaluate(inject)
      const got = await page.evaluate(measure)
      return [{ base, got }]
    },
  }
  const { findings } = await sweep({ probes: [probe], routes: ['/entities/settings'], themes: ['light'], lanes: 1 })
  const [{ base, got } = {}] = findings.get('ctlrow')
  if (!got) { console.log('❌ الضابط السالب ما اشتغلش أصلًا'); process.exit(1) }
  const newOf = (k, key) => got[k].filter((x) => !base[k].some((y) => key(y) === key(x)))
  const h36 = newOf('height', (x) => `${x.sig}|${x.txt}|${x.h}`).filter((x) => x.h === Math.round(got.H) - 8)
  const rows = newOf('rows', (x) => x.items)
  const orph = newOf('orphans', (x) => x.btn + x.gap)
  const ok1 = h36.length >= 1
  const ok2 = rows.some((x) => x.hs.includes(Math.round(got.H) - 8) && x.hs.includes(Math.round(got.H)))
  const ok3 = orph.some((x) => x.btn.includes('طاير') && x.gap >= 590)
  const ok4 = !orph.some((x) => x.btn.includes('سليم')) && !rows.some((x) => x.items.includes('سليم'))
  const ok6 = (got.pairs ?? []).length > (base.pairs ?? []).length
  const ok7 = newOf('shifted', (x) => x.items).some((x) => x.d >= 6)
  const ok5 = newOf('height', (x) => `${x.sig}|${x.txt}|${x.h}`).some((x) => x.sig === 'span' && x.h === 52)
  console.log(`════ ctlrow --selftest · --h-md=${got.H} · --sp-4=${got.GAP} ════`)
  console.log(`${ok1 ? '✅' : '❌'} حقل ${Math.round(got.H) - 8}px اتمسك في الارتفاع (${h36.map((x) => x.sig).join(' · ') || 'لا شيء'})`)
  console.log(`${ok2 ? '✅' : '❌'} الصفّ ٣٦ جنب ٤٤ اتمسك مكسور`)
  console.log(`${ok3 ? '✅' : '❌'} الزرار الطاير ٦٠٠px اتمسك (${orph.map((x) => x.gap + 'px').join(' · ') || 'لا شيء'})`)
  console.log(`${ok4 ? '✅' : '❌'} الصفّ السليم ما اتمسكش (ضابط موجب)`)
  console.log(`${ok5 ? '✅' : '❌'} الحقل جوّه حقل اتقاس بغلافه (٥٢) لا بالمنتقي (٣٦)`)
  console.log(`${ok6 ? '✅' : '❌'} حقل الملاحظة في سطر و«إعادة» في سطر تاني اتمسك`)
  console.log(`${ok7 ? '✅' : '❌'} منسدلة بتسمية جنب بحث بلا تسمية اتمسكت مزاحة`)
  process.exit(ok1 && ok2 && ok3 && ok4 && ok5 && ok6 && ok7 ? 0 : 1)
}

const routes = pickRoutes()
const themes = pickThemes()
const t0 = Date.now()
process.stdout.write(`\n════ صفّ التحكّم · ${themes.length}×${routes.length} صفحة ════\n`)
const probe = { name: 'ctlrow', async run(page) { return [await page.evaluate(measure)] } }
const { findings, visits } = await sweep({ probes: [probe], routes, themes })
const all = findings.get('ctlrow')

const dist = new Map(), exempt = new Map(), skipped = { svg: 0, prose: 0, tile: 0 }
const H = new Map(), ROWS = new Map(), ORPH = new Map(), PAIR = new Map(), SHIFT = new Map()
let total = 0, target = 44, gapPx = 12
const add = (m, k, route, theme, extra) => {
  if (!m.has(k)) m.set(k, { n: 0, routes: new Set(), themes: new Set(), ...extra })
  const v = m.get(k); v.n++; v.routes.add(route); v.themes.add(theme)
}
for (const f of all) {
  total += f.total; target = f.H; gapPx = f.GAP
  for (const [k, v] of Object.entries(f.dist)) dist.set(+k, (dist.get(+k) ?? 0) + v)
  for (const [k, v] of Object.entries(f.exempt)) exempt.set(k, (exempt.get(k) ?? 0) + v)
  for (const k of Object.keys(skipped)) skipped[k] += f.skip[k]
  for (const x of f.height) add(H, `${x.h}px · ${x.sig}`, f.route, f.theme, { h: x.h })
  for (const x of f.rows) add(ROWS, `[${x.hs.join('/')}] ${x.items}`, f.route, f.theme)
  for (const x of f.orphans) add(ORPH, `${x.field} ↔ ${x.btn} · ${x.gap}px · جوّه ${x.box}`, f.route, f.theme)
  for (const x of f.shifted ?? []) add(SHIFT, `Δ${x.d}px · ${x.items}`, f.route, f.theme)
  for (const x of f.pairs ?? []) add(PAIR, `${x.field} ↔ «${x.btn}» · ${x.gap}${typeof x.gap === 'number' ? 'px' : ''}`, f.route, f.theme)
}
const nH = [...H.values()].reduce((a, b) => a + b.n, 0)
const nR = [...ROWS.values()].reduce((a, b) => a + b.n, 0)
const nO = [...ORPH.values()].reduce((a, b) => a + b.n, 0)
const nP = [...PAIR.values()].reduce((a, b) => a + b.n, 0)
const nS = [...SHIFT.values()].reduce((a, b) => a + b.n, 0)

console.log(`الهدف ${target}px (--h-md) · الفجوة القصوى ${gapPx}px (--sp-4) · ${total} وشّ تحكّم مرسوم`)
console.log('الارتفاعات المرسومة: ' + [...dist.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}px ×${v}`).join(' · '))
console.log(`برّه السؤال بدوره (مش تحكّم صفّ): علامة جراف ×${skipped.svg} · رابط جوّه جملة ×${skipped.prose} · بلاطة بسطرين أو تكستاريا ×${skipped.tile}`)
if (exempt.size) {
  console.log('\nالاستثناءات المعلنة في الـCSS (`--h-exempt`):')
  for (const [k, v] of [...exempt.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ×${v}  ${k}`)
}
const show = (title, m) => {
  const n = [...m.values()].reduce((a, b) => a + b.n, 0)
  if (!n) { console.log(`\n✅ ${title} · صفر`); return }
  console.log(`\n🔴 ${title} · ${n} مرسوم · ${m.size} شكل`)
  for (const [k, v] of [...m.entries()].sort((a, b) => b[1].n - a[1].n)) {
    const rs = [...v.routes]
    console.log(`   ×${v.n}  ${k}  [${[...v.themes].join(',')}]`)
    console.log(`         ${rs.slice(0, 4).join(' · ')}${rs.length > 4 ? ` · +${rs.length - 4}` : ''}`)
  }
}
show('(أ) وشّ تحكّم برّه --h-md', H)
show('(ب) صفّ بارتفاعات مختلفة', ROWS)
show('(ب) زرار طاير عن حقله', ORPH)
show('(ج) حقل الملاحظة بعيد عن فعله', PAIR)
show('(د) صفّ مزاح · نفس الارتفاع وحواف مختلفة', SHIFT)

const jp = argOf('--json')
if (jp) {
  const ser = (m) => [...m.entries()].map(([k, v]) => ({ k, n: v.n, routes: [...v.routes], themes: [...v.themes] }))
  fs.writeFileSync(jp, JSON.stringify({ target, gapPx, total, skipped, dist: Object.fromEntries(dist), exempt: Object.fromEntries(exempt), height: ser(H), rows: ser(ROWS), orphans: ser(ORPH), pairs: ser(PAIR), shifted: ser(SHIFT) }, null, 1))
}
const bad = nH + nR + nO + nP + nS
console.log(`\n════ ${bad ? `🔴 ارتفاع ${nH} · صفّ ${nR} · طاير ${nO} · ملاحظة ${nP} · مزاح ${nS}` : '✅ نضيف'} · ${visits} زيارة في ${((Date.now() - t0) / 1000).toFixed(1)}ث ════\n`)
process.exit(bad ? 1 : 0)

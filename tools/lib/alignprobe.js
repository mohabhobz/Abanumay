/* In-page probe for the alignment audit (11 Oct) · injected with page.evaluate.
   Measures what is drawn, not what is declared: ink boxes (text line rects, icons, images) and
   the boxes that carry a surface (background, border, ring). Returns findings with a readable
   selector path and the rect to crop. RTL: inline-start is the right edge.

   kinds
     vmis   · items in one row whose ink centres disagree (icon vs text, label vs value)
     edge   · siblings in a stack whose start edges almost line up (off by 2–7px)
     gap    · a stack/row whose gaps between like siblings are uneven
     touch  · boxed siblings touching or overlapping
     padv   · a small boxed element whose content sits off its vertical centre
     cardh  · cards in one grid/flex row with different heights
     clip   · text cut by its box without an ellipsis
     spill  · ink that runs out of its boxed ancestor
     hscroll· the page scrolls sideways */
// eslint-disable-next-line no-unused-vars
function alignProbe(opts) {
  const SCALE = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80]
  const root = opts && opts.root ? document.querySelector(opts.root) : document.body
  if (!root) return []
  const out = []
  const R = (r) => ({ x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) })
  const cs = (e) => getComputedStyle(e)
  const visible = (e) => {
    if (!(e instanceof Element)) return false
    const r = e.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const s = cs(e)
    if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false
    return true
  }
  const skip = (e) => e.closest('svg, canvas, video, .sr-only, [aria-hidden="true"] *, .vis-hide, .vis-h, .sr, .visually-hidden, .recharts-wrapper, .login-vid, nav.rail, .__amark, script, style, template')
  const inflow = (e) => { const p = cs(e).position; return p !== 'absolute' && p !== 'fixed' }
  const name = (e) => {
    let c = typeof e.className === 'string' ? e.className.trim().split(/\s+/).filter((x) => x && !/^(on|sel|is-|has-)/.test(x)).slice(0, 2).join('.') : ''
    return e.tagName.toLowerCase() + (c ? '.' + c : '')
  }
  const path = (e) => {
    const a = []
    for (let n = e, i = 0; n && n !== document.body && i < 4; n = n.parentElement, i++) a.unshift(name(n))
    return a.join(' > ')
  }
  const txt = (e) => (e.innerText || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)
  const boxed = (e) => {
    const s = cs(e)
    const bg = s.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor)
    const bd = ['Top', 'Right', 'Bottom', 'Left'].some((k) => parseFloat(s['border' + k + 'Width']) > 0 && !/rgba\(0, 0, 0, 0\)/.test(s['border' + k + 'Color']))
    const ring = s.boxShadow && s.boxShadow !== 'none'
    const img = s.backgroundImage && s.backgroundImage !== 'none'
    return bg || bd || ring || img
  }
  /* ink · text line rects + replaced/icon boxes, clipped to nothing */
  const inkCache = new Map()
  const ink = (e) => {
    if (inkCache.has(e)) return inkCache.get(e)
    if (e.getElementsByTagName('*').length > 250) {
      /* big containers · their own box stands in, a full walk is too costly */
      const r = e.getBoundingClientRect(); const res = { left: r.left, top: r.top, right: r.right, bottom: r.bottom, cy: (r.top + r.bottom) / 2, lines: 9, n: 0, big: true }
      inkCache.set(e, res); return res
    }
    const rects = []
    const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) => {
        if (n.nodeType === 1) {
          if (!visible(n)) return NodeFilter.FILTER_REJECT
          const t = n.tagName
          if (n !== e && boxed(n)) { const br = n.getBoundingClientRect(); if (br.height <= 40 && br.width <= 320 && (n.textContent || '').trim()) { rects.push(br); return NodeFilter.FILTER_REJECT } }
          if (t === 'svg' || t === 'IMG' || t === 'svg:svg' || t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA' || t === 'CANVAS' || t === 'VIDEO') { rects.push(n.getBoundingClientRect()); return NodeFilter.FILTER_REJECT }
          return NodeFilter.FILTER_SKIP
        }
        return n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
      },
    })
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeType !== 3) continue
      const rg = document.createRange(); rg.selectNodeContents(n)
      for (const r of rg.getClientRects()) if (r.width > 0.5 && r.height > 0.5) rects.push(r)
    }
    let res = null
    if (rects.length) {
      const L = Math.min(...rects.map((r) => r.left)), T = Math.min(...rects.map((r) => r.top))
      const Rr = Math.max(...rects.map((r) => r.right)), B = Math.max(...rects.map((r) => r.bottom))
      /* lines · distinct vertical bands */
      const ys = rects.map((r) => (r.top + r.bottom) / 2).sort((a, b) => a - b)
      let lines = 1; for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] > 6) lines++
      res = { left: L, top: T, right: Rr, bottom: B, cy: (T + B) / 2, lines, n: rects.length }
    }
    inkCache.set(e, res)
    return res
  }
  const kids = (e) => [...e.children].filter((c) => visible(c) && inflow(c) && !skip(c))
  const add = (kind, el, extra, marks) => out.push({ kind, path: path(el), text: txt(el), rect: R(el.getBoundingClientRect()), marks: (marks || [el]).map((m) => R(m.getBoundingClientRect())), ...extra })

  const all = [root, ...root.querySelectorAll('*')].filter((e) => visible(e) && !skip(e))
  for (const el of all) {
    const s = cs(el)
    const disp = s.display
    const ks = kids(el)

    /* ── vmis · one visual row ── */
    const isRow = (disp.includes('flex') && !s.flexDirection.startsWith('column')) || disp.includes('grid')
    if (isRow && ks.length >= 2 && ks.length <= 12) {
      /* group children whose boxes overlap vertically (same line of a wrapping row) */
      const items = ks.map((k) => ({ k, r: k.getBoundingClientRect(), i: ink(k) })).filter((x) => x.i && x.r.height < 72)
      const lines = []
      for (const it of items) {
        const ln = lines.find((L) => it.r.top < L.b - 4 && it.r.bottom > L.t + 4)
        if (ln) { ln.items.push(it); ln.t = Math.min(ln.t, it.r.top); ln.b = Math.max(ln.b, it.r.bottom) } else lines.push({ t: it.r.top, b: it.r.bottom, items: [it] })
      }
      for (const L of lines) {
        const one = L.items.filter((x) => x.i.lines === 1)
        if (one.length < 2) continue
        const al = s.alignItems
        if (al === 'flex-start' || al === 'start' || al === 'baseline' || al === 'flex-end' || al === 'end' || al === 'last baseline') continue
        const cys = one.map((x) => x.i.cy)
        const d = Math.max(...cys) - Math.min(...cys)
        if (d > 2.5) add('vmis', el, { d: +d.toFixed(1), items: one.map((x) => name(x.k) + ' ' + Math.round(x.i.cy - Math.min(...cys))).slice(0, 5) }, one.map((x) => x.k))
      }
    }

    /* ── stacks: edges and gaps ── */
    const isCol = disp === 'block' || disp === 'flow-root' || (disp.includes('flex') && s.flexDirection.startsWith('column')) || (disp.includes('grid') && s.gridTemplateColumns.split(' ').length === 1)
    if (isCol && ks.length >= 2) {
      const rs = ks.map((k) => ({ k, r: k.getBoundingClientRect(), i: ink(k) }))
      /* stacked = each below the previous */
      const stacked = rs.every((x, i) => i === 0 || x.r.top >= rs[i - 1].r.bottom - 1)
      if (stacked) {
        /* edge · start (right) edges of ink, among children that are start-aligned text */
        const ed = rs.filter((x) => x.i && !x.i.big && cs(x.k).textAlign !== 'center' && x.r.width > 40)
        if (ed.length >= 2) {
          const vals = ed.map((x) => x.i.right)
          for (let i = 0; i < vals.length; i++) for (let j = i + 1; j < vals.length; j++) {
            const dd = Math.abs(vals[i] - vals[j])
            if (dd > 2 && dd < 7.5) { add('edge', el, { d: +dd.toFixed(1), a: name(ed[i].k) + ' «' + txt(ed[i].k).slice(0, 16) + '»', b: name(ed[j].k) + ' «' + txt(ed[j].k).slice(0, 16) + '»' }, [ed[i].k, ed[j].k]); i = vals.length; break }
          }
        }
        /* gap · between like siblings */
        if (rs.length >= 3) {
          const gaps = []
          for (let i = 1; i < rs.length; i++) if (name(rs[i].k) === name(rs[i - 1].k)) gaps.push(rs[i].r.top - rs[i - 1].r.bottom)
          if (gaps.length >= 2) {
            const d = Math.max(...gaps) - Math.min(...gaps)
            if (d > 3) add('gap', el, { d: +d.toFixed(1), gaps: gaps.map((g) => Math.round(g)).slice(0, 8) })
          }
        }
        /* touch · boxed siblings */
        for (let i = 1; i < rs.length; i++) {
          if (!boxed(rs[i].k) || !boxed(rs[i - 1].k)) continue
          const g = rs[i].r.top - rs[i - 1].r.bottom
          if (g < 1 && name(rs[i].k) !== name(rs[i - 1].k)) add('touch', el, { d: Math.round(g), a: name(rs[i - 1].k), b: name(rs[i].k) }, [rs[i - 1].k, rs[i].k])
          else if (g > 1 && !SCALE.some((v) => Math.abs(v - g) <= 1)) add('gapoff', el, { d: Math.round(g), a: name(rs[i - 1].k), b: name(rs[i].k) }, [rs[i - 1].k, rs[i].k])
        }
      }
    }

    /* ── rows of cards · heights ── */
    if (isRow && ks.length >= 2) {
      const cards = ks.filter(boxed).map((k) => k.getBoundingClientRect())
      if (cards.length >= 2 && cards.every((r) => r.height > 60)) {
        const rows = []
        for (const r of cards) { const ln = rows.find((L) => Math.abs(L.t - r.top) < 3); if (ln) ln.rs.push(r); else rows.push({ t: r.top, rs: [r] }) }
        for (const L of rows) {
          if (L.rs.length < 2) continue
          const hs = L.rs.map((r) => r.height); const d = Math.max(...hs) - Math.min(...hs)
          if (d > 3) add('cardh', el, { d: Math.round(d), hs: hs.map(Math.round) })
        }
      }
      /* horizontal gaps among like boxed siblings in one line */
      const hb = ks.filter(boxed).map((k) => ({ k, r: k.getBoundingClientRect() })).sort((a, b) => b.r.right - a.r.right)
      if (hb.length >= 3) {
        const g = []
        for (let i = 1; i < hb.length; i++) if (Math.abs(hb[i].r.top - hb[i - 1].r.top) < 3 && name(hb[i].k) === name(hb[i - 1].k)) g.push(hb[i - 1].r.left - hb[i].r.right)
        if (g.length >= 2 && Math.max(...g) - Math.min(...g) > 3) add('gap', el, { d: Math.round(Math.max(...g) - Math.min(...g)), gaps: g.map(Math.round), dir: 'h' })
      }
    }

    /* ── small boxed element · content on its vertical centre ── */
    const r = el.getBoundingClientRect()
    if (boxed(el) && r.height <= 64 && r.width >= 16) {
      const i = ink(el)
      if (i && i.lines === 1) {
        const bt = parseFloat(s.borderTopWidth), bb = parseFloat(s.borderBottomWidth)
        const top = i.top - (r.top + bt), bot = (r.bottom - bb) - i.bottom
        if (top > -1 && bot > -1 && Math.abs(top - bot) > 3) add('padv', el, { d: +Math.abs(top - bot).toFixed(1), top: Math.round(top), bot: Math.round(bot) })
      }
    }

    /* ── clip · text cut without an ellipsis ── */
    if ((s.overflowX === 'hidden' || s.overflowX === 'clip' || s.overflow === 'hidden') && s.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 2 && ink(el)) {
      const i = ink(el)
      if (i.right > r.right + 1 || i.left < r.left - 1) add('clip', el, { d: el.scrollWidth - el.clientWidth })
    }
    if ((s.overflowY === 'hidden' || s.overflowY === 'clip') && el.scrollHeight > el.clientHeight + 3 && r.height < 120 && !/-webkit-box/.test(s.display)) {
      const i = ink(el)
      if (i && i.bottom > r.bottom + 2) add('clip', el, { d: el.scrollHeight - el.clientHeight, axis: 'y' })
    }

    /* ── spill · text running out of a surface ── */
    if (boxed(el) && r.width > 24 && r.height > 16 && s.overflow === 'visible') {
      const i = ink(el)
      if (i && (i.left < r.left - 2 || i.right > r.right + 2)) add('spill', el, { d: Math.round(Math.max(r.left - i.left, i.right - r.right)) })
    }
  }
  /* ── insets · cards of one kind should hold their content the same way ── */
  const cardsBy = new Map()
  for (const el of all) {
    const r = el.getBoundingClientRect()
    if (!boxed(el) || r.height < 60 || r.width < 120) continue
    const i = ink(el); if (!i) continue
    const k = name(el)
    const a = cardsBy.get(k) ?? []; a.push({ el, top: i.top - r.top, start: r.right - i.right }); cardsBy.set(k, a)
  }
  for (const [k, a] of cardsBy) {
    if (a.length < 2) continue
    for (const dim of ['top', 'start']) {
      const v = a.map((x) => x[dim]); const d = Math.max(...v) - Math.min(...v)
      if (d > 3 && d < 40) {
        const lo = a.find((x) => x[dim] === Math.min(...v)), hi = a.find((x) => x[dim] === Math.max(...v))
        add('inset', hi.el, { d: Math.round(d), dim, vals: [...new Set(v.map(Math.round))].slice(0, 6), vs: txt(lo.el).slice(0, 24) })
      }
    }
  }
  if (!opts || !opts.root) {
    const sw = document.documentElement.scrollWidth - document.documentElement.clientWidth
    if (sw > 1) out.push({ kind: 'hscroll', path: 'html', text: '', rect: { x: 0, y: 0, w: innerWidth, h: 40 }, d: sw })
  }
  return out
}

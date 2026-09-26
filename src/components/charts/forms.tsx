import type { CSSProperties, ReactNode } from 'react'
import { Money } from '@/components/ui'
import { nf, pct } from '@/lib/format'

/* Shapes for the "Today" dashboard.

   Six cards used to share the same shape (a list of horizontal bars), so the eye read the page as
   one long table and no card stated its own question. Now each question has the shape that answers
   it:

     Where do projects stand?      StageFlow   one unit per project along the stage line
     Load on supervisors            Lollipop    a point on a stem + an average line
     Request outcomes               Waffle      part of a whole - one square per request
     Reasons for decline             Pareto      sorted bars + cumulative curve + 80%
     Entity readiness                Meters      "N of total" - one slice per entity
     Top-funded entities             RankBars    ranking + share of committed amount

   **Shared rules (dataviz):**
   - SVG drawn with relative attributes (`x="42%"`), not inline style, and all text is HTML in
   `--t1/t2/t3` ink; color lives on the shape only.
   - Labels sit directly next to the shape, no separate legend except in the waffle.
   - RTL layout: zero on the right, values growing toward the left.
   - Color comes from `c1...c6` (= `--ch-*`); `cw`/`cl` are for state only.
   - Hover: the shape under the cursor stays, the rest dims, and the tooltip states the number that
   isn't written out.
   - Entry plays once per session (`:root[data-fresh]`) from the baseline. */

export type Hue = 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6' | 'cw' | 'cl'

function Tip({ children }: { children: ReactNode }) {
  return <span className="hx-tip" role="tooltip">{children}</span>
}

/* -- 1: Stage line -- */
export interface StageDatum { key: string; label: string; value: number; over: number; tip?: string }

export function StageFlow({ stages }: { stages: StageDatum[] }) {
  /* Units are HTML elements stacked bottom-to-top (`column-reverse`) with the number above the last
   unit, so the direct label sits at the top of the column without computing a height in inline
   style. Rows use `subgrid` so the point on the stage line lines up across all columns even when a
   label wraps to two lines. */
  return (
    <ol className="hx sf">
      {stages.map((s, i) => (
        <li key={s.key} className="hx-i sf-i">
          <span className="sf-stack">
            {Array.from({ length: s.value }, (_, k) => (
              <i key={k} className={`sf-u hx-mk ${k < s.over ? 'cw' : 'c2'}`} aria-hidden="true" />
            ))}
            <b className="sf-v num">{s.value}</b>
          </span>
          <span className="sf-step" aria-hidden="true" />
          <span className="sf-l"><span className="sf-k"><span className="num">{i + 1}</span></span>{s.label}</span>
          <span className="sf-o">{s.over ? <><span className="num">{s.over}</span> فوق الحدّ</> : 'ضمن الحدّ'}</span>
          {s.tip && <Tip>{s.tip}</Tip>}
        </li>
      ))}
    </ol>
  )
}

/* -- 2: Lollipop with a reference line -- */
export interface LolliDatum { key: string; label: string; value: number; note?: string; tip?: string; hue?: Hue }

export function Lollipop({ rows, refValue, refLabel }: { rows: LolliDatum[]; refValue: number; refLabel: string }) {
  const max = Math.max(...rows.map((r) => r.value), refValue, 1)
  /* 4-96% so the dot isn't clipped at either end. */
  const x = (v: number) => `${100 - (4 + (v / max) * 92)}%`
  return (
    <div className="hx lp">
      {rows.map((r) => (
        <div key={r.key} className="hx-i lp-i">
          <span className="lp-l" title={r.label}>{r.label}</span>
          <svg className="lp-m hx-mk" aria-hidden="true">
            <line className="lp-ref" x1={x(refValue)} x2={x(refValue)} y1="0" y2="100%" />
            <line className={`lp-s ${r.hue ?? 'c1'}`} x1="100%" x2={x(r.value)} y1="50%" y2="50%" />
            <circle className={`lp-d ${r.hue ?? 'c1'}`} cx={x(r.value)} cy="50%" r="7" />
          </svg>
          <b className="lp-v num">{r.value}</b>
          {r.note && <span className="lp-n">{r.note}</span>}
          {r.tip && <Tip>{r.tip}</Tip>}
        </div>
      ))}
      <p className="hx-key"><i className="hx-key-ref" aria-hidden="true" />{refLabel}</p>
    </div>
  )
}

/* -- 3: Waffle, one square per unit -- */
export interface Part { key: string; label: string; value: number; hue: Hue }

export function Waffle({ parts }: { parts: Part[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  /* Three rows up to 60 units, then four — the square grows with the card instead of leaving empty
   space beside it, and its height tracks its neighbor (the Pareto chart). */
  const cols = total <= 60 ? Math.ceil(total / 3) : Math.ceil(total / 4)
  const units = parts.flatMap((p, g) => Array.from({ length: p.value }, (_, k) => ({ id: `${p.key}-${k}`, g: g + 1, hue: p.hue })))
  return (
    <div className="hx wf">
      <svg className="wf-g" viewBox={`0 0 ${cols * 10} ${Math.ceil(total / cols) * 10}`} aria-hidden="true">
        {units.map((u, i) => (
          <rect
            key={u.id}
            className={`wf-u ${u.hue}`}
            data-g={u.g}
            x={(cols - 1 - (i % cols)) * 10 + 1}
            y={Math.floor(i / cols) * 10 + 1}
            width="8"
            height="8"
            rx="1.5"
          />
        ))}
      </svg>
      <ul className="wf-k">
        {parts.map((p, g) => (
          <li key={p.key} className="wf-ki" data-g={g + 1}>
            <span className="wf-kl"><i className={`hx-sw ${p.hue}`} aria-hidden="true" />{p.label}</span>
            <span className="wf-kv"><b className="num">{p.value}</b><span className="num">{pct(Math.round((p.value / Math.max(total, 1)) * 100))}</span></span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* -- 4: Pareto -- */
export function Pareto({ rows, hue = 'c5' }: { rows: { key: string; label: string; value: number }[]; hue?: Hue }) {
  const total = rows.reduce((s, r) => s + r.value, 0) || 1
  const max = Math.max(...rows.map((r) => r.value), 1)
  const n = rows.length
  let run = 0
  const cum = rows.map((r) => Math.round(((run += r.value) / total) * 100))
  const cx = (i: number) => 100 - ((i + 0.5) * 100) / n
  const pts = cum.map((c, i) => `${cx(i)},${100 - c}`).join(' ')
  return (
    <div className="hx pa">
      <div className="pa-plot">
        <div className="pa-cols">
          {rows.map((r, i) => (
            /* ⚠️ The only inline style among these shapes — bar height comes from the data, and the number must
   sit right on top of it (direct labeling). */
            <div key={r.key} className="hx-i pa-col" style={{ '--h': r.value / max } as CSSProperties}>
              <b className="pa-v num">{r.value}</b>
              <i className={`pa-bar hx-mk ${hue}`} aria-hidden="true" />
              <Tip>{nf.format(r.value)} من {nf.format(total)} · تراكمي {pct(cum[i])}</Tip>
            </div>
          ))}
        </div>
        <svg className="pa-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line className="pa-ref" x1="0" x2="100" y1="20" y2="20" />
          <polyline className="pa-cum" points={pts} />
          {cum.map((c, i) => <line key={i} className="pa-pt" x1={cx(i)} x2={cx(i)} y1={100 - c} y2={100 - c} />)}
        </svg>
        <span className="pa-refl"><span className="num">{pct(80)}</span></span>
      </div>
      <ol className="pa-l">
        {rows.map((r) => <li key={r.key} title={r.label}>{r.label}</li>)}
      </ol>
      <p className="hx-key"><i className="hx-key-line" aria-hidden="true" />النسبة التراكمية · والخطّ المتقطّع عند {pct(80)}</p>
    </div>
  )
}

/* -- 5: "N of total" counters, one slice per unit -- */
export interface MeterDatum { key: string; label: string; value: number; hue: Hue; tip?: string }

export function Meters({ rows, total, unit }: { rows: MeterDatum[]; total: number; unit: string }) {
  const w = 100 / Math.max(total, 1)
  return (
    <div className="hx mt">
      {rows.map((r) => (
        <div key={r.key} className="hx-i mt-i">
          <span className="mt-l">{r.label}</span>
          <span className="mt-v"><b className="num">{r.value}</b> من <span className="num">{total}</span></span>
          <span className="mt-p num">{pct(Math.round((r.value / Math.max(total, 1)) * 100))}</span>
          <svg className="mt-m hx-mk" aria-hidden="true">
            {Array.from({ length: total }, (_, k) => (
              <rect key={k} className="mt-seg" x={`${100 - (k + 1) * w + w * 0.08}%`} y="0" width={`${w * 0.84}%`} height="100%" rx="2" />
            ))}
            <g className={`mt-on ${r.hue}`}>
              {Array.from({ length: r.value }, (_, k) => (
                <rect key={k} x={`${100 - (k + 1) * w + w * 0.08}%`} y="0" width={`${w * 0.84}%`} height="100%" rx="2" />
              ))}
            </g>
          </svg>
          {r.tip && <Tip>{r.tip}</Tip>}
        </div>
      ))}
      <p className="hx-key">كل شريحة {unit}</p>
    </div>
  )
}

/* -- 6: Ranking with share -- */
export function RankBars({ rows, total, hue = 'c1' }: { rows: { key: string; label: string; value: number }[]; total: number; hue?: Hue }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ol className="hx rk">
      {rows.map((r, i) => {
        const share = Math.round((r.value / Math.max(total, 1)) * 100)
        const w = (r.value / max) * 100
        return (
          <li key={r.key} className="hx-i rk-i">
            <span className="rk-n num">{i + 1}</span>
            <span className="rk-l" title={r.label}>{r.label}</span>
            <svg className="rk-m hx-mk" aria-hidden="true">
              <rect className="rk-t" x="0" y="0" width="100%" height="100%" rx="4" />
              <rect className={`rk-b ${hue}`} x={`${100 - w}%`} y="0" width={`${w}%`} height="100%" rx="4" />
            </svg>
            <span className="rk-v"><Money>{r.value}</Money></span>
            <span className="rk-s num">{pct(share)}</span>
            <Tip>{pct(share)} من الملتزم به كله</Tip>
          </li>
        )
      })}
    </ol>
  )
}

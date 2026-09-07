import type { ReactNode } from 'react'
import { nf } from '@/lib/format'

/* ═══════════════════════════════════════════════════════════
   مجموعة الرسوم

   كلها SVG مكتوب بالإيد — مفيش مكتبة رسوم في المشروع، لأن
   مكتبات الرسوم بتيجي بنظام ألوان وخطوط وحواف خاص بيها، وده
   بيتخانق مع نظام التصميم بدل ما يخدمه. الأشكال هنا بسيطة
   والحسابات صغيرة، فالمكسب من المكتبة ما يستاهلش الكلفة.

   القاعدة اللونية: **اللون يوصف الحالة، مش الكمية.** الأرقام
   بتتكتب بلون النص العادي؛ اللون بيقع على الشريط أو النقطة.
   ═══════════════════════════════════════════════════════════ */

export { SaudiMap, type MapPoint } from './SaudiMap'

export const CHART_COLORS = [
  'var(--ch-1)', 'var(--ch-2)', 'var(--ch-3)',
  'var(--ch-4)', 'var(--ch-5)', 'var(--ch-6)',
] as const

/* ── قائمة أشرطة أفقية ──
   الأنسب لما التسميات نص عربي متفاوت الطول: العين بتقرا التسمية
   على السطر بدل ما تلف الشاشة تسعين درجة. */
export interface BarRow {
  key: string
  label: string
  value: number
  /** لون الشريط — افتراضيًا تدرّج واحد */
  color?: string
  /** نص صغير على يسار القيمة */
  note?: string
  href?: string
}

export function BarList({
  rows,
  format = (v: number) => nf.format(v),
  labelWidth = '9rem',
  onPick,
}: {
  rows: BarRow[]
  format?: (v: number) => string
  labelWidth?: string
  onPick?: (key: string) => void
}) {
  const max = Math.max(...rows.map((r) => r.value), 1)

  return (
    <div className="chbars" style={{ '--lw': labelWidth } as React.CSSProperties}>
      {rows.map((r) => (
        <div
          key={r.key}
          className={`chbar${onPick ? ' pick' : ''}`}
          onClick={onPick ? () => onPick(r.key) : undefined}
          role={onPick ? 'button' : undefined}
          tabIndex={onPick ? 0 : undefined}
          onKeyDown={onPick ? (e) => e.key === 'Enter' && onPick(r.key) : undefined}
        >
          <span className="chbar-l" title={r.label}>{r.label}</span>
          <span className="chbar-t">
            <i
              style={{
                width: `${(r.value / max) * 100}%`,
                background: r.color ?? 'var(--ch-2)',
              }}
            />
          </span>
          <span className="chbar-v num">{format(r.value)}</span>
          {r.note && <span className="chbar-n">{r.note}</span>}
        </div>
      ))}
    </div>
  )
}

/* ── أعمدة رأسية ──
   للمدى المتصل (مدة المكوث) — الترتيب على المحور له معنى هنا،
   عكس التصنيفات الاسمية. */
export interface Column {
  key: string
  label: string
  value: number
  color?: string
}

export function Columns({ cols, unit }: { cols: Column[]; unit?: string }) {
  const max = Math.max(...cols.map((c) => c.value), 1)

  return (
    <div className="chcols">
      {cols.map((c) => (
        <div className="chcol" key={c.key}>
          <span className="chcol-v num">{c.value}</span>
          <span className="chcol-t">
            <i
              style={{
                height: `${Math.max(3, (c.value / max) * 100)}%`,
                background: c.color ?? 'var(--ch-2)',
              }}
            />
          </span>
          <span className="chcol-l">{c.label}</span>
        </div>
      ))}
      {unit && <span className="chcol-u">{unit}</span>}
    </div>
  )
}

/* ── حلقة ──
   للنِّسب من كل: الحلقة بتقول «من إجمالي» من غير محور، والرقم
   في النص بيمنع القارئ من تقدير الزوايا بعينه. */
export interface Slice {
  key: string
  label: string
  value: number
  color: string
}

export function Donut({
  slices,
  total,
  centerValue,
  centerLabel,
  size = 148,
}: {
  slices: Slice[]
  total?: number
  centerValue: ReactNode
  centerLabel: string
  size?: number
}) {
  const sum = total ?? slices.reduce((s, x) => s + x.value, 0)
  const r = 54
  const c = 2 * Math.PI * r
  const gap = slices.length > 1 ? 1.6 : 0
  let offset = 0

  return (
    <div className="chdonut">
      <svg viewBox="0 0 128 128" width={size} height={size} role="img" aria-hidden="true">
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(20,69,71,.08)" strokeWidth="15" />
        {slices.map((s) => {
          const frac = sum > 0 ? s.value / sum : 0
          const len = Math.max(0, frac * c - gap)
          const dash = `${len} ${c - len}`
          const rot = (offset / c) * 360 - 90
          offset += frac * c
          return (
            <circle
              key={s.key}
              cx="64"
              cy="64"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="15"
              strokeDasharray={dash}
              strokeLinecap="butt"
              transform={`rotate(${rot} 64 64)`}
              style={{ transition: 'stroke-dasharray .5s ease' }}
            />
          )
        })}
      </svg>

      <div className="chdonut-c">
        <b className="num">{centerValue}</b>
        <span>{centerLabel}</span>
      </div>
    </div>
  )
}

/* ── شريط مركّب ──
   لتركيبة مبلغ واحد: طبقات على مسطرة واحدة أوضح من عدة دواير. */
export function StackBar({ parts, total }: { parts: Slice[]; total: number }) {
  return (
    <div className="chstack">
      <div className="chstack-t">
        {parts.map((p) => (
          <i
            key={p.key}
            style={{ width: `${total > 0 ? (p.value / total) * 100 : 0}%`, background: p.color }}
            title={`${p.label}: ${nf.format(p.value)}`}
          />
        ))}
      </div>
    </div>
  )
}

/** وسيلة إيضاح — نقطة ولون واسم وقيمة */
export function Legend({
  items,
  format = (v: number) => nf.format(v),
}: {
  items: Slice[]
  format?: (v: number) => string
}) {
  return (
    <dl className="chleg">
      {items.map((i) => (
        <div key={i.key}>
          <dt><span className="chdot" style={{ background: i.color }} />{i.label}</dt>
          <dd className="num">{format(i.value)}</dd>
        </div>
      ))}
    </dl>
  )
}

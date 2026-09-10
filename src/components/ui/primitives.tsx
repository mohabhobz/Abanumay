import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import { nf } from '@/lib/format'
import type { Tone } from '@/types/domain'

/* ═══════════════ أسطح ═══════════════ */

export type GlassProps = HTMLAttributes<HTMLDivElement>

/** السطح الأساسي: زجاج بحافة شعرية، بلا حدود مرسومة */
export const Glass = forwardRef<HTMLDivElement, GlassProps>(function Glass(
  { children, className = '', ...rest },
  ref,
) {
  return (
    <div className={`glass ${className}`} ref={ref} {...rest}>
      {children}
    </div>
  )
})

export function Head({ title, meta }: { title: ReactNode; meta?: ReactNode }) {
  return (
    <div className="hd">
      <h3>{title}</h3>
      {meta && <span className="meta">{meta}</span>}
    </div>
  )
}

/* ═══════════════ نصوص وأرقام ═══════════════ */

export function Tag({ tone = '', children }: { tone?: Tone | ''; children: ReactNode }) {
  return <span className={`tag ${tone}`}>{children}</span>
}

export function Num({ children }: { children: number | string }) {
  return <span className="num">{typeof children === 'number' ? nf.format(children) : children}</span>
}

/** رمز الريال السعودي U+20C1، من الخط الرسمي المرفق */
export function Riyal({ style }: { style?: CSSProperties }) {
  return (
    <span className="rs" style={style} role="img" aria-label="ريال سعودي">
      {'\u20C1'}
    </span>
  )
}

/**
 * مبلغ بالريال — **الشكل الوحيد لأي مبلغ في السيستم**.
 *
 * الرمز في العربي بييجي **على شمال الرقم**، وده كان بيتكسر في نص
 * الأماكن لسبب واحد: الحاوية كانت `.num`، و`.num` فيها
 * `direction:ltr` عشان الأرقام تتقري صح. فالرقم والرمز الاتنين بقوا
 * جوّه مجرى إنجليزي، والرمز راح على اليمين.
 *
 * الحل إن العزل ينزل خطوة: `.num` على **الأرقام وحدها**، والحاوية
 * تفضل عربية — فترتيب العنصرين في الـDOM (رقم ثم رمز) بيطلع على
 * الشاشة رقمًا على اليمين ورمزًا على الشمال. ومن غير مكوّن واحد،
 * الغلطة دي بترجع كل مرة حد يكتب مبلغًا جديدًا.
 */
export function Money({ children, sm }: { children: number | string; sm?: boolean }) {
  const digits = typeof children === 'number' ? nf.format(children) : children
  return (
    <span className="amt">
      <span className="num">{digits}</span>
      {sm ? <small><Riyal /></small> : <Riyal />}
    </span>
  )
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="mono">{children}</span>
}

/* ═══════════════ عرض الحقول ═══════════════ */

export interface KVRow {
  k: ReactNode
  v: ReactNode
}

export function KV({ rows }: { rows: KVRow[] }) {
  return (
    <dl className="kv">
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{r.k}</dt>
          <dd>{r.v}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ═══════════════ تنقّل داخل الصفحة ═══════════════ */

export interface TabItem {
  slug: string
  label: string
}

export function Tabs({
  items,
  active,
  onChange,
}: {
  items: readonly TabItem[]
  active: string
  onChange: (slug: string) => void
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((t) => (
        <button
          key={t.slug}
          role="tab"
          aria-selected={t.slug === active}
          className={`tab ${t.slug === active ? 'on' : ''}`}
          onClick={() => onChange(t.slug)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/* ═══════════════ سجل زمني ═══════════════ */

const DOT: Record<string, string> = {
  teal: 'var(--teal)',
  lime: 'var(--lime)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  ret: 'var(--ret)',
  no: 'var(--no)',
  mute: 'rgba(var(--edgeC),.4)',
}

export interface TimelineEvent {
  title: ReactNode
  by?: ReactNode
  foot?: ReactNode
  footTone?: string
  tone?: Tone
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="tl">
      {events.map((e, i) => (
        <div className="ev" key={i}>
          <span className="dt" style={{ background: DOT[e.tone ?? 'mute'] ?? DOT.mute }} />
          <div>
            <div className="tx">{e.title}</div>
            {e.by && <div className="by">{e.by}</div>}
            {e.foot && (
              <div className="sub" style={{ marginTop: '.35rem', color: e.footTone }}>
                {e.foot}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════ حالات فارغة وإحصاءات ═══════════════ */

export function Empty({
  title,
  note,
  actions,
}: {
  title: ReactNode
  note?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="well empty">
      <div className="t">{title}</div>
      {note && <div className="sub" style={{ marginTop: '.3rem' }}>{note}</div>}
      {actions && <div className="emptyact">{actions}</div>}
    </div>
  )
}

export interface StatBar {
  w: string
  c: string
}

export function Stat({
  label,
  value,
  unit,
  note,
  bar,
}: {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  note?: ReactNode
  bar?: StatBar
}) {
  return (
    <div className="glass stat">
      <div className="lb">{label}</div>
      <div className="v">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {bar && (
        <div className="bar">
          <i style={{ width: bar.w, background: bar.c }} />
        </div>
      )}
      {note && (
        <div
          className="sub trim1"
          style={{ marginTop: bar ? '.4rem' : '.6rem' }}
          title={typeof note === 'string' ? note : undefined}
        >
          {note}
        </div>
      )}
    </div>
  )
}

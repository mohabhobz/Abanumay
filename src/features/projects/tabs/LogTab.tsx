import { useMemo, useState } from 'react'
import { Button, DateText, Empty, Glass, Head, Icon, Mono, OrgName, Person, SearchBox, Select, icons } from '@/components/ui'
import { DocFile } from '@/components/docs'
import type { ActorKind, LogEvent } from '@/data/mock/log'
import { HOLDER_LABEL } from '@/data/holders'
import { person } from '@/data/people'

export interface LogTabProps {
  events: LogEvent[]
  entityName: string
  /** The entity's logo beside its name in the log */
  entityLogo?: string
}

/**
 * Log categories · every event belongs to exactly one, so the tab counts always add up to the
 * total. Each category owns a chart color, drawn as the timeline dot and as a swatch in its tab,
 * so the mapping reads without a legend. Order of the checks below decides ties.
 */
type Cat = 'decision' | 'money' | 'entity' | 'followUp' | 'activity' | 'procedure'

const CATS: { key: Cat; label: string }[] = [
  { key: 'decision', label: 'القرارات' },
  { key: 'money', label: 'المال' },
  { key: 'entity', label: 'من الجهة' },
  { key: 'followUp', label: 'المتابعات' },
  { key: 'activity', label: 'فعاليات' },
  { key: 'procedure', label: 'أخرى' },
]

const MONEY = /إذن صرف|صرف الدفعة|سند القبض|سند القيد/
const DECISION = /اعتماد|دعم|رفض|معتذر|توصية|إرجاع|رفع المشروع|قبول/

const catOf = (e: LogEvent): Cat => {
  if (e.manual) return 'activity'
  if (e.followUp) return 'followUp'
  if (e.actor === 'entity') return 'entity'
  if (MONEY.test(e.action)) return 'money'
  if (DECISION.test(e.action)) return 'decision'
  return 'procedure'
}

type Order = 'newest' | 'oldest'

/**
 * Count of fields that actually have a value — an empty "notes" field
 * doesn't count.
 */
const fieldCount = (e: LogEvent) => e.fields.filter((f) => f.v).length

const ACTOR: Record<ActorKind, string> = {
  staff: 'موظف',
  entity: 'الجهة',
  committee: 'قرار جماعي',
  system: 'النظام',
}

/* Client sheet 24 Oct (#94) · the level an action was taken at, beside the name, instead of «موظف» ·
   a live event records its seat as its department (مشرف المنح · مدير المنح · المدير التنفيذي ·
   اللجنة التنفيذية · مجلس الأمناء), a seeded one is read from the person's title, and the study's own
   department is the supervisor's · «موظف» stays only for a name with no known level */
const SEATS = new Set<string>(Object.values(HOLDER_LABEL))
const DEPT_SEAT: Record<string, string> = { 'دراسة المشروع': HOLDER_LABEL.supervisor, 'اعتماد دراسة المشروع': HOLDER_LABEL.manager }
const levelOf = (e: LogEvent): string => {
  if (e.actor === 'committee') return SEATS.has(e.dept) ? e.dept : /مجلس الأمناء/.test(e.by) ? HOLDER_LABEL.board : /اللجنة التنفيذية/.test(e.by) ? HOLDER_LABEL.committee : ACTOR.committee
  if (e.actor !== 'staff') return ACTOR[e.actor]
  if (SEATS.has(e.dept)) return e.dept
  return person(e.by).title ?? DEPT_SEAT[e.dept] ?? ACTOR.staff
}

/**
 * Project log.
 *
 * Each entry is typed: every action type has its own fields. "Project
 * study" has fourteen fields including the researcher's full
 * recommendation, while "recommendation" has a single, empty field. So the
 * row shows a header, and detail opens on click — so a log of twenty-six
 * entries stays scannable at a glance.
 *
 * There are four actor types (staff · entity · collective body · system),
 * and they're visually distinguished: an entry made by the entity doesn't
 * look like one made by staff, which makes "who's waiting on whom" readable
 * without reading. Follow-ups sit in the same timeline because the system
 * places them there — a follow-up that says "second payment requirement" is
 * the reason for the disbursement authorization that comes after it.
 */
export function LogTab({ events, entityName, entityLogo }: LogTabProps) {
  const [view, setView] = useState<Cat | 'all'>('all')
  const [order, setOrder] = useState<Order>('newest')
  const [open, setOpen] = useState<Set<string>>(new Set())
  /* 3.4.32 · search inside the events: the action, who did it, the department and every field */
  const [q, setQ] = useState('')

  /* Events arrive newest first; the oldest-first order is the same list reversed, so events
     sharing a day keep their workflow order in both directions. */
  const tagged = useMemo(() => events.map((e) => ({ e, c: catOf(e) })), [events])
  const scoped = useMemo(() => {
    const n = q.trim()
    if (!n) return tagged
    return tagged.filter(({ e }) =>
      [e.action, e.by, e.dept, e.followUp ?? '', e.source ?? '', ...e.fields.map((f) => `${f.k} ${f.v}`), ...(e.files ?? [])]
        .some((t) => t.includes(n)))
  }, [tagged, q])

  const counts = useMemo(() => {
    const out = Object.fromEntries(CATS.map((c) => [c.key, 0])) as Record<Cat, number>
    for (const x of scoped) out[x.c] += 1
    return out
  }, [scoped])

  const shown = useMemo(() => {
    const rows = view === 'all' ? scoped : scoped.filter((x) => x.c === view)
    return order === 'newest' ? rows : [...rows].reverse()
  }, [scoped, view, order])

  const tabs: { key: Cat | 'all'; label: string; count: number }[] = [
    { key: 'all', label: 'كل الأحداث', count: scoped.length },
    ...CATS.map((c) => ({ key: c.key, label: c.label, count: counts[c.key] })),
  ]

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <Glass>
      {/* One order control, where the header used to restate the order as text. */}
      <Head
        title="سجل المشروع"
        meta={
          <Select
            icon={icons.sort}
            value={order === 'oldest' ? 'oldest' : undefined}
            all="الأحدث أولًا"
            options={[{ value: 'oldest', label: 'الأقدم أولًا' }]}
            onChange={(x) => setOrder(x === 'oldest' ? 'oldest' : 'newest')}
          />
        }
      />

      <div className="lgsearch">
        <SearchBox value={q} onChange={setQ} placeholder="ابحث في الأحداث: إجراء، منفّذ، قسم، أو قيمة حقل…" />
      </div>

      {/* Category tabs · the same markup as `Tabs`, plus the category swatch, which `Tabs` has no
          slot for. The swatch is the shape that carries the color; the label stays neutral text. */}
      <div className="tabs lgtabs" role="tablist" aria-label="تصنيف الأحداث">
        {tabs.map((t) => (
          <Button plain
            key={t.key}
            role="tab"
            aria-selected={t.key === view}
            className={`tab ${t.key === view ? 'on' : ''}`}
            onClick={() => setView(t.key)}
          >
            {t.key !== 'all' && <span className={`lgsw c-${t.key}`} aria-hidden="true" />}
            <span>{t.label}</span>
            <b className="num">{t.count}</b>
          </Button>
        ))}
      </div>


      {shown.length === 0 ? (
        <div style={{ marginTop: 'var(--sp-5)' }}>
          <Empty title={q.trim() ? `لا أحداث تطابق «${q.trim()}».` : 'لا توجد أحداث بهذا التصنيف.'} />
        </div>
      ) : (
        <ol className="lg">
          {shown.map(({ e, c }) => {
            const late = e.limit > 0 && e.hours > e.limit
            const isOpen = open.has(e.id)
            const has = e.fields.some((f) => f.v) || Boolean(e.files?.length)

            return (
              <li className={`lgi a-${e.actor}${e.followUp ? ' fu' : ''}`} key={e.id} id={`ev-${e.id}`}>
                <span className={`lgdot lgc c-${c}`} aria-hidden="true" />

                <div className="lgmain">
                  <div className="lghead">
                    {e.followUp ? (
                      <span className="itag">{e.followUp}</span>
                    ) : (
                      <b className="lgact">{e.action}</b>
                    )}
                    <span className="lgdept">{e.followUp ? 'متابعة' : e.dept}</span>
                    <span className="lgcat sub">
                      <span className={`lgsw c-${c}`} aria-hidden="true" />
                      {CATS.find((x) => x.key === c)?.label}
                    </span>
                    <span className="pc-sp" />
                    <DateText>{e.at}</DateText>
                    <span className="lgtime sub">{e.time}</span>
                  </div>

                  {e.followUp && <div className="lgbody">{e.action}</div>}

                  <div className="lgby">
                    {/* Client 24 Oct · the actor with its face or its entity's mark, 32 */}
                    <span className={`lgwho k-${e.actor}`}>
                      {e.actor === 'entity' ? <OrgName name={entityName} logo={entityLogo} /> : e.actor === 'staff' ? <Person name={e.by} size="md" quiet={false} /> : e.by}
                    </span>
                    <span className="lgkind sub">{e.manual ? 'إدخال يدوي' : levelOf(e)}</span>
                    {e.source && <span className="lgsrc sub">المصدر: {e.source}</span>}
                    {!e.followUp && !e.manual && (
                      <span className={`lgdur${late ? ' late' : ''}`}>
                        <Mono>{e.days}</Mono> يومًا ·{' '}
                        <Mono>{e.hours}</Mono> من <Mono>{e.limit}</Mono> ساعة
                      </span>
                    )}
                  </div>

                  {has && (
                    <>
                      <Button plain className="lgmore" onClick={() => toggle(e.id)} aria-expanded={isOpen}>
                        <Icon name={isOpen ? icons.chevronUp : icons.chevronDown} size="sm" />
                        {isOpen
                          ? 'إخفاء التفاصيل'
                          : fieldCount(e) > 0
                            ? `تفاصيل الإجراء · ${fieldCount(e)} حقل`
                            : `المرفقات · ${e.files?.length ?? 0}`}
                      </Button>

                      {isOpen && (
                        <div className="lgfields">
                          {e.fields
                            .filter((f) => f.v)
                            .map((f) => (
                              <div className={`lgf${f.strong ? ' s' : ''}`} key={f.k}>
                                <span className="lgf-k">{f.k}</span>
                                <span className="lgf-v">{f.v}</span>
                              </div>
                            ))}
                          {e.files?.map((n) => (
                            <div className="lgf" key={n}>
                              <span className="lgf-k">مرفق</span>
                              <span className="lgf-v"><DocFile name={n} /></span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}

    </Glass>
  )
}

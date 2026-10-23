import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DateText, Glass, Head, KV, Mono, Num, Riyal, Stat, Tag, Timeline } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { DocList } from '@/components/docs'
import { addDays, costPerBeneficiary, countOf, isolate, nf, NOUN, nounAfter, pct, readDate, units } from '@/lib/format'
import type { Project, ProjectType } from '@/types/domain'
import type { LogEvent } from '@/data/mock/log'
import type { ChainLink } from '@/data/mock/chain'

export interface DataTabProps {
  project: Project
  /** Display code · the same `PRJ-YYYY-NNNNN` the projects list shows */
  code: string
  /** Regular, external, or portfolio */
  type: ProjectType | string
  entityName: string
  /** Entity ID — needed for a real link to its file. */
  entityId: string
  /** Most recent log entry — shown under the summary. */
  last?: LogEvent
  onOpenLog: () => void
  /**
   * Dependencies.
   *
   * This card isn't an error message, it's an inventory. The chain year →
   * budget → project → agreement and payments blocks deletion from the top
   * down, and that rule used to be enforced only on the first two links.
   * There's no delete button here at all, so the card states what's still
   * pending on this project — which surfaces the reason before anyone tries,
   * while also showing the chain.
   */
  deps?: { agreements: number; payments: number }
  /** Chain links — computed on the page and displayed here. */
  chain?: ChainLink[]
  /** The request's own documents card replaces the flat list (procedure 3 · 3.4.32) */
  hideAttachments?: boolean
  /** v3 · 2.4.10 · 2.4.11 · the action that moves the project to another entity, and its history */
  entityAction?: ReactNode
  entityHistory?: ReactNode
}

/** Project data — summary, concept, phases, scope, and attachments. */
export function DataTab({
  project: P, type, entityName, entityId, last, onOpenLog, hideAttachments, entityAction, entityHistory,
}: DataTabProps) {
  const perBeneficiary = costPerBeneficiary(P.amountRequested, P.beneficiaries)
  const uploaded = P.attachments.filter((a) => a.uploaded).length

  return (
    <>
      {/* Meeting 20 Oct · the figures lead the data tab */}
      <div className="stats4">
        <Stat
          label="المبلغ المطلوب"
          value={<Num>{P.amountRequested}</Num>}
          unit={<Riyal />}
          bar={{ w: '100%', c: 'var(--teal)' }}
          note={`${pct(100)} من إجمالي المشروع`}
        />
        <Stat
          label="مدة التنفيذ"
          value={P.durationDays}
          unit="يومًا"
          note={`≈ ${units.month(Math.round(P.durationDays / 30))} · تُحسب من بداية التنفيذ (الفعلية إن سُجّلت)`}
        />
        <Stat
          label="المستفيدون"
          value={nf.format(P.beneficiaries)}
          note="تقدير الجهة، ولم يراجعه المشرف بعد"
        />
        <Stat
          label="تكلفة المستفيد"
          value={<Num>{perBeneficiary}</Num>}
          unit={<Riyal />}
          note="محسوبة، لمقارنة المشاريع"
        />
      </div>

      <Glass>
        <Head title="التعريف" />
        <KV
          rows={[
            /* Two mistakes in one line.

               1. It used to link to the "Entity" tab inside the project — which is a
               summary of the entity, not its full file. The full file was needed, and
               the entity's own tabs (documents, accounts, its log) don't exist in that
               summary at all.

               2. `<a onClick>` with no `href` isn't a link: it doesn't open in a new tab,
               can't be copied, and can't be reached by keyboard — it looks like a link
               but behaves like a button. */
            {
              k: 'الجهة',
              v: <span className="rowf gp-2"><Link className="tlink" to={ROUTES.entity(entityId)}>{entityName}</Link>{entityAction}</span>,
            },
            ...(entityHistory ? [{ k: 'تعديلات الجهة', v: entityHistory }] : []),
            /* Meeting 20 Oct · the code moved to the page header */
            { k: 'نوع المشروع', v: type },
            { k: 'الحالة', v: <Tag tone={P.status.tone}>{P.status.label}</Tag> },
            { k: 'المسار', v: P.track },
            { k: 'المجال', v: P.field },
            { k: 'الهدف', v: P.goal },
            ...(P.originalChoice ? [{ k: 'اختيار الجهة الأصلي', v: <span className="sub">{P.originalChoice} · قبل التحويل</span> }] : []),
            /* The two dates sit side by side: "330 days" alone doesn't say when it ends,
               and the end date is what determines whether the project crosses the
               fiscal year. The agreement's duration starts from the first payment
               disbursed. */
            { k: 'تاريخ بدء التنفيذ المتوقع', v: readDate(P.startDate) },
            {
              k: 'الانتهاء المتوقع',
              v: (
                <>
                  {readDate(P.endDate ?? addDays(P.startDate, P.durationDays))}
                  <span className="sub"> · بعد <span className="num">{nf.format(P.durationDays)}</span> {nounAfter(P.durationDays, NOUN.day)}</span>
                </>
              ),
            },
            {
              k: 'الوسوم',
              v: P.tags.length ? P.tags.join('، ') : <span className="sub">لا يوجد</span>,
            },
          ]}
        />

        {/* Last action sits right under the summary — it used to be a card in the
            side column, which was far from the question it follows: "what is this
            project, and what last happened on it." Both now live in the same card. */}
        {last && (
          <div className="lastact">
            <div className="lastact-h">
              <span className="lb">آخر إجراء</span>
              <span className="pc-sp" />
              <button className="lnk" onClick={onOpenLog}>السجل كاملًا</button>
            </div>
            <div className="lastact-b">
              <b>{last.action}</b>
              <span className="lastact-d">{last.dept}</span>
            </div>
            <div className="sub mt-1">
              {last.by} · <DateText>{last.at}</DateText>
              {' · '}
              <span className={last.hours > last.limit ? 'bad' : undefined}>
                <Num>{last.days}</Num> {nounAfter(last.days, NOUN.day)} · <Num>{last.hours}</Num> من <Num>{last.limit}</Num> ساعة
              </span>
            </div>
          </div>
        )}
      </Glass>


      <Glass>
        <Head title="فكرة المشروع" meta="من نموذج التقديم" />
        <p className="prose">{isolate(P.idea)}</p>

        <div className="well" style={{ padding: 'var(--sp-5) 0 0', marginTop: 'var(--sp-5)' }}>
          <div className="lb">الهدف العام</div>
          <div className="prose mt-1">{isolate(P.mainGoal)}</div>
        </div>

        <BulletSection title="الأهداف التفصيلية" items={P.goals} />
        <BulletSection title={P.entityOutputs ? 'مخرجات المؤسسة' : 'المخرجات'} items={P.outputs} />
        {/* v3 · 0.def.14 · 3.4.45 · the entity's outputs stay readable as the reference of what it sent */}
        {P.entityOutputs && <BulletSection title="مخرجات الجهة كما قدّمتها" items={P.entityOutputs} />}
        <BulletSection title="المسوغات" items={P.rationale} />
      </Glass>

      {/* Re-audit 17 Oct · a project without stages (the simplified external form) shows none */}
      {P.phases.length > 0 && <Glass>
        <Head title="مراحل التنفيذ" meta={`${countOf(P.phases.length, NOUN.phase)} · 11 شهرًا`} />
        <Timeline
          events={P.phases.map((ph) => ({
            tone: ph.tone,
            title: <><b>{ph.name}</b>، {ph.tasks}</>,
            by: isolate(ph.months),
          }))}
        />
        <div className="sub mt-4">
          في النظام الحالي هذه المراحل نصٌّ حر داخل حقل واحد. وهنا كيان له بنود وتواريخ، ويمكن
          ربط دفعات الصرف به.
        </div>
      </Glass>}

      <Glass>
        <Head title="النطاق والأثر" meta="مطابقة لنموذج التقديم" />
        <KV
          rows={[
            { k: 'المنطقة والمدينة', v: `${P.region} · ${P.city}` },
            {
              k: 'عدد المستفيدين',
              v: (
                <>
                  <Num>{P.beneficiaries}</Num>{' '}
                  <span className="sub">
                    (الفعلي من المشرف: <Num>{P.beneficiariesVerified}</Num>)
                  </span>
                </>
              ),
            },
            {
              k: 'الفئة المستهدفة',
              v: (
                <div className="chips gp-1">
                  {P.audiences.map((a) => (
                    <span
                      className="chip"
                      key={a}
                      style={{ fontSize: 'var(--fs-1)', padding: 'var(--sp-2) var(--sp-4)' }}
                    >
                      {a}
                    </span>
                  ))}
                </div>
              ),
            },
          ]}
        />

        <div className="hd" style={{ marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-3)' }}>
          <h3 style={{ fontSize: 'var(--fs-3)' }}>الامتثال</h3>
          <span className="meta">3 إقرارات</span>
        </div>
        <div className="g3 gp-2">
          {P.compliance.map((c) => (
            <div className="well" key={c.k} style={{ padding: 'var(--sp-4) 0 0' }}>
              <div className="lb">{c.k}</div>
              <div
                style={{
                  fontSize: 'var(--fs-3)',
                  fontFamily: 'var(--fd)',
                  fontWeight: 600,
                  marginTop: 'var(--sp-2)',
                }}
              >
                {c.v}
              </div>
            </div>
          ))}
        </div>
      </Glass>

      {!hideAttachments && <Glass>
        <Head title="المرفقات" meta={`${uploaded} من ${P.attachments.length} مرفوعة`} />
        <DocList
          label="مرفقات المشروع وحالتها"
          rows={P.attachments.map((a) => ({
            name: a.name, uploaded: a.uploaded, required: a.required,
          }))}
        />
        <div className="sub mt-3">
          الموازنة التفصيلية هي المطلوبة في طلب الاستكمال الحالي، لأن الملف المرفوع صورة لا تُقرأ آليًا.
        </div>
      </Glass>}

      <Glass>
        <Head title="جهة الاتصال والحساب البنكي" meta="من نموذج التقديم" />
        <KV
          rows={[
            { k: 'مدير المشروع', v: P.manager.name },
            { k: 'الجوال', v: <Mono>{P.manager.phone}</Mono> },
            { k: 'البريد', v: <Mono>{P.manager.email}</Mono> },
            { k: 'المصرف', v: P.bank.name },
            { k: 'اسم الحساب', v: P.bank.account },
            { k: 'الآيبان', v: <Mono>{P.bank.iban}</Mono> },
            { k: 'حالة الحساب', v: <Tag tone="ok">{P.bank.status}</Tag> },
          ]}
        />
        <div className="sub mt-3">
          البيانات البنكية مصدرها ملف الجهة، معروضة هنا للمراجعة فقط ولا تُحرَّر من المشروع.
        </div>
      </Glass>
      {/* Meeting 20 Oct · the chain card is gone · the tabs reach the same records */}
    </>
  )
}

/**
 * A list of items with a title and counter — repeated three times in the
 * same card.
 */
function BulletSection({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <>
      <div className="hd" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-4)' }}>
        <h3 style={{ fontSize: 'var(--fs-3)' }}>{title}</h3>
        <span className="meta">{items.length}</span>
      </div>
      {/* `flush`: rows are separated by a hairline, and the gap between them makes
          the space above a line half of the space below it, so it reads as
          attached to its own line. */}
      <div className="col-s flush">
        {items.map((item, i) => (
          <div className="data" key={i}>
            <div className="prose">{isolate(item)}</div>
          </div>
        ))}
      </div>
    </>
  )
}

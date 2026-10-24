import { Glass, Head, KV, Mono, Num, Riyal, Stat, Timeline } from '@/components/ui'
import { addDays, costPerBeneficiary, countOf, isolate, nf, NOUN, nounAfter, readDate, units } from '@/lib/format'
import type { Project, ProjectType } from '@/types/domain'

export interface DataTabProps {
  project: Project
  /** Display code · the same `PRJ-YYYY-NNNNN` the projects list shows */
  code: string
  /** Regular, external, or portfolio */
  type: ProjectType | string
}

/** Project data — the basics: summary, concept, phases and scope. */
export function DataTab({
  project: P, type,
}: DataTabProps) {
  const perBeneficiary = costPerBeneficiary(P.amountRequested, P.beneficiaries)

  return (
    <>
      {/* Meeting 20 Oct · the figures lead the data tab · client 24 Oct · the requested amount reads in
          the page header, so the tab doesn't repeat it */}
      <div className="stats4 n3">
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
            /* Client 24 Oct · what another tab shows isn't repeated here · the entity (and moving the
               project to another one) lives in «الجهة», the status beside the title, the log in its tab */
            /* Meeting 20 Oct · the code moved to the page header */
            { k: 'نوع المشروع', v: type },
            { k: 'المسار', v: P.track },
            { k: 'المجال', v: P.field },
            { k: 'الهدف', v: P.goal },
            /* Client 23 Oct · the contact card left the tab · the project manager stays, one line */
            { k: 'مدير المشروع', v: <span>{P.manager.name} · <Mono>{P.manager.phone}</Mono></span> },
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

      </Glass>


      <Glass>
        <Head title="فكرة المشروع" meta="من نموذج التقديم" />
        <p className="prose">{isolate(P.idea)}</p>

        <div className="well" style={{ padding: 'var(--sp-5) 0 0', marginTop: 'var(--sp-5)' }}>
          <div className="lb">الهدف العام</div>
          <div className="prose mt-1">{isolate(P.mainGoal)}</div>
        </div>

        <BulletSection title="الأهداف التفصيلية" items={P.goals} />
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

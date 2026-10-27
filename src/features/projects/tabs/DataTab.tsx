import { useState } from 'react'
import { StatRow, EditButton, EditModal, Glass, Head, KV, Mono, Num, Person, Riyal, Stat, Timeline, type EditField } from '@/components/ui'
import { REGIONS } from '@/data/mock/taxonomy'
import { citiesOf } from '@/data/mock/registration'
import { TARGET_GROUPS } from '@/data/mock/settings'
import { editProject } from '@/data/projects/edits'
import { addDays, costPerBeneficiary, countOf, isolate, nf, NOUN, nounAfter, pct, readDate } from '@/lib/format'
import type { Project, ProjectType } from '@/types/domain'

export interface DataTabProps {
  project: Project
  /** Display code · the same `PRJ-YYYY-NNNNN` the projects list shows */
  code: string
  /** Regular, external, or portfolio */
  type: ProjectType | string
  /** Client sheet 24 Oct (#96) · «نسبة اكتمال المشروع» from its plan · absent without a plan */
  completion?: { pct: number; accepted: number; total: number; exec: number | null }
  /** Client 24 Oct · who edits the project's data · each section's «تعديل» saves under this name */
  editBy?: string
}

type Section = 'def' | 'idea' | 'scope'

/** Project data — the basics: summary, concept, phases and scope. */
export function DataTab({
  project: P, type, completion, editBy,
}: DataTabProps) {
  const perBeneficiary = costPerBeneficiary(P.amountRequested, P.beneficiaries)
  /* Client 24 Oct · each section of the data carries its «تعديل» · the popup holds the section's
     fields, filled · the idea and its goals are editable too · saved to the project's log */
  const [editing, setEditing] = useState<Section | null>(null)
  const edit = (s: Section) => (editBy ? <EditButton onClick={() => setEditing(s)} /> : null)
  const fieldsOf = (s: Section): EditField[] => {
    if (s === 'def') return [
      { key: 'managerName', label: 'اسم مدير المشروع', value: P.manager.name },
      { key: 'managerPhone', label: 'جوال مدير المشروع', kind: 'tel', value: P.manager.phone },
      { key: 'startAt', label: 'تاريخ بدء التنفيذ المتوقع', kind: 'date', value: P.startDate },
      { key: 'endAt', label: 'الانتهاء المتوقع', kind: 'date', value: P.endDate ?? addDays(P.startDate, P.durationDays) },
      { key: 'tags', label: 'الوسوم', kind: 'lines', value: P.tags, hint: 'وسم في كل سطر' },
    ]
    if (s === 'idea') return [
      { key: 'idea', label: 'فكرة المشروع', kind: 'textarea', value: P.idea, required: true },
      { key: 'mainGoal', label: 'الهدف العام', kind: 'textarea', value: P.mainGoal },
      { key: 'goals', label: 'الأهداف التفصيلية', kind: 'lines', value: P.goals },
      { key: 'rationale', label: 'المسوغات', kind: 'lines', value: P.rationale },
    ]
    return [
      { key: 'region', label: 'المنطقة', kind: 'select', options: REGIONS, value: P.region, required: true },
      { key: 'city', label: 'المدينة', kind: 'select', dependsOn: { key: 'region', options: citiesOf }, value: P.city, required: true },
      { key: 'beneficiaries', label: 'عدد المستفيدين', kind: 'number', value: String(P.beneficiaries), required: true },
      { key: 'audiences', label: 'الفئة المستهدفة', kind: 'multi', options: TARGET_GROUPS, value: P.audiences },
    ]
  }
  const TITLE: Record<Section, string> = { def: 'تعديل التعريف', idea: 'تعديل فكرة المشروع', scope: 'تعديل النطاق والأثر' }

  return (
    <>
      {/* Meeting 20 Oct · the figures lead the data tab · client 24 Oct · the requested amount reads in
          the page header, so the tab doesn't repeat it */}
      <StatRow title="أرقام المشروع" three={!completion}>
        {completion && (
          <Stat
            label="نسبة اكتمال المشروع"
            value={<Num>{pct(completion.pct)}</Num>}
            bar={{ w: `${Math.min(100, completion.pct)}%`, c: 'var(--teal)' }}
            note={<>{nf.format(completion.accepted)} من {nf.format(completion.total)} مقبولة{completion.exec !== null && <> · التنفيذ {pct(completion.exec)}</>}</>}
          />
        )}
        <Stat
          label="مدة التنفيذ"
          value={P.durationDays}
          unit="يومًا"
        />
        <Stat
          label="المستفيدون"
          value={nf.format(P.beneficiaries)}
        />
        <Stat
          label="تكلفة المستفيد"
          value={<Num>{perBeneficiary}</Num>}
          unit={<Riyal />}
        />
      </StatRow>

      <Glass>
        <Head title="التعريف" meta={edit('def')} />
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
            { k: 'مدير المشروع', v: <span className="kvpair"><Person name={P.manager.name} size="md" quiet={false} /><Mono>{P.manager.phone}</Mono></span> },
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
        <Head title="فكرة المشروع" meta={edit('idea')} />
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
        <Head title="مراحل التنفيذ" meta={countOf(P.phases.length, NOUN.phase)} />
        <Timeline
          events={P.phases.map((ph) => ({
            tone: ph.tone,
            title: <><b>{ph.name}</b>، {ph.tasks}</>,
            by: isolate(ph.months),
          }))}
        />
      </Glass>}

      <Glass>
        <Head title="النطاق والأثر" meta={edit('scope')} />
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
      {editing && editBy && (
        <EditModal
          title={`${TITLE[editing]} · ${P.name}`}
          fields={fieldsOf(editing)}
          onClose={() => setEditing(null)}
          onSave={(changes, v, reason) => editProject(P.id, editing, changes.map((c) => (Array.isArray(v[c.key]) ? { ...c, to: (v[c.key] as string[]).join('\n') } : c)), reason, editBy)}
        />
      )}
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

import { useNavigate } from 'react-router-dom'
import { BackTo, Glass, Head, Nil, Num, Tabs, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { EVIDENCE_KINDS, PLAN_LIMIT, PLAN_STAGES, planRows } from '@/data/mock/plans'
import type { PlanStage } from '@/types/domain'
import { NOUN, nounAfter } from '@/lib/format'

/* Plan settings - D-1 and D-3.

   Note: every module carries its own settings and reports beneath it - the stated requirement:
   budget has its configuration, reports, and the budget itself underneath it; the same for
   projects; the same for entities.

   Two different kinds of data live here, and mixing them hides the difference:

     Evidence types - master data (D-3) - any dropdown list in the system belongs in settings, and a
     new type appears in every plan.
     Phase thresholds - a business rule - the number changes behavior: a plan past its threshold
     moves into "late" and enters the escalation report.

   Note: all these numbers are placeholders, and the screen states so. The spec gives no duration
   for any stage in the plan module - the same as the empty "target value" in the disbursement
   indicators. Presenting them as agreed-upon would let whoever builds on this assume they are.

   Note: the "used in" column isn't decoration. An evidence type with no usage means either it was
   added and never adopted, or it was removed from plans and left behind in the list - the number
   states this without anyone counting. */

const KEYS = ['tab'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

const TABS = [
  { slug: 'evidence', label: 'أنواع الشواهد' },
  { slug: 'limits', label: 'حدود المراحل' },
] as const

export default function PlanSettingsPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const tab = TABS.some((t) => t.slug === v.tab) ? (v.tab as string) : TABS[0].slug

  /** How many activities require this type - actual usage, not the count defined. */
  const usage = (kind: string) =>
    planRows.reduce(
      (s, p) => s + p.phases.reduce(
        (x, ph) => x + ph.activities.filter((a) => a.needs.includes(kind)).length, 0,
      ), 0,
    )

  /** How many plans currently sit at this stage. */
  const atStage = (k: PlanStage) => planRows.filter((p) => p.stage === k).length

  return (
    <AppLayout assistantContext={assistFor.page('إعدادات الخطط')}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="الخطط" onClick={() => navigate(ROUTES.plans)} />

          <header>
            <div>
              <h1 className="ptitle">إعدادات الخطط</h1>
              <p className="sub mt-1">
                أنواع الشواهد التي تطلبها الأنشطة، وحدود المحطات التي
                تُحدّد متى تُعدّ الخطة متأخّرة
              </p>
            </div>
            <Tag tone="mute">قيم افتراضية</Tag>
          </header>

          <Tabs
            items={TABS}
            active={tab}
            onChange={(x) => set({ tab: x === TABS[0].slug ? undefined : x })}
          />

          {tab === 'evidence' ? (
            <Glass className="tblcard">
              <Head
                title="أنواع الشواهد"
                meta={<span className="sub"><Num>{EVIDENCE_KINDS.length}</Num> {nounAfter(EVIDENCE_KINDS.length, NOUN.kind)}</span>}
              />
              <p className="sub cnote">
                يطلب النشاط نوعًا أو أكثر من هذه الأنواع، ولا تستطيع الجهة إعلان
                اكتمال النشاط قبل رفعها · وبها تصبح مراجعة مشرف المنح
                ممكنة أصلًا (القاعدة <span className="num">14</span>).
              </p>
              {/* Note: the "note" column used to be all dots - a note is only written for a type no plan has
   requested, so the column renders only when one exists. */}
              {/* Note: a name/value table sized to its content, not the card width - at full card width, the value
   sat 1100px from its name. */}
              <table className="tbl tbl-fit">
                <colgroup><col /><col />{EVIDENCE_KINDS.some((k) => usage(k) === 0) && <col />}</colgroup>
                <thead>
                  <tr>
                    <th><span className="th-t">النوع</span></th>
                    <th className="n"><span className="th-t">مستعمَل في</span></th>
                    {EVIDENCE_KINDS.some((k) => usage(k) === 0) && <th><span className="th-t">ملاحظة</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {EVIDENCE_KINDS.map((k) => {
                    const n = usage(k)
                    return (
                      <tr key={k}>
                        <td>{k}</td>
                        <td className="n">
                          {n > 0
                            ? <><span className="num">{n}</span> {nounAfter(n, NOUN.activity)}</>
                            : <span className="sub">لا شيء</span>}
                        </td>
                        {EVIDENCE_KINDS.some((kk) => usage(kk) === 0) && (
                          <td>
                            {n === 0
                              ? <span className="sub">معرَّف ولم تطلبه أي خطة</span>
                              : <Nil />}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Glass>
          ) : (
            <Glass className="tblcard">
              <Head
                title="حدود المحطات"
                meta={<Tag tone="warn">لم تحدّد الوثيقة مدة</Tag>}
              />
              {/* Note: this sentence is what distinguishes "a number we agreed on" from "a number we set so the
   screen works" - the latter must stay tagged as such until the institution settles it. */}
              <p className="sub cnote">
                لم تحدّد BPD-012 مدة لأي محطة · هذه الأرقام مؤقتة ليكون
                لوصف «متأخّرة» معنى في النموذج، ويلزم تأكيدها مع
                المؤسسة، مثل الحدود المالية للاعتماد تمامًا.
              </p>
              <table className="tbl">
                <colgroup><col /><col /><col /><col /></colgroup>
                <thead>
                  <tr>
                    <th><span className="th-t">المحطة</span></th>
                    <th><span className="th-t">المسؤول</span></th>
                    <th className="n"><span className="th-t">الحدّ بالأيام</span></th>
                    <th className="n"><span className="th-t">الخطط فيها الآن</span></th>
                  </tr>
                </thead>
                <tbody>
                  {PLAN_STAGES.map((s) => (
                    <tr key={s.key}>
                      <td>{s.label}</td>
                      <td>{s.who || <Nil />}</td>
                      <td className="n">
                        {PLAN_LIMIT[s.key] > 0
                          ? <span className="num">{Math.round(PLAN_LIMIT[s.key] / 24)}</span>
                          /* Note: "no limit", not zero - execution's duration comes from the plan itself, not a setting, and
   zero here would read as "must finish today". */
                          : <span className="sub">بلا حدّ</span>}
                      </td>
                      <td className="n">
                        {atStage(s.key) > 0
                          ? <span className="num">{atStage(s.key)}</span>
                          : <span className="sub">0</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="sub cnote">
                مدة التنفيذ نفسها ليست إعدادًا · تُؤخذ من تواريخ المراحل في
                النسخة المرجعية لكل خطة، ويُقاس التأخير عليها.
              </p>
            </Glass>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

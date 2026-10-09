import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BackTo, DateText, Empty, FieldSelect, Glass, Head, Icon, KV, Money, Num, Tag, icons,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { planOfProject } from '@/data/mock/plans'
import { openPlanFor, planDecisionOf, planRuleSays, projectWindow, usePlans } from '@/data/plans/store'
import { readRole, roleByKey } from '@/data/roles'
import { projectById, projectRows } from '@/data/mock/projects'
import { NOUN, nf, nounAfter } from '@/lib/format'

/* Open a plan for a project.

   Note: this screen isn't "create a plan", it's "open a plan". The difference isn't naming: what
   happens here is the institution deciding this project requires a work plan (per the spec: "in the
   case of projects requiring a work plan"), and opening the file, assigning it to a drafter. Phases
   and activities get written in the editor afterward, not here - putting those fields here would
   turn the screen into a long form mixing a decision with data entry.

   Note: the drafter is a documented decision, not a setting. The spec states the entity is the one
   who prepares the plan - the supervisor can draft on their behalf when the entity can't, and that
   difference stays recorded in the "drafted by" column and on the plan card. "The entity wrote it"
   and "it was written on their behalf" aren't the same thing in review.

   Note: no project appears twice. A project has one plan, so a project that already has one
   disappears from the list, and arriving from that project's tab with an existing plan links to it
   instead of opening a new one. */

const KEYS = ['project', 'by'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

export default function PlanNewPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const [done, setDone] = useState<string | null>(null)

  /* Note: only projects that are approved and have a grant. A plan is measured against an approved
     grant amount, and a project still under review has no number to divide. */
  const ver = usePlans()
  const [reason, setReason] = useState('')
  const me = roleByKey(readRole()).name
  /* 12.4.3 · approved projects only · a project the manager decided needs no plan isn't offered
     until the decision is changed on the project (12.4.31) */
  const options = useMemo(
    () => { void ver; return projectRows
      .filter((p) => p.amountGranted > 0 && !['دراسة المشروع', 'استكمال بيانات المشروع'].includes(p.stage) && p.statusGroup !== 'معتذر عنه')
      .filter((p) => !planOfProject(p.id) || planOfProject(p.id)!.stage === 'cancelled')
      .filter((p) => planDecisionOf(p.id)?.needs !== false)
      .map((p) => ({ value: p.id, label: `${p.name} · ${p.entityName}` })) },
    [done, ver],
  )

  const pr = v.project ? projectById(v.project) : undefined
  const has = v.project ? planOfProject(v.project) : undefined
  const dec = pr ? planDecisionOf(pr.id) : undefined
  const win = pr ? projectWindow(pr.id) : undefined
  /* Opening without a recorded «يتطلب خطة» is a change of the decision · its reason is required (12.4.33) */
  const needReason = Boolean(pr) && !dec?.needs
  const by = v.by === 'supervisor' ? 'supervisor' : 'entity'

  /* A project that already has a plan - links to it instead of opening another. */
  if (has && has.stage !== 'cancelled') {
    return (
      <AppLayout assistantContext={assistFor.page('فتح خطة')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الخطط" onClick={() => navigate(ROUTES.plans)} />
            <Glass>
              <Head title="لهذا المشروع خطة بالفعل" meta={<Tag tone="mute">خطة واحدة للمشروع</Tag>} />
              <Empty
                title={`فُتحت لمشروع «${has.projectName}» الخطة ${has.id}.`}
                note="للمشروع خطة واحدة، فيكون التعديل على الخطة الموجودة لا بفتح خطة أخرى."
                actions={
                  <Link className="btn btn-p" to={ROUTES.plan(has.id)}>افتح الخطة</Link>
                }
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout assistantContext={assistFor.page('فتح خطة لمشروع')}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="الخطط" onClick={() => navigate(ROUTES.plans)} />

          <header>
            <div>
              <h1 className="ptitle">فتح خطة تنفيذ لمشروع</h1>
              <p className="sub mt-1">
                قرار بأن المشروع يتطلب خطة عمل · وتُكتب المراحل والأنشطة
                في المحرّر بعد الفتح
              </p>
            </div>
            {/* doc BPD-012 */}
          </header>

          <Glass>
            <Head
              title="المشروع"
              meta={<span className="sub"><Num>{options.length}</Num> {nounAfter(options.length, NOUN.project)} بلا خطة</span>}
            />

            {options.length === 0 ? (
              <Empty
                title="كل المشاريع المعتمدة لها خطط."
                note="تُفتح الخطة لمشروع معتمد له قيمة منحة، أما المشروع الذي ما زال في الدراسة فليس له مبلغ تُقاس عليه الخطة."
              />
            ) : (
              <>
                {/* Note: no `regf-w` here - documented above `.regfields` in the CSS: field width
                    should suggest input length, and a field spanning the full screen for a choice
                    between two options reads as a mistake. The client caught the same issue in the
                    region filter - so both fields here are single columns. */}
                <div className="regfields">
                  <label className="regf">
                    <span className="lb">
                      المشروع<b className="regf-r" aria-label="إلزامي">*</b>
                    </span>
                    <FieldSelect
                      value={v.project ?? ''}
                      options={options}
                      onChange={(x) => set({ project: x || undefined })}
                      label="المشروع"
                      placeholder="اختر مشروعًا معتمدًا"
                    />
                    <span className="sub regf-h">
                      لا تظهر في القائمة المشاريع التي لها خطة، فللمشروع خطة واحدة
                    </span>
                  </label>

                  {/* Note: this choice is recorded and can't change afterward - the "drafted by"
                      column in the inbox shows it, and the reviewer reads what the entity wrote
                      with a different eye than what was written on their behalf. */}
                  <label className="regf">
                    <span className="lb">كاتب المسودة</span>
                    <FieldSelect
                      value={by}
                      options={[
                        { value: 'entity', label: 'الجهة المستفيدة · من بوابة المنح' },
                        { value: 'supervisor', label: 'مشرف المنح بالنيابة عنها' },
                      ]}
                      onChange={(x) => set({ by: x === 'supervisor' ? 'supervisor' : undefined })}
                      label="كاتب المسودة"
                    />
                    <span className="sub regf-h">
                      تنص الوثيقة على أن الجهة هي من تكتب الخطة، والكتابة بالنيابة استثناء
                      يُسجَّل، لأن ما كتبته الجهة وما كُتب عنها لا يُراجعان بالطريقة نفسها
                    </span>
                  </label>
                </div>

                {/* Note: this block has its own heading rather than sitting loose under the field -
                    without it, it reads as a continuation of the field's hint text above rather
                    than information about the selected project (which is what was actually
                    happening). */}
                {pr && (
                  <Head title="المشروع المختار" />
                )}
                {pr && (
                  <KV
                    rows={[
                      { k: 'الجهة المستفيدة', v: pr.entityName },
                      { k: 'قيمة المنحة', v: <Money>{pr.amountGranted}</Money> },
                      { k: 'مدة التنفيذ', v: <>{win?.days ? `${nf.format(win.days)} يومًا` : '—'}{win?.from && <span className="sub"> · <DateText>{win.from}</DateText> ← <DateText>{win.to ?? ''}</DateText></span>}</> },
                      { k: 'حالة المشروع', v: <span className="sub">{pr.stage}</span> },
                      { k: 'قرار الخطة', v: dec ? <>{dec.needs ? 'يتطلب خطة' : 'لا يتطلب خطة'} <span className="sub">· {dec.by}</span></> : <span className="sub">لم يُوثَّق · القاعدة تقترح {planRuleSays(pr.id) ? 'يتطلب خطة' : 'لا يتطلب خطة'}</span> },
                    ]}
                  />
                )}

                {/* Note: this sentence states what happens after the click - a button that doesn't
                    say where it leads makes the user hesitate. */}
                <p className="sub cnote">
                  يُنشئ الفتح خطة <b>مسودة</b> فارغة وينقلك إلى المحرّر، ويمكن للجهة
                  كتابتها من بوابة المنح. ولا يبدأ القياس ولا حساب الانحراف قبل أن
                  يعتمدها مدير المنح ويثبّت النسخة المرجعية.
                </p>

                {needReason && (
                  <label className="regf regf-w">
                    <span className="lb">سبب فتح الخطة<b className="regf-r" aria-label="إلزامي">*</b></span>
                    <span className="fld"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: تعدّد مراحل التنفيذ وتوزّعها على فصلين دراسيين" aria-label="سبب فتح الخطة" /></span>
                    <span className="sub regf-h">لا يوجد قرار موثّق بأن المشروع يتطلب خطة · يُسجَّل الفتح قرارًا باسمك وسببه{/* doc 12.4.33 */}</span>
                  </label>
                )}

                <div className="regfoot">
                  <span className="decsent sub">
                    {pr
                      ? <>خطة لـ<b>{pr.name}</b></>
                      : 'اختر المشروع أولًا'}
                  </span>
                  <div className="rowf gp-2">
                    <button className="btn btn-2" onClick={() => navigate(ROUTES.plans)}>
                      إلغاء
                    </button>
                    <button
                      className="btn btn-p"
                      disabled={!pr || (needReason && !reason.trim())}
                      title={!pr ? 'اختر المشروع أولًا' : needReason && !reason.trim() ? 'اكتب سبب فتح الخطة' : 'يفتح مسودة وينقلك إلى المحرّر'}
                      onClick={() => {
                        if (!pr) return
                        const id = openPlanFor(pr.id, by, needReason ? reason : '', me)
                        setDone(id)
                        navigate(ROUTES.planEdit(id))
                      }}
                    >
                      <Icon name={icons.plus} size="sm" />
                      افتح الخطة
                    </button>
                  </div>
                </div>
              </>
            )}
          </Glass>
        </div>
      </div>
    </AppLayout>
  )
}

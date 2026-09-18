import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BackTo, Empty, FieldSelect, Glass, Head, Icon, KV, Money, Num, Tag, icons,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { openPlan, planOfProject } from '@/data/mock/plans'
import { projectById, projectRows } from '@/data/mock/projects'

/* ═══════════════════════════════════════════════════════════
   فتح خطة لمشروع · BPD-012

   ⚠️ **الشاشة دي مش «إنشاء خطة»، هي «فتح خطة».** الفرق مش تسمية:
   اللي بيحصل هنا إن المؤسسة بتقرّر إن المشروع ده **يتطلب خطة
   عمل** (الوثيقة: «في حالة المشاريع التي تتطلب خطة عمل»)، وبتفتح
   الملف وتحيله لكاتب المسودة. المراحل والأنشطة بتتكتب في المحرّر
   بعد كده، لا هنا · فلو حطّينا الحقول هنا بقت الشاشة نموذجًا طويلًا
   بيخلط قرارًا بتعبئة.

   ⚠️ **وكاتب المسودة قرار موثَّق لا إعداد.** الوثيقة بتقول إن
   **الجهة** هي اللي بتعمل المسودة · والمشرف بيقدر يكتب بالنيابة
   لمّا الجهة ما تقدرش، والفرق بيفضل مكتوبًا في عمود «كاتب المسودة»
   وفي كارت الخطة. «الجهة كتبتها» و«اتكتبت عنها» مش نفس الحاجة في
   مراجعة.

   ⚠️ **ومفيش مشروع مرّتين.** الخطة واحدة للمشروع · فالمشروع اللي
   ليه خطة بيختفي من القايمة، واللي جاي من تاب المشروع بخطة موجودة
   بيتودّي لها بدل ما يفتح تانية.
   ═══════════════════════════════════════════════════════════ */

const KEYS = ['project', 'by'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

export default function PlanNewPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const [done, setDone] = useState<string | null>(null)

  /* ⚠️ المشاريع اللي **اتعتمدت ولها منحة** بس · الخطة بتتقاس على
     منحة معتمدة القيمة، ومشروع لسه في الدراسة مالوش رقم يتقسم */
  const options = useMemo(
    () => projectRows
      .filter((p) => p.amountGranted > 0 && !planOfProject(p.id))
      .map((p) => ({ value: p.id, label: `${p.name} · ${p.entityName}` })),
    [done],
  )

  const pr = v.project ? projectById(v.project) : undefined
  const has = v.project ? planOfProject(v.project) : undefined
  const by = v.by === 'supervisor' ? 'supervisor' : 'entity'

  /* المشروع اللي ليه خطة بالفعل · بنودّي لها لا بنفتح تانية */
  if (has) {
    return (
      <AppLayout assistantContext={assistFor.page('فتح خطة')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الخطط" onClick={() => navigate(ROUTES.plans)} />
            <Glass>
              <Head title="المشروع ده له خطة بالفعل" meta={<Tag tone="ret">خطة واحدة للمشروع</Tag>} />
              <Empty
                title={`«${has.projectName}» مفتوح له ${has.id}.`}
                note="الخطة واحدة للمشروع · التعديل على الموجودة، مش فتح تانية."
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
                قرار إن المشروع يتطلب خطة عمل · والمراحل والأنشطة بتتكتب
                في المحرّر بعد الفتح
              </p>
            </div>
            <Tag tone="ret">BPD-012</Tag>
          </header>

          <Glass>
            <Head
              title="المشروع"
              meta={<span className="sub"><Num>{options.length}</Num> مشروعًا بلا خطة</span>}
            />

            {options.length === 0 ? (
              <Empty
                title="كل المشاريع المعتمدة لها خطط."
                note="الخطة بتتفتح لمشروع اتعتمد وله قيمة منحة · ومشروع لسه في الدراسة مالوش رقم تتقاس عليه الخطة."
              />
            ) : (
              <>
                {/* ⚠️ **مفيش `regf-w` هنا** · القاعدة مكتوبة فوق `.regfields`
                    في الـCSS: طول الحقل بيوحي بطول المدخل، وحقل بعرض
                    الشاشة لاختيار من اتنين بيغلط. والعميل مسك نفس الغلط
                    في فلتر «المنطقة» يوم ١٧ سبتمبر · فالحقلين هنا عمودين */}
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
                      المشاريع اللي ليها خطة مش في القايمة · خطة واحدة للمشروع
                    </span>
                  </label>

                  {/* ⚠️ الاختيار ده **بيتسجّل** ومش بيتغيّر بعد كده ·
                      عمود «كاتب المسودة» في الصندوق بيعرضه، والمراجع
                      بيقرا اللي كتبته الجهة بعين غير اللي اتكتب عنها */}
                  <label className="regf">
                    <span className="lb">كاتب المسودة</span>
                    <FieldSelect
                      value={by}
                      options={[
                        { value: 'entity', label: 'الجهة المستفيدة · من بوّابتها' },
                        { value: 'supervisor', label: 'مشرف المنح بالنيابة عنها' },
                      ]}
                      onChange={(x) => set({ by: x === 'supervisor' ? 'supervisor' : undefined })}
                      label="كاتب المسودة"
                    />
                    <span className="sub regf-h">
                      الوثيقة بتقول إن الجهة هي اللي بتكتب · والنيابة استثناء
                      بيتسجّل، لأن «الجهة كتبتها» و«اتكتبت عنها» مش سواء في مراجعة
                    </span>
                  </label>
                </div>

                {/* ⚠️ الكتلة دي **بعنوانها** لا سايبة تحت الحقل · من غيره
                    بتتقري امتدادًا لشرح الحقل اللي فوقها لا معلومة عن
                    المشروع المختار (وده اللي كان بيحصل فعلًا) */}
                {pr && (
                  <Head title="المشروع المختار" />
                )}
                {pr && (
                  <KV
                    rows={[
                      { k: 'الجهة المستفيدة', v: pr.entityName },
                      { k: 'قيمة المنحة', v: <Money>{pr.amountGranted}</Money> },
                      { k: 'حالة المشروع', v: <span className="sub">{pr.stage}</span> },
                    ]}
                  />
                )}

                {/* ⚠️ الجملة دي بتقول **اللي هيحصل بعد الضغطة** · الزرار
                    اللي مش قايل وجهته بيخلّي المستخدم يتردّد */}
                <p className="sub cnote">
                  الفتح بيعمل خطة <b>مسودة</b> فاضية ويوديك للمحرّر · والجهة بتقدر
                  تكتبها من بوّابتها. ومفيش قياس ولا انحراف قبل ما مدير المنح
                  يعتمدها ويثبّت النسخة المرجعية.
                </p>

                <div className="regfoot">
                  <span className="decsent sub">
                    {pr
                      ? <>خطة لـ<b>{pr.name}</b></>
                      : 'اختر المشروع الأول'}
                  </span>
                  <div className="rowf gp-2">
                    <button className="btn btn-2" onClick={() => navigate(ROUTES.plans)}>
                      إلغاء
                    </button>
                    <button
                      className="btn btn-p"
                      disabled={!pr}
                      title={pr ? 'يفتح مسودة ويوديك للمحرّر' : 'اختر المشروع الأول'}
                      onClick={() => {
                        if (!pr) return
                        const id = openPlan(pr.id, by)
                        setDone(id)
                        navigate(ROUTES.planEdit(id))
                      }}
                    >
                      <Icon name={icons.plus} size={15} />
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

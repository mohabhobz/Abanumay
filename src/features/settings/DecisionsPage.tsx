import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FieldSelect, Glass, Head, Switch, Tag } from '@/components/ui'
import { DockSlotProvider, SaveBar, useDockSlot } from '@/components/shell'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import {
  DECISIONS, DECISIONS_DEFAULT, KIND_SAY, LEVEL_SAY, saveDecisions,
  type Decisions, type Level, type ProjectKind,
} from '@/data/shared/decisions'
import { APPROVAL_RULES, saveApprovalRules } from '@/data/approvals/rules'
import { ENTITY_RULES, saveEntityRules } from '@/data/entities/rules'
import { logSettings } from '@/data/shared/settingsLog'

/* «قرارات المؤسسة» · batch 8 (9 Oct).

   The audit left a handful of questions only the foundation can answer. Each is built both ways, and
   the answer is picked here: one card per question, with what each option does in plain words and
   where it shows. The first option is what the system did before, so nothing changes until someone
   chooses. Two older switches (automatic committee referral, blocking an incomplete entity file)
   live in their own module's rules and are shown here too so every open question is on one page. */

interface Opt<T extends string> { value: T; label: string; does: string }

function Choice<T extends string>({ title, refs, q, opts, value, onChange, where, disabled }: {
  title: string; refs: string; q: string; opts: Opt<T>[]; value: T; onChange: (v: T) => void; where: React.ReactNode; disabled: boolean
}) {
  const cur = opts.find((o) => o.value === value)
  return (
    <Glass>
      <Head title={title} meta={<span className="sub"><bdi>{refs}</bdi></span>} />
      <p className="sub">{q}</p>
      <div className="apv-row mt-2">
        <FieldSelect label={title} value={value} disabled={disabled} options={opts.map((o) => ({ value: o.value, label: o.label }))} onChange={(v) => onChange(v as T)} />
        {value === opts[0]!.value ? <Tag tone="mute">كما كان</Tag> : <Tag tone="warn">مختار</Tag>}
      </div>
      {cur && <p className="sub cnote">{cur.does}</p>}
      <p className="sub cnote">يظهر في: {where}</p>
    </Glass>
  )
}

const LEVEL_OPTS: Opt<string>[] = [
  { value: '', label: 'بالمبلغ فقط', does: '' },
  ...(Object.keys(LEVEL_SAY) as Level[]).map((l) => ({ value: l, label: `${LEVEL_SAY[l]} فأعلى`, does: '' })),
]

export default function DecisionsPage() {
  const dock = useDockSlot()
  const { role, user } = useRole()
  const can = role.key === 'admin' || role.key === 'ceo'
  const [saved, setSaved] = useState(() => ({ d: structuredClone(DECISIONS), auto: Boolean(APPROVAL_RULES.autoReferAboveExec), block: ENTITY_RULES.blockIncomplete }))
  const [d, setD] = useState<Decisions>(() => structuredClone(DECISIONS))
  const [auto, setAuto] = useState(saved.auto)
  const [block, setBlock] = useState(saved.block)
  const put = <K extends keyof Decisions>(k: K, v: Decisions[K]) => setD((x) => ({ ...x, [k]: v }))
  const changes = (Object.keys(d) as (keyof Decisions)[]).filter((k) => JSON.stringify(d[k]) !== JSON.stringify(saved.d[k])).length
    + (auto !== saved.auto ? 1 : 0) + (block !== saved.block ? 1 : 0)
  const decided = (Object.keys(d) as (keyof Decisions)[]).filter((k) => JSON.stringify(d[k]) !== JSON.stringify(DECISIONS_DEFAULT[k])).length + (auto ? 1 : 0) + (block ? 1 : 0)

  const save = () => {
    saveDecisions(d, user.name)
    if (auto !== saved.auto) {
      saveApprovalRules({ ...APPROVAL_RULES, autoReferAboveExec: auto })
      logSettings('قرارات المؤسسة', ROUTES.decisions, user.name, [{ k: 'الإحالة التلقائية للجنة', from: saved.auto ? 'مفعّلة' : 'موقوفة', to: auto ? 'مفعّلة' : 'موقوفة' }])
    }
    if (block !== saved.block) {
      saveEntityRules({ ...ENTITY_RULES, blockIncomplete: block })
      logSettings('قرارات المؤسسة', ROUTES.decisions, user.name, [{ k: 'منع إرسال ملف الجهة الناقص', from: saved.block ? 'مفعّل' : 'موقوف', to: block ? 'مفعّل' : 'موقوف' }])
    }
    setSaved({ d: structuredClone(DECISIONS), auto, block })
  }
  const discard = () => { setD(structuredClone(saved.d)); setAuto(saved.auto); setBlock(saved.block) }

  return (
    <AppLayout assistantContext={assistFor.page('قرارات المؤسسة')}>
      <DockSlotProvider value={dock.value}>
      <div className={`viewstack${dock.on ? ' hasdock' : ''}`}>
        <div className="screen col">
          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">قرارات المؤسسة</h1>
              <p className="sub mt-1">
                أسئلة لا يجيب عنها إلا أصحاب القرار · كل سؤال مبني بالخيارين، والاختيار هنا يغيّر سلوك النظام فورًا ·
                الخيار الأول هو ما كان يعمل به النظام · {decided ? <>اختير {decided} من 10</> : 'لم يُختر شيء بعد'}
              </p>
            </div>
            {!can && <Tag tone="mute">للعرض · يختار المدير التنفيذي أو مدير النظام</Tag>}
          </header>

          <Choice
            title="حالة الجهة أثناء طلب التحديث" refs={/* doc 2.3.upd-16 · entities#8 */ ""} disabled={!can}
            q="الجهة التي أرسلت طلب تحديث يتطلب اعتمادًا تُعلَّق حتى يُبتّ فيه · بأي اسم تظهر حالتها؟"
            value={d.updateStatus} onChange={(v) => put('updateStatus', v)}
            opts={[
              { value: 'محدث', label: '«محدث» · اسم النظام العامل', does: 'تبقى التسمية التي يعرفها الموظفون من النظام الحالي.' },
              { value: 'غير نشطة', label: '«غير نشطة» · اسم الوثيقة', does: 'تظهر «غير نشطة · بانتظار التحديث» كما في الوثيقة، والسلوك واحد: لا تقديم حتى يُبتّ في الطلب.' },
            ]}
            where={<>قائمة الجهات وملف الجهة وبوابتها ومراجعة التحديث</>}
          />

          <Choice
            title="فتح الدفعة التالية" refs={/* doc BPD-009 · payments#6 */ ""} disabled={!can}
            q="الدفعات تُطلب بالترتيب · متى تُفتح الدفعة التي تليها؟"
            value={d.payNext} onChange={(v) => put('payNext', v)}
            opts={[
              { value: 'requested', label: 'بمجرد طلب السابقة', does: 'تُطلب الدفعة التالية وطلب السابقة قيد المراجعة · أسرع للجهة.' },
              { value: 'paid', label: 'بعد صرف السابقة', does: 'لا تُفتح الدفعة التالية حتى تُصرف السابقة أو تُسوّى · رقابة أشد.' },
            ]}
            where={<>جدول الدفعات في <Link className="lnk" to={ROUTES.payments}>الصرف</Link> وتبويب الدفعات في المشروع</>}
          />

          <Choice
            title="الجهات الموجّهة عبر إحسان" refs={/* doc BPD-011 · 11.2.4 */ ""} disabled={!can}
            q="من يُسمح بتوجيه مشروعه عبر منصة إحسان؟"
            value={d.ehsanEntities} onChange={(v) => put('ehsanEntities', v)}
            opts={[
              { value: 'any', label: 'أي جهة', does: 'المنصة نفسها هي الشريك، فيُوجَّه مشروع أي جهة معتمدة.' },
              { value: 'strategic', label: 'الشركاء الاستراتيجيون المعتمدون فقط', does: 'يُرفض اقتراح التوجيه أو إقراره لمشروع جهة ليست شريكًا معتمدًا.' },
            ]}
            where={<>بطاقة التوجيه في المشروع و<Link className="lnk" to={ROUTES.partners}>الشركاء</Link></>}
          />

          <Choice
            title="أولوية الطلب" refs={/* doc BPD-003 */ ""} disabled={!can}
            q="كيف تُحدَّد أولوية الطلب أثناء الدراسة؟"
            value={d.priority} onChange={(v) => put('priority', v)}
            opts={[
              { value: 'manual', label: 'يحدّدها المشرف', does: 'يختار المشرف «عالية / متوسطة / عادية» بسبب مكتوب، ويُحفظ كل تغيير.' },
              { value: 'computed', label: 'تُحسب من الدراسة', does: 'من درجة الدراسة الموزونة: 80 فأكثر عالية، 60 – 79 متوسطة، وأقل عادية.' },
            ]}
            where={<>تبويب الدراسة وعمود «الأولوية» في قائمة المشاريع</>}
          />

          <Glass>
            <Head title="نوع المشروع في مسار الاعتماد" meta={<span className="sub"><bdi>{/* doc 5.4.25 · approvals#18 */}</bdi></span>} />
            <p className="sub">المسار يُحسب من المبلغ · هل يرفع نوع المشروع أدنى مستوى يعتمده؟ «بالمبلغ فقط» لا يغيّر شيئًا.</p>
            <ul className="cfglist mt-2">
              {(Object.keys(KIND_SAY) as ProjectKind[]).map((k) => (
                <li key={k} className="itk-sup">
                  <span className="cfgl"><b>{KIND_SAY[k]}</b></span>
                  <span className="pc-sp" />
                  <FieldSelect label={KIND_SAY[k]} value={d.typeFloor[k] ?? ''} disabled={!can} options={LEVEL_OPTS.map((o) => ({ value: o.value, label: o.label }))}
                    onChange={(v) => put('typeFloor', { ...d.typeFloor, [k]: (v || null) as Level | null })} />
                </li>
              ))}
            </ul>
            <p className="sub cnote">يظهر في: شريط القرار وتبويب الاعتماد وقرارات الجلسات · المستوى الأدنى لا يرى «اعتماد» ويُحيل</p>
          </Glass>

          <Choice
            title="أساس الأثر المتوقع" refs="cross · الأثر المتوقع" disabled={!can}
            q="الأثر المتوقع = المستفيدون المستهدفون × نسبة التحقّق · من أين تؤخذ النسبة؟"
            value={d.impactBasis} onChange={(v) => put('impactBasis', v)}
            opts={[
              { value: 'similar', label: 'المشاريع المشابهة المغلقة أولًا', does: 'نسبة ما حققته مشاريع مشابهة أرسلت تقريرها الختامي، ثم المجال، ثم 80 بالمئة افتراضيًا.' },
              { value: 'field', label: 'نسبة المجال فقط', does: 'متوسط ما حققته مشاريع المجال نفسه، ثم 80 بالمئة افتراضيًا · أبسط وأقل تذبذبًا.' },
            ]}
            where={<>تبويب الاعتماد واللوحة التنفيذية وملخص الجلسات</>}
          />

          <Glass>
            <Head title="مسائل تشغيل" meta={<span className="sub"><bdi>{/* doc entities#49 · intake#15 · 2.2.7 · 5.4.11 */}</bdi></span>} />
            <Switch
              label="إظهار مشاريع الجهات المؤرشفة في التقارير ولوحة الأثر" disabled={!can}
              note="موقوف: الجهة المؤرشفة تخرج من القوائم والتقارير مع مشاريعها · مفعّل: تخرج من القوائم وتبقى أرقامها في التقارير"
              on={d.archivedInReports} onChange={(v) => put('archivedInReports', v)}
            />
            <Switch
              label="إعادة حساب نهاية المشاريع المفتوحة عند تغيّر الإجازات الرسمية" disabled={!can}
              note="عند الحفظ في إعدادات الاستقبال تُحسب النهاية من جديد للمشاريع التي حُسبت نهايتها من التقويم، ويُسجَّل التغيير وتُبلَّغ الجهة"
              on={d.holidayRederive} onChange={(v) => put('holidayRederive', v)}
            />
            <Switch
              label="منع إرسال طلب تسجيل الجهة قبل اكتمال بياناته ومرفقاته" disabled={!can}
              note={/* doc 2.2.7 · 2.4.4 */ "أُوقف بطلب العميل في 30 سبتمبر · عند التفعيل لا يُرسل الطلب حتى يجتاز التحقق"}
              on={block} onChange={setBlock}
            />
            <Switch
              label="إحالة تلقائية للجنة فوق حد المدير التنفيذي" disabled={!can}
              note={/* doc 5.4.11 */ "توصية مدير المنح بالموافقة فوق حد المدير التنفيذي تذهب للجنة مباشرة"}
              on={auto} onChange={setAuto}
            />
          </Glass>

          {can && changes > 0 && (
            <SaveBar
              count={changes}
              sentence={<>تعديلات على قرارات المؤسسة<span className="decsep" /><span className="sub">تسري فور الحفظ وتُسجَّل في سجل الإعدادات</span></>}
              onSave={save}
              onDiscard={discard}
            />
          )}
        </div>
        <div className="dockslot" ref={dock.setEl} />
      </div>
      </DockSlotProvider>
    </AppLayout>
  )
}

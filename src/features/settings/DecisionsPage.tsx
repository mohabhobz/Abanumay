import { useState } from 'react'
import { FieldSelect, Glass, Head, Switch, Tag } from '@/components/ui'
import { DockSlotProvider, SaveBar, useDockSlot } from '@/components/shell'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import {
  DECISIONS, DECISIONS_DEFAULT, KIND_SAY, LEVEL_SAY, SEAT_SAY, saveDecisions,
  type Decisions, type Level, type ProjectKind,
} from '@/data/shared/decisions'
import { APPROVAL_RULES, saveApprovalRules, APPROVAL_RULES_DEFAULT } from '@/data/approvals/rules'
import { ENTITY_RULES, ENTITY_RULES_DEFAULT, saveEntityRules } from '@/data/entities/rules'
import { logSettings } from '@/data/shared/settingsLog'
import type { RoleKey } from '@/data/roles'

/* «قرارات المؤسسة» · batch 8 (9 Oct).

   The audit left a handful of questions only the foundation can answer. Each is built both ways, and
   the answer is picked here: one card per question, with what each option does in plain words and
   where it shows. The first option is what the system did before, so nothing changes until someone
   chooses. Two older switches (automatic committee referral, blocking an incomplete entity file)
   live in their own module's rules and are shown here too so every open question is on one page. */

interface Opt<T extends string> { value: T; label: string; does: string }

function Choice<T extends string>({ title, q, opts, value, onChange, disabled }: {
  title: string; refs: string; q: string; opts: Opt<T>[]; value: T; onChange: (v: T) => void; disabled: boolean
}) {
  const cur = opts.find((o) => o.value === value)
  return (
    <Glass>
      <Head title={title} hint={cur?.does || undefined} />
      <p className="sub">{q}</p>
      <div className="apv-row mt-2">
        <FieldSelect label={title} value={value} disabled={disabled} options={opts.map((o) => ({ value: o.value, label: o.label }))} onChange={(v) => onChange(v as T)} />
        {value === opts[0]!.value ? <Tag tone="mute">كما كان</Tag> : <Tag tone="warn">مختار</Tag>}
      </div>
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
  const decided = (Object.keys(d) as (keyof Decisions)[]).filter((k) => JSON.stringify(d[k]) !== JSON.stringify(DECISIONS_DEFAULT[k])).length + (auto !== Boolean(APPROVAL_RULES_DEFAULT.autoReferAboveExec) ? 1 : 0) + (block !== ENTITY_RULES_DEFAULT.blockIncomplete ? 1 : 0)

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
              <p className="sub mt-1">{decided ? <>اختير {decided} من 13</> : 'لم يُختر شيء بعد'}</p>
            </div>
            {!can && <Tag tone="mute">للعرض</Tag>}
          </header>

          <Choice
            title="ترتيب الدفعات" refs={/* doc BPD-009 · 9.4.7 · payments#6 */ ""} disabled={!can}
            q="هل تُصرف الدفعات بترتيبها؟"
            value={d.payNext} onChange={(v) => put('payNext', v)}
            opts={[
              { value: 'off', label: 'بلا ترتيب (الإجراء)', does: 'أي دفعة اكتملت متطلباتها تُصرف · القيد الوحيد شروط الاتفاقية، ومنها شرط التاريخ.' },
              { value: 'requested', label: 'بعد بدء السابقة', does: 'تُفتح الدفعة التالية متى رُفعت متطلبات السابقة.' },
              { value: 'paid', label: 'بعد صرف السابقة', does: 'لا تُفتح الدفعة التالية حتى تُصرف السابقة أو تُسوّى · رقابة أشد.' },
            ]}
          />

          <Choice
            title="الجهات الموجّهة عبر شريك استراتيجي" refs={/* doc BPD-011 · 11.2.4 */ ""} disabled={!can}
            q="من يُسمح بتوجيه مشروعه عبر شريك استراتيجي؟"
            value={d.ehsanEntities} onChange={(v) => put('ehsanEntities', v)}
            opts={[
              { value: 'any', label: 'أي جهة', does: 'المنصة نفسها هي الشريك، فيُوجَّه مشروع أي جهة معتمدة.' },
              { value: 'strategic', label: 'الشركاء الاستراتيجيون المعتمدون فقط', does: 'يُرفض اقتراح التوجيه أو إقراره لمشروع جهة ليست شريكًا معتمدًا.' },
            ]}
          />

          <Choice
            title="أولوية الطلب" refs={/* doc BPD-003 */ ""} disabled={!can}
            q="كيف تُحدَّد أولوية الطلب أثناء الدراسة؟"
            value={d.priority} onChange={(v) => put('priority', v)}
            opts={[
              { value: 'manual', label: 'يحدّدها المشرف', does: 'يختار المشرف «عالية / متوسطة / عادية» بسبب مكتوب، ويُحفظ كل تغيير.' },
              { value: 'computed', label: 'تُحسب من الدراسة', does: 'من درجة الدراسة الموزونة: 80 فأكثر عالية، 60 – 79 متوسطة، وأقل عادية.' },
            ]}
          />

          <Glass>
            <Head title="نوع المشروع في مسار الاعتماد" hint="هل يرفع نوع المشروع أدنى مستوى يعتمده؟ «بالمبلغ فقط» لا يغيّر شيئًا" />
            <ul className="cfglist">
              {(Object.keys(KIND_SAY) as ProjectKind[]).map((k) => (
                <li key={k} className="itk-sup">
                  <span className="cfgl"><b>{KIND_SAY[k]}</b></span>
                  <span className="pc-sp" />
                  <FieldSelect label={KIND_SAY[k]} value={d.typeFloor[k] ?? ''} disabled={!can} options={LEVEL_OPTS.map((o) => ({ value: o.value, label: o.label }))}
                    onChange={(v) => put('typeFloor', { ...d.typeFloor, [k]: (v || null) as Level | null })} />
                </li>
              ))}
            </ul>
          </Glass>

          <Choice
            title="حالة «أعيد توجيه الدعم» في قرار الإيقاف" refs={/* doc 10.9.2 – 10.9.4 · client item 26 */ ""} disabled={!can}
            q="قرار إيقاف المشروع بنتيجة «إعادة توجيه الدعم»: متى تظهر الحالة على المشروع؟"
            value={d.redirectStatusAt} onChange={(v) => put('redirectStatusAt', v)}
            opts={[
              { value: 'closing', label: 'عند الإغلاق النهائي', does: 'المشروع بيبقى «ملغى» طول ما الإغلاق شغال، وبيتحوّل لـ«أعيد توجيه الدعم» لما الإغلاق يتقفل.' },
              { value: 'decision', label: 'لحظة اعتماد القرار (v3)', does: 'المشروع بيبقى «أعيد توجيه الدعم» من ساعة ما القرار يتعتمد، وبيفضل كده طول الإغلاق. الدفعات الجاية بتتوقف، وغير المصروف بيتحرر أو يتوجّه زي ما هو.' },
            ]}
          />

          <Choice
            title="أساس الأثر المتوقع" refs="cross · الأثر المتوقع" disabled={!can}
            q="من أين تؤخذ نسبة التحقّق في الأثر المتوقع؟"
            value={d.impactBasis} onChange={(v) => put('impactBasis', v)}
            opts={[
              { value: 'similar', label: 'المشاريع المشابهة المغلقة أولًا', does: 'نسبة ما حققته مشاريع مشابهة أرسلت تقريرها الختامي، ثم المجال، ثم 80 بالمئة افتراضيًا.' },
              { value: 'field', label: 'نسبة المجال فقط', does: 'متوسط ما حققته مشاريع المجال نفسه، ثم 80 بالمئة افتراضيًا · أبسط وأقل تذبذبًا.' },
            ]}
          />

          <Glass>
            <Head title="صلاحيات القرار" />
            {([
              { k: 'annexBy', t: 'قرار ملحق القيمة من الإغلاق', n: 'تخفيض قيمة المشروع أو زيادتها بملحق اتفاقية · يمر بعدها بمسار اعتماده المعتاد' },
              { k: 'portfolioCancelBy', t: 'إلغاء المحفظة', n: 'إلغاء محفظة معتمدة قبل إغلاقها، مع ما يُسترد على مستواها' },
              /* client 18 Oct (sheet V2 · #42 · #48) · distress and recovery are permissions · each step needs its document */
              { k: 'distressBy', t: 'فتح حالة التعثر وإثبات تعذّر الاسترداد', n: 'إيقاف المشروع أو تعديل قيمته من الإغلاق، وإثبات المطالبات والتصعيد · كل خطوة بمستندها' },
              { k: 'recoveryBy', t: 'القرار في الرصيد غير المسترد', n: 'شطب الرصيد أو جدولة السداد أو متابعة المطالبة نظاميًّا · بمستند القرار' },
            ] as const).map((x) => (
              <div key={x.k} className="mt-3">
                <p><b>{x.t}</b></p>
                <ul className="cfglist mt-2">
                  {(Object.keys(SEAT_SAY) as RoleKey[]).map((r) => {
                    const on = d[x.k].includes(r)
                    return (
                      <li key={r}>
                        <Switch label={SEAT_SAY[r]!} disabled={!can || (on && d[x.k].length === 1)} on={on}
                          onChange={(v) => put(x.k, v ? [...d[x.k], r] : d[x.k].filter((y) => y !== r))} />
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </Glass>

          <Glass>
            <Head title="مسائل تشغيل" />
            <Switch
              label="إظهار مشاريع الجهات المؤرشفة في التقارير ولوحة الأثر" disabled={!can}
              on={d.archivedInReports} onChange={(v) => put('archivedInReports', v)}
            />
            <Switch
              label="إعادة حساب نهاية المشاريع المفتوحة عند تغيّر التقويم" disabled
              on onChange={() => {}}
            />
            <Switch
              label="منع إرسال طلب تسجيل الجهة قبل اكتمال بياناته ومرفقاته" disabled={!can}
              on={block} onChange={setBlock}
            />
            <Switch
              label="إحالة تلقائية للجنة فوق حد المدير التنفيذي" disabled={!can}
              on={auto} onChange={setAuto}
            />
          </Glass>

          {can && changes > 0 && (
            <SaveBar
              count={changes}
              sentence="تعديلات على قرارات المؤسسة"
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

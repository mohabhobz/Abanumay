import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FieldSelect, Glass, Head, Icon, MultiSelect, Num, Person, Switch, icons } from '@/components/ui'
import { SaveBar } from '@/components/shell'
import { CfgNum } from '@/features/settings/CfgEdit'
import { ROUTES } from '@/app/routes'
import { capOf } from '@/data/approval'
import { STAFF_ROLES, type RoleKey } from '@/data/roles'
import { staffNames } from '@/data/people'
import { entityRows } from '@/data/mock/entities'
import { APPROVAL_RULES, saveApprovalRules, type ApprovalRules, type EntityLimit } from '@/data/approvals/rules'
import { resetApprovals } from '@/data/approvals/store'

/* «مسار الاعتماد» settings · every rule the four seats above the supervisor read, edited without code
   (4.3.1 · 4.3.2 · 5.3.1 · 6.3.2 · 6.4.19 – 6.4.21). The caps themselves stay in the approval matrix,
   one source for the whole system; this tab holds what the matrix doesn't. */

const ROLE_OPTS = STAFF_ROLES.map((r) => ({ value: r.key, label: r.title }))
const STAFF = () => staffNames().map((n) => ({ value: n, label: n }))

export function ApprovalRulesTab() {
  const [saved, setSaved] = useState<ApprovalRules>(() => structuredClone(APPROVAL_RULES))
  const [d, setD] = useState<ApprovalRules>(() => structuredClone(APPROVAL_RULES))
  const dirty = JSON.stringify(d) !== JSON.stringify(saved)
  const put = <K extends keyof ApprovalRules>(k: K, v: ApprovalRules[K]) => setD((x) => ({ ...x, [k]: v }))
  const [cp, setCp] = useState('')
  const [ce, setCe] = useState('')
  const [cr, setCr] = useState('')

  /* Zero reads as «no limit» in the field, the rule stores `null` */
  const limit = (k: 'execEntity' | 'committeeEntity', f: keyof EntityLimit, label: string, suffix: string) => (
    <CfgNum value={d[k][f] ?? 0} label={label} suffix={suffix} onChange={(n) => put(k, { ...d[k], [f]: n > 0 ? n : null })} />
  )
  const execCap = capOf('exec')

  return (
    <>
      <Glass>
        <Head title="مدير المنح" meta={<span className="sub"><bdi>4.3.1 · 4.3.2 · 4.4.19 · 4.4.20</bdi></span>} />
        <Switch
          label="صلاحية الموافقة النهائية لمدير المنح"
          note={<>عند التفعيل يعتمد نهائيًا حتى <Num>{capOf('manager')}</Num> (حدّه في <Link className="lnk" to={`${ROUTES.projectSettings}?tab=approval`}>مصفوفة الاعتماد</Link>) · وعند الإيقاف أو التجاوز يُخفى الخيار ويُحال المشروع</>}
          on={d.managerFinal}
          onChange={(v) => put('managerFinal', v)}
        />
        <ul className="cfglist">
          <li className="itk-sup">
            <span className="cfgl"><b>حد الرفض النهائي</b><span className="sub">فوقه يُرفع الرفض توصيةً للمدير التنفيذي</span></span>
            <span className="pc-sp" />
            <CfgNum value={d.managerRejectUpTo} label="حد الرفض النهائي" suffix="ريال" onChange={(n) => put('managerRejectUpTo', n)} />
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>يُقترح «يتطلب خطة» من مبلغ</b><span className="sub">أو مدة تتجاوز السنة · ويختار المدير (4.4.2)</span></span>
            <span className="pc-sp" />
            <CfgNum value={d.planFrom} label="مبلغ اقتراح الخطة" suffix="ريال" onChange={(n) => put('planFrom', n)} />
          </li>
        </ul>
      </Glass>

      <Glass>
        <Head title="المدير التنفيذي" meta={<span className="sub"><bdi>5.3.1 · 5.4.27-b · 5.4.28</bdi></span>} />
        <Switch
          label="إحالة تلقائية للجنة فوق حد المدير التنفيذي"
          note="عند التفعيل تذهب توصية مدير المنح بالموافقة فوق حد المدير التنفيذي إلى اللجنة مباشرة · بانتظار قرار المؤسسة (5.4.11)"
          on={Boolean(d.autoReferAboveExec)}
          onChange={(v) => put('autoReferAboveExec', v)}
        />
        <ul className="cfglist">
          <li className="itk-sup">
            <span className="cfgl"><b>نسبة التجاوز المسموحة لحده</b><span className="sub">حدّه <Num>{execCap}</Num> · بالتجاوز <Num>{Math.round(execCap * (1 + d.execOverPct / 100))}</Num></span></span>
            <span className="pc-sp" />
            <CfgNum value={d.execOverPct} label="نسبة التجاوز" suffix="بالمئة" onChange={(n) => put('execOverPct', Math.min(50, n))} />
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>عدد المشاريع المعتمدة للجهة</b><span className="sub">صفر = بلا حد</span></span>
            <span className="pc-sp" />
            {limit('execEntity', 'count', 'عدد مشاريع الجهة للمدير التنفيذي', 'مشروع')}
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>إجمالي قيمة مشاريع الجهة</b><span className="sub">صفر = بلا حد</span></span>
            <span className="pc-sp" />
            {limit('execEntity', 'total', 'إجمالي قيمة مشاريع الجهة للمدير التنفيذي', 'ريال')}
          </li>
        </ul>
      </Glass>

      <Glass>
        <Head title="اللجنة التنفيذية" meta={<span className="sub"><bdi>6.4.19 – 6.4.21</bdi> · حدّها في المصفوفة <Num>{capOf('committee')}</Num></span>} />
        <ul className="cfglist">
          <li className="itk-sup">
            <span className="cfgl"><b>عدد المشاريع المعتمدة للجهة</b><span className="sub">صفر = بلا حد</span></span>
            <span className="pc-sp" />
            {limit('committeeEntity', 'count', 'عدد مشاريع الجهة للجنة', 'مشروع')}
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>إجمالي قيمة مشاريع الجهة</b><span className="sub">صفر = بلا حد</span></span>
            <span className="pc-sp" />
            {limit('committeeEntity', 'total', 'إجمالي قيمة مشاريع الجهة للجنة', 'ريال')}
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>فترة الحساب</b><span className="sub">تُعدّ فيها اعتمادات الجهة</span></span>
            <span className="pc-sp" />
            <CfgNum value={d.periodDays} min={30} label="فترة الحساب" suffix="يومًا" onChange={(n) => put('periodDays', n)} />
          </li>
        </ul>
      </Glass>

      <Glass>
        <Head title="الجلسات والتصويت" meta={<span className="sub"><bdi>6.4.6 · 7.4.6</bdi></span>} />
        <ul className="cfglist">
          <li className="itk-sup">
            <span className="cfgl"><b>أعضاء اللجنة التنفيذية</b></span><span className="pc-sp" />
            <MultiSelect label="أعضاء اللجنة" all="اختر الأعضاء" people values={d.committeeMembers} options={STAFF()} onChange={(v) => put('committeeMembers', v)} />
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>أعضاء مجلس الأمناء</b></span><span className="pc-sp" />
            <MultiSelect label="أعضاء المجلس" all="اختر الأعضاء" people values={d.boardMembers} options={STAFF()} onChange={(v) => put('boardMembers', v)} />
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>النصاب</b><span className="sub">أقل عدد أصوات لصدور القرار</span></span><span className="pc-sp" />
            <CfgNum value={d.quorum} min={1} label="النصاب" suffix="أعضاء" onChange={(n) => put('quorum', n)} />
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>آلية التصويت</b></span><span className="pc-sp" />
            <div className="cfgchips" role="radiogroup" aria-label="آلية التصويت">
              {(['majority', 'unanimous'] as const).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={d.voting === v} className={`cfgchip${d.voting === v ? ' on' : ''}`} onClick={() => put('voting', v)}>
                  {v === 'majority' ? 'الأغلبية' : 'الإجماع'}
                </button>
              ))}
            </div>
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>من يسجّل جلسات اللجنة</b></span><span className="pc-sp" />
            <MultiSelect all="لا أحد" values={d.committeeBy} options={ROLE_OPTS} onChange={(v) => put('committeeBy', v as RoleKey[])} />
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>من يسجّل جلسات المجلس</b></span><span className="pc-sp" />
            <MultiSelect all="لا أحد" values={d.boardBy} options={ROLE_OPTS} onChange={(v) => put('boardBy', v as RoleKey[])} />
          </li>
        </ul>
      </Glass>

      <Glass>
        <Head title="الاستراتيجية" meta={<span className="sub"><bdi>5.4.4</bdi></span>} />
        <Switch
          label="لا يُعتمد مشروع خارج المجالات الممولة والتوجهات النشطة"
          note="يُقرأ من ميزانية السنة المعتمدة وتوجهاتها الاستراتيجية في إعدادات الميزانية"
          on={d.requireStrategy}
          onChange={(v) => put('requireStrategy', v)}
        />
      </Glass>

      <Glass>
        <Head title="تعارض المصالح المعلن" meta={<span className="sub"><bdi>5.4.24</bdi> · <Num>{d.conflicts.length}</Num></span>} />
        <ul className="cfglist">
          {d.conflicts.map((c, i) => (
            <li key={`${c.person}-${c.entityId}`}>
              <Person name={c.person} />
              <span className="sub trim1">{entityRows.find((e) => e.id === c.entityId)?.name ?? c.entityId} · {c.reason}</span>
              <span className="pc-sp" />
              <button className="btn btn-ghost btn-sm" aria-label={`احذف تعارض ${c.person}`} onClick={() => put('conflicts', d.conflicts.filter((_, j) => j !== i))}>
                <Icon name={icons.close} size="sm" />
              </button>
            </li>
          ))}
        </ul>
        <div className="apv-row">
          <MultiSelect label="الشخص" all="الشخص" people values={cp ? [cp] : []} options={STAFF()} onChange={(v) => setCp(v[v.length - 1] ?? '')} />
          <FieldSelect value={ce} label="الجهة" placeholder="الجهة" searchAt={6} options={entityRows.slice(0, 200).map((e) => ({ value: e.id, label: e.name }))} onChange={setCe} />
          <span className="fld"><input value={cr} onChange={(e) => setCr(e.target.value)} placeholder="سبب التعارض" aria-label="سبب التعارض" /></span>
          <button className="btn btn-2 btn-sm" disabled={!cp || !ce || !cr.trim()} onClick={() => { put('conflicts', [...d.conflicts, { person: cp, entityId: ce, reason: cr.trim() }]); setCp(''); setCe(''); setCr('') }}>
            <Icon name={icons.plus} size="sm" />أضف
          </button>
        </div>
        <p className="sub cnote">صاحب التعارض لا يتخذ القرار على مشاريع الجهة · يظهر له زر التحويل لصاحب الصلاحية التالي.</p>
      </Glass>

      <Glass>
        <Head title="بيانات العرض التجريبي" />
        <p className="sub cnote">يُعيد قرارات مسار الاعتماد والجلسات والشروط والملاحظات إلى بداية العرض · ولا تتغيّر الإعدادات.</p>
        <button type="button" className="btn btn-2" onClick={resetApprovals}>أعد ضبط بيانات الاعتماد</button>
      </Glass>

      {dirty && (
        <SaveBar
          count={1}
          sentence={<>تعديل قواعد مسار الاعتماد<span className="decsep" /><span className="sub">تسري على القرارات فور الحفظ</span></>}
          onSave={() => { saveApprovalRules(d); setSaved(structuredClone(d)) }}
          onDiscard={() => setD(structuredClone(saved))}
        />
      )}
    </>
  )
}

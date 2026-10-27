import { useState } from 'react'
import { FieldBox, Button, FieldMultiSelect, FieldSelect, Glass, Head, Icon, MultiSelect, Num, Person, Switch, icons } from '@/components/ui'
import { SaveBar } from '@/components/shell'
import { CfgNum } from '@/features/settings/CfgEdit'
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
  const [crit, setCrit] = useState('')

  /* Zero reads as «no limit» in the field, the rule stores `null` */
  const limit = (k: 'execEntity' | 'committeeEntity', f: keyof EntityLimit, label: string, suffix: string) => (
    <CfgNum value={d[k][f] ?? 0} label={label} suffix={suffix} onChange={(n) => put(k, { ...d[k], [f]: n > 0 ? n : null })} />
  )
  const execCap = capOf('exec')

  return (
    <>
      <Glass>
        <Head title="مدير المنح" />
        <Switch
          label="صلاحية الموافقة النهائية لمدير المنح"
          on={d.managerFinal}
          onChange={(v) => put('managerFinal', v)}
        />
        <ul className="cfglist">
          <li className="itk-sup">
            <Switch
              label="حدّ مبلغ الرفض النهائي"
              on={Boolean(d.managerRejectCapOn)}
              onChange={(v) => put('managerRejectCapOn', v)}
            />
            {d.managerRejectCapOn && <CfgNum value={d.managerRejectUpTo} label="حدّ مبلغ الرفض النهائي" suffix="ريال" onChange={(n) => put('managerRejectUpTo', n)} />}
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>يُقترح «يتطلب خطة» من مبلغ</b></span>
            <span className="pc-sp" />
            <CfgNum value={d.planFrom} label="مبلغ اقتراح الخطة" suffix="ريال" onChange={(n) => put('planFrom', n)} />
          </li>
        </ul>
      </Glass>

      <Glass>
        <Head title="المدير التنفيذي" />
        <Switch
          label="إحالة تلقائية للجنة فوق حد المدير التنفيذي"
          on={Boolean(d.autoReferAboveExec)}
          onChange={(v) => put('autoReferAboveExec', v)}
        />
        {/* v3 · 6.4.1 · within his authority the executive refers to the committee only on a criterion */}
        <h4 className="fnd-h">معايير الإحالة للجنة ضمن صلاحيته</h4>
        <ul className="cfglist">
          {d.referCriteria.map((c, i) => (
            <li key={`${c}-${i}`} className="itk-sup">
              <span className="cfgl"><b>{c}</b></span>
              <span className="pc-sp" />
              <Button plain type="button" className="iact" aria-label={`احذف المعيار ${c}`} title="احذف" onClick={() => put('referCriteria', d.referCriteria.filter((_, j) => j !== i))}><Icon name={icons.close} size="sm" /></Button>
            </li>
          ))}
        </ul>
        <div className="cfgrow">
          <FieldBox><input value={crit} onChange={(e) => setCrit(e.target.value)} placeholder="معيار إحالة جديد" aria-label="معيار إحالة جديد" /></FieldBox>
          <Button type="button" variant="2" className="cfgadd" disabled={!crit.trim() || d.referCriteria.includes(crit.trim())} onClick={() => { put('referCriteria', [...d.referCriteria, crit.trim()]); setCrit('') }}>أضف المعيار</Button>
        </div>
        <ul className="cfglist">
          <li className="itk-sup">
            <span className="cfgl"><b>نسبة التجاوز المسموحة لحده</b><span className="sub">حدّه <Num>{execCap}</Num> · بالتجاوز <Num>{Math.round(execCap * (1 + d.execOverPct / 100))}</Num></span></span>
            <span className="pc-sp" />
            <CfgNum value={d.execOverPct} label="نسبة التجاوز" suffix="بالمئة" onChange={(n) => put('execOverPct', Math.min(50, n))} />
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>عدد المشاريع المعتمدة للجهة</b></span>
            <span className="pc-sp" />
            {limit('execEntity', 'count', 'عدد مشاريع الجهة للمدير التنفيذي', 'مشروع')}
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>إجمالي قيمة مشاريع الجهة</b></span>
            <span className="pc-sp" />
            {limit('execEntity', 'total', 'إجمالي قيمة مشاريع الجهة للمدير التنفيذي', 'ريال')}
          </li>
        </ul>
      </Glass>

      <Glass>
        <Head title="اللجنة التنفيذية" meta={<span className="sub">{/* doc 6.4.19 – 6.4.21 */}حدّها في المصفوفة <Num>{capOf('committee')}</Num></span>} />
        <ul className="cfglist">
          <li className="itk-sup">
            <span className="cfgl"><b>عدد المشاريع المعتمدة للجهة</b></span>
            <span className="pc-sp" />
            {limit('committeeEntity', 'count', 'عدد مشاريع الجهة للجنة', 'مشروع')}
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>إجمالي قيمة مشاريع الجهة</b></span>
            <span className="pc-sp" />
            {limit('committeeEntity', 'total', 'إجمالي قيمة مشاريع الجهة للجنة', 'ريال')}
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>فترة الحساب</b></span>
            <span className="pc-sp" />
            <CfgNum value={d.periodDays} min={30} label="فترة الحساب" suffix="يومًا" onChange={(n) => put('periodDays', n)} />
          </li>
        </ul>
      </Glass>

      <Glass>
        <Head title="الجلسات" />
        <ul className="cfglist">
          <li className="itk-sup">
            <span className="cfgl"><b>أعضاء اللجنة التنفيذية</b></span><span className="pc-sp" />
            <FieldMultiSelect label="أعضاء اللجنة" placeholder="اختر الأعضاء" people values={d.committeeMembers} options={STAFF()} onChange={(v) => put('committeeMembers', v)} />
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>أعضاء مجلس الأمناء</b></span><span className="pc-sp" />
            <FieldMultiSelect label="أعضاء المجلس" placeholder="اختر الأعضاء" people values={d.boardMembers} options={STAFF()} onChange={(v) => put('boardMembers', v)} />
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>النصاب</b></span><span className="pc-sp" />
            <CfgNum value={d.quorum} min={1} label="النصاب" suffix="أعضاء" onChange={(n) => put('quorum', n)} />
          </li>
          {/* Client 18 Oct · decision 14 · no per-member votes · the voting rule is retired · the CEO records
              the body's final decision with the minutes */}
          <li className="itk-sup">
            <span className="cfgl"><b>من يسجّل جلسات اللجنة</b></span><span className="pc-sp" />
            <FieldMultiSelect placeholder="لا أحد" values={d.committeeBy} options={ROLE_OPTS} onChange={(v) => put('committeeBy', v as RoleKey[])} />
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>من يسجّل جلسات المجلس</b></span><span className="pc-sp" />
            <FieldMultiSelect placeholder="لا أحد" values={d.boardBy} options={ROLE_OPTS} onChange={(v) => put('boardBy', v as RoleKey[])} />
          </li>
        </ul>
      </Glass>

      <Glass>
        <Head title="الاستراتيجية" />
        <Switch
          label="لا يُعتمد مشروع خارج المجالات الممولة والتوجهات النشطة"
          on={d.requireStrategy}
          onChange={(v) => put('requireStrategy', v)}
        />
      </Glass>

      <Glass>
        <Head title="تعارض المصالح المعلن" meta={<span className="sub">{/* doc 5.4.24 */}<Num>{d.conflicts.length}</Num></span>} />
        <ul className="cfglist">
          {d.conflicts.map((c, i) => (
            <li key={`${c.person}-${c.entityId}`}>
              <Person name={c.person} />
              <span className="sub trim1">{entityRows.find((e) => e.id === c.entityId)?.name ?? c.entityId} · {c.reason}</span>
              <span className="pc-sp" />
              <Button variant="ghost" size="sm" aria-label={`احذف تعارض ${c.person}`} onClick={() => put('conflicts', d.conflicts.filter((_, j) => j !== i))}>
                <Icon name={icons.close} size="sm" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="apv-row">
          <MultiSelect label="الشخص" all="الشخص" people values={cp ? [cp] : []} options={STAFF()} onChange={(v) => setCp(v[v.length - 1] ?? '')} />
          <FieldSelect value={ce} label="الجهة" placeholder="الجهة" searchAt={6} options={entityRows.filter((e) => !e.archived).slice(0, 200).map((e) => ({ value: e.id, label: e.name }))} onChange={setCe} />
          <FieldBox><input value={cr} onChange={(e) => setCr(e.target.value)} placeholder="سبب التعارض" aria-label="سبب التعارض" /></FieldBox>
          <Button variant="2" size="sm" disabled={!cp || !ce || !cr.trim()} onClick={() => { put('conflicts', [...d.conflicts, { person: cp, entityId: ce, reason: cr.trim() }]); setCp(''); setCe(''); setCr('') }}>
            <Icon name={icons.plus} size="sm" />أضف
          </Button>
        </div>
      </Glass>

      <Glass>
        <Head title="بيانات العرض التجريبي" />
        <Button type="button" variant="2" onClick={resetApprovals}>أعد ضبط بيانات الاعتماد</Button>
      </Glass>

      {dirty && (
        <SaveBar
          count={1}
          sentence="تعديل قواعد مسار الاعتماد"
          onSave={() => { saveApprovalRules(d); setSaved(structuredClone(d)) }}
          onDiscard={() => setD(structuredClone(saved))}
        />
      )}
    </>
  )
}

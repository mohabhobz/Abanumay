import { useState } from 'react'
import { FieldMultiSelect, Glass, Head, Num, Switch } from '@/components/ui'
import { SaveBar } from '@/components/shell'
import { CfgNum } from '@/features/settings/CfgEdit'
import { STAFF_ROLES, type RoleKey } from '@/data/roles'
import { ENTITY_RULES, FILE_FIELDS, saveEntityRules, type EntityRules } from '@/data/entities/rules'
import { resetEntities } from '@/data/entities/store'

/* Registration and update rules · the switches and numbers behind BPD-002, edited without code.

   The first card holds a decision the foundation still owes: the document refuses an incomplete
   registration, the client asked to let it through. Both are built; this switch chooses. */

const ROLE_OPTS = STAFF_ROLES.map((r) => ({ value: r.key, label: r.title }))

export function EntityRulesTab() {
  const [saved, setSaved] = useState<EntityRules>(() => structuredClone(ENTITY_RULES))
  const [d, setD] = useState<EntityRules>(() => structuredClone(ENTITY_RULES))
  const dirty = JSON.stringify(d) !== JSON.stringify(saved)
  const put = <K extends keyof EntityRules>(k: K, v: EntityRules[K]) => setD((x) => ({ ...x, [k]: v }))
  const roles = (k: 'approveBy' | 'returnBy' | 'updateBy' | 'statusBy' | 'suspendBy' | 'revokeBy' | 'archiveBy' | 'bankBy' | 'askBy' | 'notifyBy' | 'assignBy' | 'registerBy' | 'relinkEntityBy' | 'editBy', label: string) => (
    <li className="itk-sup">
      <span className="cfgl"><b>{label}</b></span>
      <span className="pc-sp" />
      <FieldMultiSelect placeholder="لا أحد" values={d[k] ?? []} options={ROLE_OPTS} onChange={(v) => put(k, v as RoleKey[])} />
    </li>
  )

  return (
    <>
      <Glass>
        <Head title="إرسال طلب التسجيل" />
        <Switch
          label="لا يُرسل طلب التسجيل قبل اكتمال البيانات والمستندات"
          on={d.blockIncomplete}
          onChange={(v) => put('blockIncomplete', v)}
        />
      </Glass>

      <Glass>
        <Head title="رموز التحقّق" />
        <ul className="cfglist">
          <li className="itk-sup">
            <span className="cfgl"><b>صلاحية الرمز</b></span>
            <span className="pc-sp" />
            <CfgNum value={d.otpMinutes} min={1} label="صلاحية الرمز بالدقائق" suffix="دقائق" onChange={(v) => put('otpMinutes', v)} />
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>المحاولات الخاطئة</b></span>
            <span className="pc-sp" />
            <CfgNum value={d.otpAttempts} min={1} label="عدد المحاولات" suffix="محاولات" onChange={(v) => put('otpAttempts', v)} />
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>الانتظار قبل رمز جديد</b></span>
            <span className="pc-sp" />
            <CfgNum value={d.resendSeconds} min={10} label="الانتظار بالثواني" suffix="ثانية" onChange={(v) => put('resendSeconds', v)} />
          </li>
        </ul>
      </Glass>

      <Glass>
        <Head title="سياسة كلمات المرور" />
        <ul className="cfglist">
          <li className="itk-sup">
            <span className="cfgl"><b>الحد الأدنى للطول</b></span>
            <span className="pc-sp" />
            <CfgNum value={d.passMin} min={6} label="الحد الأدنى للطول" suffix="أحرف" onChange={(v) => put('passMin', v)} />
          </li>
        </ul>
        <Switch label="تتضمّن حرفًا واحدًا على الأقل" on={d.passNeedsLetter} onChange={(v) => put('passNeedsLetter', v)} />
        <Switch label="تتضمّن رقمًا واحدًا على الأقل" on={d.passNeedsDigit} onChange={(v) => put('passNeedsDigit', v)} />
      </Glass>

      <Glass>
        <Head title="أصحاب القرار" />
        <ul className="cfglist">
          {roles('approveBy', 'اعتماد طلب التسجيل أو رفضه')}
          {roles('returnBy', 'إعادة طلب التسجيل للاستكمال')}
          {roles('updateBy', 'قرار طلب تحديث البيانات')}
          {roles('statusBy', 'تعديل حالة الجهة')}
          {roles('suspendBy', 'تعليق الأهلية ورفعه')}
          {roles('revokeBy', 'إلغاء اعتماد الجهة')}
          {roles('archiveBy', 'أرشفة الجهة')}
          {roles('bankBy', 'إدارة الحسابات البنكية')}
          {roles('registerBy', 'التسجيل المباشر للجهة')}
          {roles('editBy', 'تعديل بيانات الجهة')}
          {roles('relinkEntityBy', 'تعديل الجهة المرتبطة بمشروع')}
        </ul>
      </Glass>

      <Glass>
        <Head title="الإجراءات على القائمة" />
        <ul className="cfglist">
          {roles('askBy', 'طلب تحديث البيانات')}
          {roles('notifyBy', 'إرسال إشعار')}
          {roles('assignBy', 'إسناد المراجعة')}
          <li className="itk-sup">
            <span className="cfgl"><b>الحد الأقصى للدفعة</b></span>
            <span className="pc-sp" />
            <CfgNum value={d.bulkMax} min={1} label="الحد الأقصى للدفعة" suffix="جهة" onChange={(v) => put('bulkMax', v)} />
          </li>
        </ul>
        <Switch label="تُسند الطلبات إلى مشرف محدد" on={d.assignOn} onChange={(v) => put('assignOn', v)} />
      </Glass>

      <Glass>
        <Head title="ما يحتاج إلى اعتماد عند التحديث" hint="الحقول المختارة تنتظر اعتماد المؤسسة، والباقي يُطبَّق فور الإرسال." meta={<span className="sub"><Num>{d.approvalFields.length}</Num> من <Num>{FILE_FIELDS.length}</Num> حقلًا</span>} />
        <FieldMultiSelect
          placeholder="لا شيء · كل التعديلات فورية"
          values={d.approvalFields}
          options={FILE_FIELDS.map((f) => ({ value: f.key, label: f.label }))}
          onChange={(v) => put('approvalFields', v)}
        />
      </Glass>

      <Glass>
        <Head title="تنبيه انتهاء المستندات" hint="المتغيّرات: {المستند} · {n} الأيام الباقية · {التاريخ} تاريخ الانتهاء" />
        <ul className="cfglist">
          <li className="itk-sup">
            <span className="cfgl"><b>مواعيد التنبيه (أيام قبل الانتهاء)</b></span>
            <span className="pc-sp" />
            <span className="fld"><input dir="ltr" value={d.expiryOffsets.join(', ')} aria-label="مواعيد التنبيه بالأيام"
              onChange={(e) => put('expiryOffsets', e.target.value.split(/[,،\s]+/).map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))} /></span>
          </li>
          {([
            ['expiryText', 'نص التنبيه'],
            ['expiryUrgentText', 'نص التنبيه الأخير'],
            ['expiredText', 'نص الانتهاء'],
          ] as const).map(([k, t]) => (
            <li key={k} className="itk-sup">
              <span className="cfgl"><b>{t}</b></span>
              <span className="pc-sp" />
              <span className="fld"><input value={d[k]} aria-label={t} onChange={(e) => put(k, e.target.value)} /></span>
            </li>
          ))}
        </ul>
      </Glass>

      <Glass>
        <Head title="بيانات العرض التجريبي" />
        <button type="button" className="btn btn-2" onClick={resetEntities}>أعد ضبط بيانات الجهات</button>
      </Glass>

      {dirty && (
        <SaveBar
          count={1}
          sentence="تعديل قواعد التسجيل والتحديث"
          onSave={() => { saveEntityRules(d); setSaved(structuredClone(d)) }}
          onDiscard={() => setD(structuredClone(saved))}
        />
      )}
    </>
  )
}

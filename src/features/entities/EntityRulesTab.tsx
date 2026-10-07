import { useState } from 'react'
import { Glass, Head, MultiSelect, Num, Switch, Tag } from '@/components/ui'
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
  const roles = (k: 'approveBy' | 'returnBy' | 'updateBy' | 'statusBy', label: string, note: string) => (
    <li className="itk-sup">
      <span className="cfgl"><b>{label}</b><span className="sub">{note}</span></span>
      <span className="pc-sp" />
      <MultiSelect all="لا أحد" values={d[k]} options={ROLE_OPTS} onChange={(v) => put(k, v as RoleKey[])} />
    </li>
  )

  return (
    <>
      <Glass>
        <Head title="إرسال طلب التسجيل" meta={<Tag tone="warn">قرار معلّق</Tag>} />
        <Switch
          label="لا يُرسل طلب التسجيل قبل اكتمال البيانات والمستندات"
          note={<>الوثيقة تشترطه (<bdi>2.2.7 · 2.4.4</bdi>) · والعميل طلب في 30 سبتمبر إتاحة الإرسال وترك النواقص للمراجع · مطفأ على طلب العميل</>}
          on={d.blockIncomplete}
          onChange={(v) => put('blockIncomplete', v)}
        />
      </Glass>

      <Glass>
        <Head title="رموز التحقّق" meta={<span className="sub">التسجيل · الاستعادة · تحديث الاتصال</span>} />
        <ul className="cfglist">
          <li className="itk-sup">
            <span className="cfgl"><b>صلاحية الرمز</b><span className="sub">بعدها يلزم رمز جديد</span></span>
            <span className="pc-sp" />
            <CfgNum value={d.otpMinutes} min={1} label="صلاحية الرمز بالدقائق" suffix="دقائق" onChange={(v) => put('otpMinutes', v)} />
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>المحاولات الخاطئة</b><span className="sub">يُلغى الرمز بعدها (<bdi>2.3.pw-13</bdi>)</span></span>
            <span className="pc-sp" />
            <CfgNum value={d.otpAttempts} min={1} label="عدد المحاولات" suffix="محاولات" onChange={(v) => put('otpAttempts', v)} />
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>الانتظار قبل رمز جديد</b><span className="sub">يمنع إغراق الجوال بالرسائل</span></span>
            <span className="pc-sp" />
            <CfgNum value={d.resendSeconds} min={10} label="الانتظار بالثواني" suffix="ثانية" onChange={(v) => put('resendSeconds', v)} />
          </li>
        </ul>
      </Glass>

      <Glass>
        <Head title="سياسة كلمات المرور" meta={<span className="sub"><bdi>2.3.pw-8</bdi></span>} />
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
        <Head title="أصحاب القرار" meta={<span className="sub"><bdi>2.2.15 · 2.4.16 · 2.3.upd-9</bdi></span>} />
        <ul className="cfglist">
          {roles('approveBy', 'اعتماد طلب التسجيل أو رفضه', 'ومعه قرار كل حساب بنكي')}
          {roles('returnBy', 'إعادة طلب التسجيل للاستكمال', 'بملاحظة وحقول محدّدة')}
          {roles('updateBy', 'قرار طلب تحديث البيانات', 'اعتماد أو إعادة أو رفض')}
          {roles('statusBy', 'تعليق الجهة وإلغاء اعتمادها وأرشفتها', 'وتعطيل الحسابات البنكية')}
        </ul>
      </Glass>

      <Glass>
        <Head title="ما يحتاج إلى اعتماد عند التحديث" meta={<span className="sub"><Num>{d.approvalFields.length}</Num> من <Num>{FILE_FIELDS.length}</Num> حقلًا</span>} />
        <p className="sub cnote">الحقول المختارة تنتظر قرار المؤسسة ويُعلَّق معها نشاط الجهة · والباقي يُطبَّق فور الإرسال (<bdi>2.3.upd-8</bdi>). الحسابات البنكية والوثائق المجدَّدة باعتماد دائمًا.</p>
        <MultiSelect
          wide
          all="لا شيء · كل التعديلات فورية"
          values={d.approvalFields}
          options={FILE_FIELDS.map((f) => ({ value: f.key, label: f.label }))}
          onChange={(v) => put('approvalFields', v)}
        />
      </Glass>

      <Glass>
        <Head title="بيانات العرض التجريبي" />
        <p className="sub cnote">يُعيد طلبات التسجيل والتحديث وحالات الجهات إلى بداية العرض.</p>
        <button type="button" className="btn btn-2" onClick={resetEntities}>أعد ضبط بيانات الجهات</button>
      </Glass>

      {dirty && (
        <SaveBar
          count={1}
          sentence={<>تعديل قواعد التسجيل والتحديث<span className="decsep" /><span className="sub">تسري على النماذج والمراجعة فور الحفظ</span></>}
          onSave={() => { saveEntityRules(d); setSaved(structuredClone(d)) }}
          onDiscard={() => setD(structuredClone(saved))}
        />
      )}
    </>
  )
}

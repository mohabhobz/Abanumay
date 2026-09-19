import { FieldSelect } from '@/components/ui'
import { citiesOf, type RegField } from '@/data/mock/registration'

/**
 * حقل واحد.
 *
 * القيم المقفولة `select` والباقي `input` · وأسماء البنوك تحديدًا
 * مقفولة بقاعدة 27 عشان الاسم ما يتكتبش بعشر صيغ فيبقى الفرز
 * مستحيل. والتلميحات المكتوبة هنا منقولة من النظام العامل حرفيًا.
 */
export function Field({
  f, value, parent, onChange,
}: {
  f: RegField
  value: string
  parent: string
  onChange: (x: string) => void
}) {
  const options = f.dependsOn ? citiesOf(parent) : f.options ?? []
  const locked = Boolean(f.dependsOn) && !parent

  return (
    <label className={`regf${f.wide ? ' regf-w' : ''}${f.nl ? ' regf-nl' : ''}`}>
      <span className="lb">
        {f.label}
        {f.req && <b className="regf-r" aria-label="إلزامي">*</b>}
      </span>
      {/* ⚠️ `.fld` مش كلاس شكلي · هو **التحكّم الموجود** للحقول في
          السيستم، ومسجَّل في `ctlaudit` فحلقة تركيزه بتتفحص مع
          البحث والفلاتر. حقل مكتوب للشاشة دي كان هيبقى الركن
          السادس لنفس الشيء، وبحلقة تركيز مختلفة. */}
      {f.kind === 'select' ? (
        /* ⚠️ `FieldSelect` بيرسم `.fld` بنفسه · فمفيش `<span
           className="fld">` حواليه، وإلا بقى حقل جوّه حقل: حافتان
           وخلفيتان فوق بعض وارتفاع مضاعف. */
        <FieldSelect
          value={value}
          options={options}
          disabled={locked}
          onChange={onChange}
          label={f.label}
          placeholder={locked ? 'اختر المنطقة أولًا' : 'اختر'}
        />
      ) : (
        <span className="fld">
          {/* ⚠️ **`type="password"` مش تزويق، هو سلوك.** الحقل ده
             بياخد كلمة مرور، والمتصفح لازم يعرف ده عشان يخبّي
             الحروف ويقترح كلمة قوية وما يحفظهاش في الأوتوفيل
             العادي · و`text` كان هيعرض اللي المستخدم بيكتبه على
             شاشة ممكن تكون متشيَّرة في اجتماع. */}
          {/* ⚠️ **`id` مش زينة** · زرار «تعديل» في مودال التحقّق
              بيرجّع للحقل ده ويفوكسه (من شاشات العميل · ١٩ سبتمبر)،
              وده مستحيل من غير عنوان يوصل له. */}
          <input
            id={`rf-${f.key}`}
            type={
              f.kind === 'date' ? 'date'
                : f.kind === 'number' ? 'number'
                  : f.kind === 'password' ? 'password'
                    : f.kind === 'email' ? 'email' : 'text'
            }
            autoComplete={f.kind === 'password' ? 'new-password' : undefined}
            inputMode={f.kind === 'tel' || f.kind === 'number' ? 'numeric' : undefined}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={f.label}
          />
        </span>
      )}
      {f.hint && <span className="sub regf-h">{f.hint}</span>}
    </label>
  )
}

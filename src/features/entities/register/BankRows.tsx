import { FieldSelect, Icon, Tag, icons } from '@/components/ui'
import { DocFile } from '@/components/docs'
import { BANKS, BANK_DOC_LABEL, emptyBank, type RegBank } from '@/data/mock/registration'

/* ═══════════════════════════════════════════════════════════
   الحسابات البنكية · ن-1

   ⚠️ **قايمة لا نموذج.** النسخة القديمة كانت تلات حقول: «اسم
   البنك» و«اسم صاحب الحساب» و«الآيبان» · يعني الفورم بيفترض
   حسابًا واحدًا. والجمعية عندها حساب لكل وجه خير («تحفيظ · تفطير
   صائم · أضاحي» زي ما مظفر قال في ح-5)، فاللي عنده أربعة كان
   بيحطّ واحدًا ويبعت الباقي في إيميل · والمراجع بينقلهم بإيده.

   ⚠️ **ووثيقة الحساب جنب حسابها لا في كومة المستندات.** لو
   الوثايق كلها تحت في «المستندات»، المراجع بيبصّ على آيبان
   وبيدوّر على ورقته بين خمس ورقات مالهمش ترتيب · وهنا كل وثيقة
   ملزوقة بالصفّ اللي بتثبته.
   ═══════════════════════════════════════════════════════════ */

export function BankRows({
  banks, onChange,
}: {
  banks: RegBank[]
  onChange: (next: RegBank[]) => void
}) {
  const patch = (id: string, p: Partial<RegBank>) =>
    onChange(banks.map((b) => (b.id === id ? { ...b, ...p } : b)))

  const add = () => onChange([...banks, emptyBank(banks.length + 1)])

  /* ⚠️ آخر حساب ما يتشالش: الطلب لازم فيه حساب واحد على الأقل،
     والزرار اللي بيشيل آخر واحد بيسيب المستخدم في حالة ما ينفعش
     يبعت منها ومفيش حاجة بتقول ليه. */
  const drop = (id: string) => {
    if (banks.length <= 1) return
    onChange(banks.filter((b) => b.id !== id))
  }

  return (
    <div className="bkrows">
      {banks.map((b, i) => (
        <div className="bkrow" key={b.id}>
          <div className="bkrow-h">
            <span className="bkrow-n num">{i + 1}</span>
            <b>الحساب {i === 0 ? 'الأساسي' : `رقم ${i + 1}`}</b>
            <span className="pc-sp" />
            {b.doc
              ? <Tag tone="ok">وثيقته مرفوعة</Tag>
              : <Tag tone="warn">{BANK_DOC_LABEL} ناقصة</Tag>}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={banks.length <= 1}
              title={banks.length <= 1 ? 'لازم حساب واحد على الأقل' : `احذف الحساب ${i + 1}`}
              aria-label={`احذف الحساب ${i + 1}`}
              onClick={() => drop(b.id)}
            >
              <Icon name={icons.close} size={15} />
            </button>
          </div>

          <div className="bkrow-f">
            <label className="regf">
              <span className="lb">اسم البنك<b className="regf-r" aria-label="إلزامي">*</b></span>
              {/* قائمة مقفولة · قاعدة 27: الاسم المكتوب بعشر صيغ
                  بيخلّي الفرز مستحيل */}
              <FieldSelect
                value={b.bankName}
                options={BANKS}
                onChange={(v) => patch(b.id, { bankName: v })}
                label={`بنك الحساب ${i + 1}`}
              />
            </label>

            <label className="regf">
              <span className="lb">اسم صاحب الحساب<b className="regf-r" aria-label="إلزامي">*</b></span>
              <span className="fld">
                <input
                  value={b.bankHolder}
                  onChange={(e) => patch(b.id, { bankHolder: e.target.value })}
                  aria-label={`صاحب الحساب ${i + 1}`}
                />
              </span>
              <span className="sub regf-h">باسم الجهة · لا باسم شخص</span>
            </label>

            <label className="regf">
              <span className="lb">رقم الآيبان<b className="regf-r" aria-label="إلزامي">*</b></span>
              <span className="fld">
                <input
                  value={b.iban}
                  onChange={(e) => patch(b.id, { iban: e.target.value })}
                  aria-label={`آيبان الحساب ${i + 1}`}
                />
              </span>
              <span className="sub regf-h">SA يليه 22 رقمًا</span>
            </label>
          </div>

          {b.doc ? (
            <div className="regdoc-up">
              <DocFile name={b.doc} meta={`${BANK_DOC_LABEL} · بانتظار الإرسال`} block download={false} />
              <button className="btn btn-ghost btn-sm" onClick={() => patch(b.id, { doc: undefined })}>
                <Icon name={icons.close} size={14} />
                إزالة
              </button>
            </div>
          ) : (
            <label className="regdrop">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) patch(b.id, { doc: f.name })
                }}
              />
              <Icon name={icons.upload} size={16} />
              <span>{BANK_DOC_LABEL}</span>
              <span className="pc-sp" />
              <span className="sub regdocs-m">PDF أو صورة · إلزامية لكل حساب</span>
            </label>
          )}
        </div>
      ))}

      <button className="btn btn-2 btn-sm bkrows-a" onClick={add}>
        <Icon name={icons.plus} size={15} />
        حساب بنكي آخر
      </button>
    </div>
  )
}

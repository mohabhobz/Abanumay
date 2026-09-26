import { FieldSelect, Icon, Tag, icons } from '@/components/ui'
import { DocFile } from '@/components/docs'
import { BANKS, BANK_DOC_LABEL, emptyBank, type RegBank } from '@/data/mock/registration'

/* Bank accounts.

   Note: a list, not a form. The old version had three fields - bank name, account holder name, IBAN
   - assuming a single account. An association has one account per cause ("Qur'an memorization,
   iftar, sacrifices"), so one with four accounts would enter one and email the rest, and a reviewer
   would copy them in by hand.

   Note: an account's supporting document sits next to its own account, not in a pile of documents.
   If all documents sat under one "documents" section, a reviewer looking at an IBAN would hunt for
   its matching paper among five unordered ones - here each document is attached to the row it
   verifies. */

export function BankRows({
  banks, onChange,
}: {
  banks: RegBank[]
  onChange: (next: RegBank[]) => void
}) {
  const patch = (id: string, p: Partial<RegBank>) =>
    onChange(banks.map((b) => (b.id === id ? { ...b, ...p } : b)))

  const add = () => onChange([...banks, emptyBank(banks.length + 1)])

  /* The last account can't be removed: a request needs at least one account, and a button that
   removes the only one leaves the user unable to submit with no explanation why. */
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
              title={banks.length <= 1 ? 'يلزم حساب واحد على الأقل' : `احذف الحساب ${i + 1}`}
              aria-label={`احذف الحساب ${i + 1}`}
              onClick={() => drop(b.id)}
            >
              <Icon name={icons.close} size="sm" />
            </button>
          </div>

          <div className="bkrow-f">
            <label className="regf">
              <span className="lb">اسم البنك<b className="regf-r" aria-label="إلزامي">*</b></span>
              {/* A closed list - a bank name written ten different ways makes sorting impossible. */}
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

            {/* Note: the short name is required per the client's own screens - and its tooltip states our
   interpretation of it explicitly (the name as it appears on statements), since the client never
   explained it and the question is still open, so the entity isn't left guessing and a reviewer
   knows this is our interpretation. */}
            <label className="regf">
              <span className="lb">الاسم المختصر<b className="regf-r" aria-label="إلزامي">*</b></span>
              <span className="fld">
                <input
                  value={b.shortName}
                  onChange={(e) => patch(b.id, { shortName: e.target.value })}
                  aria-label={`الاسم المختصر للحساب ${i + 1}`}
                />
              </span>
              <span className="sub regf-h">الاسم الذي يُعرف به الحساب في الكشوف، مثل «تحفيظ»</span>
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
                <Icon name={icons.close} size="sm" />
                أزل الوثيقة
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
              <Icon name={icons.upload} size="sm" />
              <span>{BANK_DOC_LABEL}</span>
              <span className="pc-sp" />
              <span className="sub regdocs-m">PDF أو صورة · إلزامية لكل حساب</span>
            </label>
          )}
        </div>
      ))}

      <button className="btn btn-2 btn-sm bkrows-a" onClick={add}>
        <Icon name={icons.plus} size="sm" />
        أضف حسابًا بنكيًا آخر
      </button>
    </div>
  )
}

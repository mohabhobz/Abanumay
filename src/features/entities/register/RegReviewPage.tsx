import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  DateText, Empty, FieldSelect, Glass, Head, Icon, icons, KV, Mono, Num, Person, Steps, Tag,
  type StepItem,
} from '@/components/ui'
import { DocFile } from '@/components/docs'
import { Crumbs } from '@/components/shell'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { isolate } from '@/lib/format'
import { entityRows } from '@/data/mock/entities'
import {
  BANK_DOC_LABEL, BANK_REJECTS, REG_DOCS, REG_STATE_SAY, REG_STATE_WHO, REG_TONE,
  docRequired, licenseClash, partnerKind, regMissingDocs, regRequestById,
} from '@/data/mock/registration'

/* ═══════════════════════════════════════════════════════════
   مراجعة طلب تسجيل · محطة مسؤول النظام

   ⚠️ **المراجع بيراجع إقرارًا لا سجلًا.** كل رقم في الشاشة دي
   كتبته الجهة عن نفسها في بوّابة عامة · فدرجة الحوكمة موسومة
   «إقرار الجهة»، ورقم الترخيص متحقَّق منه قدام المراجع لا بعد
   القرار. المعلومة اللي المراجع محتاجها مش «إيه البيانات»، هي
   **«إيه اللي ما اتأكّدش»**.

   ═══ تلات مخارج، ومخرج رابع للبنك ═══

     اعتماد وتفعيل   → الجهة **بتتولد** هنا وبيتبعت اسم المستخدم
     إعادة للاستكمال → بترجع للجهة بملاحظة · قاعدة 26
     رفض وإيقاف      → بيتأرشف بسببه · قاعدتا 28 و31

   والملاحظة الإدارية **إلزامية** في التانيين · النظام العامل
   بيفرضها في «قبول و تفعيل» و«رفض وإيقاف»، والقاعدة 31 بتلزم
   كتابة سبب الإيقاف أو سحب الاعتماد.

   ⚠️ **واعتماد الحساب البنكي منفصل** · النظام عنده شاشتان للبنوك
   وسبعة أسباب رفض مكوَّدة، فالبنك بياخد قراره لوحده حتى لو اتدخل
   في نفس الطلب (قاعدة 11). الفرق ده مسجَّل في البريف نوتة ن-4.

   ⚠️ **ومفيش زرار حذف.** قاعدة 28: ممنوع الحذف نهائيًا · أرشفة أو
   تعطيل. والغياب ده مكتوب في الشاشة لأن الغياب ما بيشرحش نفسه.
   ═══════════════════════════════════════════════════════════ */

type Outcome = 'approve' | 'return' | 'reject'

const OUT_SAY: Record<Outcome, string> = {
  approve: 'اعتماد وتفعيل · أُنشئت الجهة وأُرسل اسم المستخدم',
  return: 'إعادة للاستكمال · رجع الطلب للجهة بالملاحظة',
  reject: 'رفض وإيقاف · أُرشف الطلب بسببه',
}

export default function RegReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const r = id ? regRequestById(id) : undefined
  const [note, setNote] = useState('')
  const [taken, setTaken] = useState<Outcome | null>(null)
  const [bankNo, setBankNo] = useState<string>('')

  /* ⚠️ رقم طلب غلط ≠ طلب فاضي · نفس الدرس اللي اتعلم في شاشة
     الصرف: الشاشة اللي بتكمّل على `undefined` بتفضل «سليمة»
     فكل أدوات الفحص بترجع خضرا وهي بتقيس شاشة غلط. */
  const missingDocs = useMemo(() => (r ? regMissingDocs(r) : []), [r])
  const clash = useMemo(
    () => (r ? licenseClash(r.licenseNo, r.type, entityRows) : null),
    [r],
  )

  if (!r) {
    return (
      <AppLayout assistantContext={assistFor.page('طلبات تسجيل الجهات')}>
        <div className="viewstack">
          <div className="screen col">
            {/* الحالة الفاضية: مفيش طلب، فمفيش آخر مستوى يتسمّى */}
            <Crumbs
              items={[
                { label: 'الجهات', to: ROUTES.entities },
                { label: 'طلبات التسجيل' },
              ]}
            />
            <Glass>
              <Empty
                title="الطلب غير موجود."
                note="يمكن يكون اتأرشف أو الرابط قديم · والطلبات لا تُحذف (قاعدة 28)."
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.entityRequests)}>
                    ارجع للصندوق
                  </button>
                }
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  const decided = r.state === 'approved' || r.state === 'rejected'
  const open = r.state === 'review'
  const blocked = missingDocs.length > 0 || Boolean(clash)

  const steps: StepItem[] = [
    { label: 'تعبئة الجهة وإرسالها', at: <DateText>{r.submittedAt}</DateText>, state: 'done' },
    {
      label: 'تحقّق الجوال · قاعدة 19',
      note: r.clerkMobile,
      state: r.state === 'draft' ? 'todo' : 'done',
    },
    {
      label: 'مراجعة مسؤول النظام',
      note: REG_STATE_WHO[r.state],
      at: r.decidedAt ? <DateText>{r.decidedAt}</DateText> : '',
      state: decided ? 'done' : r.state === 'draft' ? 'todo' : 'now',
    },
    {
      label: 'إنشاء حساب الجهة · قاعدة 2',
      note: r.entityId ? `الجهة ${r.entityId}` : 'بعد الاعتماد وحده',
      state: r.entityId ? 'done' : 'todo',
    },
  ]

  return (
    <AppLayout assistantContext={assistFor.page('مراجعة طلب تسجيل', r.name)}>
      <div className="viewstack hasdock">
        {/* `hasg2` زي صفحة الطلب والاتفاقية · المحتوى بيخلص فوق
            الرصيف فالتدرّج بيبان، والعمود الجانبي بياخد مسافة لزقه */}
        <div className="screen col hasg2">
          <Crumbs
            items={[
              { label: 'الجهات', to: ROUTES.entities },
              { label: 'طلبات التسجيل', to: ROUTES.entityRequests },
              { label: r.id },
            ]}
          />

          <header>
            <div>
              <h1 className="ptitle">{r.name}</h1>
              <p className="sub mt-1">
                <Mono>{r.id}</Mono> · {r.type} · {REG_STATE_WHO[r.state]}
              </p>
            </div>
            <Tag tone={REG_TONE[r.state]}>{REG_STATE_SAY[r.state]}</Tag>
          </header>

          <div className="g2">
            <div className="col">
              {/* ⚠️ كارت التحقّقات فوق البيانات عن قصد · المراجع
                  محتاج «إيه اللي ما اتأكّدش» قبل «إيه البيانات» */}
              <Glass>
                <Head
                  title="ما يمنع الاعتماد"
                  meta={blocked ? <Tag tone="no">موقوف</Tag> : <Tag tone="ok">لا مانع</Tag>}
                />
                <ul className="payq-ck">
                  <li className={clash ? 'no' : 'ok'}>
                    <Icon name={clash ? icons.alert : icons.check} size={13} />
                    <span>
                      {clash
                        ? <>رقم الترخيص مسجَّل لـ «{clash.name}» بنفس التصنيف</>
                        : <>رقم الترخيص <Mono>{r.licenseNo}</Mono> غير مكرَّر في التصنيف ده</>}
                    </span>
                    <span className="payq-r">قاعدة <Num>8</Num></span>
                  </li>
                  <li className={missingDocs.length ? 'no' : 'ok'}>
                    <Icon name={missingDocs.length ? icons.alert : icons.check} size={13} />
                    <span>
                      {missingDocs.length
                        ? <>ناقص <Num>{missingDocs.length}</Num>: {missingDocs.map((d) => d.label).join(' · ')}</>
                        : 'كل المستندات الإلزامية للتصنيف ده مرفوعة'}
                    </span>
                    <span className="payq-r">قاعدة <Num>4</Num></span>
                  </li>
                  <li className={r.governanceClaim > 0 ? 'ok' : 'no'}>
                    <Icon name={r.governanceClaim > 0 ? icons.check : icons.alert} size={13} />
                    <span>
                      درجة الحوكمة{' '}
                      {r.governanceClaim > 0
                        ? <><span className="num">{r.governanceClaim}</span> · <b>إقرار الجهة</b> لا تقييمنا</>
                        : <>أُقرّت بصفر · النظام يطلب ذلك عند عدم إجراء التقييم</>}
                    </span>
                    <span className="payq-r">نوتة ن-<Num>2</Num></span>
                  </li>
                </ul>
              </Glass>

              <Glass>
                <Head title="التعريف" meta="كما أقرّت به الجهة" />
                <KV
                  rows={[
                    { k: 'اسم الجهة', v: r.name },
                    /* ⚠️ النوع ده **الجهة ما شافتهوش** · اتحطّ
                       أوتوماتيك لأنها جاية من البوّابة. والمراجع
                       لازم يشوفه لأنه بيفتح كونديشنز في إجراءات
                       بعده، ولأنه الحاجة الوحيدة في الصفحة اللي
                       مش إقرارًا منها. */
                    {
                      k: 'نوع الشراكة',
                      v: (
                        <span className="kvpair">
                          {partnerKind(r.partner).label}
                          <Tag tone="mute">افتراضي للجاي من البوّابة</Tag>
                        </span>
                      ),
                    },
                    { k: 'تصنيف الجهة', v: r.type },
                    { k: 'جهة الإشراف الفني', v: r.licensor },
                    { k: 'رقم الترخيص', v: <Mono>{r.licenseNo}</Mono> },
                    { k: 'المنطقة', v: r.region },
                    { k: 'المحافظة / المدينة', v: r.city },
                    { k: 'تاريخ التأسيس', v: <DateText>{r.foundedAt}</DateText> },
                    { k: 'نهاية الترخيص', v: <DateText>{r.licenseEndsAt}</DateText> },
                    {
                      k: 'نهاية تكليف المجلس',
                      v: (
                        <span className="kvpair">
                          <DateText>{r.boardEndsAt}</DateText>
                          <Tag tone="mute">قاعدة 18 في إجراء التحديث</Tag>
                        </span>
                      ),
                    },
                  ]}
                />
              </Glass>

              <Glass>
                <Head title="الاتصال والأشخاص" meta="مدخل البيانات يصله اسم المستخدم" />
                <KV
                  rows={[
                    { k: 'جوال الجهة', v: <Mono>{r.mobile}</Mono> },
                    /* ك-2 · البريد **حقل قابل للفعل** لا نصّ يتنسخ
                       بالإيد · ودي أكتر حاجة بتتعمل في مراجعة طلب */
                    {
                      k: 'البريد الإلكتروني',
                      v: <a className="tlink" href={`mailto:${r.email}`}><Mono>{r.email}</Mono></a>,
                    },
                    { k: 'المدير التنفيذي', v: <Person name={r.directorName} quiet={false} /> },
                    { k: 'مدخل البيانات', v: <Person name={r.clerkName} quiet={false} /> },
                    { k: 'جوال مدخل البيانات', v: <Mono>{r.clerkMobile}</Mono> },
                    {
                      k: 'بريد مدخل البيانات',
                      v: <a className="tlink" href={`mailto:${r.clerkEmail}`}><Mono>{r.clerkEmail}</Mono></a>,
                    },
                  ]}
                />
              </Glass>

              {/* المستندات بنفس معاملة المشاريع والجهات · `DocFile`
                  بثامبنيله، عشان المراجع يعرف إن الترخيص **صورة
                  ممسوحة** من الصف نفسه قبل ما يفتحه */}
              <Glass>
                <Head
                  title="المستندات"
                  meta={
                    <span className="sub">
                      <Num>{r.docs.length}</Num> مرفوعًا · المطلوب للتصنيف{' '}
                      <Num>{REG_DOCS.filter((d) => docRequired(d, r.type)).length}</Num>
                    </span>
                  }
                />
                {/* ⚠️ **المرفوع والغايب مش نفس الشيء، فمش نفس الصفّ.**
                    أول نسخة حطّتهم في شبكة واحدة · والنتيجة إن اسم
                    زي «شهادة التسجيل في ضريبة القيمة المضافة»
                    اتكسر على خمس سطور جوّه خانة معمولة لثامبنيل
                    ملف. المرفوع بياخد `DocFile` بثامبنيله (نفس
                    معاملة المشاريع والجهات)، والغايب قائمة سطور ·
                    وهي اللي المراجع بيقراها فعلًا. */}
                <div className="docgrid">
                  {REG_DOCS.filter((d) => r.docs.includes(d.key)).map((d) => (
                    <DocFile
                      key={d.key}
                      name={`${d.label}.pdf`}
                      meta={docRequired(d, r.type) ? 'إلزامي' : 'اختياري'}
                      block
                    />
                  ))}
                </div>

                {REG_DOCS.some((d) => !r.docs.includes(d.key)) && (
                  <>
                    <p className="sub cnote">لم تُرفع</p>
                    <ul className="regmiss-l">
                      {REG_DOCS.filter((d) => !r.docs.includes(d.key)).map((d) => {
                        const need = docRequired(d, r.type)
                        return (
                          <li key={d.key} className={need ? 'no' : ''}>
                            <Icon name={need ? icons.alert : icons.doc} size={15} />
                            <span className={need ? '' : 'sub'}>{d.label}</span>
                            <span className="pc-sp" />
                            <Tag tone={need ? 'no' : 'mute'}>
                              {need ? 'إلزامي لهذا التصنيف' : 'اختياري'}
                            </Tag>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}
              </Glass>
            </div>

            <div className="col">
              <Glass>
                <Head title="مسار الطلب" meta={<span className="sub">قاعدة 30 · سجل التدقيق</span>} />
                <Steps items={steps} flow="ladder" />
              </Glass>

              {/* الحساب البنكي · قرار منفصل حتى لو الإدخال واحد */}
              <Glass>
                <Head
                  title="الحسابات البنكية"
                  meta={<>
                    <span className="sub"><Num>{r.banks.length}</Num> حساب</span>
                    {' '}<Tag tone="mute">اعتماد منفصل</Tag>
                  </>}
                />
                {/* ⚠️ **حساب لكل وجه خير (ح-5)، فالمراجعة قايمة لا
                    صفّ.** ووثيقة كل حساب جنبه لا في كومة المستندات:
                    المراجع بيقارن الآيبان بالورقة، وكومة مستندات
                    مالهاش ترتيب بتخلّيه يدوّر. */}
                <ul className="rgbanks">
                  {r.banks.map((b, i) => (
                    <li key={b.id}>
                      <span className="rgbank-n num">{i + 1}</span>
                      <div className="rgbank-b">
                        <div className="rgbank-t">
                          <b>{b.bankName}</b>
                          <span className="sub">· {b.bankHolder}</span>
                        </div>
                        <div className="sub"><Mono>{b.iban}</Mono></div>
                        {b.doc
                          ? <DocFile name={b.doc} meta={BANK_DOC_LABEL} />
                          : <span className="bad">{BANK_DOC_LABEL} ناقصة</span>}
                      </div>
                    </li>
                  ))}
                </ul>
                {open && (
                  <label className="regf mt-3">
                    <span className="lb">سبب رفض الحساب · إن وُجد</span>
                    <FieldSelect
                      value={bankNo}
                      options={BANK_REJECTS}
                      onChange={setBankNo}
                      label="سبب رفض الحساب البنكي"
                      placeholder="الحساب مقبول"
                    />
                  </label>
                )}
                <p className="sub cnote">
                  الأسباب السبعة دي مكوَّدة في النظام العامل · الحساب بياخد قراره
                  لوحده حتى لو اتدخل في نفس الطلب (قاعدة{' '}
                  <span className="num">11</span>).
                </p>
              </Glass>

              {r.note && (
                <Glass>
                  <Head
                    title={r.state === 'rejected' ? 'سبب الرفض' : 'ملاحظة الاستكمال'}
                    meta={<Tag tone={r.state === 'rejected' ? 'no' : 'ret'}>قاعدة 31</Tag>}
                  />
                  <div className="payq-note">
                    <Icon name={icons.chat} size={15} />
                    <span>{isolate(r.note)}</span>
                  </div>
                </Glass>
              )}

              <Glass>
                <Head title="ما لا يوجد في هذه الشاشة" />
                <p className="sub cnote">
                  مفيش زرار حذف · القاعدة <span className="num">28</span> تمنع الحذف
                  نهائيًا، والمرفوض يُؤرشف والقائم يُعطَّل. والمؤرشف يظهر لمسؤول
                  النظام وحده ببحث مخصّص (القاعدة <span className="num">29</span>)،
                  وهي شاشة لم تُبنَ بعد.
                </p>
              </Glass>
            </div>
          </div>
        </div>

        {/* ═══ الدوك ═══ */}
        <div className="decdock">
          <div className="chrome decbar payact">
            {taken ? (
              <>
                <div className="rowf gp-3">
                  <Icon name={icons.check} size={18} className="ok-ink" />
                  <span className="decsent">
                    اتسجّل: <b>{OUT_SAY[taken]}</b>
                    {bankNo && <><span className="decsep" />الحساب البنكي مرفوض · {bankNo}</>}
                  </span>
                </div>
                <button className="btn btn-2" onClick={() => { setTaken(null); setNote('') }}>
                  تراجع
                </button>
              </>
            ) : !open ? (
              <div className="rowf gp-3 payact-w">
                <span className="decsent">
                  {r.state === 'draft'
                    ? <>الطلب <b>مسودة عند الجهة</b> · ما وصلش للمراجعة بعد (قاعدة <Num>12</Num>)</>
                    : r.state === 'completion'
                      ? <>الطلب <b>عند الجهة للاستكمال</b> · المخارج بترجع لما يتبعت تاني</>
                      : <>الطلب <b>{REG_STATE_SAY[r.state]}</b> · القرار اتاخد ومفيش مخارج بعده</>}
                </span>
              </div>
            ) : (
              <>
                <div className="rowf gp-3 payact-w">
                  <Person name="مسؤول النظام" size="lg" quiet={false} />
                  <span className="decsent">
                    قرارك في طلب <b>{r.name}</b>
                    <span className="decsep" />
                    {r.type}
                  </span>
                </div>

                {/* الملاحظة الإدارية · إلزامية في الإعادة والرفض ·
                    النظام العامل بيفرضها، وقاعدة 31 بتلزمها */}
                <label className="payact-n">
                  <span className="vis-h">الملاحظة الإدارية</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="الملاحظة الإدارية · إلزامية للإعادة والرفض"
                  />
                </label>

                <div className="rowf gp-2">
                  <button
                    className="btn btn-p"
                    disabled={blocked}
                    title={
                      blocked
                        ? 'نواقص تمنع الاعتماد · القاعدتان 4 و8'
                        : 'تُنشأ الجهة ويُرسل اسم المستخدم · قاعدة 2'
                    }
                    onClick={() => setTaken('approve')}
                  >
                    اعتماد وتفعيل
                  </button>
                  <button
                    className="btn btn-2"
                    disabled={!note.trim()}
                    title={note.trim() ? 'يرجع للجهة بالملاحظة' : 'اكتب الملاحظة الإدارية أولًا'}
                    onClick={() => setTaken('return')}
                  >
                    إعادة للاستكمال
                  </button>
                  <button
                    className="btn btn-d"
                    disabled={!note.trim()}
                    title={note.trim() ? 'يُؤرشف بسببه · قاعدة 28' : 'اكتب سبب الرفض أولًا'}
                    onClick={() => setTaken('reject')}
                  >
                    رفض وإيقاف
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

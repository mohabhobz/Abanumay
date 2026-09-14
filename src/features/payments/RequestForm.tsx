import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  BackTo, DateText, Empty, Glass, Head, Icon, icons, Money, Mono, Num, Riyal, Select, Tag,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useQueryParams } from '@/hooks/useQueryParams'
import { assistFor } from '@/data/mock/assistant'
import { isolate, nf } from '@/lib/format'
import {
  PAY_SLOT_SAY, payProjects, payRequestById, paySchedule, type PaySlot,
} from '@/data/mock/disbursements'

const KEYS = ['project', 'pay'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

/* ═══════════════════════════════════════════════════════════
   طلب الصرف · شاشة 2 · خطوات 1 · 2 · 3 · 11 · قاعدة 19

   ⚠️ **دي مش فورم، دي جدول الدفعات المعتمد.** الفورم الفاضي بيسأل
   الجهة «كام؟» وبيسيبها تكتب رقمًا غلط، وبعدين يرفضه. والوثيقة
   بتشتغل بالعكس: خطوة 1 بتقول النظام **يتيح** الإنشاء عند حلول
   الاستحقاق واستيفاء الشروط · يعني الإتاحة معلومة معروضة قبل
   الضغط، لا رفض بعده.

   فالشاشة بتعرض **كل** دفعات الاتفاقية وكل واحدة بحالتها وسببها،
   وأربع قواعد بتتنفّذ بالعرض لا بالتحقّق:

     قاعدة 1 · مفيش طلب قبل تفعيل الاتفاقية    → الشاشة كلها مقفولة
                                                  والسبب مكتوب
     قاعدة 2 · الدفعات المستحقة بس              → «لم تستحق» مقفولة
     قاعدة 4 · طلب واحد مفتوح لكل دفعة          → «لها طلب مفتوح»
                                                  وبتوصّل للطلب
     قاعدة 6 · الدفعة المشروطة لا تُرسل           → «موقوفة بشرط»
     قاعدة 5 · القيمة ما تتجاوزش المعتمدة        → تحقّق فوري في الحقل
     قاعدة 3 · المتطلبات قبل الإرسال             → قائمة تحقّق،
                                                  والإرسال مقفول قبلها

   ⚠️ **وقاعدة 3 قائمة تحقّق لا رسالة خطأ.** خطوة 3 بتقول النظام
   «يرفض الإرسال عند النواقص» · الرفض بعد الضغط بيخلّي الجهة تجرّب
   وتفشل. القائمة قبل الضغط بتقول إيه الناقص من الأول.

   ═══ نفس الشاشة لخطوة 11 ═══

   خطوة 11 «تستكمل الملاحظات وتعيد إرسال الطلب» · نفس الجدول ونفس
   الحقل ونفس القائمة، والفرق إن ملاحظات الإعادة فوق والدفعة
   محدَّدة سلفًا. شاشة تانية كانت هتبقى نسخة بفرق سطر.
   ═══════════════════════════════════════════════════════════ */

/** المتطلبات اللي الإرسال متوقّف عليها · قاعدة 3 */
const NEEDS = [
  'التقرير المرحلي للفترة السابقة',
  'كشف المستفيدين المسجَّلين',
  'فواتير ومستندات الصرف السابق',
  'إقرار ممثل الجهة المخوّل بالتوقيع',
]

const SLOT_TONE: Record<string, 'ok' | 'warn' | 'no' | 'mute' | 'teal'> = {
  open: 'teal',
  early: 'mute',
  pending: 'warn',
  paid: 'ok',
  held: 'no',
}

export default function RequestForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)

  /* وضعان: إنشاء جديد، أو إعادة إرسال طلب معاد (خطوة 11) */
  const resend = id ? payRequestById(id) : undefined
  /* ⚠️ **رقم طلب غلط ≠ طلب جديد.**
     كان `payRequestById` بيرجّع `undefined` والشاشة بتكمّل كأنها
     «طلب صرف جديد» · يعني `/payments/SR-9999/edit` بيفتح فورم
     فاضية بدل ما يقول إن الطلب مش موجود. والأسوأ إن الصفحة بتفضل
     **سليمة**: مفيش خطأ في الكونسول ولا نصّ مقصوص، فكل أدوات
     الفحص بترجع خضرا وهي بتقيس شاشة غلط. */
  const missingId = Boolean(id) && !resend
  const projectId = resend?.projectId ?? v.project
  const projects = useMemo(payProjects, [])
  const project = projects.find((p) => p.id === projectId)
  const slots = useMemo(() => (projectId ? paySchedule(projectId) : []), [projectId])

  const picked = resend
    ? slots.find((s) => s.no === resend.no)
    : slots.find((s) => String(s.no) === v.pay)

  const [amount, setAmount] = useState<string>('')
  const [done, setDone] = useState<Set<string>>(new Set())
  const [sent, setSent] = useState(false)

  const value = amount === '' ? (picked?.amount ?? 0) : Number(amount) || 0
  /* قاعدة 5 · القيمة ما تتجاوزش الدفعة المعتمدة · التحقّق في الحقل
     نفسه لا بعد الإرسال، فالجهة تعرف قبل ما تضغط */
  const over = picked ? value > picked.amount : false
  const missing = NEEDS.filter((n) => !done.has(n))
  const canSend = Boolean(picked) && !over && value > 0 && missing.length === 0

  const toggle = (n: string) =>
    setDone((s) => {
      const next = new Set(s)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })

  const title = resend ? 'إعادة إرسال طلب الصرف' : 'طلب صرف جديد'

  if (missingId) {
    return (
      <AppLayout assistantContext={assistFor.page('الصرف')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الصرف" onClick={() => navigate(ROUTES.payments)} />
            <Glass>
              <Empty
                title="الطلب غير موجود."
                note="يمكن يكون اتقفل أو الرابط قديم."
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.payments)}>
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

  return (
    <AppLayout assistantContext={assistFor.page(title, project?.name ?? '')}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo
            label={resend ? 'الطلب' : 'الصرف'}
            onClick={() => navigate(resend ? ROUTES.payment(resend.id) : ROUTES.payments)}
          />

          <header>
            <div>
              <h1 className="ptitle">{title}</h1>
              <p className="sub mt-1">
                {project
                  ? <>{project.name} · {project.entity}</>
                  : 'اختر المشروع، والجدول المعتمد هو اللي بيقول أي دفعة تقدر تطلبها'}
              </p>
            </div>
          </header>

          {/* خطوة 11 · ملاحظات الإعادة فوق، فالجهة تشوف المطلوب
              قبل ما تفتح الجدول لا بعده */}
          {resend?.note && (
            <Glass>
              <Head title="ملاحظات المشرف" meta={<Tag tone="warn">مطلوب استكمالها</Tag>} />
              <div className="payq-note">
                <Icon name={icons.chat} size={15} />
                <span>{isolate(resend.note)}</span>
              </div>
            </Glass>
          )}

          {!resend && (
            <Glass className="ftoolbar">
              <div className="ftool-r">
                <div className="ftool-f">
                  <Select
                    icon={icons.doc}
                    value={projectId}
                    all="اختر المشروع"
                    options={projects.map((p) => ({
                      value: p.id,
                      label: p.open ? `${p.name} (${p.open})` : p.name,
                    }))}
                    onChange={(x) => set({ project: x, pay: undefined })}
                  />
                </div>
              </div>
            </Glass>
          )}

          {!project ? (
            <Glass>
              <Empty
                title="اختر المشروع أولًا."
                note="جدول الدفعات المعتمد هو اللي بيحدّد أي دفعة تقدر تطلبها."
              />
            </Glass>
          ) : !project.can ? (
            /* قاعدة 1 · الشاشة مقفولة والسبب مكتوب، مش مخفية */
            <Glass>
              <Empty
                title="ما ينفعش تنشئ طلب صرف على المشروع ده."
                note={project.why}
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.project(project.id))}>
                    افتح المشروع
                  </button>
                }
              />
            </Glass>
          ) : (
            <>
              {/* المدخل التاني في الوثيقة · جدول الدفعات المعتمد */}
              <Glass>
                <Head
                  title="جدول الدفعات المعتمد"
                  meta={<span className="sub"><Num>{slots.length}</Num> دفعات في الاتفاقية</span>}
                />
                <ul className="payslots">
                  {slots.map((s) => (
                    <SlotRow
                      key={s.no}
                      slot={s}
                      picked={picked?.no === s.no}
                      locked={Boolean(resend)}
                      onPick={() => set({ pay: String(s.no) })}
                      onOpen={() => s.requestId && navigate(ROUTES.payment(s.requestId))}
                    />
                  ))}
                </ul>
              </Glass>

              {picked && (picked.state === 'open' || resend) && (
                <div className="g2">
                  <div className="col">
                    {/* قاعدة 3 · قائمة تحقّق قبل الإرسال لا رسالة بعده */}
                    <Glass>
                      <Head
                        title="متطلبات الإرسال"
                        meta={
                          missing.length
                            ? <Tag tone="warn"><Num>{missing.length}</Num> ناقص</Tag>
                            : <Tag tone="ok">مكتملة</Tag>
                        }
                      />
                      <ul className="paycheckl">
                        {NEEDS.map((n) => (
                          <li key={n}>
                            <label>
                              <input
                                type="checkbox"
                                checked={done.has(n)}
                                onChange={() => toggle(n)}
                              />
                              <span>{n}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                      <p className="sub cnote">
                        القاعدة 3 بتشترط استيفاء كل المتطلبات <b>قبل</b> الإرسال، وخطوة 3
                        بترفض الإرسال عند النواقص · فالقائمة قبل الزرار لا بعده.
                      </p>
                    </Glass>

                    {/* قاعدة 6 · شرط الدفعة معروض جنبها */}
                    {picked.condition && (
                      <Glass>
                        <Head
                          title="شرط الدفعة"
                          meta={
                            picked.conditionMet
                              ? <Tag tone="ok">مستوفى</Tag>
                              : <Tag tone="no">غير مستوفى · قاعدة 6</Tag>
                          }
                        />
                        <p className="sub cnote">{isolate(picked.condition)}</p>
                      </Glass>
                    )}
                  </div>

                  <div className="col">
                    <Glass>
                      <Head title="قيمة الطلب" meta={<span className="sub">قاعدة 5</span>} />
                      <label className="payamt">
                        <span className="lb">المبلغ المطلوب</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={amount === '' ? picked.amount : amount}
                          onChange={(e) => setAmount(e.target.value)}
                          aria-label="المبلغ المطلوب"
                        />
                        <Riyal />
                      </label>
                      <p className={over ? 'bad cnote' : 'sub cnote'}>
                        {over
                          ? <>أعلى من الدفعة المعتمدة <Mono>{nf.format(picked.amount)}</Mono> · القاعدة 5 بتمنع التجاوز</>
                          : <>الدفعة المعتمدة في الجدول <Mono>{nf.format(picked.amount)}</Mono> · استحقاقها <DateText>{picked.dueAt}</DateText></>}
                      </p>
                    </Glass>

                    <Glass>
                      <Head title="ملخّص الطلب" />
                      <ul className="paysum">
                        <li><span>المشروع</span><span className="trim1">{project.name}</span></li>
                        <li><span>الجهة</span><span className="trim1">{project.entity}</span></li>
                        <li>
                          <span>الدفعة</span>
                          <span className="num">{picked.no}/{picked.of}</span>
                        </li>
                        <li><span>القيمة</span><span><Money sm>{value}</Money></span></li>
                      </ul>
                    </Glass>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* الإرسال · خطوة 2 (أو 11 في الإعادة) */}
        {picked && (picked.state === 'open' || resend) && (
          <div className="decdock">
            <div className="chrome decbar payact">
              <div className="rowf gp-3 payact-w">
                <span className="decsent">
                  {sent
                    ? <>الطلب اتبعت · <b>{resend ? 'أعيد إرساله للمشرف' : 'أحيل لمشرف المنح'}</b> والإشعار اتبعت (قاعدة 17)</>
                    : <>
                        الدفعة <b><Num>{picked.no}</Num> من <Num>{picked.of}</Num></b>
                        <span className="decsep" />
                        <Money>{value}</Money>
                      </>}
                </span>
              </div>
              {!sent && (
                <button
                  className="btn btn-p"
                  disabled={!canSend}
                  title={
                    over ? 'القيمة أعلى من الدفعة المعتمدة · قاعدة 5'
                    : missing.length ? `ناقص ${missing.length} من المتطلبات · قاعدة 3`
                    : 'خطوة 2 في الوثيقة'
                  }
                  onClick={() => setSent(true)}
                >
                  {resend ? 'إعادة الإرسال' : 'إرسال الطلب'}
                </button>
              )}
              {sent && (
                <button className="btn btn-2" onClick={() => navigate(ROUTES.payments)}>
                  ارجع للصندوق
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function SlotRow({
  slot, picked, locked, onPick, onOpen,
}: {
  slot: PaySlot
  picked: boolean
  locked: boolean
  onPick: () => void
  onOpen: () => void
}) {
  const say = PAY_SLOT_SAY[slot.state]
  const can = slot.state === 'open' && !locked

  return (
    <li className={`payslot${picked ? ' on' : ''}${can ? '' : ' off'}`}>
      <button
        className="payslot-b"
        onClick={can ? onPick : slot.requestId ? onOpen : undefined}
        disabled={!can && !slot.requestId}
        /* السبب في `title` مكتوب، مش متروك للّون · اللون بيقول
           «فيه حاجة» والنصّ بيقول «إيه هي» */
        title={say.rule ? `${say.why} · قاعدة ${say.rule}` : say.why}
      >
        <span className="payslot-n">الدفعة <span className="num">{slot.no}</span></span>
        <span className="payslot-a num">{nf.format(slot.amount)}</span>
        <DateText>{slot.dueAt}</DateText>
        <span className="pc-sp" />
        {slot.condition && (
          <span className="sub trim1 payslot-c">{isolate(slot.condition)}</span>
        )}
        <Tag tone={SLOT_TONE[slot.state] ?? 'mute'}>{say.label}</Tag>
        {picked && <Icon name={icons.check} size={15} />}
      </button>
    </li>
  )
}

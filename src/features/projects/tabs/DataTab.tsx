import { DateText, Glass, Head, KV, Mono, Num, Riyal, Stat, Tag, Timeline } from '@/components/ui'
import { DocDownload, DocFile } from '@/components/docs'
import { addDays, costPerBeneficiary, isolate, nf, pct, readDate, units } from '@/lib/format'
import type { Project } from '@/types/domain'
import type { LogEvent } from '@/data/mock/log'
import { projectDeps } from '@/data/mock/settings'

export interface DataTabProps {
  project: Project
  entityName: string
  onOpenEntity: () => void
  /** أحدث قيد في السجل · بيتعرض تحت التعريف */
  last?: LogEvent
  onOpenLog: () => void
  /**
   * المتعلقات · ج-19.
   *
   * ⚠️ **الكارت ده مش رسالة خطأ، هو جرد.** السلسلة سنة ← ميزانية ←
   * مشروع ← اتفاقية ودفعات بتمنع الحذف من أولها، والقاعدة كانت
   * متعملة في أول حلقتين بس. وهنا مفيش زرار حذف أصلًا، فالكارت
   * بيقول **إيه المعلّق على المشروع ده** · وده اللي بيخلّي السبب
   * ظاهرًا قبل ما حد يحاول، ويوري السلسلة في نفس الوقت.
   */
  deps?: { agreements: number; payments: number }
}

/** بيانات المشروع · التعريف والفكرة والمراحل والنطاق والمرفقات */
export function DataTab({
  project: P, entityName, onOpenEntity, last, onOpenLog, deps,
}: DataTabProps) {
  const dep = deps ? projectDeps(deps.agreements, deps.payments) : undefined
  const perBeneficiary = costPerBeneficiary(P.amountRequested, P.beneficiaries)
  const uploaded = P.attachments.filter((a) => a.uploaded).length

  return (
    <>
      <Glass>
        <Head title="التعريف" meta="9 حقول" />
        <KV
          rows={[
            { k: 'الجهة', v: <a onClick={onOpenEntity}>{entityName}</a> },
            { k: 'رقم المشروع', v: <Mono>{P.id}</Mono> },
            { k: 'الحالة', v: <Tag tone={P.status.tone}>{P.status.label}</Tag> },
            { k: 'المسار', v: P.track },
            { k: 'المجال', v: P.field },
            { k: 'الهدف', v: P.goal },
            /* التاريخان جنب بعض: «330 يومًا» لوحدها ما بتقولش إمتى
               بيخلص، والنهاية هي اللي بتحدّد لو المشروع هيعدّي السنة
               المالية. والمدة في الاتفاقية بتبدأ من صرف أول دفعة. */
            { k: 'تاريخ البدء', v: readDate(P.startDate) },
            {
              k: 'الانتهاء المتوقع',
              v: (
                <>
                  {readDate(addDays(P.startDate, P.durationDays))}
                  <span className="sub"> · بعد <span className="num">{nf.format(P.durationDays)}</span> يومًا</span>
                </>
              ),
            },
            {
              k: 'الوسوم',
              v: P.tags.length ? P.tags.join('، ') : <span className="sub">لا يوجد</span>,
            },
          ]}
        />

        {/* آخر إجراء تحت التعريف مباشرة · كان كارتًا في العمود الجانبي،
            وده مكان بعيد عن السؤال اللي بيسبقه: «المشروع ده إيه، وآخر
            حاجة حصلت فيه إيه». الاتنين بقوا في نفس الكارت. */}
        {last && (
          <div className="lastact">
            <div className="lastact-h">
              <span className="lb">آخر إجراء</span>
              <span className="pc-sp" />
              <button className="lnk" onClick={onOpenLog}>السجل كامل</button>
            </div>
            <div className="lastact-b">
              <b>{last.action}</b>
              <span className="lastact-d">{last.dept}</span>
            </div>
            <div className="sub mt-1">
              {last.by} · <DateText>{last.at}</DateText>
              {' · '}
              <span style={{ color: last.hours > last.limit ? 'var(--no-ink)' : undefined }}>
                <Num>{last.days}</Num> يومًا · <Num>{last.hours}</Num> من <Num>{last.limit}</Num> ساعة
              </span>
            </div>
          </div>
        )}
      </Glass>

      <div className="stats4">
        <Stat
          label="المبلغ المطلوب"
          value={<Num>{P.amountRequested}</Num>}
          unit={<Riyal />}
          bar={{ w: '100%', c: 'var(--teal)' }}
          note={`${pct(100)} من إجمالي المشروع`}
        />
        <Stat
          label="مدة التنفيذ"
          value={P.durationDays}
          unit="يومًا"
          note={`≈ ${units.month(Math.round(P.durationDays / 30))} · تبدأ من صرف الدفعة الأولى`}
        />
        <Stat
          label="المستفيدون"
          value={nf.format(P.beneficiaries)}
          note="تقدير الجهة، لم يُراجَع من المشرف"
        />
        <Stat
          label="تكلفة المستفيد"
          value={<Num>{perBeneficiary}</Num>}
          unit={<Riyal />}
          note="محسوبة، لمقارنة المشاريع"
        />
      </div>

      <Glass>
        <Head title="فكرة المشروع" meta="من نموذج التقديم" />
        <p className="prose">{isolate(P.idea)}</p>

        <div className="well" style={{ padding: 'var(--sp-5) 0 0', marginTop: 'var(--sp-5)' }}>
          <div className="lb">الهدف العام</div>
          <div className="prose mt-1">{isolate(P.mainGoal)}</div>
        </div>

        <BulletSection title="الأهداف التفصيلية" items={P.goals} />
        <BulletSection title="المخرجات" items={P.outputs} />
        <BulletSection title="المسوغات" items={P.rationale} />
      </Glass>

      <Glass>
        <Head title="مراحل التنفيذ" meta={`${P.phases.length} مراحل · 11 شهرًا`} />
        <Timeline
          events={P.phases.map((ph) => ({
            tone: ph.tone,
            title: <><b>{ph.name}</b>، {ph.tasks}</>,
            by: <Mono>{ph.months}</Mono>,
          }))}
        />
        <div className="sub mt-4">
          في النظام الحالي هذه المراحل نصٌّ حر داخل حقل واحد. هنا كيان له بنود وتواريخ، ويصلح
          لربط دفعات الصرف به.
        </div>
      </Glass>

      <Glass>
        <Head title="النطاق والأثر" meta="مطابقة لنموذج التقديم" />
        <KV
          rows={[
            { k: 'المنطقة والمدينة', v: `${P.region} · ${P.city}` },
            {
              k: 'عدد المستفيدين',
              v: (
                <>
                  <Num>{P.beneficiaries}</Num>{' '}
                  <span className="sub">
                    (الفعلي من المشرف: <Num>{P.beneficiariesVerified}</Num>)
                  </span>
                </>
              ),
            },
            {
              k: 'الفئة المستهدفة',
              v: (
                <div className="chips gp-1">
                  {P.audiences.map((a) => (
                    <span
                      className="chip"
                      key={a}
                      style={{ fontSize: 'var(--fs-1)', padding: 'var(--sp-2) var(--sp-4)' }}
                    >
                      {a}
                    </span>
                  ))}
                </div>
              ),
            },
          ]}
        />

        <div className="hd" style={{ marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-3)' }}>
          <h3 style={{ fontSize: 'var(--fs-3)' }}>الامتثال</h3>
          <span className="meta">3 إقرارات</span>
        </div>
        <div className="g3 gp-2">
          {P.compliance.map((c) => (
            <div className="well" key={c.k} style={{ padding: 'var(--sp-4) 0 0' }}>
              <div className="lb">{c.k}</div>
              <div
                style={{
                  fontSize: 'var(--fs-3)',
                  fontFamily: 'var(--fd)',
                  fontWeight: 600,
                  marginTop: 'var(--sp-2)',
                }}
              >
                {c.v}
              </div>
            </div>
          ))}
        </div>
      </Glass>

      <Glass>
        <Head title="المرفقات" meta={`${uploaded} من ${P.attachments.length} مرفوعة`} />
        <div style={{ overflowX: 'auto' }}>
          {/* بلا ترويسة أعمدة: عنوان الكارت فوق بيقول «المرفقات»،
              و«المرفق · الحالة» تحته بيكرّروه. وكل خلية بتوصف
              نفسها · اسم ملف ووسم حالة. عمود «إجراء» مش موجود
              أصلًا: الملف نفسه زرار المعاينة وجنبه زرار التنزيل. */}
          <table className="tbl" aria-label="مرفقات المشروع وحالتها">
            <tbody>
              {P.attachments.map((a) => (
                <tr key={a.name} className={a.uploaded ? '' : 'off'}>
                  <td>
                    {/* المرفوع بيتعرض بثامبنيله · النوع بيبان قبل الفتح.
                        وغير المرفوع مالوش ثامبنيل لأن مفيش محتوى. */}
                    {a.uploaded ? (
                      <DocFile name={a.name} download={false} />
                    ) : (
                      <span className="nmc sub">{a.name}</span>
                    )}
                  </td>
                  {/* التنزيل جنب الحالة في آخر الصف: الأيقونات بتتسطّر
                      في عمود واحد بدل ما تقف بعد كل اسم في مكان. */}
                  <td className="n">
                    <span className="dstat">
                      {a.uploaded ? (
                        <Tag tone="ok">مرفوع</Tag>
                      ) : (
                        <Tag>{a.required ? 'مطلوب، غير مرفوع' : 'اختياري، غير مرفوع'}</Tag>
                      )}
                      {a.uploaded && <DocDownload name={a.name} />}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sub mt-3">
          الموازنة التفصيلية هي المطلوبة في طلب الاستكمال الحالي، الملف المرفوع صورة لا تُقرأ آليًا.
        </div>
      </Glass>

      <Glass>
        <Head title="جهة الاتصال والحساب البنكي" meta="من نموذج التقديم" />
        <KV
          rows={[
            { k: 'مدير المشروع', v: P.manager.name },
            { k: 'الجوال', v: <Mono>{P.manager.phone}</Mono> },
            { k: 'البريد', v: <Mono>{P.manager.email}</Mono> },
            { k: 'المصرف', v: P.bank.name },
            { k: 'اسم الحساب', v: P.bank.account },
            { k: 'الآيبان', v: <Mono>{P.bank.iban}</Mono> },
            { k: 'حالة الحساب', v: <Tag tone="ok">{P.bank.status}</Tag> },
          ]}
        />
        <div className="sub mt-3">
          البيانات البنكية مصدرها ملف الجهة، معروضة هنا للمراجعة فقط ولا تُحرَّر من المشروع.
        </div>
      </Glass>

      {dep && (
        <Glass>
          <Head
            title="المتعلقات"
            meta={
              dep.count > 0
                ? <Tag tone="mute">{dep.say}</Tag>
                : <Tag tone="ok">بلا متعلقات</Tag>
            }
          />
          <p className="sub">
            {dep.count > 0
              ? <>المشروع ده مرتبط بيه <b>{dep.say}</b> · فما يتحذفش، والسلسلة
                  بتمنع الحذف من أولها: سنة ← ميزانية ← مشروع ← اتفاقية ودفعات.</>
              : <>مفيش اتفاقيات ولا دفعات مرتبطة بالمشروع ده لحد دلوقتي.</>}
          </p>
        </Glass>
      )}
    </>
  )
}

/** قائمة بنود بعنوان وعدّاد · بتتكرر ثلاث مرات في نفس الكارت */
function BulletSection({ title, items }: { title: string; items: string[] }) {
  return (
    <>
      <div className="hd" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-4)' }}>
        <h3 style={{ fontSize: 'var(--fs-3)' }}>{title}</h3>
        <span className="meta">{items.length}</span>
      </div>
      {/* `flush`: الصفوف بيفصلها خط شعري، والفجوة بينهم بتخلّي
          المسافة فوق السطر نصّ اللي تحته فيتقري ملزوقًا في خطّه. */}
      <div className="col-s flush">
        {items.map((item, i) => (
          <div className="data" key={i}>
            <div className="prose">{isolate(item)}</div>
          </div>
        ))}
      </div>
    </>
  )
}

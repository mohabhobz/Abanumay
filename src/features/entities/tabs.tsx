import { Link } from 'react-router-dom'
import { Empty, Glass, Head, Icon, icons, KV, Money, Mono, Num, Tag } from '@/components/ui'
import { DocDownload, DocFile } from '@/components/docs'
import { ROUTES } from '@/app/routes'
import { readDate } from '@/lib/format'
import { activationTone, days, governanceTone, groupTone } from '@/lib/tone'
import { ENTITY_DOCS_TOTAL, stagePressure } from '@/data/repository'
import type { EntityDetail, EntityEvent } from '@/data/mock/entityDetail'
import type { EntityRow, ProjectRow } from '@/types/domain'

/* ═══════════════════ بيانات الجهة ═══════════════════ */

/**
 * الحقول الـ٣٥ اللي في النظام، مرتّبة بمجموعاتها الخمس.
 *
 * الترتيب مش عشوائي: التعريف الأول لأنه اللي بيثبت الجهة، وبعده
 * **الصلاحيات** (الترخيص وتكليف المجلس) لأنها اللي بتوقف التعاقد،
 * وبعدين الاتصال والأشخاص والنظام. اللي بيوقف قرارًا بيتقري الأول.
 */
export function EntityDataTab({ e, d }: { e: EntityRow; d: EntityDetail }) {
  return (
    <>
      <Glass>
        <Head title="التعريف" meta="من سجل الجهة في النظام" />
        <KV
          rows={[
            { k: 'اسم الجهة', v: e.name },
            { k: 'تصنيف الجهة', v: e.type },
            { k: 'الجهة المرخِّصة', v: e.licensor },
            { k: 'رقم الترخيص', v: <Mono>{e.licenseNo}</Mono> },
            { k: 'المنطقة', v: e.region },
            { k: 'المحافظة / المدينة', v: e.city },
            { k: 'تاريخ التأسيس', v: <Mono>{readDate(d.foundedAt)}</Mono> },
            { k: 'تاريخ التسجيل عندنا', v: <Mono>{readDate(e.registeredAt)}</Mono> },
          ]}
        />
      </Glass>

      {/* الصلاحيات: التاريخان دول بيوقفوا الاتفاقية لو انتهوا، فمكانهم
          فوق مش وسط بيانات الاتصال. */}
      <Glass>
        <Head
          title="سريان الصلاحيات"
          meta={
            d.licenseExpired || d.boardExpired
              ? <Tag tone="no">يوقف التعاقد</Tag>
              : <Tag tone="ok">سارية</Tag>
          }
        />
        <KV
          rows={[
            {
              k: 'نهاية الترخيص',
              v: (
                <>
                  <Mono>{readDate(d.licenseEndsAt)}</Mono>
                  {d.licenseExpired && <span className="tag no">منتهٍ</span>}
                </>
              ),
            },
            {
              k: 'نهاية تكليف أعضاء المجلس',
              v: (
                <>
                  <Mono>{readDate(d.boardMandateEndsAt)}</Mono>
                  {d.boardExpired && <span className="tag no">منتهٍ</span>}
                </>
              ),
            },
            { k: 'استثناء عام', v: d.exceptionGeneral ? <Tag tone="ret">مستثناة</Tag> : '—' },
            { k: 'استثناء وقف', v: d.exceptionWaqf ? <Tag tone="ret">مستثناة</Tag> : '—' },
          ]}
        />
      </Glass>

      <Glass>
        <Head title="الاتصال" />
        <KV
          rows={[
            { k: 'الهاتف', v: <Mono>{d.phone}</Mono> },
            { k: 'جوال الجهة', v: <Mono>{e.mobile}</Mono> },
            { k: 'البريد الإلكتروني', v: <Mono>{e.email}</Mono> },
            { k: 'الموقع الإلكتروني', v: <Mono>{d.website}</Mono> },
          ]}
        />
        <p className="sub" style={{ marginTop: '.7rem' }}>
          بيانات التواصل هنا مموّهة عمدًا — المستودع عام.
        </p>
      </Glass>

      <Glass>
        <Head title="الأشخاص" meta="المدير التنفيذي ومدخل البيانات" />
        <KV
          rows={[
            { k: 'المدير التنفيذي', v: d.directorName },
            { k: 'جوال المدير', v: <Mono>{d.directorMobile}</Mono> },
            { k: 'مدخل البيانات', v: d.clerkName },
            { k: 'جوال مدخل البيانات', v: <Mono>{d.clerkMobile}</Mono> },
            { k: 'بريد مدخل البيانات', v: <Mono>{d.clerkEmail}</Mono> },
          ]}
        />
      </Glass>

      <Glass>
        <Head title="بيانات النظام" />
        <KV
          rows={[
            { k: 'حالة التفعيل', v: <Tag tone={activationTone(e.activation)}>{e.activation}</Tag> },
            { k: 'درجة الحوكمة', v: <Tag tone={governanceTone(e.governance)}>{e.governance}</Tag> },
            { k: 'نوع الحساب', v: d.accountType },
            { k: 'اسم المستخدم', v: <Mono>{d.username}</Mono> },
            { k: 'رقم المستخدم', v: <Mono>{d.userNo}</Mono> },
            { k: 'آخر تعديل', v: <Mono>{d.updatedAt}</Mono> },
          ]}
        />
        {/* الملاحظة الإدارية إلزامية في النظام على كل قبول أو رفض،
            فمكانها هنا لا في السجل وحده. */}
        <div className="lastact">
          <span className="sub">آخر ملاحظة إدارية</span>
          <p>{d.adminNote}</p>
        </div>
      </Glass>
    </>
  )
}

/* ═══════════════════ المستندات ═══════════════════ */

/**
 * ثمانية مستندات، وكل واحد بحالته وتاريخه.
 *
 * الفرق عن العرض القديم (علامة صح/خطأ): المستند المرفوع اللي
 * **انتهت صلاحيته** كان بيعدّي كأنه مكتمل. وده أخطر من الناقص —
 * الناقص بيبان، والمنتهي بيعدّي.
 */
export function EntityDocsTab({ d }: { d: EntityDetail }) {
  const up = d.docs.filter((x) => x.uploaded).length
  const expired = d.docs.filter((x) => x.expired).length

  return (
    <Glass>
      <Head
        title="ملف المستندات"
        meta={
          <>
            <span className="num">{up}</span> من <span className="num">{ENTITY_DOCS_TOTAL}</span>
            {expired > 0 && <> · <Tag tone="no"><span className="num">{expired}</span> منتهٍ</Tag></>}
          </>
        }
      />
      <table className="tbl">
        <colgroup>
          <col style={{ width: 300 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 120 }} />
        </colgroup>
        <thead>
          <tr>
            <th>المستند</th>
            <th>تاريخ الرفع</th>
            <th>نهاية الصلاحية</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          {d.docs.map((x) => (
            <tr key={x.name}>
              <td title={x.name}>
                {x.uploaded
                  ? <DocFile name={`${x.name}.pdf`} download={false} />
                  : <span className="sub">{x.name}</span>}
              </td>
              <td title={x.at ?? ''}>{x.at ? <Mono>{x.at}</Mono> : <span className="sub">—</span>}</td>
              <td title={x.expires ?? ''}>
                {x.expires ? <Mono>{x.expires}</Mono> : <span className="sub">—</span>}
              </td>
              <td>
                <span className="dstat">
                  {!x.uploaded ? (
                    <Tag tone="no">غير مرفوع</Tag>
                  ) : x.expired ? (
                    <Tag tone="no">منتهٍ</Tag>
                  ) : (
                    <Tag tone="ok">مرفوع</Tag>
                  )}
                  {x.uploaded && <DocDownload name={`${x.name}.pdf`} />}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Glass>
  )
}

/* ═══════════════════ الحسابات البنكية ═══════════════════ */

/**
 * الحساب البنكي بوابة الصرف: بلا حساب مفعّل مفيش دفعة تخرج.
 *
 * وأهم حاجة اتنقلت من النظام هنا إن **سبب الرفض مختار لا مكتوب** —
 * سبعة أسباب مقنّنة. ده اللي بيخلّي «ليه الحسابات بتترفض؟» سؤالًا
 * له إجابة رقمية بدل ما يبقى قراءة في خانة ملاحظات.
 */
export function EntityBanksTab({ d }: { d: EntityDetail }) {
  if (d.banks.length === 0) {
    return <Glass><Empty title="لا حسابات بنكية مسجّلة." note="الصرف موقوف لحد ما تُسجّل الجهة حسابًا وتُفعّله." /></Glass>
  }

  return (
    <div className="col">
      {d.banks.map((b) => (
        <Glass key={b.id}>
          <Head
            title={b.bank}
            meta={
              <Tag tone={b.status === 'مفعل' ? 'ok' : b.status === 'غير مفعل' ? 'no' : 'warn'}>
                {b.status}
              </Tag>
            }
          />
          <KV
            rows={[
              { k: 'الاسم المختصر', v: b.shortName },
              { k: 'اسم الحساب البنكي', v: b.accountName },
              { k: 'رقم الآيبان', v: <Mono>{b.iban}</Mono> },
            ]}
          />

          {b.reason && (
            <div className="lastact">
              <span className="sub">سبب عدم التفعيل — من الأسباب السبعة المقنّنة</span>
              <p>{b.reason}</p>
            </div>
          )}

          <div className="col-s flush" style={{ marginTop: '.8rem' }}>
            <DocFile name={b.certificate} meta="الشهادة البنكية" />
            {b.attachment && <DocFile name={b.attachment} meta="المرفق" />}
          </div>
        </Glass>
      ))}
    </div>
  )
}

/* ═══════════════════ سجل الجهة ═══════════════════ */

/** لون النقطة = طبيعة القيد: قبول أخضر، إيقاف أحمر، تعديل مرتجع */
const DOT: Record<EntityEvent['kind'], string> = {
  reg: 't-mute',
  accept: 't-ok',
  reject: 't-no',
  stop: 't-no',
  edit: 't-ret',
  bank: 't-warn',
  doc: 't-mute',
}

/** الفاعل: الجهة طرف تاني، والقرار الإداري من عندنا */
const WHO: Record<EntityEvent['kind'], string> = {
  reg: 'k-entity',
  accept: '',
  reject: 'k-committee',
  stop: 'k-committee',
  edit: 'k-entity',
  bank: '',
  doc: 'k-system',
}

/**
 * سجل قرارات الجهة — نفس شكل سجل المشروع: القيد له نوع وحمولة،
 * مش سطر نصّ. وبيستعمل نفس الكلاسات عشان الاتنين يتقروا بنفس
 * الطريقة — اللي اتعلّمه المستخدم في المشروع بيشتغل هنا.
 *
 * والملاحظة الإدارية بتتعرض كاملة لأنها **إلزامية** في النظام على
 * كل قبول أو رفض: هي التبرير الرسمي للقرار لا تعليق جانبي.
 */
export function EntityLogTab({ d }: { d: EntityDetail }) {
  return (
    <Glass>
      <Head title="سجل الجهة" meta={<><span className="num">{d.log.length}</span> قيدًا</>} />
      <ul className="lg">
        {d.log.map((ev) => (
          <li className="lgi" key={ev.id}>
            <span className={`lgdot ${DOT[ev.kind]}`} />

            <div className="lghead">
              <span className="lgact">{ev.action}</span>
              <span className="pc-sp" />
              <span className="lgtime sub num">{ev.at} · {ev.time}</span>
            </div>

            <div className="lgby">
              <span className={`lgwho ${WHO[ev.kind]}`}>{ev.by}</span>
            </div>

            {ev.fields && (
              <div className="lgfields">
                {ev.fields.map((f) => (
                  <div className="lgf" key={f.k}>
                    <span className="lgf-k">{f.k}</span>
                    <span className="lgf-v">{f.v}</span>
                  </div>
                ))}
              </div>
            )}

            {ev.note && <p className="lgnote">{ev.note}</p>}
          </li>
        ))}
      </ul>
    </Glass>
  )
}

/* ═══════════════════ مشاريعها ═══════════════════ */

export function EntityProjectsTab({ rows }: { rows: ProjectRow[] }) {
  if (rows.length === 0) {
    return <Glass><Empty title="لا مشاريع لهذه الجهة." note="الجهة مسجّلة لكن ما تقدّمتش بمشروع في هذا النموذج." /></Glass>
  }

  return (
    <Glass>
      <Head title="مشاريع الجهة" meta={<><span className="num">{rows.length}</span> مشروعًا</>} />
      <div className="eprj">
        {rows.map((p) => {
          const over = stagePressure(p) > 1
          return (
            <Link key={p.id} to={ROUTES.project(p.id)} className="eprj-r well">
              <div className="eprj-h">
                <Mono>{p.id}</Mono>
                <Tag tone={groupTone(p.statusGroup)}>{p.statusGroup}</Tag>
                <span className="pc-sp" />
                <Money>{p.amountGranted > 0 ? p.amountGranted : p.amountRequested}</Money>
              </div>
              <div className="eprj-n">{p.name}</div>
              <div className="sub eprj-f">
                {p.stage}
                {p.stageLimit > 0 && (
                  <>
                    {' · '}
                    <span className="num">{days(p.hoursInStage)}</span>
                    {' يومًا في القسم'}
                    {over && <span className="tag no">متأخر</span>}
                  </>
                )}
                {p.declineReason && <> · {p.declineReason}</>}
              </div>
            </Link>
          )
        })}
      </div>
    </Glass>
  )
}

/** أداء الجهة — السجل التراكمي، بيتعرض تحت أي تاب لأنه سياق دايم */
export function EntityRecord({ e }: { e: EntityRow }) {
  return (
    <Glass>
      <Head title="أداء الجهة" meta="السجل التراكمي" />
      <KV
        rows={[
          { k: 'مشاريع معتمدة', v: <Num>{e.projectsApproved}</Num> },
          { k: 'تحت التشغيل', v: <Num>{e.projectsRunning}</Num> },
          { k: 'مكتملة', v: <Num>{e.projectsCompleted}</Num> },
          { k: 'معتذر عنها', v: <Num>{e.projectsDeclined}</Num> },
          {
            k: 'متعثرة',
            v: (
              <>
                <Num>{e.projectsStalled}</Num>
                {e.projectsStalled > 0 && <span className="dotmark" />}
              </>
            ),
          },
        ]}
      />
    </Glass>
  )
}

/** روابط سريعة */
export function EntityGoTo({ e }: { e: EntityRow }) {
  return (
    <Glass>
      <Head title="اذهب إلى" />
      <div className="chips">
        <Link className="chip" to={`${ROUTES.projects}?q=${encodeURIComponent(e.name)}`}>
          <Icon path={icons.link} size={14} /> مشاريعها في القائمة
        </Link>
        <Link className="chip" to={`${ROUTES.entities}?region=${encodeURIComponent(e.region)}`}>
          جهات {e.region}
        </Link>
      </div>
    </Glass>
  )
}

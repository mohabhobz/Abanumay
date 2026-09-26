import { Link } from 'react-router-dom'
import { DateText, Empty, Glass, Head, Icon, KV, Money, Mono, Num, Person, Tag, icons } from '@/components/ui'
import { DocFile, DocList } from '@/components/docs'
import { ROUTES } from '@/app/routes'
import { NOUN, nounAfter } from '@/lib/format'
import { activationTone, days, groupTone, TONE } from '@/lib/tone'
import { ENTITY_DOCS_TOTAL, stagePressure } from '@/data/repository'
import type { EntityDetail, EntityEvent } from '@/data/mock/entityDetail'
import type { EntityRow, ProjectRow } from '@/types/domain'

/* === Entity data === */

/**
 * The system's 35 fields, arranged into their five groups.
 *
 * The order isn't arbitrary: identification comes first since it establishes the entity, followed
 * by permissions (license and board assignment) since they gate the agreement, then contact/people
 * and system. Whatever blocks a decision is read first.
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
            { k: 'تاريخ التأسيس', v: <DateText>{d.foundedAt}</DateText> },
            { k: 'تاريخ التسجيل في المؤسسة', v: <DateText>{e.registeredAt}</DateText> },
          ]}
        />
      </Glass>

      {/* Permissions: these two dates block the agreement if they expire, so they sit at the top, not
   among the contact details. */}
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
              /* The date and badge used to run together: `<>` stacks the two elements with no gap, so the line
   read "March 25 2019Expired". Adding a space wasn't the fix - the gap should be declared in the
   layout. The badge is now a `Tag` component like every other badge, not a hand-written `<span
   class=\"tag no\">`. */
              k: 'نهاية الترخيص',
              v: (
                <span className="kvpair">
                  <DateText>{d.licenseEndsAt}</DateText>
                  {d.licenseExpired && <Tag tone="no">منتهٍ</Tag>}
                </span>
              ),
            },
            {
              k: 'نهاية تكليف أعضاء المجلس',
              v: (
                <span className="kvpair">
                  <DateText>{d.boardMandateEndsAt}</DateText>
                  {d.boardExpired && <Tag tone="no">منتهٍ</Tag>}
                </span>
              ),
            },
            { k: 'استثناء عام', v: d.exceptionGeneral ? <Tag tone="mute">مستثناة</Tag> : 'لا' },
            { k: 'استثناء وقف', v: d.exceptionWaqf ? <Tag tone="mute">مستثناة</Tag> : 'لا' },
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
        <p className="sub mt-3">
          بيانات الاتصال هنا مموّهة عمدًا لأن المستودع عام.
        </p>
      </Glass>

      <Glass>
        <Head title="الأشخاص" meta="المدير التنفيذي ومدخل البيانات" />
        <KV
          rows={[
            /* A card titled "People" - the avatar here isn't decoration, it is the card's content. These two
   aren't in the staff directory (entity names are generated), so they fall back to their initials -
   the correct shape for a person with no profile in the system. */
            { k: 'المدير التنفيذي', v: <Person name={d.directorName} quiet={false} /> },
            { k: 'جوال المدير', v: <Mono>{d.directorMobile}</Mono> },
            { k: 'مدخل البيانات', v: <Person name={d.clerkName} quiet={false} /> },
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
            { k: 'درجة الحوكمة', v: <b>{e.governance}</b> },
            { k: 'نوع الحساب', v: d.accountType },
            { k: 'اسم المستخدم', v: <Mono>{d.username}</Mono> },
            { k: 'رقم المستخدم', v: <Mono>{d.userNo}</Mono> },
            { k: 'آخر تعديل', v: <DateText>{d.updatedAt}</DateText> },
          ]}
        />
        {/* The admin note is required across the system on every approval or rejection, so it belongs here
   too, not only in the record. */}
        <div className="lastact">
          <span className="sub">آخر ملاحظة إدارية</span>
          <p>{d.adminNote}</p>
        </div>
      </Glass>
    </>
  )
}

/* === Documents === */

/**
 * Eight documents, each with its own status and date.
 *
 * The difference from the old view (a checkmark/cross): an uploaded document that has expired used
 * to pass as complete. That's worse than a missing one - a missing document is visible, an expired
 * one slips through.
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
      <DocList
        label="مستندات الجهة وصلاحيتها"
        heads={['تاريخ الرفع', 'نهاية الصلاحية']}
        rows={d.docs.map((x) => ({
          name: `${x.name}.pdf`,
          uploaded: x.uploaded,
          expired: x.expired,
          extra: [
            x.at ? <DateText>{x.at}</DateText> : null,
            x.expires ? <DateText>{x.expires}</DateText> : null,
          ],
        }))}
      />
    </Glass>
  )
}

/* === Bank accounts === */

/**
 * The bank account is the gate for disbursement: with no activated account, no payment goes out.
 *
 * The most important thing carried over from the live system is that the rejection reason is
 * selected, not typed freely - seven coded reasons. That's what turns "why do accounts get
 * rejected" into a question with a numeric answer instead of free-text notes.
 */
export function EntityBanksTab({ d }: { d: EntityDetail }) {
  if (d.banks.length === 0) {
    return <Glass><Empty art={{ done: 0, total: 2 }} title="لا توجد حسابات بنكية مسجّلة." note="الصرف موقوف حتى تسجّل الجهة حسابًا بنكيًا ويُفعَّل." /></Glass>
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
              <span className="sub">سبب عدم التفعيل، من الأسباب السبعة المقنّنة</span>
              <p>{b.reason}</p>
            </div>
          )}

          <div className="col-s flush mt-3">
            <DocFile name={b.certificate} meta="الشهادة البنكية" />
            {b.attachment && <DocFile name={b.attachment} meta="المرفق" />}
          </div>
        </Glass>
      ))}
    </div>
  )
}

/* === Entity log === */

/** Dot color reflects the nature of the entry: approval green, suspension red, return-for-edit its
 * own tone. */
const DOT: Record<EntityEvent['kind'], string> = {
  reg: 't-mute',
  accept: 't-ok',
  reject: 't-no',
  stop: 't-no',
  edit: 't-ret',
  bank: 't-warn',
  doc: 't-mute',
}

/** Actor: the entity is the other party; the administrative decision is ours. */
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
 * Entity decision log - same shape as the project log: an entry has a type and payload, not a text
 * line. It uses the same classes so both read the same way - what the user learned on the project
 * log applies here.
 *
 * The admin note is shown in full because it's required across the system on every approval or
 * rejection: it's the official justification for the decision, not a side comment.
 */
export function EntityLogTab({ d }: { d: EntityDetail }) {
  return (
    <Glass>
      <Head title="سجل الجهة" meta={<><span className="num">{d.log.length}</span> {nounAfter(d.log.length, NOUN.entry)}</>} />
      <ul className="lg">
        {d.log.map((ev) => (
          <li className="lgi" key={ev.id}>
            <span className={`lgdot ${DOT[ev.kind]}`} />

            <div className="lghead">
              <span className="lgact">{ev.action}</span>
              <span className="pc-sp" />
              <span className="lgtime sub"><DateText>{ev.at}</DateText> · <Num>{ev.time}</Num></span>
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

/* === Its projects === */

export function EntityProjectsTab({ rows }: { rows: ProjectRow[] }) {
  if (rows.length === 0) {
    return <Glass><Empty art={{ done: 0 }} title="لا توجد مشاريع لهذه الجهة." note="الجهة مسجّلة، لكنها لم تتقدّم بأي مشروع في هذا النموذج." /></Glass>
  }

  return (
    <Glass>
      <Head title="مشاريع الجهة" meta={<><span className="num">{rows.length}</span> {nounAfter(rows.length, NOUN.project)}</>} />
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
                    {over && <span className={`tag ${TONE.late}`}>متأخر</span>}
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

/** Entity performance - the cumulative record, shown under every tab because it's persistent context. */
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

/** Quick links */
export function EntityGoTo({ e }: { e: EntityRow }) {
  return (
    <Glass>
      <Head title="اذهب إلى" />
      <div className="chips">
        <Link className="chip" to={`${ROUTES.projects}?q=${encodeURIComponent(e.name)}`}>
          <Icon name={icons.link} size="sm" /> مشاريع الجهة في القائمة
        </Link>
        <Link className="chip" to={`${ROUTES.entities}?region=${encodeURIComponent(e.region)}`}>
          جهات {e.region}
        </Link>
      </div>
    </Glass>
  )
}

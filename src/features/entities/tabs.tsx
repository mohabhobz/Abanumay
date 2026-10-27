import { accountEvents } from '@/data/entities/auth'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FormField, FieldBox, Button, BankGrid, BankCard, DateText, Empty, Glass, Head, Icon, KV, Mono, Num, Person, Tabs, Tag, icons } from '@/components/ui'
import { DataTable, nextSort, readCols, sortRows, type ColSort } from '@/components/table'
import { COLS, rowHref } from '@/features/projects/list/columns'
import { DONE, DROPPED, LIVE } from '@/data/status'
import { DocFile, DocList } from '@/components/docs'
import { ROUTES } from '@/app/routes'
import { NOUN, nounAfter, readDate, units } from '@/lib/format'
import { ENTITY_DOCS_TOTAL } from '@/data/repository'
import type { EntityDetail, EntityEvent } from '@/data/mock/entityDetail'
import type { EntityRow, ProjectRow } from '@/types/domain'
import { AddBank, BankActions } from './EntityActions'
import { BankCertReplace, BankEdit, EntityDocReplace, EntityEdit } from './EditSections'
import { useState } from 'react'
import { useRole } from '@/hooks/useRole'
import { entityEvalSummary, entityLessons, saveEntityLessons, useClosing } from '@/data/closing/store'

/* === An external party's reference record (v3 · 11.2.1 · 11.4.1) ===
   Re-audit 17 Oct · the file used to fill an external party with a generated director, clerk,
   username and license · it has none of these · it reads what was recorded, nothing more */
export function ExternalRecordTab({ e }: { e: EntityRow }) {
  const x = e.external!
  return (
    <Glass>
      <Head title="سجل مرجعي داخلي" meta={<Tag tone="mute">جهة خارجية</Tag>} />
      <KV
        rows={[
          { k: 'اسم الجهة', v: e.name },
          { k: 'المنطقة', v: e.region },
          { k: 'المحافظة / المدينة', v: e.city },
          { k: 'طريقة التحويل', v: x.transfer ?? '—' },
          { k: 'المراجع', v: x.refs ?? '—' },
          { k: 'أنشأه', v: <Person name={x.by} quiet={false} /> },
          { k: 'تاريخ الإنشاء', v: <DateText>{x.at}</DateText> },
        ]}
      />
    </Glass>
  )
}

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
        <Head title="التعريف" meta={<EntityEdit e={e} d={d} section="id" />} />
        <KV
          rows={[
            /* Client 24 Oct · what the header already shows (name, code, classification, licence,
               licensor, region and city, governance) isn't repeated in the tab */
            { k: 'تاريخ التأسيس', v: <DateText>{d.foundedAt}</DateText> },
            { k: 'تاريخ التسجيل في المؤسسة', v: <DateText>{e.registeredAt}</DateText> },
          ]}
        />
      </Glass>

      {/* Permissions: these two dates block the agreement if they expire, so they sit at the top,
          not among the contact details. */}
      <Glass>
        <Head
          title="سريان الصلاحيات"
          meta={<span className="rowf gp-2">{
            d.licenseExpired || d.boardExpired
              ? <Tag tone="no">يوقف التعاقد</Tag>
              : <Tag tone="ok">سارية</Tag>
          }<EntityEdit e={e} d={d} section="dates" /></span>}
        />
        <KV
          rows={[
            {
              /* The date and badge used to run together: `<>` stacks the two elements with no gap,
                 so the line read "March 25 2019Expired". Adding a space wasn't the fix - the gap
                 should be declared in the layout. The badge is now a `Tag` component like every
                 other badge, not a hand-written `<span class=\"tag no\">`. */
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
        <Head title="الاتصال" meta={<EntityEdit e={e} d={d} section="contact" />} />
        <KV
          rows={[
            { k: 'الهاتف', v: <Mono>{d.phone}</Mono> },
            { k: 'جوال الجهة', v: <Mono>{e.mobile}</Mono> },
            { k: 'البريد الإلكتروني', v: <Mono>{e.email}</Mono> },
            { k: 'الموقع الإلكتروني', v: <Mono>{d.website}</Mono> },
          ]}
        />
      </Glass>

      <Glass>
        <Head title="الأشخاص" meta={<EntityEdit e={e} d={d} section="people" />} />
        <KV
          rows={[
            /* A card titled "People" - the avatar here isn't decoration, it is the card's content.
               These two aren't in the staff directory (entity names are generated), so they fall
               back to their initials - the correct shape for a person with no profile in the
               system. */
            { k: 'المدير التنفيذي', v: <Person name={d.directorName} size="md" quiet={false} /> },
            { k: 'جوال المدير', v: <Mono>{d.directorMobile}</Mono> },
            { k: 'مدخل البيانات', v: <Person name={d.clerkName} size="md" quiet={false} /> },
            { k: 'جوال مدخل البيانات', v: <Mono>{d.clerkMobile}</Mono> },
            { k: 'بريد مدخل البيانات', v: <Mono>{d.clerkEmail}</Mono> },
          ]}
        />
      </Glass>

      <Glass>
        <Head title="بيانات النظام" />
        <KV
          rows={[
            { k: 'نوع الحساب', v: d.accountType },
            { k: 'اسم المستخدم', v: <Mono>{d.username}</Mono> },
            { k: 'رقم المستخدم', v: <Mono>{d.userNo}</Mono> },
            { k: 'آخر تعديل', v: <DateText>{d.updatedAt}</DateText> },
          ]}
        />
        {/* The admin note is required across the system on every approval or rejection, so it
            belongs here too, not only in the record. */}
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
export function EntityDocsTab({ d, entityId }: { d: EntityDetail; entityId: string }) {
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
      {/* 2.4.20 · an expired mandatory document takes the entity out of activity until an update
          request carries the renewed copy · the entity is told from its portal */}
      {expired > 0 && (
        <div className="ptl-res no mb-3">
          <Icon name={icons.alert} size="sm" />
          <div>
            <b><Num>{expired}</Num> {expired === 1 ? 'وثيقة منتهية' : 'وثائق منتهية'}</b>
            <p><Link className="lnk" to={`${ROUTES.entityUpdate}?entity=${entityId}`}>نموذج التحديث كما تراه الجهة</Link></p>
          </div>
        </div>
      )}
      <DocList
        label="مستندات الجهة وصلاحيتها"
        rows={d.docs.map((x) => ({
          name: x.file ?? `${x.name}.pdf`,
          /* Client 24 Oct · the dates read under the name, so the row has room for «استبدال» */
          meta: [x.at ? `رُفع ${readDate(x.at)}` : '', x.expires ? `ينتهي ${readDate(x.expires)}` : ''].filter(Boolean).join(' · ') || undefined,
          uploaded: x.uploaded,
          expired: x.expired,
          /* Client 24 Oct · an uploaded document is replaced in place · a missing one is uploaded */
          action: <EntityDocReplace entityId={entityId} doc={x.name} has={x.uploaded} />,
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
export function EntityBanksTab({ d, entityId }: { d: EntityDetail; entityId: string }) {
  if (d.banks.length === 0) {
    return <Glass><Empty art={{ done: 0, total: 2 }} title="لا توجد حسابات بنكية مسجّلة." actions={<AddBank entityId={entityId} />} /></Glass>
  }

  const on = d.banks.filter((b) => b.status === 'مفعل').length
  return (
    <div className="col">
      {/* Client 23 Oct · the staff add an account from here · active on save */}
      <Glass>
        <Head title="الحسابات البنكية" meta={<span className="sub"><Num>{d.banks.length}</Num> {nounAfter(d.banks.length, { one: 'حساب', few: 'حسابات', many: 'حسابًا' })} · <Num>{on}</Num> مفعّل</span>} />
        <AddBank entityId={entityId} />
      {/* Client 27 Oct · the accounts as bank cards · one grid in the same card, each with its
          certificate and its actions under it */}
      {d.banks.length > 0 && (
          <BankGrid>
            {d.banks.map((b) => (
              <BankCard
                key={b.id}
                bank={b.bank}
                iban={b.iban}
                holder={b.accountName}
                purpose={b.shortName}
                status={b.status}
                off={b.status !== 'مفعل'}
                actions={<><BankCertReplace entityId={entityId} b={b} /><BankEdit entityId={entityId} b={b} /><BankActions entityId={entityId} b={b} /></>}
              >
                {b.reason && (
                  <div className="lastact">
                    <span className="sub">سبب التعطيل</span>
                    <p>{b.reason}</p>
                  </div>
                )}
                <DocFile name={b.certificate} meta="الشهادة البنكية" />
                {b.attachment && <DocFile name={b.attachment} meta="المرفق" />}
              </BankCard>
            ))}
          </BankGrid>
      )}
      </Glass>
    </div>
  )
}

/* === Entity log === */

/**
 * Dot color reflects the nature of the entry: approval green, suspension red, return-for-edit its
 * own tone.
 */
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
export function EntityLogTab({ d, entityId }: { d: EntityDetail; entityId?: string }) {
  /* Batch 7 · cross#18 · the portal account's events sit in the entity's own log too, not only in
     /audit · each reset is its own line */
  const acct = accountEvents().filter((e) => Boolean(entityId) && e.id === `e-${entityId}`).map((e, i): EntityDetail['log'][number] => ({
    id: `acct-${i}`, kind: 'edit', action: e.created ? 'إنشاء حساب في بوابة الجهات' : 'تعيين كلمة مرور جديدة للحساب',
    by: 'مدخل بيانات الجهة', at: e.at.slice(0, 10), time: e.at.slice(11, 16),
  }))
  const log = [...acct, ...d.log].sort((a, b) => `${b.at} ${b.time}`.localeCompare(`${a.at} ${a.time}`))
  return (
    <Glass>
      <Head title="سجل الجهة" meta={<><span className="num">{log.length}</span> {nounAfter(log.length, NOUN.entry)}</>} />
      <ul className="lg">
        {log.map((ev) => (
          <li className="lgi" key={ev.id}>
            <span className={`lgdot ${DOT[ev.kind]}`} />

            <div className="lghead">
              <span className="lgact">{ev.action}</span>
              <span className="pc-sp" />
              <span className="lgtime sub"><DateText>{ev.at}</DateText> · <Num>{ev.time}</Num></span>
            </div>

            <div className="lgby">
              {/* Client 24 Oct · the name with its face, 32 */}
              <span className={`lgwho ${WHO[ev.kind]}`}><Person name={ev.by} size="md" quiet={false} /></span>
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

/** v3 · 10.4.30 · a simple average of the entity's project evaluations · advisory · and its lessons learned */
export function EntityEvalCard({ entityId }: { entityId: string }) {
  useClosing()
  const { role, user } = useRole()
  const sum = entityEvalSummary(entityId)
  const les = entityLessons(entityId)
  const [text, setText] = useState(les?.text ?? '')
  const [bad, setBad] = useState<string[]>([])
  const may = ['supervisor', 'grants-manager', 'ceo'].includes(role.key)
  return (
    <Glass id="ent-evals">
      <Head title="تقييمات مشاريع الجهة" hint="متوسط بسيط استرشادي، لا يُقرّر وحده." meta={sum.avg !== null ? <span className="sub">المتوسط <Num>{sum.avg}</Num> من 100 · <Num>{sum.n}</Num> {nounAfter(sum.n, NOUN.project)}</span> : <span className="sub">لا مشاريع مقيّمة مغلقة بعد</span>} />
      {sum.projects.length > 0 && (
        <KV rows={sum.projects.map((x) => ({ k: x.name, v: <><Num>{x.score}</Num> <span className="sub">من 100</span></> }))} />
      )}
      <FormField label="الدروس المستفادة على مستوى الجهة">
        <FieldBox><textarea rows={2} value={text} disabled={!may} onChange={(e) => setText(e.target.value)} aria-label="الدروس المستفادة على مستوى الجهة" placeholder="ما تعلّمته المؤسسة من العمل مع هذه الجهة" /></FieldBox>
        {les && <span className="sub regf-h">آخر تحديث · <Person name={les.by} /> · <DateText>{les.at}</DateText></span>}
      </FormField>
      {may && <div className="act-a"><Button type="button" variant="2" size="sm" disabled={!text.trim() || text === les?.text} onClick={() => setBad(saveEntityLessons(entityId, text, user.name, role.key))}>احفظ الدروس</Button></div>}
      {bad.map((b) => <p key={b} className="bad cnote">{b}</p>)}
    </Glass>
  )
}

/* Client 23 Oct · the entity's projects by where they stand · it replaces the «أداء الجهة» box: the
   same five counts, now each one opens its projects · and the table is the projects list's own,
   same columns, so a project reads the same in both places. */
const PRJ_TABS: { slug: string; label: string; has: readonly string[] }[] = [
  /* Every project that was approved, wherever it went since · the record's «مشاريع معتمدة» */
  { slug: 'approved', label: 'معتمدة', has: [...LIVE, ...DONE, 'متعثر'] },
  /* From the approval to the closing · as the entity's running counter counts it */
  { slug: 'running', label: 'تحت التشغيل', has: LIVE },
  { slug: 'done', label: 'مكتملة', has: DONE },
  { slug: 'declined', label: 'معتذر عنها', has: DROPPED },
  { slug: 'stalled', label: 'متعثرة', has: ['متعثر'] },
]

export function EntityProjectsTab({ rows }: { rows: ProjectRow[] }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [cols, setCols] = useState<string[]>(() => readCols('projects', COLS))
  const [sort, setSort] = useState<ColSort | null>(null)
  if (rows.length === 0) {
    return <Glass id="ent-projects"><Empty art={{ done: 0 }} title="لا توجد مشاريع لهذه الجهة." /></Glass>
  }
  const of = (has: readonly string[]) => rows.filter((r) => has.includes(r.statusGroup))
  const items = [
    { slug: 'all', label: 'كل المشاريع', count: rows.length },
    ...PRJ_TABS.map((t) => ({ slug: t.slug, label: t.label, count: of(t.has).length })),
  ]
  const pt = items.some((t) => t.slug === params.get('pt')) ? (params.get('pt') as string) : 'all'
  const tab = PRJ_TABS.find((t) => t.slug === pt)
  const shown = tab ? of(tab.has) : rows
  return (
    <Glass id="ent-projects" className="tblcard">
      <Head title="مشاريع الجهة" meta={<><span className="num">{rows.length}</span> {nounAfter(rows.length, NOUN.project)}</>} />
      <Tabs pin={false} items={items} active={pt} onChange={(s) => setParams((x) => { const n = new URLSearchParams(x); if (s === 'all') n.delete('pt'); else n.set('pt', s); return n }, { replace: true })} />
      {shown.length === 0 ? (
        <Empty title={`لا مشاريع ${tab?.label ?? ''} لهذه الجهة.`} />
      ) : (
        <DataTable
          rows={sortRows(shown, COLS, sort)}
          sort={sort}
          onSort={(k) => setSort((x) => nextSort(x, k))}
          all={COLS}
          table="projects"
          cols={cols}
          onCols={setCols}
          id={(r) => r.id}
          onOpen={(r) => navigate(rowHref(r))}
          count={units.project}
        />
      )}
    </Glass>
  )
}

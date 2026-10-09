import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DateField, DateText, BackTo, FieldSelect, Glass, Head, Icon, icons, Money, Num, Riyal, Steps, Tag, type StepItem, Blockers, DockWhy, blockerCount,
} from '@/components/ui'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { blockerReadings } from '@/features/shared/blockerReadings'
import { AppLayout } from '@/app/layout/AppLayout'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { nf, NOUN, nounAfter, pct as sayPct } from '@/lib/format'
import {
  DOCS_STAGE, P_STAGES, completion, endOf, entityCap, entityOptions, optionsFor,
  projectIssues, shortIn, type PFieldDef, type PStageDef, type PValues,
} from '@/data/mock/projectNew'
import { REQUEST_DOCS, pickSupervisor, submitRequest } from '@/data/intake/flow'
import { draftKey, draftOf, dropDraft, saveDraft } from '@/data/intake/drafts'
import { CYCLE, inPeriod, openFields } from '@/data/intake/cycle'
import { entityById } from '@/data/mock/entities'
import { isStrategic, proposeRoute, typeAllowed } from '@/data/partners/store'
import { useRole } from '@/hooks/useRole'

/* Create a project - rule 31.

   Note: the system's largest module had no creation entry point. 4,929 projects in the live system,
   and our projects screen had only "settings" in its corner - meaning the screen said "read only".

   The three rules shaping it are documented in `projectNew.ts`: staged completion percentage (31),
   independent execution date (13), a cap on an entity's projects (12).

   Note: completion percentage is shown on the dock, not the header. The dock is where the user
   looks while deciding "send or not" - a number in the header is read once at the start and
   forgotten. */

/** A request attachment the form refuses · the types the field offers, up to 10 MB, and not empty */
const REQ_EXT = ['pdf', 'xlsx', 'docx', 'jpg', 'jpeg', 'png']
const reqFileRefusal = (f: File): string => {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  if (!REQ_EXT.includes(ext)) return `الامتداد .${ext} غير مقبول · PDF أو Excel أو Word أو صورة.`
  if (f.size === 0) return 'الملف فارغ · اختر النسخة الصحيحة.'
  if (f.size > 10 * 1024 * 1024) return 'الملف أكبر من 10 م.ب.'
  return ''
}

const KEYS = ['tab', 'as', 'entity'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

const EMPTY: PValues = {}

/** The free category in a multi-pick list · followed by the name the user types. */
const OTHER = 'أخرى'

/** One field - same `.fld` used in every other form in the system. */
function PField({
  f, value, parent, entitySlot, onChange,
}: {
  f: PFieldDef
  value: string
  parent: string
  entitySlot?: boolean
  onChange: (x: string) => void
}) {
  const opts = optionsFor(f, parent)

  return (
    <label className={`regf${f.kind === 'long' || f.kind === 'multi' ? ' regf-w' : ''}`}>
      <span className="lb">
        {f.label}
        {f.req && <b className="regf-r" aria-label="إلزامي">*</b>}
      </span>

      {entitySlot ? (
        /* Note: an entity that hit its cap stays in the list, with the reason shown - hiding it
           would make the user search for an entity they can't find and assume it isn't registered. */
        <FieldSelect
          value={value}
          onChange={onChange}
          label={f.label}
          placeholder="اختر"
          options={entityOptions().map((e) => ({
            value: e.id,
            label: `${e.name}${e.capped ? ` · بلغت الحدّ (${e.open})` : ''}${e.inactive ? ' · غير نشطة' : ''}`,
          }))}
        />
      ) : f.kind === 'select' ? (
        <FieldSelect
          value={value}
          options={opts}
          disabled={Boolean(f.dependsOn) && !parent}
          onChange={onChange}
          label={f.label}
          placeholder={f.dependsOn && !parent ? 'اختر الحقل السابق أولًا' : 'اختر'}
        />
      ) : f.kind === 'multi' ? (
        /* Note: target categories are tags, not a dropdown - selection is multiple, and a
           multi-select dropdown hides what's already chosen. */
        <span className="pmulti-w">
          <span className="pmulti">
            {opts.map((o) => {
              const on = value.split('،').filter(Boolean).includes(o)
              return (
                <button
                  key={o}
                  type="button"
                  className={`cfgchip${on ? ' on' : ''}`}
                  aria-pressed={on}
                  onClick={() => {
                    const cur = value.split('،').filter(Boolean)
                    const next = on ? cur.filter((x) => x !== o) : [...cur, o]
                    onChange(next.join('،'))
                  }}
                >
                  {o}
                </button>
              )
            })}
            {/* «أخرى» opens a field for a category the list doesn't have. It is stored as
                «أخرى: <name>» beside the others, so the review step and the record read it as is. */}
            {(() => {
              const cur = value.split('،').filter(Boolean)
              const on = cur.some((x) => x.startsWith(OTHER))
              return (
                <button
                  type="button"
                  className={`cfgchip${on ? ' on' : ''}`}
                  aria-pressed={on}
                  aria-expanded={on}
                  onClick={() => {
                    const next = on ? cur.filter((x) => !x.startsWith(OTHER)) : [...cur, OTHER]
                    onChange(next.join('،'))
                  }}
                >
                  {OTHER}
                </button>
              )
            })()}
          </span>
          {(() => {
            const cur = value.split('،').filter(Boolean)
            const other = cur.find((x) => x.startsWith(OTHER))
            if (other === undefined) return null
            const name = other.replace(OTHER, '').replace(/^:\s*/, '')
            return (
              <span className="pmulti-o">
                <span className="fld">
                  <input
                    autoFocus
                    value={name}
                    placeholder="اكتب اسم الفئة"
                    aria-label="اسم الفئة الأخرى"
                    onChange={(e) => {
                      /* The list separator can't appear inside a name. */
                      const typed = e.target.value.replace(/،/g, ' ')
                      const item = typed.trim() ? `${OTHER}: ${typed}` : OTHER
                      onChange(cur.map((x) => (x.startsWith(OTHER) ? item : x)).join('،'))
                    }}
                  />
                </span>
                {!name.trim() && <span className="sub regf-h">اكتب اسم الفئة غير الموجودة في القائمة</span>}
              </span>
            )
          })()}
        </span>
      ) : f.kind === 'long' ? (
        <span className="fld fld-a">
          <textarea
            rows={4}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={f.label}
          />
        </span>
      ) : f.kind === 'num' ? (
        <span className="fld">
          <input
            className="num"
            inputMode="numeric"
            value={value ? nf.format(Number(value)) : ''}
            onChange={(e) => onChange(String(Number(e.target.value.replace(/[^\d]/g, '')) || ''))}
            aria-label={f.label}
          />
          {f.unit === 'ريال' ? <Riyal /> : <span className="sub">{f.unit}</span>}
        </span>
      ) : f.kind === 'date' ? (
        /* Note: `DateField` wraps `.fld` itself - no extra wrapper needed. */
        <DateField value={value} onChange={onChange} label={f.label} />
      ) : (
        <span className="fld">
          <input value={value} onChange={(e) => onChange(e.target.value)} aria-label={f.label} />
        </span>
      )}

      {f.hint && <span className="sub regf-h">{f.hint}</span>}
    </label>
  )
}

/* The documents station · its content is the upload list (3.1.input-4), so it carries no fields */
const DOCS: PStageDef = { key: DOCS_STAGE, label: 'المرفقات', note: 'الوثائق التي يُدرس عليها الطلب · الإلزامية تمنع الإرسال حتى تُرفع', fields: [] }
const ENTITY_DOCS = REQUEST_DOCS.filter((d) => d.audience === 'entity')

export default function ProjectNewPage() {
  const navigate = useNavigate()
  const { user } = useRole()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  /* `?as=entity` · the entity applying from its portal (0.2.1 · 3.2.5): its own record is fixed,
     so the «الجهة» station drops out. Without it, a supervisor files the request on its behalf. */
  const asEntity = v.as === 'entity' && Boolean(v.entity && entityById(v.entity))
  const STAGES = useMemo(
    () => [...(asEntity ? P_STAGES.filter((st) => st.key !== 'who') : P_STAGES), DOCS],
    [asEntity],
  )
  const tab = STAGES.some((s) => s.key === v.tab) ? (v.tab as string) : STAGES[0].key
  const setTab = (x: string) => set({ tab: x === STAGES[0].key ? undefined : x })

  /* Re-audit 7 Oct · a saved draft reopens here, for the same author */
  const dkey = draftKey(asEntity, v.entity as string | undefined, user.name)
  const [draft, setDraft] = useState(() => draftOf(dkey))
  const [val, setVal] = useState<PValues>(() => draft?.val ?? (asEntity ? { entityId: v.entity as string } : EMPTY))
  const [docs, setDocs] = useState<Record<string, string>>(() => draft?.docs ?? {})
  const [saved, setSaved] = useState(false)
  const [fileErr, setFileErr] = useState<Record<string, string>>({})
  const keepDraft = () => { setDraft(saveDraft(dkey, val, docs)); setSaved(true) }
  const freshStart = () => { dropDraft(dkey); setDraft(undefined); setVal(asEntity ? { entityId: v.entity as string } : EMPTY); setDocs({}); setSaved(false) }
  const [sentId, setSentId] = useState<string | null>(null)
  const sent = sentId !== null

  const setField = (k: string, x: string) =>
    setVal((s) => {
      const next = { ...s, [k]: x }
      /* The child resets when its parent changes - otherwise a target could be left under a scope
         it no longer belongs to. */
      if (k === 'track') { next.field = ''; next.goal = '' }
      if (k === 'field') next.goal = ''
      if (k === 'region') next.city = ''
      return next
    })

  const docShort = ENTITY_DOCS.filter((d) => d.required && !docs[d.key]).map((d) => d.label)
  const reqDocs = ENTITY_DOCS.filter((d) => d.required).length
  /* Completion counts the required documents beside the required fields */
  const pct = Math.round((completion(val) * 0.85) + (((reqDocs - docShort.length) / reqDocs) * 15))
  const issues = useMemo(() => {
    /* 11.2.2 · 13.4.1 · the type has to be one the partner may have · a portfolio is a partner's alone */
    const t = val.ptype === 'محفظة' ? 'portfolio' : 'independent'
    const own = [
      ...(val.ptype === 'محفظة' && val.entityId && !isStrategic(val.entityId) ? [{ key: 'ptype', say: 'المحفظة لشريك استراتيجي معتمد وحده', rule: /* doc 13.4.1 */ '' }] : []),
      ...(val.entityId && isStrategic(val.entityId) && !typeAllowed(val.entityId, t) ? [{ key: 'ptype', say: `«${val.ptype || 'مستقل'}» غير مسموح لهذا الشريك`, rule: /* doc 11.2.2 */ '' }] : []),
    ]
    return [...projectIssues(val), ...own]
  }, [val])
  const shortBy = useMemo(
    () => Object.fromEntries(STAGES.map((s) => [s.key, s.key === DOCS_STAGE ? docShort : shortIn(s, val)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [val, STAGES, docs],
  )
  const endAt = endOf(val)
  const assignee = val.field ? pickSupervisor(val.field, val.goal ?? '') : null
  const portalOpen = inPeriod()
  const missing = Object.values(shortBy).flat()
  const canSend = missing.length === 0 && issues.length === 0
  /* One shared count for the card and the dock. */
  const blocks = [
    ...STAGES.filter((s) => shortBy[s.key].length)
      .map((s) => ({ head: s.label, text: shortBy[s.key].join(' · '), n: shortBy[s.key].length })),
    ...issues.map((i) => ({ head: 'قبل الإرسال', text: i.say })),
  ]

  const at = STAGES.findIndex((x) => x.key === tab)
  const stage = STAGES[at]
  const first = at <= 0
  const last = at >= STAGES.length - 1
  const go = (d: -1 | 1) => {
    const next = STAGES[at + d]
    if (next) setTab(next.key)
  }

  const send = () => {
    /* 13.2.2 · a portfolio isn't a project · it's created on its own page with the partner fixed */
    if (val.ptype === 'محفظة') { navigate(`${ROUTES.portfolioNew}?entity=${val.entityId}${asEntity ? '&as=partner' : ''}`); return }
    const id = submitRequest({ ...val, endAt, ...(draft ? { draftAt: draft.createdAt } : {}) }, Object.keys(docs), asEntity ? entityById(val.entityId)?.name ?? user.name : user.name, asEntity)
    /* Batch 7 · partners#4 · the form records the routing as a proposal · the executive decides it */
    if (val.platform === 'منصة إحسان' || isStrategic(val.entityId)) proposeRoute(id, val.platform === 'منصة إحسان', 'independent', 'من نموذج الطلب', user.name)
    dropDraft(dkey)
    setSentId(id)
  }

  const ent = entityOptions().find((e) => e.id === val.entityId)
  const asked = Number(val.amountRequested) || 0
  const reach = Number(val.reach) || 0

  const steps: StepItem[] = [
    { label: 'تعبئة الطلب', note: asEntity ? 'الجهة من البوابة' : 'مشرف المنح نيابةً عن الجهة', state: sent ? 'done' : 'now' },
    { label: 'الدراسة والتوصية', note: 'خطوات 11 إلى 15', state: sent ? 'now' : 'todo' },
    { label: 'الاعتماد', note: 'حسب مصفوفة السقوف', state: 'todo' },
  ]

  return (
    <AppLayout assistantContext={assistFor.page('إنشاء مشروع')}>
      <div className="viewstack hasdock">
        <div className="screen col">
          <BackTo label="المشاريع" onClick={() => navigate(ROUTES.projects)} />

          <header>
            <div>
              <h1 className="ptitle">{asEntity ? 'طلب دعم مشروع' : 'مشروع جديد'}</h1>
              <p className="sub mt-1">
                {CYCLE.name} · من <DateText>{CYCLE.from}</DateText> إلى <DateText>{CYCLE.to}</DateText> ·{' '}
                <span className="num">{openFields().length}</span> مجالات مفتوحة · والمبلغ المعتمد يُحدَّد في الدراسة لا هنا
              </p>
              {!portalOpen && (
                <p className="sub cnote"><Tag tone="warn">البوابة مغلقة</Tag> لا يُقبل طلب جديد خارج فترة التقديم.</p>
              )}
            </div>
            {/* Note: `pct` comes from the shared library, not a hand-written mark.
                `<Num>{n}</Num>` followed by a bare percent sign renders "0 % complete" with a gap: the percent sign is
                Arabic-context and the number is Latin, so bidi reordering separates them. `pct`
                wraps both inside a directional isolate (`U+2066...U+2069`) so they stay adjacent -
                and it already existed in `lib/format`. */}
            {/* The count badge in the page header was removed - a single count now lives in the
                dock. */}
          </header>

          <Glass className="regsteps">
            <Steps
              flow="stepper"
              onPick={(i) => setTab(STAGES[i].key)}
              items={STAGES.map((st) => ({
                label: st.label,
                state: st.key === tab ? 'now' : shortBy[st.key].length === 0 ? 'done' : 'todo',
              }))}
            />
          </Glass>

          <div className="g2">
            <div className="col">
              <Glass>
                <Head
                  title={stage.label}
                  meta={
                    shortBy[tab].length
                      ? <Tag tone="warn"><Num>{shortBy[tab].length}</Num> نواقص</Tag>
                      : <Tag tone="ok">مكتمل</Tag>
                  }
                />
                <p className="sub cnote">{stage.note}</p>

                {tab === DOCS_STAGE && (
                  <ul className="regdocs">
                    {ENTITY_DOCS.map((d) => {
                      const on = Boolean(docs[d.key])
                      return (
                        <li key={d.key} className={on ? 'ok' : d.required ? 'no' : ''}>
                          <div className="regdoc-h">
                            <span className="regdocs-l">{d.label}</span>
                            <span className="pc-sp" />
                            {on && <Tag tone="ok">مرفوع</Tag>}
                            {d.required ? <Tag tone="warn">إلزامي</Tag> : <Tag tone="mute">اختياري</Tag>}
                          </div>
                          {on ? (
                            <div className="regdoc-up">
                              <span className="sub">{docs[d.key]}</span>
                              <button className="btn btn-ghost btn-sm" onClick={() => setDocs((x) => { const y = { ...x }; delete y[d.key]; return y })}>
                                <Icon name={icons.close} size="sm" />
                                أزل الملف
                              </button>
                            </div>
                          ) : (
                            <label className="regdrop">
                              <input
                                type="file"
                                accept=".pdf,.xlsx,.docx,.jpg,.png"
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  if (!f) return
                                  /* Re-audit 7 Oct · the type and size are checked here, not only hinted by \`accept\` */
                                  const why = reqFileRefusal(f)
                                  setFileErr((x) => ({ ...x, [d.key]: why }))
                                  if (why) { e.target.value = ''; return }
                                  setDocs((x) => ({ ...x, [d.key]: f.name }))
                                }}
                              />
                              <Icon name={icons.upload} size="sm" />
                              <span>اسحب الملف هنا أو اضغط لاختياره</span>
                            </label>
                          )}
                          {fileErr[d.key] && <p className="bad cnote">{fileErr[d.key]}</p>}
                        </li>
                      )
                    })}
                  </ul>
                )}

                <div className="regfields">
                  {stage.fields.map((f) => (
                    <PField
                      key={f.key}
                      f={f}
                      value={val[f.key] ?? ''}
                      parent={f.dependsOn ? val[f.dependsOn] ?? '' : ''}
                      entitySlot={f.key === 'entityId'}
                      onChange={(x) => setField(f.key, x)}
                    />
                  ))}
                </div>

                {tab === 'when' && endAt && (
                  <p className="sub cnote">
                    نهاية التنفيذ المحسوبة <b><DateText>{endAt}</DateText></b> · بعد{' '}
                    <span className="num">{val.workDays}</span> يوم عمل من <DateText>{val.startAt}</DateText>،
                    باستبعاد العطلة الأسبوعية والإجازات الرسمية.
                  </p>
                )}
                {tab === 'what' && val.field && (
                  <p className="sub cnote">
                    {assignee
                      ? <>يُسند الطلب عند إرساله إلى <b>{assignee}</b> · بقاعدة توزيع المجال.</>
                      : <>توزيع المجال يدوي · يُسند مدير المنح الطلب بعد إرساله.</>}
                  </p>
                )}

                {/* The rule is stated at its own stage, not in a message after submission. */}
                {issues
                  .filter((i) => stage.fields.some((f) => f.key.startsWith(i.key)) ||
                    ((tab === 'who' || (asEntity && tab === 'what')) && ['cap', 'inactive', 'docs-exp', 'bank'].includes(i.key)) ||
                    (tab === 'what' && (i.key === 'field' || i.key === 'period')) ||
                    (tab === 'when' && i.key === 'dates') ||
                    (tab === 'money' && i.key === 'per'))
                  .map((i) => (
                    <p key={i.key} className="bad cnote">
                      {i.say}
                    </p>
                  ))}

                <div className="regfoot">
                  <span className="decsent">
                    الخطوة <b><Num>{at + 1}</Num> من <Num>{STAGES.length}</Num></b>
                    <span className="decsep" />
                    {stage.label}
                  </span>
                  <span className="pc-sp" />
                  <div className="rowf gp-2">
                    <button
                      className="btn btn-2"
                      disabled={first}
                      title={first ? 'هذه الخطوة الأولى' : `العودة إلى ${STAGES[at - 1].label}`}
                      onClick={() => go(-1)}
                    >
                      <Icon name={icons.chevronBack} size="sm" />
                      السابق
                    </button>
                    {!last && (
                      <button
                        className="btn btn-p"
                        title={`الانتقال إلى ${STAGES[at + 1].label}`}
                        onClick={() => go(1)}
                      >
                        التالي
                        <Icon name={icons.chevron} size="sm" />
                      </button>
                    )}
                  </div>
                </div>
              </Glass>

              {/* The path, the entity and the checks · in the main column, the end column is the assistant's alone */}
              <Glass>
                <Head title="مسار الطلب" meta={<span className="sub">ثلاث محطات</span>} />
                <Steps items={steps} flow="ladder" />
                {/* Rule 24 - a supervisor's recommendation isn't a decision - this line prevents a
                    wrong expectation from the first screen. */}
                <p className="sub cnote">
                  توصية المشرف بالموافقة <b>لا يترتّب عليها</b> اعتماد ولا صرف ·
                  القرار النهائي حسب مصفوفة السقوف.
                </p>
              </Glass>

              {ent && (
                <Glass>
                  <Head
                    title="الجهة"
                    meta={
                      ent.capped
                        ? <Tag tone="warn">بلغت الحدّ</Tag>
                        : <Tag tone="ok">يمكنها التقديم</Tag>
                    }
                  />
                  <p className="sub">
                    قدّمت «{ent.name}» <b className="num">{ent.open}</b> {nounAfter(ent.open, NOUN.sentRequest)} في هذه الدورة ·
                    والحدّ <b className="num">{entityCap()}</b>.
                  </p>
                  <p className="sub cnote">
                    الحدّ من الإعدادات («الحدود المالية والزمنية») ويُحتسب على الطلبات المقدَّمة
                    داخل فترة الدورة ().
                  {/* doc 3.4.12 */}</p>
                </Glass>
              )}

              {asked > 0 && reach > 0 && (
                <Glass>
                  <Head title="تكلفة المستفيد" meta={<Tag tone="mute">محسوبة</Tag>} />
                  <p className="sub">
                    <Money>{asked}</Money> على <b className="num">{nf.format(reach)}</b>{' '}
                    مستفيد = <b><Money>{Math.round(asked / reach)}</Money></b> للمستفيد.
                  </p>
                </Glass>
              )}

              <Blockers
                items={blocks}
                ready="كل الحقول الإلزامية مكتملة · الطلب جاهز للإرسال."
              />
            </div>

            <AssistantAside
              title="مراجعة الطلب"
              cta="راجع الطلب"
              empty="كل الحقول الإلزامية مكتملة · الطلب جاهز للإرسال."
              readings={[
                ...blockerReadings(blocks, 'يمنع الإرسال'),
                ...(ent?.capped ? [{ id: 'pn-cap', kind: 'flag' as const, label: 'حدّ الطلبات', text: `بلغت «${ent.name}» حدّ الطلبات في هذه الدورة.`, src: /* doc 3.4.12 */ '' }] : []),
                ...(asked > 0 && reach > 0 ? [{ id: 'pn-cost', kind: 'note' as const, label: 'تكلفة المستفيد', metric: { value: nf.format(Math.round(asked / reach)), unit: 'ريال للمستفيد' }, text: `${nf.format(asked)} على ${nf.format(reach)} مستفيد.`, src: 'محسوبة من الطلب' }] : []),
              ]}
            />
          </div>
        </div>

        <div className="decdock">
          <div className="chrome decbar payact">
            <div className="rowf gp-3 payact-w">
              <span className="decsent">
                {sent
                  ? <>أُرسل الطلب · <b>{val.name}</b> في مرحلة الدراسة الآن{assignee ? <> عند {assignee}</> : ' · بانتظار الإسناد'}</>
                  : <>
                      {/* Note: the percentage sits on the dock - that's where the user decides
                          whether to submit, while a number in the header is read once and
                          forgotten. */}
                      الاكتمال <b className="num">{sayPct(pct)}</b>
                      {blocks.length
                        ? <DockWhy n={blockerCount(blocks)} />
                        : <><span className="decsep" />جاهز للإرسال</>}
                      {draft && <><span className="decsep" />{saved ? 'حُفظت المسودة' : 'مسودة محفوظة'} <DateText>{draft.savedAt.slice(0, 10)}</DateText>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={freshStart}>ابدأ من جديد</button></>}
                    </>}
              </span>
            </div>
            <div className="rowf gp-2">
              {!sent ? (
                <>
                  {/* Rule 31 - saving a draft is part of the staged form. */}
                  <button
                    className="btn btn-2"
                    disabled={!val.entityId}
                    title={val.entityId ? 'احفظ الطلب مسودةً' : 'اختر الجهة أولًا'}
                    onClick={keepDraft}
                  >
                    احفظ المسودة
                  </button>
                  <button
                    className="btn btn-p"
                    disabled={!canSend}
                    title={
                      missing.length
                        ? `ينقص ${missing.length} من الحقول الإلزامية`
                        : issues.length
                          ? issues[0].say
                          : 'أرسل الطلب للدراسة'
                    }
                    onClick={send}
                  >
                    أرسل للدراسة
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-2" onClick={() => navigate(asEntity ? `${ROUTES.entityPortal}?entity=${val.entityId}` : ROUTES.projects)}>
                    {asEntity ? 'العودة إلى البوابة' : 'العودة إلى المشاريع'}
                  </button>
                  {!asEntity && sentId && (
                    <button className="btn btn-p" onClick={() => navigate(ROUTES.project(sentId))}>
                      افتح المشروع
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

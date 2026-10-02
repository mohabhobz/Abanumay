import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DateField, BackTo, FieldSelect, Glass, Head, Icon, icons, Money, Num, Riyal, Steps, Tag, type StepItem, Blockers, DockWhy, blockerCount,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { nf, NOUN, nounAfter, pct as sayPct } from '@/lib/format'
import {
  ENTITY_PROJECT_CAP, P_STAGES, completion, entityOptions, optionsFor,
  projectIssues, shortIn, type PFieldDef, type PValues,
} from '@/data/mock/projectNew'

/* Create a project - rule 31.

   Note: the system's largest module had no creation entry point. 4,929 projects in the live system,
   and our projects screen had only "settings" in its corner - meaning the screen said "read only".

   The three rules shaping it are documented in `projectNew.ts`: staged completion percentage (31),
   independent execution date (13), a cap on an entity's projects (12).

   Note: completion percentage is shown on the dock, not the header. The dock is where the user
   looks while deciding "send or not" - a number in the header is read once at the start and
   forgotten. */

const KEYS = ['tab'] as const
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

export default function ProjectNewPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const tab = P_STAGES.some((s) => s.key === v.tab) ? (v.tab as string) : P_STAGES[0].key
  const setTab = (x: string) => set({ tab: x === P_STAGES[0].key ? undefined : x })

  const [val, setVal] = useState<PValues>(EMPTY)
  const [saved, setSaved] = useState(false)
  const [sent, setSent] = useState(false)

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

  const pct = completion(val)
  const issues = useMemo(() => projectIssues(val), [val])
  const shortBy = useMemo(
    () => Object.fromEntries(P_STAGES.map((s) => [s.key, shortIn(s, val)])),
    [val],
  )
  const missing = Object.values(shortBy).flat()
  const canSend = missing.length === 0 && issues.length === 0
  /* One shared count for the card and the dock. */
  const blocks = [
    ...P_STAGES.filter((s) => shortBy[s.key].length)
      .map((s) => ({ head: s.label, text: shortBy[s.key].join(' · '), n: shortBy[s.key].length })),
    ...issues.map((i) => ({ head: i.rule, text: i.say })),
  ]

  const at = P_STAGES.findIndex((x) => x.key === tab)
  const stage = P_STAGES[at]
  const first = at <= 0
  const last = at >= P_STAGES.length - 1
  const go = (d: -1 | 1) => {
    const next = P_STAGES[at + d]
    if (next) setTab(next.key)
  }

  const ent = entityOptions().find((e) => e.id === val.entityId)
  const asked = Number(val.amountRequested) || 0
  const reach = Number(val.reach) || 0

  const steps: StepItem[] = [
    { label: 'تعبئة الطلب', note: 'مشرف المنح', state: sent ? 'done' : 'now' },
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
              <h1 className="ptitle">مشروع جديد</h1>
              <p className="sub mt-1">
                نموذج مرحلي · <span className="num">{P_STAGES.length}</span> محطات ·
                والمبلغ المعتمد يُحدَّد في الدراسة لا هنا
              </p>
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
              onPick={(i) => setTab(P_STAGES[i].key)}
              items={P_STAGES.map((st) => ({
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

                {/* The rule is stated at its own stage, not in a message after submission. */}
                {issues
                  .filter((i) => stage.fields.some((f) => f.key.startsWith(i.key)) ||
                    (tab === 'who' && (i.key === 'cap' || i.key === 'inactive')) ||
                    (tab === 'when' && i.key === 'dates') ||
                    (tab === 'money' && i.key === 'per'))
                  .map((i) => (
                    <p key={i.key} className="bad cnote">
                      {i.say} <span className="sub">· {i.rule}</span>
                    </p>
                  ))}

                <div className="regfoot">
                  <span className="decsent">
                    الخطوة <b><Num>{at + 1}</Num> من <Num>{P_STAGES.length}</Num></b>
                    <span className="decsep" />
                    {stage.label}
                  </span>
                  <span className="pc-sp" />
                  <div className="rowf gp-2">
                    <button
                      className="btn btn-2"
                      disabled={first}
                      title={first ? 'هذه الخطوة الأولى' : `العودة إلى ${P_STAGES[at - 1].label}`}
                      onClick={() => go(-1)}
                    >
                      <Icon name={icons.chevronBack} size="sm" />
                      السابق
                    </button>
                    {!last && (
                      <button
                        className="btn btn-p"
                        title={`الانتقال إلى ${P_STAGES[at + 1].label}`}
                        onClick={() => go(1)}
                      >
                        التالي
                        <Icon name={icons.chevron} size="sm" />
                      </button>
                    )}
                  </div>
                </div>
              </Glass>
            </div>

            <div className="col">
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
                    «{ent.name}» لديها <b className="num">{ent.open}</b> {nounAfter(ent.open, NOUN.openProject)} ·
                    والحدّ <b className="num">{ENTITY_PROJECT_CAP}</b> في الفترة.
                  </p>
                  <p className="sub cnote">
                    الحدّ <b>افتراضي</b> · تنصّ الوثيقة على أنه من الإعدادات دون
                    أن تحدّد رقمًا (قاعدة 12).
                  </p>
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
          </div>
        </div>

        <div className="decdock">
          <div className="chrome decbar payact">
            <div className="rowf gp-3 payact-w">
              <span className="decsent">
                {sent
                  ? <>أُرسل الطلب · <b>{val.name}</b> في مرحلة الدراسة الآن</>
                  : <>
                      {/* Note: the percentage sits on the dock - that's where the user decides
                          whether to submit, while a number in the header is read once and
                          forgotten. */}
                      الاكتمال <b className="num">{sayPct(pct)}</b>
                      {blocks.length
                        ? <DockWhy n={blockerCount(blocks)} />
                        : <><span className="decsep" />جاهز للإرسال</>}
                      {saved && <><span className="decsep" />حُفظت المسودة</>}
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
                    onClick={() => setSaved(true)}
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
                    onClick={() => setSent(true)}
                  >
                    أرسل للدراسة
                  </button>
                </>
              ) : (
                <button className="btn btn-2" onClick={() => navigate(ROUTES.projects)}>
                  العودة إلى المشاريع
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

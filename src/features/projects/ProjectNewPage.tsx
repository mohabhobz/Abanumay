import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DateField, BackTo, FieldSelect, Glass, Head, Icon, icons, Money, Num, Riyal, Steps, Tag, type StepItem,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { nf, pct as sayPct } from '@/lib/format'
import {
  ENTITY_PROJECT_CAP, P_STAGES, completion, entityOptions, optionsFor,
  projectIssues, shortIn, type PFieldDef, type PValues,
} from '@/data/mock/projectNew'

/* ═══════════════════════════════════════════════════════════
   إنشاء مشروع · BPD-003 قاعدة 31

   ⚠️ **أكبر موديول في السيستم كان مالوش مدخل إنشاء.** ٤٩٢٩ مشروعًا
   في النظام العامل، وشاشة المشاريع عندنا كان في ركنها «الإعدادات»
   وحدها · يعني الشاشة بتقول «دي للقراية».

   والقواعد التلاتة اللي بتشكّلها مكتوبة في `projectNew.ts`:
   المرحلية ونسبة الاكتمال (31) · تاريخ التنفيذ المستقل (13) ·
   حدّ مشاريع الجهة (12).

   ⚠️ **ونسبة الاكتمال معروضة في الدوك لا في الترويسة.** الدوك هو
   المكان اللي المستخدم بيبصّ فيه وهو بيقرّر «أبعت ولا لأ» · والرقم
   في الترويسة بيتقري مرة في الأول وبيتنسي.
   ═══════════════════════════════════════════════════════════ */

const KEYS = ['tab'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

const EMPTY: PValues = {}

/** حقل واحد · نفس `.fld` اللي في كل فورم تاني في السيستم */
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
        /* ⚠️ الجهة اللي وصلت الحدّ **بتفضل في القايمة** ومعاها
           السبب · اختفاؤها بيخلّي المستخدم يدوّر على جهة مش لاقيها
           ويفتكر إنها مش مسجَّلة (نفس درس ج-15) */
        <FieldSelect
          value={value}
          onChange={onChange}
          label={f.label}
          placeholder="اختار"
          options={entityOptions().map((e) => ({
            value: e.id,
            label: `${e.name}${e.capped ? ` · وصلت الحدّ (${e.open})` : ''}${e.inactive ? ' · غير مفعَّلة' : ''}`,
          }))}
        />
      ) : f.kind === 'select' ? (
        <FieldSelect
          value={value}
          options={opts}
          disabled={Boolean(f.dependsOn) && !parent}
          onChange={onChange}
          label={f.label}
          placeholder={f.dependsOn && !parent ? 'اختار اللي قبله أولًا' : 'اختار'}
        />
      ) : f.kind === 'multi' ? (
        /* ⚠️ الفئات المستهدفة **شرائح لا قائمة منسدلة** · الاختيار
           متعدّد، والمنسدلة المتعددة بتخبّي اللي اتختار */
        <span className="pmulti">
          {opts.map((o) => {
            const on = value.split('،').filter(Boolean).includes(o)
            return (
              <button
                key={o}
                type="button"
                className={`cfgchip${on ? ' on' : ''}`}
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
        <span className="fld">
          <DateField value={value} onChange={onChange} label={f.label} />
        </span>
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
      /* التابع بيتصفّر لما أبوه يتغيّر · وإلا بيفضل هدف تحت مجال
         مش تابع له */
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
                والمبلغ المعتمد بيتحدّد في الدراسة لا هنا
              </p>
            </div>
            {/* ⚠️ **`pct` من المكتبة لا علامة مكتوبة بالإيد.**
                `<Num>{n}</Num>٪` بيطلع «0 ٪ مكتمل» بفراغ: العلامة
                عربية والرقم لاتيني، فالـbidi بيفصلهم. و`pct` بيلفّ
                الاتنين في عازل اتجاهي (`U+2066…U+2069`) فبيفضلوا
                ملزوقين · وهي موجودة في `lib/format` من الأول. */}
            <Tag tone={pct === 100 ? 'ok' : 'warn'}>
              <span className="num">{sayPct(pct)}</span> مكتمل
            </Tag>
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
                      ? <Tag tone="warn"><Num>{shortBy[tab].length}</Num> ناقص</Tag>
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

                {/* القاعدة بتتقال في محطتها · لا في رسالة بعد الإرسال */}
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
                      title={first ? 'دي أول خطوة' : `ارجع لـ${P_STAGES[at - 1].label}`}
                      onClick={() => go(-1)}
                    >
                      <Icon name={icons.chevronBack} size={15} />
                      السابق
                    </button>
                    {!last && (
                      <button
                        className="btn btn-p"
                        title={`كمّل في ${P_STAGES[at + 1].label}`}
                        onClick={() => go(1)}
                      >
                        التالي
                        <Icon name={icons.chevron} size={15} />
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
                {/* قاعدة 24 · توصية المشرف مش قرارًا · والسطر ده بيمنع
                    توقّعًا غلط من أول شاشة */}
                <p className="sub cnote">
                  توصية المشرف بالموافقة <b>ما بيترتّب عليها</b> اعتماد ولا صرف ·
                  القرار النهائي حسب مصفوفة السقوف.
                </p>
              </Glass>

              {ent && (
                <Glass>
                  <Head
                    title="الجهة"
                    meta={
                      ent.capped
                        ? <Tag tone="warn">وصلت الحدّ</Tag>
                        : <Tag tone="ok">تقدر تقدّم</Tag>
                    }
                  />
                  <p className="sub">
                    «{ent.name}» عندها <b className="num">{ent.open}</b> مشاريع مفتوحة ·
                    الحدّ <b className="num">{ENTITY_PROJECT_CAP}</b> في الفترة.
                  </p>
                  <p className="sub cnote">
                    الحدّ <b>افتراضي</b> · الوثيقة بتقول إنه من الإعدادات من غير
                    ما تدّي رقمًا (قاعدة 12).
                  </p>
                </Glass>
              )}

              {asked > 0 && reach > 0 && (
                <Glass>
                  <Head title="تكلفة المستفيد" meta={<Tag tone="ret">محسوبة</Tag>} />
                  <p className="sub">
                    <Money>{asked}</Money> على <b className="num">{nf.format(reach)}</b>{' '}
                    مستفيد = <b><Money>{Math.round(asked / reach)}</Money></b> للمستفيد.
                  </p>
                </Glass>
              )}

              {missing.length > 0 && (
                <Glass>
                  <Head
                    title="ما ينقص قبل الإرسال"
                    meta={<Tag tone="warn"><Num>{missing.length}</Num> حقلًا</Tag>}
                  />
                  <ul className="regmiss">
                    {P_STAGES.filter((s) => shortBy[s.key].length).map((s) => (
                      <li key={s.key}>
                        <b>{s.label}</b>
                        <span className="sub"> · {shortBy[s.key].join(' · ')}</span>
                      </li>
                    ))}
                  </ul>
                </Glass>
              )}
            </div>
          </div>
        </div>

        <div className="decdock">
          <div className="chrome decbar payact">
            <div className="rowf gp-3 payact-w">
              <span className="decsent">
                {sent
                  ? <>اتبعت · <b>{val.name}</b> دخل الدراسة</>
                  : <>
                      {/* ⚠️ النسبة في الدوك · هنا اللي المستخدم بيقرّر
                          فيه «أبعت ولا لأ»، والرقم في الترويسة بيتقري
                          مرة وبيتنسي */}
                      الاكتمال <b className="num">{sayPct(pct)}</b>
                      <span className="decsep" />
                      {missing.length
                        ? <><Num>{missing.length}</Num> حقلًا إلزاميًا ناقص</>
                        : issues.length
                          ? <><Num>{issues.length}</Num> ملاحظة على الطلب</>
                          : 'جاهز للإرسال'}
                      {saved && <><span className="decsep" />اتحفظ كمسودة</>}
                    </>}
              </span>
            </div>
            <div className="rowf gp-2">
              {!sent ? (
                <>
                  {/* قاعدة 31 · حفظ مسودة جزء من النموذج المرحلي */}
                  <button
                    className="btn btn-2"
                    disabled={!val.entityId}
                    title={val.entityId ? 'احفظ كمسودة' : 'اختار الجهة الأول'}
                    onClick={() => setSaved(true)}
                  >
                    حفظ كمسودة
                  </button>
                  <button
                    className="btn btn-p"
                    disabled={!canSend}
                    title={
                      missing.length
                        ? `ناقص ${missing.length} من الإلزامي`
                        : issues.length
                          ? issues[0].say
                          : 'أرسل الطلب للدراسة'
                    }
                    onClick={() => setSent(true)}
                  >
                    إرسال للدراسة
                  </button>
                </>
              ) : (
                <button className="btn btn-2" onClick={() => navigate(ROUTES.projects)}>
                  ارجع للمشاريع
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

import { PartnerArt } from '@/components/soul'
import { registerInternal } from '@/data/entities/store'
import { readRole, roleByKey } from '@/data/roles'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BackTo, Glass, Head, Icon, icons, Mono, Num, Person, Steps, Tag, type StepItem, DockWhy,
} from '@/components/ui'
import { DocFile } from '@/components/docs'
import { AnalysisCard } from '@/components/assistant'
import { AppLayout } from '@/app/layout/AppLayout'
import { useFillHeight } from '@/hooks/useFillHeight'
import { readList, useQueryParams, writeList } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { entityRows } from '@/data/mock/entities'
import { regReadings, stageAdvice, stepState } from '@/data/mock/regPortal'
import {
  FORM_STAGES, PARTNER_ACCESS_STAGE, PARTNER_KINDS, REG_DOCS, docRequired, licenseClash,
  partnerKind, type PartnerKind, type RegStage,
} from '@/data/mock/registration'
import { Field } from './Field'
import { MISSING_ITEM, nounAfter } from '@/lib/format'

/* Registering an entity from inside the system - rule 32.

   Note: this isn't a second copy of the portal form. The difference isn't cosmetic, it's that the
   two sides are different:

   - portal: an entity with no account, applying for a grant, and its application gets reviewed
   - internal: an authorized grants supervisor registering a partner they manage themselves

   Which means three portal stages have no meaning here:
   - acceptance criteria - an eligibility filter for an outside party; the supervisor doesn't need
   approval
   - verification code - confirms the person filling it out owns the phone; the supervisor is
   already known by their session
   - review - the entity is created immediately, with no application to review

   What was added is exactly one field, and it's the most important part of the screen:

   Partnership type

   Rule of thumb: "the difference is in field control - an entity registering itself never sees this
   field". Whoever comes from the portal automatically gets "beneficiary partner", while whoever is
   registered here can be "implementing" or "strategic" - like the Ihsan platform, which never
   enters the platform at all and whose project is managed internally with no agreement.

   So type here isn't a table tag, it's a key that locks and unlocks steps in other procedures - and
   the screen shows what it unlocks at selection time, not after, so the supervisor knows they're
   making a decision, not just filling a field. */

const KEYS = ['tab', 'up', 'kind'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

/** The type stage comes before the data stages - it's the first decision on the screen.

    The portal's «حساب الجهة» stage isn't here: it holds a password, and the supervisor never sets
    a credential for an entity. A strategic partner gets its own access stage instead, right after
    the contacts, since its coordinator is one of those contacts. */
const stagesFor = (partner: PartnerKind | ''): RegStage[] => {
  const out: RegStage[] = []
  for (const st of FORM_STAGES) {
    out.push(st)
    if (st.key === 'contact' && partner === 'strategic') out.push(PARTNER_ACCESS_STAGE)
  }
  return out
}

const EMPTY: Record<string, string> = {}

export default function EntityNewPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)

  /* Note: type lives in the URL, not in state - and this isn't a code preference. When it was
     `useState`, the selected card's state was unreachable to testing, so every check ran against
     the empty card alone - the same blind spot that pushed the portal form's steps into the URL. */
  const partner = PARTNER_KINDS.some((k) => k.key === v.kind)
    ? (v.kind as PartnerKind)
    : ''
  const setPartner = (k: PartnerKind) => set({ kind: k })

  const formStages = useMemo(() => stagesFor(partner), [partner])
  const STAGES = useMemo(
    () => [{ key: 'partner', label: 'نوع الشراكة', note: '' }, ...formStages.map((s) => ({ key: s.key, label: s.label, note: s.note }))],
    [formStages],
  )
  const tab = STAGES.some((s) => s.key === v.tab) ? (v.tab as string) : STAGES[0].key
  const setTab = (x: string) => set({ tab: x === STAGES[0].key ? undefined : x })

  const [val, setVal] = useState<Record<string, string>>(EMPTY)
  const docs = useMemo(() => new Set(readList(v.up)), [v.up])
  const [files, setFiles] = useState<Record<string, { name: string; size: number }>>({})
  const [done, setDone] = useState(false)
  const [newId, setNewId] = useState('')

  const type = val.type ?? ''

  const setField = (k: string, x: string) =>
    setVal((s) => {
      const next = { ...s, [k]: x }
      if (k === 'region' && next.city) next.city = ''
      return next
    })

  const upload = (k: string, f?: File) => {
    if (f) setFiles((s) => ({ ...s, [k]: { name: f.name, size: f.size } }))
    set({ up: writeList([...new Set([...readList(v.up), k])]) })
  }

  const clearDoc = (k: string) => {
    setFiles((s) => {
      const next = { ...s }
      delete next[k]
      return next
    })
    set({ up: writeList(readList(v.up).filter((x) => x !== k)) })
  }

  /** What's missing at each stage - and the type stage's own missing item is the type itself. */
  const shortBy = useMemo(() => {
    const out: Record<string, string[]> = {}
    out.partner = partner ? [] : ['نوع الشراكة']
    for (const s of formStages) {
      out[s.key] =
        s.key === 'docs'
          ? REG_DOCS.filter((d) => docRequired(d, type) && !docs.has(d.key)).map((d) => d.label)
          : s.fields.filter((f) => f.req && !val[f.key]?.trim()).map((f) => f.label)
    }
    return out
  }, [val, docs, type, partner, formStages])

  const missing = Object.values(shortBy).flat()

  const clash = useMemo(
    () => (val.licenseNo && type ? licenseClash(val.licenseNo, type, entityRows) : null),
    [val.licenseNo, type],
  )

  /* Note: this follows the portal's own advice, exactly. This screen used to have no assistant at
     all - a grants supervisor registering internally filled the same form without the guidance
     shown to an external entity, and there was no reason for the difference: the missing items,
     blockers, and the calculation are the same (`stageAdvice`). What was missing was wiring the
     card in, not writing a new one. */
  const advice = useMemo(
    () => stageAdvice(tab, val, shortBy[tab] ?? [], [], []),
    [tab, val, shortBy],
  )

  /* Side column sticks and stretches to the end of the screen - same as the portal. */
  const aside = useRef<HTMLDivElement>(null)
  useFillHeight(aside, { varName: '--ai-fill', reserveSelector: '.decdock, .askfab', min: 240 })

  const canSave = missing.length === 0 && !clash && advice.blocking.length === 0

  const at = STAGES.findIndex((x) => x.key === tab)
  const first = at <= 0
  const last = at >= STAGES.length - 1
  const go = (d: -1 | 1) => {
    const next = STAGES[at + d]
    if (next) setTab(next.key)
  }

  const stage = STAGES[at]
  const fields = formStages.find((s) => s.key === tab)?.fields ?? []
  const strategic = partner === 'strategic'

  /* Journey stages - three, not five, with the difference stated in the column. */
  const steps: StepItem[] = [
    { label: 'تسجيل البيانات', note: 'مشرف المنح', state: done ? 'done' : 'now' },
    {
      label: 'إنشاء الجهة',
      note: 'فورًا · بلا مراجعة (قاعدة 32)',
      state: done ? 'done' : 'todo',
    },
    ...(strategic
      ? [{ label: 'دعوة المنسّق', note: 'بريد بدور «الشريك الاستراتيجي»', state: done ? 'done' : 'todo' } as StepItem]
      : []),
    {
      label: strategic ? 'تغذية المحفظة' : 'إنشاء مشاريعها',
      note: strategic ? 'يضيف الشريك مشاريعها الفرعية · ويعتمدها المشرف' : 'من داخل النظام لا من بوابتها',
      state: 'todo',
    },
  ]

  return (
    <AppLayout assistantContext={assistFor.page('تسجيل جهة مباشرةً')}>
      <div className="viewstack hasdock">
        <div className="screen col">
          <BackTo label="الجهات" onClick={() => navigate(ROUTES.entities)} />

          <header>
            <div>
              <h1 className="ptitle">تسجيل جهة مباشرةً</h1>
              <p className="sub mt-1">
                قاعدة <span className="num">32</span> · يسجّل مشرف المنح جهة شريكة
                دون المرور بالبوابة · منفّذة أو استراتيجية تدير محفظة · وتُنشأ فورًا بلا مراجعة
              </p>
            </div>
            {/* Note: the "22 missing" tag was removed from the page header - a third count of the
                same missing items next to the card and the doc. The colored tag now belongs to the
                card's status alone. The total count lives in the doc. */}
          </header>

          <Glass className="regsteps">
            <Steps
              flow="stepper"
              onPick={(i) => setTab(STAGES[i].key)}
              /* Note: "nothing missing" isn't "done" - the bank-accounts stage has no computed
                 fields, so it used to show complete while the user was still on the first stage. */
              items={STAGES.map((st, i) => ({
                label: st.label,
                state: stepState(i, at, shortBy[st.key]?.length ?? 0),
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
                      /* "6 of 22" - this stage's share of the same doc count. */
                      ? <Tag tone="warn"><Num>{shortBy[tab].length}</Num> من {missing.length} {nounAfter(missing.length, MISSING_ITEM)}</Tag>
                      : <Tag tone="ok">مكتمل</Tag>
                  }
                />
                {stage.note && <p className="sub cnote">{stage.note}</p>}

                {tab === 'partner' && (
                  <>
                    {/* Note: this decision is made once and governs later procedures - so what it
                        unlocks is shown at selection time, not after, and stated in text rather
                        than coded into a tag alone. */}
                    <ul className="pkinds">
                      {PARTNER_KINDS.map((k) => (
                        <li key={k.key}>
                          <label className={`pkind${partner === k.key ? ' on' : ''}`}>
                            <input
                              type="radio"
                              name="partner"
                              checked={partner === k.key}
                              onChange={() => setPartner(k.key)}
                            />
                            {/* Note: the `input` is hidden, so something drawn has to say "this is
                                the selected one". Previously the ring alone did that, and it's the
                                same neutral gray ring as any card - so this marker is what carries
                                the selection, and the ring only supports it. */}
                            <span className="pkind-h">
                              <span className="pkind-r" aria-hidden="true">
                                {partner === k.key && (
                                  <Icon name={icons.check} size="sm" />
                                )}
                              </span>
                              <b>{k.label}</b>
                              <span className="sub trim1">· {k.example}</span>
                              {/* The tag sits next to the title, not at the edge - the edge is now
                                  for the illustration. */}
                              {k.from === 'portal' && (
                                <Tag tone="mute">الافتراضي للقادم من البوابة</Tag>
                              )}
                            </span>
                            <PartnerArt kind={k.key} />
                            <ul className="pkind-o">
                              {k.opens.map((o) => (
                                <li key={o}>
                                  <Icon name={icons.check} size="sm" />
                                  <span>{o}</span>
                                </li>
                              ))}
                            </ul>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <p className="sub cnote">
                      القادم من البوابة العامة يُصنَّف <b>شريك مستفيد</b> تلقائيًا
                      ولا يظهر له هذا الحقل · وهذا هو الفرق الحقيقي بين المدخلين.
                    </p>
                  </>
                )}

                {tab === 'docs' && (
                  <>
                    <div className="regwho">
                      <Person name="مشرف المنح" quiet={false} />
                      <span className="sub">
                        المستندات هنا ترفعها <b>المؤسسة</b> نيابةً عن الشريك · لأنه لا
                        يدخل المنصة أصلًا
                      </span>
                    </div>
                    <ul className="regdocs">
                      {REG_DOCS.map((d) => {
                        const need = docRequired(d, type)
                        const on = docs.has(d.key)
                        const picked = files[d.key]
                        return (
                          <li key={d.key} className={on ? 'ok' : need ? 'no' : ''}>
                            <div className="regdoc-h">
                              <span className="regdocs-l">{d.label}</span>
                              <span className="pc-sp" />
                              {/* Note: type is a fixed tag and status is a separate one -
                                  "required" used to turn green once uploaded, so the same document
                                  read "required" in amber on one screen and green on another. */}
                              {on && <Tag tone="ok">مرفوع</Tag>}
                              {need
                                ? <Tag tone="warn">
                                    {d.reqFor ? `إلزامي للتصنيف ${d.reqFor[0]}` : 'إلزامي'}
                                  </Tag>
                                : <Tag tone="mute">اختياري</Tag>}
                            </div>
                            {on ? (
                              <div className="regdoc-up">
                                <DocFile
                                  name={picked?.name ?? `${d.label}.pdf`}
                                  meta={picked
                                    ? `${(picked.size / 1024 / 1024).toFixed(2)} م.ب`
                                    : 'عيّنة'}
                                  block
                                  download={false}
                                />
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => clearDoc(d.key)}
                                >
                                  <Icon name={icons.close} size="sm" />
                                  أزل الملف
                                </button>
                              </div>
                            ) : (
                              <label className="regdrop">
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png,.gif"
                                  onChange={(e) => upload(d.key, e.target.files?.[0])}
                                />
                                <Icon name={icons.upload} size="sm" />
                                <span>اسحب الملف هنا أو اضغط لاختياره</span>
                                <span className="pc-sp" />
                                <span className="sub regdocs-m">
                                  PDF أو JPG أو PNG · حتى{' '}
                                  <span className="num">{d.maxMb}</span> م.ب
                                </span>
                              </label>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}

                {tab !== 'partner' && tab !== 'docs' && (
                  <div className="regfields">
                    {fields.map((f) => (
                      <Field
                        key={f.key}
                        f={f}
                        value={val[f.key] ?? ''}
                        parent={f.dependsOn ? val[f.dependsOn] ?? '' : ''}
                        onChange={(x) => setField(f.key, x)}
                      />
                    ))}
                  </div>
                )}

                {/* Rules 8 and 9 - the same validation on both entry points. */}
                {tab === 'id' && clash && (
                  <p className="bad cnote">
                    رقم الترخيص <Mono>{val.licenseNo}</Mono> مسجَّل لـ «{clash.name}»
                    بنفس التصنيف · القاعدة <span className="num">8</span> تمنع التكرار.
                  </p>
                )}

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
                      title={first ? 'هذه أول خطوة' : `ارجع إلى ${STAGES[at - 1].label}`}
                      onClick={() => go(-1)}
                    >
                      <Icon name={icons.chevronBack} size="sm" />
                      السابق
                    </button>
                    {!last && (
                      <button
                        className="btn btn-p"
                        title={`انتقل إلى ${STAGES[at + 1].label}`}
                        onClick={() => go(1)}
                      >
                        التالي
                        <Icon name={icons.chevron} size="sm" />
                      </button>
                    )}
                  </div>
                </div>
              </Glass>

              {/* The path and what the partner kind opens · in the main column, the end column is the assistant's alone */}
              <Glass>
                <Head title="مسار التسجيل" meta={<span className="sub">{strategic ? 'أربع محطات' : 'ثلاث محطات'}</span>} />
                <Steps items={steps} flow="ladder" />
                {/* Note: the difference from the portal is stated, not inferred from the stage
                    count - five there, three here, and the reason is that the two sides are
                    different, not that this screen is a shortened version. */}
                <p className="sub cnote">
                  لا ضوابط قبول ولا رمز تحقّق ولا مراجعة · فهذه للطرف القادم من خارج
                  النظام، أما المشرف فمعروف بجلسته، والجهة تُنشأ فورًا.
                </p>
              </Glass>

              {/* Note: this card used to render even while sitting on the type stage - repeating
                  the exact three lines already shown on the selected card next to it. It now
                  appears only once selection sits outside the current screen - a reminder, not a
                  repeat. */}
              {partner && tab !== 'partner' && (
                <Glass>
                  <Head
                    title={`ما يتيحه «${partnerKind(partner).label}»`}
                    meta={<Tag tone="mute">شروط</Tag>}
                  />
                  <ul className="payq-ck">
                    {partnerKind(partner).opens.map((o) => (
                      <li key={o} className="ok">
                        <Icon name={icons.check} size="sm" />
                        <span>{o}</span>
                      </li>
                    ))}
                  </ul>
                  {partner === 'implementer' && (
                    <p className="sub cnote">
                      لا تدخل المنصة · فيُدار المشروع والدفعات من داخل النظام بيد مشرف المنح.
                    </p>
                  )}
                  {strategic && (
                    <p className="sub cnote">
                      مثل منصة إحسان · تمنحها المؤسسة مبلغًا لمحفظة وهي توزّعه على مشاريعها الفرعية،
                      ومنسّقها يدخل النظام ليغذّي المحفظة دون أن يعتمد أو يرفض.
                    </p>
                  )}
                </Glass>
              )}

            </div>

            <div className="col aiside" ref={aside}>
              {/* Note: the exact same assistant card as the portal - `AnalysisCard` and
                  `regReadings`, not a card written for this screen. Rendering "the Abanumay
                  assistant" differently depending on where the user is makes it look like two
                  assistants instead of one. */}
              <AnalysisCard
                title="مراجعة مساعد أبانمي"
                cta="راجع الطلب"
                empty="لا يوجد مانع في هذه المحطة · انتقل إلى المحطة التالية."
                ask
                onAsk={() => window.dispatchEvent(
                  new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
                )}
                readings={regReadings(
                  tab,
                  STAGES.map((st) => ({
                    key: st.key, label: st.label, short: shortBy[st.key] ?? [],
                  })),
                  advice,
                  setTab,
                )}
              />

              {/* Note: the "what's missing before registration" card was removed - the assistant
                  above says the same thing, ordered by priority, with its reason and a button
                  leading to the stage - so the card was repeating it as an inert list. */}
            </div>
          </div>
        </div>

        <div className="decdock">
          <div className="chrome decbar payact">
            <div className="rowf gp-3 payact-w">
              <span className="decsent">
                {done
                  ? <>سُجّلت الجهة · <b>{val.name}</b> أصبحت جهة نشطة، ونوعها{' '}
                      {partner && partnerKind(partner).label}
                      {strategic && val.coordEmail && (
                        <><span className="decsep" />أُرسلت دعوة الدخول إلى <span className="num">{val.coordEmail}</span></>
                      )}</>
                  : <>
                      تُنشأ الجهة <b>فورًا</b> · لا يوجد طلب للمراجعة
                      {partner && (
                        <>
                          <span className="decsep" />
                          {partnerKind(partner).label}
                        </>
                      )}
                      <DockWhy n={missing.length} />
                    </>}
              </span>
            </div>
            <div className="rowf gp-2">
              {!done ? (
                <button
                  className="btn btn-p"
                  disabled={!canSave}
                  title={
                    clash
                      ? 'رقم الترخيص مكرّر · قاعدة 8'
                      : missing.length
                        ? `ينقص ${missing.length} من الحقول الإلزامية`
                        : 'سجّل الجهة'
                  }
                  onClick={() => { setNewId(registerInternal(val, [...docs], partner ? partnerKind(partner).label : 'جهة مستفيدة', roleByKey(readRole()).name)); setDone(true) }}
                >
                  سجّل الجهة
                </button>
              ) : (
                <>
                  {strategic && (
                    <button className="btn btn-2" onClick={() => navigate(`${ROUTES.permissions}?tab=roles&r=partner`)}>
                      صلاحيات الشريك
                    </button>
                  )}
                  {newId && (
                    <button className="btn btn-p" onClick={() => navigate(ROUTES.entity(newId))}>
                      افتح ملف الجهة
                    </button>
                  )}
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.entities)}>
                    العودة إلى الجهات
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

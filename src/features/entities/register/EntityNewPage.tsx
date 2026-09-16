import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BackTo, Glass, Head, Icon, icons, Mono, Num, Person, Steps, Tag, type StepItem,
} from '@/components/ui'
import { DocFile } from '@/components/docs'
import { AppLayout } from '@/app/layout/AppLayout'
import { readList, useQueryParams, writeList } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { entityRows } from '@/data/mock/entities'
import {
  PARTNER_KINDS, REG_DOCS, REG_STAGES, docRequired, licenseClash, partnerKind,
  type PartnerKind,
} from '@/data/mock/registration'
import { Field } from './Field'

/* ═══════════════════════════════════════════════════════════
   تسجيل جهة من داخل النظام · قاعدة 32

   ⚠️ **دي مش نسخة تانية من فورم البوّابة.** الفرق مش شكلي، هو في
   إن الطرفين مختلفين:

     البوّابة      جهة مالهاش حساب، بتطلب منحة، وطلبها بيتراجَع
     من جوّه       مشرف منح بصلاحية، بيسجّل شريكًا بيديره بنفسه

   وعشان كده تلات محطات في البوّابة **مالهاش معنى هنا**:
     · ضوابط القبول — فلتر أهلية لطرف برّه، والمشرف مش محتاج يقرّ
     · رمز التحقّق — بيتأكّد إن اللي بيملا صاحب الجوال، والمشرف
       معروف بجلسته
     · المراجعة — الجهة بتتولد **فورًا**، مفيش طلب يتراجَع

   واللي زاد حقل واحد بس، وهو أهم حاجة في الشاشة:

   ═══ نوع الشراكة ═══

   مظفر: «الاختلاف حيكون في **التحكم في الحقول** · الجهة لما تيجي
   تسجّل الحقل ده ما بتشوفهوش». الجاي من البوّابة بياخد **شريك
   مستفيد** أوتوماتيك، واللي بيتسجّل هنا ممكن يكون **منفّذ** أو
   **استراتيجي** — زي منصة إحسان، اللي ما بتدخلش المنصة أصلًا
   والمشروع بيتدار داخليًا **بلا اتفاقية**.

   فالنوع هنا **مش وسمًا في الجدول**، هو مفتاح بيقفل ويفتح خطوات في
   إجراءات تانية · والشاشة بتعرض اللي بيفتحه **وقت الاختيار** لا
   بعده، عشان المشرف يعرف إنه بياخد قرارًا لا بيملا خانة.
   ═══════════════════════════════════════════════════════════ */

const KEYS = ['tab', 'up', 'kind'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

/** محطة النوع قبل محطات البيانات · وهي أول قرار في الشاشة */
const STAGES = [
  { key: 'partner', label: 'نوع الشراكة', note: '' },
  ...REG_STAGES.map((s) => ({ key: s.key, label: s.label, note: s.note })),
]

const EMPTY: Record<string, string> = {}

export default function EntityNewPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const tab = STAGES.some((s) => s.key === v.tab) ? (v.tab as string) : STAGES[0].key
  const setTab = (x: string) => set({ tab: x === STAGES[0].key ? undefined : x })

  /* ⚠️ النوع في **الرابط** لا في الستيت · وده مش تفضيلًا في الكود.
     لما كان في `useState` كانت حالة الكارت المختار مستحيل الفحص
     يوصلها، فكل قياس بيتعمل على الكارت الفاضي وحده · نفس العمى اللي
     خلّى مراحل فورم البوّابة تتنقل للرابط. */
  const partner = PARTNER_KINDS.some((k) => k.key === v.kind)
    ? (v.kind as PartnerKind)
    : ''
  const setPartner = (k: PartnerKind) => set({ kind: k })

  const [val, setVal] = useState<Record<string, string>>(EMPTY)
  const docs = useMemo(() => new Set(readList(v.up)), [v.up])
  const [files, setFiles] = useState<Record<string, { name: string; size: number }>>({})
  const [done, setDone] = useState(false)

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

  /** الناقص في كل محطة · ومحطة النوع ناقصها النوع نفسه */
  const shortBy = useMemo(() => {
    const out: Record<string, string[]> = {}
    out.partner = partner ? [] : ['نوع الشراكة']
    for (const s of REG_STAGES) {
      out[s.key] =
        s.key === 'docs'
          ? REG_DOCS.filter((d) => docRequired(d, type) && !docs.has(d.key)).map((d) => d.label)
          : s.fields.filter((f) => f.req && !val[f.key]?.trim()).map((f) => f.label)
    }
    return out
  }, [val, docs, type, partner])

  const missing = Object.values(shortBy).flat()

  const clash = useMemo(
    () => (val.licenseNo && type ? licenseClash(val.licenseNo, type, entityRows) : null),
    [val.licenseNo, type],
  )

  const canSave = missing.length === 0 && !clash

  const at = STAGES.findIndex((x) => x.key === tab)
  const first = at <= 0
  const last = at >= STAGES.length - 1
  const go = (d: -1 | 1) => {
    const next = STAGES[at + d]
    if (next) setTab(next.key)
  }

  const stage = STAGES[at]
  const fields = REG_STAGES.find((s) => s.key === tab)?.fields ?? []

  /* محطات الرحلة · تلاتة لا خمسة، والفرق مكتوب في العمود */
  const steps: StepItem[] = [
    { label: 'تسجيل البيانات', note: 'مشرف المنح', state: done ? 'done' : 'now' },
    {
      label: 'إنشاء الجهة',
      note: 'فورًا · بلا مراجعة (قاعدة 32)',
      state: done ? 'done' : 'todo',
    },
    { label: 'إنشاء مشاريعها', note: 'من جوّه لا من بوّابتها', state: 'todo' },
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
                قاعدة <span className="num">32</span> · مسؤول النظام يسجّل جهة شريكة
                بدون البوّابة · والجهة تُنشأ فورًا بلا مراجعة
              </p>
            </div>
            <Tag tone={missing.length ? 'warn' : 'ok'}>
              {missing.length ? <><Num>{missing.length}</Num> ناقصًا</> : 'مكتمل'}
            </Tag>
          </header>

          <Glass className="regsteps">
            <Steps
              flow="stepper"
              onPick={(i) => setTab(STAGES[i].key)}
              items={STAGES.map((st) => ({
                label: st.label,
                state: st.key === tab
                  ? 'now'
                  : shortBy[st.key].length === 0 ? 'done' : 'todo',
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
                {stage.note && <p className="sub cnote">{stage.note}</p>}

                {tab === 'partner' && (
                  <>
                    {/* ⚠️ القرار ده بيتاخد مرة وبيحكم إجراءات بعده ·
                        فاللي بيفتحه معروض **وقت الاختيار** لا بعده،
                        ومكتوب لا مرمّز في وسم */}
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
                            {/* ⚠️ الـ`input` مخفي، فلازم حاجة **مرسومة** تقول
                                «دي المختارة». قبل كده كانت الحلقة وحدها،
                                وهي رمادية محايدة زي حلقة أي كارت · فالعلامة
                                دي هي اللي بتحمل الاختيار، والحلقة بتسانده */}
                            <span className="pkind-h">
                              <span className="pkind-r" aria-hidden="true">
                                {partner === k.key && (
                                  <Icon name={icons.check} size={12} />
                                )}
                              </span>
                              <b>{k.label}</b>
                              <span className="sub trim1">· {k.example}</span>
                              <span className="pc-sp" />
                              {k.from === 'portal' && (
                                <Tag tone="mute">الافتراضي للجاي من البوّابة</Tag>
                              )}
                            </span>
                            <ul className="pkind-o">
                              {k.opens.map((o) => (
                                <li key={o}>
                                  <Icon name={icons.check} size={13} />
                                  <span>{o}</span>
                                </li>
                              ))}
                            </ul>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <p className="sub cnote">
                      الجاي من البوّابة العامة بياخد <b>شريك مستفيد</b> أوتوماتيك
                      وما بيشوفش الحقل ده · وهو الفرق الحقيقي بين المدخلين.
                    </p>
                  </>
                )}

                {tab === 'docs' && (
                  <>
                    <div className="regwho">
                      <Person name="مشرف المنح" quiet={false} />
                      <span className="sub">
                        المستندات هنا <b>المؤسسة</b> بترفعها عن الشريك · لأنه ما
                        بيدخلش المنصة أصلًا
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
                              {need
                                ? <Tag tone={on ? 'ok' : 'warn'}>
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
                                  <Icon name={icons.close} size={14} />
                                  إزالة
                                </button>
                              </div>
                            ) : (
                              <label className="regdrop">
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png,.gif"
                                  onChange={(e) => upload(d.key, e.target.files?.[0])}
                                />
                                <Icon name={icons.upload} size={16} />
                                <span>اسحب الملف هنا أو اضغط للاختيار</span>
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

                {/* قاعدتا 8 و9 · نفس التحقّق في المدخلين */}
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
                      title={first ? 'دي أول خطوة' : `ارجع لـ${STAGES[at - 1].label}`}
                      onClick={() => go(-1)}
                    >
                      <Icon name={icons.chevronBack} size={15} />
                      السابق
                    </button>
                    {!last && (
                      <button
                        className="btn btn-p"
                        title={`كمّل في ${STAGES[at + 1].label}`}
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
                <Head title="مسار التسجيل" meta={<span className="sub">ثلاث محطات</span>} />
                <Steps items={steps} flow="ladder" />
                {/* ⚠️ الفرق عن البوّابة مكتوب لا مستنتَج من عدد
                    المحطات · خمسة هناك وتلاتة هنا، والسبب هو إن
                    الطرفين مختلفين لا إن الشاشة مختصرة */}
                <p className="sub cnote">
                  مفيش ضوابط قبول ولا رمز تحقّق ولا مراجعة · دول للطرف اللي برّه
                  السيستم، والمشرف معروف بجلسته والجهة بتتولد فورًا.
                </p>
              </Glass>

              {/* ⚠️ الكارت ده كان بيتعرض حتى وإحنا واقفين على محطة
                  النوع · فبيعيد نفس التلات سطور اللي في الكارت
                  المختار جنبه بالحرف. بيظهر لما الاختيار يبقى برّه
                  الشاشة بس · تذكير لا تكرار */}
              {partner && tab !== 'partner' && (
                <Glass>
                  <Head
                    title={`اللي بيفتحه «${partnerKind(partner).label}»`}
                    meta={<Tag tone="ret">كونديشنز</Tag>}
                  />
                  <ul className="payq-ck">
                    {partnerKind(partner).opens.map((o) => (
                      <li key={o} className="ok">
                        <Icon name={icons.check} size={13} />
                        <span>{o}</span>
                      </li>
                    ))}
                  </ul>
                  {partner !== 'beneficiary' && (
                    <p className="sub cnote">
                      زي منصة إحسان · المؤسسة بتدّيها دعمًا وهي بتصرفه، وما
                      بتدخلش المنصة · فالمشروع والدفعات بيتداروا من جوّه.
                    </p>
                  )}
                </Glass>
              )}

              {missing.length > 0 && (
                <Glass>
                  <Head
                    title="ما ينقص قبل التسجيل"
                    meta={<Tag tone="warn"><Num>{missing.length}</Num> عنصرًا</Tag>}
                  />
                  <ul className="regmiss">
                    {STAGES.filter((s) => shortBy[s.key].length).map((s) => (
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
                {done
                  ? <>اتسجّلت · <b>{val.name}</b> بقت جهة نشطة، ونوعها{' '}
                      {partner && partnerKind(partner).label}</>
                  : <>
                      الجهة بتتولد <b>فورًا</b> · مفيش طلب يتراجَع
                      {partner && (
                        <>
                          <span className="decsep" />
                          {partnerKind(partner).label}
                        </>
                      )}
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
                        ? `ناقص ${missing.length} من الإلزامي`
                        : 'سجّل الجهة'
                  }
                  onClick={() => setDone(true)}
                >
                  تسجيل الجهة
                </button>
              ) : (
                <button className="btn btn-2" onClick={() => navigate(ROUTES.entities)}>
                  ارجع للجهات
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

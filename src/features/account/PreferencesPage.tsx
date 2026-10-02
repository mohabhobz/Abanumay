import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DateField, DateText, Glass, Head, Icon, icons, Num, Person, Select, Switch, Tabs, Tag,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES, NAV } from '@/app/routes'
import { useQueryParams } from '@/hooks/useQueryParams'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { OWNERS } from '@/data/mock/taxonomy'
import {
  DELEGATION_DEFAULT, FREQ_OPTIONS, HOURS, NOTIFY_GROUPS, SESSIONS, notifyDefaults,
  type Channel, type Delegation, type Freq, type NotifyPrefs,
} from '@/data/mock/notifyPrefs'
import {
  A11Y_DEFAULT, useA11y, useDisplay, useStored, type CalendarChoice, type TextSize,
} from '@/lib/prefs'
import { applyTheme, readTheme, writeTheme, type ThemeChoice } from '@/lib/theme'
import { isolate, readDate } from '@/lib/format'

const KEYS = ['tab'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

/* Five tabs, in the order a user comes looking: what reaches me, who covers for me, how the
   screen looks, how readable it is, and the account's safety. */
const TABS = [
  { slug: 'notify', label: 'الإشعارات' },
  { slug: 'delegate', label: 'التفويض والإجازة' },
  { slug: 'display', label: 'العرض' },
  { slug: 'a11y', label: 'سهولة الوصول' },
  { slug: 'security', label: 'الأمان' },
] as const

const CHANNELS: { key: Channel; label: string }[] = [
  { key: 'app', label: 'داخل النظام' },
  { key: 'email', label: 'البريد' },
  { key: 'sms', label: 'رسالة نصية' },
]

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Preferences and notifications · personal, not system settings.
 *
 * Everything here applies the moment it changes and is kept for its owner; nothing changes the
 * system for other users (that lives in «إعدادات النظام»). The structure follows the research the
 * client asked for: a per-event, per-channel matrix with locked essentials, frequency and a daily
 * summary, quiet hours on the Saudi working week, delegation while away (approvals must not wait
 * on someone on leave), display and calendar, accessibility for low vision, and account security.
 * Awareness messages sit apart and start off: the personal-data law asks for explicit consent.
 */
export default function PreferencesPage() {
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const tab = TABS.some((t) => t.slug === v.tab) ? (v.tab as string) : TABS[0].slug
  const { role, user } = useRole()

  return (
    <AppLayout assistantContext={assistFor.page('التفضيلات والإشعارات')}>
      <div className="viewstack">
        <div className="screen col">
          <header>
            <div>
              <h1 className="ptitle">التفضيلات والإشعارات</h1>
              <p className="sub mt-1">
                تخصّك وحدك وتُحفظ فور تغييرها · أما ما يغيّر النظام لكل المستخدمين ففي{' '}
                <Link className="tlink" to={ROUTES.settings}>إعدادات النظام</Link>
              </p>
            </div>
            <Person name={user.name} size="lg" quiet={false} />
          </header>

          <Tabs items={TABS} active={tab} onChange={(x) => set({ tab: x === TABS[0].slug ? undefined : x })} />

          {tab === 'notify' && <NotifyTab roleKey={role.key} roleName={role.title} />}
          {tab === 'delegate' && <DelegateTab me={user.name} />}
          {tab === 'display' && <DisplayTab />}
          {tab === 'a11y' && <A11yTab />}
          {tab === 'security' && <SecurityTab />}
        </div>
      </div>
    </AppLayout>
  )
}

/* ═══ Notifications ═══ */

function NotifyTab({ roleKey, roleName }: { roleKey: string; roleName: string }) {
  const [p, setP] = useStored<NotifyPrefs>(`ab-notify-${roleKey}`, notifyDefaults(roleKey))

  const setCell = (ev: string, ch: Channel, on: boolean) =>
    setP((x) => ({ ...x, matrix: { ...x.matrix, [ev]: { ...x.matrix[ev], [ch]: on } } }))
  const setFreq = (g: string, f: Freq) => setP((x) => ({ ...x, freq: { ...x.freq, [g]: f } }))

  const summaryGroups = NOTIFY_GROUPS.filter((g) => p.freq[g.key] !== 'now')

  return (
    <>
      <Glass className="tblcard">
        <Head
          title="ما يصلك وأين"
          meta={
            <button type="button" className="btn btn-2 btn-sm" onClick={() => setP(notifyDefaults(roleKey))}>
              <Icon name={icons.redo} size="sm" />
              افتراضيات {roleName}
            </button>
          }
        />
        <p className="sub cnote">
          الرسالة النصية للعاجل وحده، فتبقى تعني «الآن» · وما عليه قفل لا يتحرك العمل بدونه.
        </p>
        <div className="tblwrap">
          <table className="tbl nfm">
            <thead>
              <tr>
                <th>الحدث</th>
                {CHANNELS.map((c) => <th key={c.key} className="nfm-c">{c.label}</th>)}
                <th className="nfm-f">التكرار</th>
              </tr>
            </thead>
            {NOTIFY_GROUPS.map((g) => (
              <tbody key={g.key}>
                <tr className="nfm-g">
                  <th colSpan={4} scope="rowgroup">
                    <b>{g.label}</b>
                    <span className="sub">{g.note}</span>
                  </th>
                  <td className="nfm-f">
                    {g.key === 'security' || g.key === 'decisions' ? (
                      <span className="sub">فوري دائمًا</span>
                    ) : (
                      <Select
                        value={p.freq[g.key]}
                        allowEmpty={false}
                        options={FREQ_OPTIONS}
                        onChange={(x) => setFreq(g.key, (x as Freq) ?? 'now')}
                      />
                    )}
                  </td>
                </tr>
                {g.events.map((e) => {
                  const row = p.matrix[e.key] ?? { app: true, email: false, sms: false }
                  return (
                    <tr key={e.key}>
                      <td>
                        <span className="nfm-e">
                          {isolate(e.label)}
                          {e.urgent && <Tag tone="mute">عاجل</Tag>}
                        </span>
                      </td>
                      {CHANNELS.map((c) => {
                        const locked = c.key === 'app' && e.required
                        const noSms = c.key === 'sms' && !e.urgent
                        const on = locked ? true : noSms ? false : row[c.key]
                        return (
                          <td key={c.key} className="nfm-c">
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={locked || noSms}
                              onChange={(ev) => setCell(e.key, c.key, ev.target.checked)}
                              aria-label={`${e.label} · ${c.label}`}
                              title={
                                locked ? 'إلزامي · لا يتحرك العمل بدونه'
                                  : noSms ? 'الرسالة النصية للعاجل فقط' : undefined
                              }
                            />
                            {locked && <Icon name={icons.lock} size="sm" className="nfm-lock" />}
                          </td>
                        )
                      })}
                      <td className="nfm-f" />
                    </tr>
                  )
                })}
              </tbody>
            ))}
          </table>
        </div>
      </Glass>

      <div className="g2">
        <div className="col">
          <Glass>
            <Head title="الملخّص" meta={<span className="sub">لما ليس فوريًا</span>} />
            <div className="pf-row">
              <span className="lb">وقت الملخّص اليومي</span>
              <Select
                value={p.digestAt}
                allowEmpty={false}
                options={HOURS}
                onChange={(x) => setP((y) => ({ ...y, digestAt: x ?? '07:30' }))}
              />
            </div>
            <p className="sub cnote">
              يصلك بترتيب صفحة «اليوم»: ما ينتظرك، ثم المتأخر، ثم ما تغيّر ·
              {summaryGroups.length
                ? <> ويضم الآن <Num>{summaryGroups.length}</Num> مجموعات: {summaryGroups.map((g) => g.label).join('، ')}.</>
                : ' وكل المجموعات الآن فورية، فلا ملخّص.'}
            </p>
          </Glass>

          <Glass>
            <Head title="أخبار المؤسسة والرسائل التوعوية" meta={<Tag tone="mute">موافقة صريحة</Tag>} />
            <Switch
              label="أوافق على استلام الأخبار والرسائل التوعوية"
              note={
                p.news.on
                  ? <>وافقت في <DateText>{p.news.at}</DateText> · يمكنك سحب الموافقة في أي وقت</>
                  : 'غير مفعّلة افتراضيًا · رسائل العمل تصلك دون حاجة إلى هذه الموافقة'
              }
              on={p.news.on}
              onChange={(on) => setP((x) => ({ ...x, news: { on, at: on ? today() : '' } }))}
            />
            <p className="sub cnote">
              يشترط نظام حماية البيانات الشخصية موافقة صريحة موثّقة لكل رسالة غير تشغيلية.
            </p>
          </Glass>
        </div>

        <Glass>
          <Head title="ساعات الهدوء" meta={<span className="sub">على أسبوع العمل في المملكة</span>} />
          <Switch
            label="لا رسائل نصية ولا بريد خارج ساعات العمل"
            note="الإشعار العاجل يتجاوزها · وما سواه يُجمع ويصلك عند انتهائها"
            on={p.quiet.on}
            onChange={(on) => setP((x) => ({ ...x, quiet: { ...x.quiet, on } }))}
          />
          {p.quiet.on && (
            <>
              <div className="pf-row">
                <span className="lb">من</span>
                <Select value={p.quiet.from} allowEmpty={false} options={HOURS}
                  onChange={(x) => setP((y) => ({ ...y, quiet: { ...y.quiet, from: x ?? '16:00' } }))} />
                <span className="lb">إلى</span>
                <Select value={p.quiet.to} allowEmpty={false} options={HOURS}
                  onChange={(x) => setP((y) => ({ ...y, quiet: { ...y.quiet, to: x ?? '08:00' } }))} />
              </div>
              <Switch
                label="يوما الجمعة والسبت بالكامل"
                on={p.quiet.weekend}
                onChange={(weekend) => setP((x) => ({ ...x, quiet: { ...x.quiet, weekend } }))}
              />
            </>
          )}
        </Glass>
      </div>
    </>
  )
}

/* ═══ Delegation ═══ */

function DelegateTab({ me }: { me: string }) {
  const [d, setD] = useStored<Delegation>('ab-delegation', DELEGATION_DEFAULT)
  const people = OWNERS.filter((o) => o !== me)
  const ready = d.from && d.to && d.delegate
  const live = d.on && ready && d.from <= today() && today() <= d.to

  return (
    <div className="g2">
      <Glass>
        <Head
          title="أنا خارج العمل"
          meta={live ? <Tag tone="ok">التفويض ساري</Tag> : d.on && ready ? <Tag tone="mute">مجدول</Tag> : undefined}
        />
        <Switch
          label="فعّل التفويض خلال غيابي"
          note="تنتقل مهامك إلى من تختاره طوال المدة، ثم تعود إليك تلقائيًا"
          on={d.on}
          onChange={(on) => setD((x) => ({ ...x, on }))}
        />
        {d.on && (
          <div className="regfields mt-3">
            <div className="regf">
              <span className="lb">من تاريخ<b className="regf-r" aria-label="إلزامي">*</b></span>
              <DateField value={d.from} onChange={(from) => setD((x) => ({ ...x, from }))} label="بداية التفويض" min={today()} />
            </div>
            <div className="regf">
              <span className="lb">إلى تاريخ<b className="regf-r" aria-label="إلزامي">*</b></span>
              <DateField value={d.to} onChange={(to) => setD((x) => ({ ...x, to }))} label="نهاية التفويض" min={d.from || today()} />
            </div>
            <div className="regf">
              <span className="lb">المفوَّض إليه<b className="regf-r" aria-label="إلزامي">*</b></span>
              <Select
                value={d.delegate || undefined}
                all="اختر الزميل…"
                allowEmpty={false}
                people
                options={people}
                onChange={(delegate) => setD((x) => ({ ...x, delegate: delegate ?? '' }))}
              />
            </div>
            <div className="regf">
              <span className="lb">النطاق</span>
              <div className="seg" role="radiogroup" aria-label="نطاق التفويض">
                {([['approvals', 'الاعتمادات فقط'], ['all', 'كل المهام']] as const).map(([k, l]) => (
                  <button key={k} type="button" role="radio" aria-checked={d.scope === k}
                    className={d.scope === k ? 'on' : ''} onClick={() => setD((x) => ({ ...x, scope: k }))}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <label className="regf regf-w">
              <span className="lb">ملاحظة تظهر لمن يفتح مهامك</span>
              <span className="fld fld-a">
                <textarea rows={2} value={d.note} onChange={(e) => setD((x) => ({ ...x, note: e.target.value }))}
                  placeholder="مثال: في إجازة سنوية، والعاجل عبر الزميل المفوَّض" aria-label="ملاحظة التفويض" />
              </span>
            </label>
          </div>
        )}
      </Glass>

      <div className="col">
        <Glass>
          <Head title="كيف يظهر للآخرين" />
          {d.on && ready ? (
            <div className="pf-deleg">
              <Icon name={icons.user} size="md" />
              <span>
                <b>{me}</b> خارج العمل من <DateText>{d.from}</DateText> إلى <DateText>{d.to}</DateText> ·
                {d.scope === 'approvals' ? ' الاعتمادات' : ' كل المهام'} لدى <Person name={d.delegate} quiet={false} />
                {d.note && <span className="sub pf-deleg-n">{d.note}</span>}
              </span>
            </div>
          ) : (
            <p className="sub">يظهر هنا الشريط الذي يراه زملاؤك على مشاريعك ومهامك أثناء غيابك.</p>
          )}
        </Glass>
        <Glass>
          <Head title="قواعد التفويض" meta={<Tag tone="mute">قاعدة</Tag>} />
          <ul className="pf-rules">
            <li>يعتمد المفوَّض إليه ضمن حدوده هو في مصفوفة الاعتماد · وما يتجاوزها يُرفع إلى المستوى التالي.</li>
            <li>يُسجَّل كل إجراء باسم المفوَّض إليه مع عبارة «نيابةً عن» في سجل المشروع.</li>
            <li>لا يُفوَّض إلا لزميل في الدور نفسه أو أعلى · ويصله إشعار إلزامي ببداية التفويض.</li>
          </ul>
        </Glass>
      </div>
    </div>
  )
}

/* ═══ Display ═══ */

function DisplayTab() {
  const [theme, setTheme] = useState<ThemeChoice>(readTheme)
  const [d, setD] = useDisplay()
  useEffect(() => { applyTheme(theme); writeTheme(theme) }, [theme])
  const sample = today()

  const landing = [{ value: '', label: 'الافتراضي · اسأل أبانمي' }].concat(
    NAV.map((n) => ({ value: n.to, label: n.label })),
  )

  return (
    <div className="g2">
      <Glass>
        <Head title="المظهر" />
        <div className="seg" role="radiogroup" aria-label="المظهر">
          {([['light', 'فاتح', icons.sun], ['dark', 'داكن', icons.moon]] as const).map(([k, l, ic]) => (
            <button key={k} type="button" role="radio" aria-checked={theme === k}
              className={theme === k ? 'on' : ''} onClick={() => setTheme(k)}>
              <Icon name={ic} size="sm" /><span>{l}</span>
            </button>
          ))}
        </div>
        <div className="pf-row mt-4">
          <span className="lb">الصفحة بعد تسجيل الدخول</span>
          <Select value={d.landing} allowEmpty={false} options={landing}
            onChange={(x) => setD({ landing: x ?? '' })} />
        </div>
      </Glass>

      <Glass>
        <Head title="التقويم" meta={<span className="sub">لكل التواريخ في النظام</span>} />
        <div className="seg" role="radiogroup" aria-label="التقويم">
          {([['gregory', 'ميلادي'], ['hijri', 'هجري'], ['both', 'الاثنان']] as const).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={d.cal === k}
              className={d.cal === k ? 'on' : ''} onClick={() => setD({ cal: k as CalendarChoice })}>
              {l}
            </button>
          ))}
        </div>
        <p className="sub cnote">
          تاريخ اليوم يظهر هكذا: <b>{readDate(sample, d.cal)}</b> · والهجري بتقويم أم القرى.
        </p>
        <div className="pf-row">
          <span className="lb">اللغة</span>
          <span>العربية</span>
          <Tag tone="mute">الإنجليزية لاحقًا</Tag>
        </div>
      </Glass>
    </div>
  )
}

/* ═══ Accessibility ═══ */

const SIZES: { k: TextSize; label: string }[] = [
  { k: '100', label: 'عادي' },
  { k: '112', label: 'أكبر' },
  { k: '125', label: 'كبير' },
  { k: '150', label: 'كبير جدًا' },
]

function A11yTab() {
  const [a, setA, reset] = useA11y()
  const changed = JSON.stringify(a) !== JSON.stringify(A11Y_DEFAULT)

  return (
    <div className="g2">
      <div className="col">
        <Glass>
          <Head
            title="حجم النص"
            meta={changed ? (
              <button type="button" className="btn btn-2 btn-sm" onClick={reset}>
                <Icon name={icons.redo} size="sm" />
                الإعدادات الافتراضية
              </button>
            ) : undefined}
          />
          <div className="seg pf-sizes" role="radiogroup" aria-label="حجم النص">
            {SIZES.map((s) => (
              <button key={s.k} type="button" role="radio" aria-checked={a.text === s.k}
                className={a.text === s.k ? 'on' : ''} onClick={() => setA({ text: s.k })}>
                <span className={`pf-a pf-a${s.k}`} aria-hidden="true">أ</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
          <p className="sub cnote">
            يكبر كل النص في النظام، والحقول والأزرار تبقى بارتفاعها فلا ينقص شيء منها.
          </p>
        </Glass>

        <Glass>
          <Head title="الرؤية" />
          <div className="pf-sw">
            <Switch label="نص أعرض" note="خطوط أثقل في كل النظام · للرؤية الضعيفة" on={a.bold} onChange={(bold) => setA({ bold })} />
            <Switch label="تباين أعلى" note="النص الثانوي أغمق، وحدود البطاقات والحقول أوضح" on={a.contrast} onChange={(contrast) => setA({ contrast })} />
            <Switch label="خط تحت الروابط" note="فلا يعتمد تمييز الرابط على اللون وحده" on={a.links} onChange={(links) => setA({ links })} />
            <Switch label="تباعد أوسع للنص" note="مسافة أكبر بين الكلمات والسطور · دون تفريق الحروف العربية" on={a.spacing} onChange={(spacing) => setA({ spacing })} />
          </div>
        </Glass>

        <Glass>
          <Head title="الحركة والتنقّل" />
          <div className="pf-sw">
            <Switch label="إيقاف الحركة" note={a.motion === 'reduce' ? 'متوقفة في كل النظام' : 'تتبع إعداد جهازك'}
              on={a.motion === 'reduce'} onChange={(on) => setA({ motion: on ? 'reduce' : 'system' })} />
            <Switch label="إطار تركيز واضح" note="إطار عريض على العنصر الحالي عند التنقّل بلوحة المفاتيح" on={a.focus} onChange={(focus) => setA({ focus })} />
          </div>
        </Glass>
      </div>

      {/* A live sample built from the system's own parts, so the user sees the effect on a real
          card, field and button rather than a description of it. */}
      <Glass className="pf-prev">
        <Head title="معاينة" meta={<span className="sub">تتغيّر مع اختيارك</span>} />
        <div className="kpi glass pf-kpi">
          <span className="kpi-h"><span className="kpi-k">ينتظر قرارك</span></span>
          <span className="kpi-v num">2</span>
          <span className="kpi-n">1 فوق الحدّ</span>
        </div>
        <label className="regf mt-4">
          <span className="lb">اسم المشروع</span>
          <span className="fld"><input defaultValue="علاج 60 من مرضى الكلى بالأحساء" aria-label="اسم المشروع (معاينة)" /></span>
          <span className="sub regf-h">كما سيظهر في الاتفاقية</span>
        </label>
        <p className="prose mt-4">
          متوقف عند «رفع التقرير الختامي» منذ 110 أيام ·{' '}
          <Link className="lnk" to={ROUTES.projects}>اعرض المشاريع</Link>
        </p>
        <div className="rowf gp-2 mt-4">
          <button type="button" className="btn btn-p">توصية بالموافقة</button>
          <button type="button" className="btn btn-2">طلب استكمال</button>
        </div>
      </Glass>
    </div>
  )
}

/* ═══ Security ═══ */

function SecurityTab() {
  const [s, setS] = useStored('ab-security', { twoStep: true, method: 'app', alerts: true, signedOut: false })
  const sessions = s.signedOut ? SESSIONS.filter((x) => x.current) : SESSIONS

  return (
    <div className="g2">
      <Glass>
        <Head title="الدخول" />
        <div className="pf-sw">
          <Switch label="التحقق بخطوتين" note="رمز إضافي عند الدخول من جهاز جديد" on={s.twoStep}
            onChange={(twoStep) => setS((x) => ({ ...x, twoStep }))} />
          {s.twoStep && (
            <div className="seg" role="radiogroup" aria-label="طريقة التحقق">
              {([['app', 'تطبيق المصادقة'], ['sms', 'رسالة نصية']] as const).map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={s.method === k}
                  className={s.method === k ? 'on' : ''} onClick={() => setS((x) => ({ ...x, method: k }))}>
                  {l}
                </button>
              ))}
            </div>
          )}
          <Switch label="تنبيه عند الدخول من جهاز جديد" on={s.alerts} disabled
            lockNote="إلزامي · حماية للحساب" onChange={() => undefined} />
        </div>
        <p className="sub cnote">
          كلمة المرور والبيانات الشخصية في{' '}
          <Link className="tlink" to={ROUTES.account}>إعدادات الحساب</Link>.
        </p>
      </Glass>

      <Glass>
        <Head
          title="الجلسات النشطة"
          meta={sessions.length > 1 ? (
            <button type="button" className="btn btn-2 btn-sm" onClick={() => setS((x) => ({ ...x, signedOut: true }))}>
              أنهِ الجلسات الأخرى
            </button>
          ) : <Tag tone="ok">هذا الجهاز فقط</Tag>}
        />
        <ul className="pf-sess">
          {sessions.map((x) => (
            <li key={x.id}>
              <Icon name={icons.lock} size="sm" />
              <span>
                <b>{x.device}</b>
                <span className="sub"> · {x.place} · {x.at}</span>
              </span>
              <span className="pc-sp" />
              {x.current && <Tag tone="ok">هذا الجهاز</Tag>}
            </li>
          ))}
        </ul>
      </Glass>
    </div>
  )
}

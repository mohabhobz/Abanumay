import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DateText, FieldSelect, Glass, Head, Icon, icons, KV, Money, Num, Person, Switch, Tabs, Tag,
} from '@/components/ui'
import { UploadButton } from '@/components/docs'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useQueryParams } from '@/hooks/useQueryParams'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { person } from '@/data/people'
import { SESSIONS } from '@/data/mock/notifyPrefs'
import {
  ACTIONS, PERM_INITIAL, PERM_KEY, PERM_MODULES, SCOPES, moduleCount, overrideCount,
  type ActionKey, type PermState,
} from '@/data/mock/permissions'
import { useStored } from '@/lib/prefs'
import { PermMatrix } from '@/features/settings/PermMatrix'

const KEYS = ['tab'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

/* Three tabs: who I am, how I sign in, what I'm allowed to do. Display, notifications and
   delegation are preferences, kept on their own page so this one stays about the account. */
const TABS = [
  { slug: 'profile', label: 'الملف الشخصي' },
  { slug: 'security', label: 'الدخول والأمان' },
  { slug: 'access', label: 'صلاحياتي' },
] as const

/** HR record (mock) · the system reads it, the user doesn't edit it */
const HR: Record<string, { dept: string; no: string; joined: string; manager?: string }> = {
  'عمر قاسم': { dept: 'إدارة المنح', no: 'EMP-1042', joined: '2021-02-14', manager: 'عبدالله الدوسري' },
  'عبدالله الدوسري': { dept: 'إدارة المنح', no: 'EMP-0871', joined: '2018-09-02', manager: 'عبدالرحمن الهليّل' },
  'عبدالرحمن الهليّل': { dept: 'الإدارة التنفيذية', no: 'EMP-0310', joined: '2015-01-11' },
}
const hrOf = (name: string) => HR[name] ?? { dept: 'إدارة المنح', no: 'EMP-1100', joined: '2022-01-01' }

/**
 * Account settings · the account itself, not how the screen behaves.
 *
 * Identity fields come from HR and show as read-only facts with where to correct them, not as
 * disabled inputs that look editable. What the user owns (photo, mobile, extension, the signature
 * printed on approval documents) is a draft until saved. Sign-in and security moved here from
 * preferences: a password and a session list belong to the account, not to its display.
 */
export default function AccountPage() {
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const tab = TABS.some((t) => t.slug === v.tab) ? (v.tab as string) : TABS[0].slug
  const { user } = useRole()

  return (
    <AppLayout assistantContext={assistFor.page('إعدادات الحساب')}>
      <div className="viewstack">
        <div className="screen col">
          <header>
            <div>
              <h1 className="ptitle">إعدادات الحساب</h1>
              <p className="sub mt-1">
                بياناتك ودخولك وما يُسمح لك به · أما الإشعارات والعرض والتفويض ففي{' '}
                <Link className="tlink" to={ROUTES.preferences}>التفضيلات</Link>
              </p>
            </div>
            <Person name={user.name} size="lg" quiet={false} />
          </header>

          <Tabs items={TABS} active={tab} onChange={(x) => set({ tab: x === TABS[0].slug ? undefined : x })} />

          {tab === 'profile' && <ProfileTab name={user.name} title={user.role} />}
          {tab === 'security' && <SecurityTab />}
          {tab === 'access' && <AccessTab name={user.name} />}
        </div>
      </div>
    </AppLayout>
  )
}

/* ═══ Profile ═══ */

interface Contact {
  mobile: string
  ext: string
  signature: string
}

const MOBILE = /^05\d{8}$/

function ProfileTab({ name, title }: { name: string; title: string }) {
  const p = person(name)
  const hr = hrOf(name)
  const email = `${p.slug ?? 'user'}@abanumay.org`

  const [saved, setSaved] = useStored<Contact>(`ab-contact-${p.slug ?? 'me'}`, {
    mobile: '0551234567', ext: '214', signature: '',
  })
  const [d, setD] = useState<Contact>(saved)
  const [photo, setPhoto] = useState<string | undefined>(p.photo)
  /* The mock keeps a picked photo for this visit only · the server would store it */
  const [photoSaved, setPhotoSaved] = useState<string | undefined>(p.photo)
  const [sig, setSig] = useState<string | undefined>()
  const [done, setDone] = useState(false)

  /* Object URLs of picked files are released when replaced or on leaving the page. */
  useEffect(() => () => { if (sig) URL.revokeObjectURL(sig) }, [sig])

  const mobileOk = MOBILE.test(d.mobile)
  const dirty = JSON.stringify(d) !== JSON.stringify(saved) || photo !== photoSaved
  const save = () => {
    if (!mobileOk) return
    setSaved(d)
    setPhotoSaved(photo)
    setDone(true)
  }

  return (
    <div className="g2">
      <div className="col">
        <Glass>
          <Head
            title="بياناتك"
            meta={dirty ? (
              <span className="acc-act">
                <button type="button" className="btn btn-2" onClick={() => { setD(saved); setPhoto(photoSaved) }}>تراجع</button>
                <button type="button" className="btn btn-p" onClick={save} disabled={!mobileOk}>
                  <Icon name={icons.check} size="sm" />
                  احفظ
                </button>
              </span>
            ) : done ? <span className="sub">حُفظت</span> : undefined}
          />

          <div className="acc-photo">
            {photo
              ? <img className="acc-ph" src={photo} alt="" />
              : <span className="acc-ph acc-ini" aria-hidden="true">{p.initial}</span>}
            <div className="col gp-2">
              <b>الصورة</b>
              <span className="sub">تظهر بجانب اسمك في الإسناد والقرارات والسجل</span>
              <span className="acc-act">
                <UploadButton
                  label="ارفع صورة شخصية"
                  accept=".jpg,.jpeg,.png"
                  onPick={(f) => { setDone(false); setPhoto(URL.createObjectURL(f)) }}
                />
                {photo && (
                  <button type="button" className="btn btn-2 btn-sm" onClick={() => { setDone(false); setPhoto(undefined) }}>
                    إزالة
                  </button>
                )}
              </span>
            </div>
          </div>

          <div className="regfields mt-4">
            <label className="regf">
              <span className="lb">الجوال</span>
              <span className="fld">
                <input
                  value={d.mobile}
                  inputMode="numeric"
                  dir="ltr"
                  maxLength={10}
                  onChange={(e) => { setDone(false); setD({ ...d, mobile: e.target.value.replace(/\D/g, '') }) }}
                  aria-label="رقم الجوال"
                  aria-invalid={!mobileOk}
                />
              </span>
              <span className="sub">
                {mobileOk ? 'يصله رمز التحقق والرسائل العاجلة' : 'عشرة أرقام تبدأ بـ 05'}
              </span>
            </label>
            <label className="regf">
              <span className="lb">التحويلة</span>
              <span className="fld">
                <input
                  value={d.ext}
                  inputMode="numeric"
                  dir="ltr"
                  maxLength={5}
                  onChange={(e) => { setDone(false); setD({ ...d, ext: e.target.value.replace(/\D/g, '') }) }}
                  aria-label="رقم التحويلة"
                />
              </span>
            </label>
          </div>
        </Glass>

        <Glass>
          <Head title="التوقيع" meta={<span className="sub">على وثائق الاعتماد</span>} />
          <p className="sub cnote">
            يُطبع تحت اسمك في إذن الصرف ومحضر الاعتماد وخطاب الاتفاقية حين تعتمد من النظام.
          </p>
          <div className="acc-sig">
            {sig || d.signature ? (
              <>
                {sig ? <img src={sig} alt="التوقيع" /> : <Icon name={icons.file} />}
                <span className="sub">{d.signature}</span>
              </>
            ) : (
              <span className="sub">لم يُرفع توقيع · تُطبع الوثائق باسمك دون توقيع</span>
            )}
          </div>
          <span className="acc-act mt-3">
            <UploadButton
              label="ارفع صورة التوقيع"
              accept=".png,.jpg,.jpeg"
              onPick={(f) => { setDone(false); setSig(URL.createObjectURL(f)); setD((x) => ({ ...x, signature: f.name })) }}
            />
            {(sig || d.signature) && (
              <button type="button" className="btn btn-2 btn-sm" onClick={() => { setSig(undefined); setD((x) => ({ ...x, signature: '' })) }}>
                إزالة
              </button>
            )}
            <span className="sub">png بخلفية شفافة</span>
          </span>
        </Glass>
      </div>

      <Glass>
        <Head title="من الموارد البشرية" meta={<Icon name={icons.lock} size="sm" />} />
        <KV
          rows={[
            { k: 'الاسم', v: name },
            { k: 'المسمى', v: title },
            { k: 'الإدارة', v: hr.dept },
            ...(hr.manager ? [{ k: 'المدير المباشر', v: <Person name={hr.manager} /> }] : []),
            { k: 'الرقم الوظيفي', v: <span dir="ltr">{hr.no}</span> },
            { k: 'البريد', v: <span dir="ltr">{email}</span> },
            { k: 'تاريخ الالتحاق', v: <DateText>{hr.joined}</DateText> },
          ]}
        />
        <p className="sub cnote">
          تُقرأ من نظام الموارد البشرية ولا تُعدَّل هنا · لتصحيح خطأ فيها تواصل مع الموارد البشرية.
        </p>
      </Glass>
    </div>
  )
}

/* ═══ Sign-in and security ═══ */

const RULES: { key: string; label: string; test: (pw: string, cur: string) => boolean }[] = [
  { key: 'len', label: '12 حرفًا على الأقل', test: (pw) => pw.length >= 12 },
  { key: 'mix', label: 'حروف وأرقام معًا', test: (pw) => /\p{L}/u.test(pw) && /\d/.test(pw) },
  { key: 'new', label: 'تختلف عن الحالية', test: (pw, cur) => pw.length > 0 && pw !== cur },
]

function PwField({ label, value, onChange, auto }: {
  label: string; value: string; onChange: (v: string) => void; auto: string
}) {
  const [show, setShow] = useState(false)
  return (
    <label className="regf">
      <span className="lb">{label}</span>
      <span className="fld">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          dir="ltr"
          autoComplete={auto}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
        <button
          type="button"
          className="iact"
          onClick={() => setShow((x) => !x)}
          aria-label={show ? 'إخفاء' : 'إظهار'}
          aria-pressed={show}
        >
          <Icon name={show ? icons.eyeOff : icons.eye} size="sm" />
        </button>
      </span>
    </label>
  )
}

function SecurityTab() {
  const [s, setS] = useStored('ab-security', {
    twoStep: true, method: 'app', alerts: true, signedOut: false, changed: '2026-06-03',
  })
  const sessions = s.signedOut ? SESSIONS.filter((x) => x.current) : SESSIONS

  const [cur, setCur] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [ok, setOk] = useState(false)
  const pass = RULES.map((r) => ({ ...r, on: r.test(pw, cur) }))
  const match = pw2.length > 0 && pw === pw2
  const ready = cur.length > 0 && pass.every((r) => r.on) && match

  const change = () => {
    if (!ready) return
    setS((x) => ({ ...x, changed: new Date().toISOString().slice(0, 10) }))
    setCur(''); setPw(''); setPw2(''); setOk(true)
  }

  return (
    <div className="g2">
      <div className="col">
        <Glass>
          <Head title="كلمة المرور" meta={<span className="sub">آخر تغيير <DateText>{s.changed}</DateText></span>} />
          <div className="regfields">
            <div className="regf-w">
              <PwField label="الحالية" value={cur} onChange={(x) => { setOk(false); setCur(x) }} auto="current-password" />
            </div>
            <PwField label="الجديدة" value={pw} onChange={(x) => { setOk(false); setPw(x) }} auto="new-password" />
            <PwField label="تأكيد الجديدة" value={pw2} onChange={(x) => { setOk(false); setPw2(x) }} auto="new-password" />
          </div>
          {/* The rules are checked as you type, so the button never refuses without saying why. */}
          <ul className="acc-rules" aria-live="polite">
            {pass.map((r) => (
              <li key={r.key} className={r.on ? 'on' : ''}>
                <Icon name={r.on ? icons.check : icons.close} size="sm" />
                {r.label}
              </li>
            ))}
            <li className={match ? 'on' : ''}>
              <Icon name={match ? icons.check : icons.close} size="sm" />
              التأكيد مطابق
            </li>
          </ul>
          <div className="acc-foot">
            {ok && <span className="sub">تغيّرت كلمة المرور · وأُنهيت جلساتك على الأجهزة الأخرى</span>}
            <span className="pc-sp" />
            <button type="button" className="btn btn-p" disabled={!ready} onClick={change}>
              غيّر كلمة المرور
            </button>
          </div>
        </Glass>

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
        </Glass>
      </div>

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
              <Icon name={icons.device} size="sm" />
              <span>
                <b>{x.device}</b>
                <span className="sub"> · {x.place} · {x.at}</span>
              </span>
              <span className="pc-sp" />
              {x.current && <Tag tone="ok">هذا الجهاز</Tag>}
            </li>
          ))}
        </ul>
        <p className="sub cnote">جلسة لا تعرفها؟ أنهِ الجلسات الأخرى ثم غيّر كلمة المرور.</p>
      </Glass>
    </div>
  )
}

/* ═══ My access ═══ */

const ACT_LABEL = Object.fromEntries(ACTIONS.map((a) => [a.key, a.label])) as Record<ActionKey, string>

function AccessTab({ name }: { name: string }) {
  const { role: me } = useRole()
  /* Reads the admin's stored state, so a change saved in «الصلاحيات والأدوار» shows here at once. */
  const [st] = useStored<PermState>(PERM_KEY, PERM_INITIAL)
  const user = st.users.find((u) => u.name === name)
  const role = st.roles.find((r) => r.key === user?.role)
  const ov = user?.overrides ?? {}
  const n = overrideCount(ov)

  const [req, setReq] = useState({ mod: '', act: '', why: '' })
  const [sent, setSent] = useState<string | null>(null)
  const mod = PERM_MODULES.find((m) => m.key === req.mod)
  const admin = st.users.find((u) => u.role === 'admin')?.name

  const extras = useMemo(
    () => Object.entries(user?.overrides ?? {}).flatMap(([m, acts]) =>
      Object.entries(acts ?? {}).map(([a, on]) => ({
        m: PERM_MODULES.find((x) => x.key === m)?.label ?? m, a: ACT_LABEL[a as ActionKey], on,
      }))),
    [user],
  )

  return (
    <>
      <div className="g2">
        <Glass>
          <Head title="دورك" meta={<Tag tone="mute">{role?.label ?? me.title}</Tag>} />
          <KV
            rows={[
              { k: 'الوحدات المتاحة', v: <><Num>{moduleCount(role, ov)}</Num> من <Num>{PERM_MODULES.length}</Num></> },
              {
                k: 'الحدّ المالي للاعتماد',
                v: me.financialAuthority ? <>حتى <Money>{me.financialAuthority}</Money></> : 'توصية فقط · بلا حدّ مالي',
              },
              {
                k: 'نطاق المشاريع',
                v: SCOPES.find((s) => s.value === (role?.grants.projects?.scope ?? 'own'))?.label ?? '—',
              },
              { k: 'خارج دورك', v: n > 0 ? <><Num>{n}</Num> صلاحية</> : 'لا شيء' },
            ]}
          />
          {extras.length > 0 && (
            <ul className="acc-ext">
              {extras.map((x) => (
                <li key={x.m + x.a}>{x.on ? 'مُنحت' : 'سُحبت'} «{x.a}» في {x.m}</li>
              ))}
            </ul>
          )}
        </Glass>

        <Glass>
          <Head title="اطلب صلاحية" meta={admin ? <Person name={admin} /> : undefined} />
          {sent ? (
            <>
              <p className="cnote">أُرسل طلبك «{sent}» إلى مدير النظام · يصلك الرد في الإشعارات.</p>
              <button type="button" className="btn btn-2 btn-sm" onClick={() => setSent(null)}>طلب آخر</button>
            </>
          ) : (
            <>
              <div className="regfields">
                <div className="regf">
                  <span className="lb">الوحدة</span>
                  <FieldSelect
                    value={req.mod}
                    options={PERM_MODULES.map((m) => ({ value: m.key, label: m.label }))}
                    onChange={(x) => setReq({ ...req, mod: x, act: '' })}
                    label="الوحدة"
                  />
                </div>
                <div className="regf">
                  <span className="lb">الصلاحية</span>
                  <FieldSelect
                    value={req.act}
                    options={(mod?.actions ?? []).map((a) => ({ value: a, label: ACT_LABEL[a] }))}
                    onChange={(x) => setReq({ ...req, act: x })}
                    label="الصلاحية"
                    disabled={!mod}
                    end
                  />
                </div>
                <label className="regf regf-w">
                  <span className="lb">السبب</span>
                  <span className="fld fld-a">
                    <textarea
                      rows={2}
                      value={req.why}
                      onChange={(e) => setReq({ ...req, why: e.target.value })}
                      aria-label="سبب الطلب"
                      placeholder="ما العمل الذي تحتاجها له"
                    />
                  </span>
                </label>
              </div>
              <div className="acc-foot">
                <span className="pc-sp" />
                <button
                  type="button"
                  className="btn btn-p"
                  disabled={!req.mod || !req.act || !req.why.trim()}
                  onClick={() => { setSent(`${ACT_LABEL[req.act as ActionKey]} في ${mod?.label}`); setReq({ mod: '', act: '', why: '' }) }}
                >
                  <Icon name={icons.send} size="sm" />
                  أرسل لمدير النظام
                </button>
              </div>
            </>
          )}
        </Glass>
      </div>

      <Glass className="tblcard">
        <Head title="ما تستطيع فعله" meta={<span className="sub">للقراءة · يغيّره مدير النظام</span>} />
        <PermMatrix mode="user" role={role} overrides={ov} readOnly />
      </Glass>
    </>
  )
}

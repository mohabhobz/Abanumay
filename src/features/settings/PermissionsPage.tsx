import { AuthRulesCard } from './AuthRulesCard'
import { readRole } from '@/data/roles'
import { useMemo, useState } from 'react'
import {
  FormField, Button, DateText, Empty, FieldBox, FieldSelect, Glass, Head, Icon, icons, Modal, ModalHead, Num, Person, SearchBox, Select, Switch, Tabs, Tag,
} from '@/components/ui'
import { STAFF_DIRECTORY } from '@/data/roles'
import { makeTemp, setTempPassword, tempIssues } from '@/data/staffAuth'
import { AppLayout } from '@/app/layout/AppLayout'
import { DockSlotProvider, SaveBar, useDockSlot } from '@/components/shell'
import { useQueryParams } from '@/hooks/useQueryParams'
import { assistFor } from '@/data/mock/assistant'
import { useStored } from '@/lib/prefs'
import {
  ACTIONS, DEPTS, WORK_DOMAIN, PERM_INITIAL, PERM_KEY, PERM_MODULES, PERM_USERS, PERSONAS, SCOPES, conflicts, moduleByKey,
  moduleCount, overrideCount, roleLabel,
  type ActionKey, type Grants, type Overrides, type PermLogRow, type PermRole, type PermState,
  type PermUser, type Scope,
} from '@/data/mock/permissions'
import { PermMatrix, SodNote } from './PermMatrix'

const KEYS = ['tab', 'u', 'r'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>


/** The admin acting on this screen · the first holder of the admin role */
const ME = PERM_USERS.find((u) => u.role === 'admin')?.name ?? ''

const today = () => new Date().toISOString().slice(0, 10)
const logRow = (target: string, change: string): PermLogRow => ({
  id: `l${Date.now()}${Math.random().toString(36).slice(2, 6)}`, at: today(), by: ME, target, change,
})

const ACT_LABEL = Object.fromEntries(ACTIONS.map((a) => [a.key, a.label])) as Record<ActionKey, string>

/**
 * Permissions and roles · the system admin's screen.
 *
 * It opens from the account menu, not the rail: one in twenty users will ever see it. Three tabs in
 * the order an admin comes looking: a person ("why can't Saud see payments?"), a role ("what does a
 * supervisor get?"), and the trail ("who changed this, and when?").
 *
 * Every module in the system is a row, and the same five verbs are the columns, so a person and a
 * role read on the same grid. Changes are a **draft until saved**: a permission is not a display
 * preference, and a half-finished edit must not reach a live account. Each save writes a line in
 * the log with the admin's name.
 */
export default function PermissionsPage() {
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const [st, setSt] = useStored<PermState>(PERM_KEY, PERM_INITIAL)

  const ov = st.users.reduce((n, u) => n + overrideCount(u.overrides), 0)
  const TABS = [
    { slug: 'users', label: 'المستخدمون', count: st.users.length },
    { slug: 'roles', label: 'الأدوار', count: st.roles.length },
    { slug: 'log', label: 'سجل التغييرات', count: st.log.length },
  ]
  const tab = TABS.some((t) => t.slug === v.tab) ? (v.tab as string) : TABS[0].slug
  const dock = useDockSlot()

  return (
    <AppLayout assistantContext={assistFor.page('الصلاحيات والأدوار')}>
      <DockSlotProvider value={dock.value}>
      <div className={`viewstack${dock.on ? ' hasdock' : ''}`}>
        <div className="screen col">
          <header>
            <div>
              <h1 className="ptitle">الصلاحيات والأدوار</h1>
              <p className="sub mt-1">
                <Num>{PERM_MODULES.length}</Num> وحدة · {ov > 0 ? <><Num>{ov}</Num> تخصيص حاليًا</> : 'لا تخصيصات'}
              </p>
            </div>
            <Tag tone="mute">
              <Icon name={icons.shield} size="sm" />
              مدير النظام
            </Tag>
          </header>
          <AuthRulesCard by={ME} admin={readRole() === 'admin'} />

          <Tabs
            items={TABS}
            active={tab}
            onChange={(x) => set({ tab: x === TABS[0].slug ? undefined : x, u: undefined, r: undefined })}
          />

          {tab === 'users' && (
            <UsersTab st={st} setSt={setSt} sel={v.u} onSel={(u) => set({ u })} />
          )}
          {tab === 'roles' && (
            <RolesTab st={st} setSt={setSt} sel={v.r} onSel={(r) => set({ r })} />
          )}
          {tab === 'log' && <LogTab log={st.log} />}
        </div>
        {/* The unsaved-changes dock · inside the view stack, so it spans the content column like the decision bar, not the rail */}
        <div className="dockslot" ref={dock.setEl} />
      </div>
      </DockSlotProvider>
    </AppLayout>
  )
}

type SetSt = (next: PermState | ((x: PermState) => PermState)) => void

/* ═══ Users ═══ */

function UsersTab({ st, setSt, sel, onSel }: {
  st: PermState; setSt: SetSt; sel?: string; onSel: (id: string | undefined) => void
}) {
  const [q, setQ] = useState('')
  const [role, setRole] = useState<string | undefined>()
  const [status, setStatus] = useState<string | undefined>()

  const rows = st.users.filter((u) =>
    (!q.trim() || u.name.includes(q.trim())) &&
    (!role || u.role === role) &&
    (!status || (status === 'off' ? !u.active : status === 'custom' ? overrideCount(u.overrides) > 0 : u.active)),
  )
  const user = st.users.find((u) => u.id === sel) ?? rows[0]
  const roleOf = (k: string) => st.roles.find((r) => r.key === k)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<PermUser | null>(null)
  const [said, setSaid] = useState('')

  return (
    <>
      {said && <p className="ok-ink cnote" role="status">{said}</p>}
      <div className="pm-split">
        <Glass className="pm-side">
          <Head title="المستخدمون" meta={<><Num>{rows.length}</Num> من <Num>{st.users.length}</Num></>} />
          {/* Client 14 Nov · the way a staff account is made · the only one, besides the demo accounts ·
              above the list it adds to */}
          <Button variant="2" full className="pm-add" onClick={() => setAdding(true)}>
            <Icon name={icons.plus} size="sm" />
            إضافة مستخدم
          </Button>
          <div className="pm-bar">
            <SearchBox value={q} onChange={setQ} placeholder="ابحث باسم المستخدم" />
            <Select
              icon={icons.users}
              value={role}
              all="كل الأدوار"
              options={st.roles.map((r) => ({ value: r.key, label: r.label }))}
              onChange={setRole}
            />
            <Select
              icon={icons.filter}
              value={status}
              all="كل الحالات"
              options={[
                { value: 'on', label: 'مفعّل' },
                { value: 'off', label: 'موقوف' },
                { value: 'custom', label: 'مخصّص عن دوره' },
              ]}
              onChange={setStatus}
            />
          </div>

          {rows.length === 0 ? (
            <Empty title="لا يطابق البحث أحدًا." />
          ) : (
            <ul className="pm-list" role="listbox" aria-label="المستخدمون">
              {rows.map((u) => {
                const r = roleOf(u.role)
                const n = overrideCount(u.overrides)
                const c = conflicts(r, u.overrides).length
                return (
                  <li key={u.id}>
                    <Button plain
                      type="button"
                      role="option"
                      aria-selected={u.id === user?.id}
                      className={`pm-item${u.id === user?.id ? ' on' : ''}${u.active ? '' : ' off'}`}
                      onClick={() => onSel(u.id)}
                    >
                      <Person name={u.name} quiet={false} />
                      <span className="pm-item-m sub">
                        {r?.label ?? u.role}
                        {!u.active && <> · موقوف</>}
                        {n > 0 && <> · <Num>{n}</Num> تخصيص</>}
                      </span>
                      {c > 0 && <Icon name={icons.alert} size="sm" className="pm-warn" />}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </Glass>

        {adding && (
          <AddUserModal
            users={st.users}
            roles={st.roles}
            onClose={() => setAdding(false)}
            onAdd={(u, temp) => {
              if (temp && u.email) setTempPassword(u.email, temp)
              setSaid(`أُضيف ${u.name} · يدخل ببريد العمل ${u.email} وكلمة المرور المؤقتة، ويُطلب منه تغييرها عند أول دخول`)
              setSt((x) => ({
                ...x,
                users: [...x.users, u],
                log: [logRow(u.name, `إضافة المستخدم بدور «${roleLabel(u.role)}» · ${u.email}`), ...x.log],
              }))
              setAdding(false)
              onSel(u.id)
            }}
          />
        )}

        {editing && (
          <AddUserModal
            users={st.users}
            roles={st.roles}
            initial={editing}
            onClose={() => setEditing(null)}
            onAdd={(u, temp) => {
              const was = editing
              const lines: string[] = []
              const say = (k: string, a?: string, b?: string) => { if ((a ?? '') !== (b ?? '')) lines.push(`تعديل ${k}: «${a || '—'}» ← «${b || '—'}»`) }
              say('الاسم', was.name, u.name); say('بريد العمل', emailOf(was), u.email); say('الجوال', was.mobile, u.mobile)
              say('الإدارة', was.dept, u.dept); say('المسمى', was.title, u.title)
              if (was.role !== u.role) lines.push(`تغيير الدور من «${roleLabel(was.role)}» إلى «${roleLabel(u.role)}»`)
              if (temp && u.email) {
                /* a reset · the account opens with the new temporary password, on its own sign-in */
                setTempPassword(u.email, temp)
                const demo = demoOf(was.name)
                if (demo && demo.login !== u.email.split('@')[0]) setTempPassword(demo.login, temp)
                lines.push('إعادة تعيين كلمة المرور بكلمة مؤقتة')
                setSaid(`أُعيد تعيين كلمة مرور ${u.name} · يُطلب منه تغييرها عند دخوله التالي`)
              }
              const next = was.role !== u.role ? { ...u, overrides: {} } : u
              if (lines.length) {
                setSt((x) => ({
                  ...x,
                  users: x.users.map((v) => (v.id === next.id ? next : v)),
                  log: [...lines.map((l) => logRow(next.name, l)), ...x.log],
                }))
              }
              setEditing(null)
            }}
          />
        )}

        {user && (
          <UserEditor
            key={user.id + JSON.stringify(user)}
            user={user}
            roles={st.roles}
            onEdit={() => setEditing(user)}
            onSave={(next, lines) =>
              setSt((x) => ({
                ...x,
                users: x.users.map((u) => (u.id === next.id ? next : u)),
                log: [...lines.map((l) => logRow(next.name, l)), ...x.log],
              }))
            }
          />
        )}
      </div>
    </>
  )
}

/* ═══ Client 14 Nov · a new staff account ═══
   The full name, the work email (its sign-in · unique across every account, the demo ones
   included), the mobile, the department, the job title and the role · the account starts active
   on its role's permissions, with no overrides, and the log keeps who added it */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MOBILE_RE = /^(05\d{8}|9665\d{8}|\+9665\d{8})$/
/* Client 14 Nov · the same form edits an account's details (`initial`) · its own email and its own
   demo login don't count against it · a demo account with no email yet starts from its login at the
   foundation's domain */
const demoOf = (name: string) => STAFF_DIRECTORY.find((a) => a.name === name)
const emailOf = (u: PermUser) => u.email ?? (demoOf(u.name) ? `${demoOf(u.name)!.login}@${WORK_DOMAIN}` : '')
function AddUserModal({ users, roles, initial, onClose, onAdd }: {
  users: PermUser[]; roles: PermRole[]; initial?: PermUser; onClose: () => void; onAdd: (u: PermUser, temp?: string) => void
}) {
  /* Client 14 Nov · the admin sets a temporary password · required on a new account, optional on an
     existing one (a reset) · the person replaces it on their first sign-in */
  const [temp, setTemp] = useState('')
  const [showTemp, setShowTemp] = useState(true)
  const [f, setF] = useState(() => initial
    ? { name: initial.name, email: emailOf(initial), mobile: initial.mobile ?? '', dept: initial.dept ?? '', title: initial.title ?? '', role: initial.role }
    : { name: '', email: '', mobile: '', dept: '', title: '', role: '' })
  const [tried, setTried] = useState(false)
  const put = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }))
  const email = f.email.trim().toLowerCase()
  const mine = initial ? demoOf(initial.name)?.login : undefined
  const taken = (e: string) =>
    users.some((u) => u.id !== initial?.id && emailOf(u).toLowerCase() === e)
    || STAFF_DIRECTORY.some((a) => a.login !== mine && (`${a.login}@${WORK_DOMAIN}` === e || a.login === e.split('@')[0]))
  const errs: Partial<Record<keyof typeof f, string>> = {}
  if (!f.name.trim() || f.name.trim().split(/\s+/).length < 2) errs.name = 'اكتب الاسم الكامل · الاسم واسم العائلة على الأقل'
  if (!EMAIL_RE.test(email)) errs.email = 'اكتب بريد عمل صحيحًا'
  else if (taken(email)) errs.email = 'هذا البريد مستخدم في حساب آخر'
  if (!MOBILE_RE.test(f.mobile.replace(/\s/g, ''))) errs.mobile = 'اكتب الجوال بصيغة 05XXXXXXXX'
  if (!f.dept) errs.dept = 'اختر الإدارة'
  if (!f.title.trim()) errs.title = 'اكتب المسمى الوظيفي'
  if (!f.role) errs.role = 'اختر الدور'
  const tempBad = temp || !initial ? tempIssues(temp) : []
  const ok = Object.keys(errs).length === 0 && tempBad.length === 0
  const say = (k: keyof typeof f) => tried && errs[k] ? <span className="bad regf-h" role="alert">{errs[k]}</span> : null
  const submit = () => {
    setTried(true)
    if (!ok) return
    const base = initial ?? { id: `u${Date.now().toString(36)}`, active: true, seen: 'لم يدخل بعد', overrides: {} }
    onAdd({
      ...base, name: f.name.trim().replace(/\s+/g, ' '), role: f.role,
      email, mobile: f.mobile.replace(/\s/g, ''), dept: f.dept, title: f.title.trim(),
    }, temp || undefined)
  }
  return (
    <Modal label={initial ? 'تعديل بيانات الموظف' : 'إضافة مستخدم'} onClose={onClose} escape>
      <ModalHead icon={icons.user} title={initial ? 'تعديل بيانات الموظف' : 'إضافة مستخدم'} />
      <div className="mb col">
        <p className="sub cnote">{initial ? 'يدخل ببريد العمل · تغيير الدور هنا يغيّر صلاحياته إلى صلاحيات الدور الجديد' : 'حساب موظف جديد · يدخل ببريد العمل ويأخذ صلاحيات دوره'}</p>
        <div className="regfields">
          <FormField label="الاسم الكامل" required wide>
            <FieldBox><input value={f.name} onChange={(e) => put('name')(e.target.value)} aria-label="الاسم الكامل" autoComplete="off" /></FieldBox>
            {say('name')}
          </FormField>
          <FormField label="بريد العمل" required>
            <FieldBox><input dir="ltr" type="email" value={f.email} onChange={(e) => put('email')(e.target.value)} aria-label="بريد العمل" placeholder={`name@${WORK_DOMAIN}`} autoComplete="off" /></FieldBox>
            {say('email')}
          </FormField>
          <FormField label="الجوال" required>
            <FieldBox><input dir="ltr" inputMode="tel" value={f.mobile} onChange={(e) => put('mobile')(e.target.value)} aria-label="الجوال" placeholder="05XXXXXXXX" autoComplete="off" /></FieldBox>
            {say('mobile')}
          </FormField>
          <FormField label="الإدارة" required>
            <FieldSelect value={f.dept} label="الإدارة" placeholder="اختر" options={[...DEPTS]} onChange={put('dept')} />
            {say('dept')}
          </FormField>
          <FormField label="المسمى الوظيفي" required>
            <FieldBox><input value={f.title} onChange={(e) => put('title')(e.target.value)} aria-label="المسمى الوظيفي" placeholder="مثال: أخصائي منح" autoComplete="off" /></FieldBox>
            {say('title')}
          </FormField>
          <FormField label="الدور" required wide>
            <FieldSelect value={f.role} label="الدور" placeholder="اختر" disabled={initial?.name === ME}
              options={roles.filter((r) => (r.persona ?? 'staff') !== 'entity' && (r.persona ?? 'staff') !== 'partner').map((r) => ({ value: r.key, label: r.label }))}
              onChange={put('role')} />
            {say('role')}
          </FormField>
          <FormField label={initial ? 'كلمة مرور مؤقتة جديدة' : 'كلمة المرور المؤقتة'} required={!initial} wide>
            <span className="rowf gp-2 pm-temp">
              <FieldBox>
                <input dir="ltr" type={showTemp ? 'text' : 'password'} value={temp} onChange={(e) => setTemp(e.target.value)}
                  aria-label="كلمة المرور المؤقتة" autoComplete="new-password" placeholder={initial ? 'اتركها فارغة لتبقى كلمة المرور كما هي' : ''} />
                <Button plain type="button" className="iact" onClick={() => setShowTemp((x) => !x)} aria-label={showTemp ? 'إخفاء' : 'إظهار'} aria-pressed={showTemp}>
                  <Icon name={showTemp ? icons.eyeOff : icons.eye} size="sm" />
                </Button>
              </FieldBox>
              <Button variant="2" type="button" onClick={() => { setTemp(makeTemp()); setShowTemp(true) }}>ولّد</Button>
            </span>
            {tried && tempBad.length > 0
              ? <span className="bad regf-h" role="alert">كلمة المرور المؤقتة: {tempBad.join(' · ')}</span>
              : <span className="sub regf-h">{initial ? 'تُعيد تعيين كلمة مروره · يُطلب منه تغييرها عند دخوله التالي' : 'بلّغه بها مع بريد العمل · يُطلب منه تغييرها عند أول دخول'}</span>}
          </FormField>
        </div>
      </div>
      <div className="mf">
        <Button variant="p" onClick={submit}>
          {!initial && <Icon name={icons.plus} size="sm" />}
          {initial ? 'احفظ البيانات' : 'أضف المستخدم'}
        </Button>
        <Button variant="2" onClick={onClose}>تراجع</Button>
      </div>
    </Modal>
  )
}

function UserEditor({ user, roles, onSave, onEdit }: {
  user: PermUser; roles: PermRole[]; onSave: (u: PermUser, log: string[]) => void; onEdit: () => void
}) {
  const [d, setD] = useState<PermUser>(user)
  const role = roles.find((r) => r.key === d.role)
  const self = user.name === ME
  const n = overrideCount(d.overrides)
  const sod = conflicts(role, d.overrides)

  const changes = useMemo(() => {
    const out: string[] = []
    if (d.role !== user.role) out.push(`تغيير الدور من «${roleLabel(user.role)}» إلى «${roleLabel(d.role)}»`)
    if (d.active !== user.active) out.push(d.active ? 'تفعيل الحساب' : 'إيقاف الحساب')
    const a = JSON.stringify(user.overrides)
    const b = JSON.stringify(d.overrides)
    if (a !== b) {
      for (const m of PERM_MODULES) {
        for (const act of m.actions) {
          const was = user.overrides[m.key]?.[act]
          const now = d.overrides[m.key]?.[act]
          if (was === now) continue
          if (now === undefined) out.push(`إرجاع «${ACT_LABEL[act]}» في ${m.label} إلى الدور`)
          else out.push(`${now ? 'منح' : 'سحب'} «${ACT_LABEL[act]}» في ${m.label} خارج الدور`)
        }
      }
    }
    return out
  }, [d, user])

  /* A cell set back to what the role gives is no longer an override, so the count stays honest.
     The same row rule as the role: any verb opens the module, closing «عرض» closes the row. */
  const toggle = (mod: string, act: ActionKey, on: boolean) =>
    setD((x) => {
      const next: Overrides = { ...x.overrides }
      const put = (a: ActionKey, val: boolean) => {
        const base = Boolean(role?.grants[mod]?.acts.includes(a))
        const m = { ...(next[mod] ?? {}) }
        if (val === base) delete m[a]
        else m[a] = val
        if (Object.keys(m).length) next[mod] = m
        else delete next[mod]
      }
      put(act, on)
      if (act === 'view' && !on) moduleByKey(mod)?.actions.forEach((a) => put(a, false))
      if (on && act !== 'view') put('view', true)
      return { ...x, overrides: next }
    })

  return (
    <Glass className="pm-main">
      <div className="pm-who">
        <Person name={d.name} size="lg" quiet={false} />
        <span className="sub">
          {d.title && <>{d.title}{d.dept ? ` · ${d.dept}` : ''} · </>}
          يفتح <Num>{moduleCount(role, d.overrides)}</Num> من <Num>{PERM_MODULES.length}</Num> وحدة · آخر دخول: {d.seen}
          {emailOf(d) && <> · <bdi>{emailOf(d)}</bdi></>}
        </span>
        <span className="pc-sp" />
        {/* Client 14 Nov · the person's details · name, work email, mobile, department, title */}
        <Button variant="2" size="sm" onClick={onEdit}>
          <Icon name={icons.edit} size="sm" />
          تعديل البيانات
        </Button>
        {changes.length > 0 && (
          <SaveBar
            count={changes.length}
            sentence={<>{changes.length === 1 ? 'تغيير غير محفوظ' : 'تغييرات غير محفوظة'} على {d.name}<span className="decsep" /><span className="sub">{changes[changes.length - 1]}</span></>}
            onSave={() => onSave(d, changes)}
            onDiscard={() => setD(user)}
          />
        )}
      </div>

      <div className="regfields">
        <FormField label="الدور" as="div">
          <FieldSelect
            value={d.role}
            options={roles.map((r) => ({ value: r.key, label: r.label }))}
            onChange={(x) => setD((y) => ({ ...y, role: x }))}
            label="دور المستخدم"
            disabled={self}
          />
          {self && <span className="sub">لا تغيّر دورك بنفسك</span>}
        </FormField>
        <FormField label="الحساب" as="div">
          <Switch
            label={d.active ? 'مفعّل' : 'موقوف'}
            on={d.active}
            onChange={(x) => setD((y) => ({ ...y, active: x }))}
            disabled={self}
            lockNote={self ? 'لا توقف حسابك بنفسك' : undefined}
          />
        </FormField>
      </div>

      <PermMatrix
        mode="user"
        role={role}
        overrides={d.overrides}
        onToggle={toggle}
        locked={(mod) => (self && mod === 'permissions') || role?.key === 'admin'}
      />

      <div className="pm-foot">
        <span className="sub">
          {n > 0 ? <><Num>{n}</Num> خانة مختلفة عن دور «{role?.label}»</> : <>مطابق لدور «{role?.label}» تمامًا</>}
        </span>
        <span className="pc-sp" />
        {n > 0 && (
          <Button type="button" variant="2" size="sm" onClick={() => setD((x) => ({ ...x, overrides: {} }))}>
            <Icon name={icons.redo} size="sm" />
            ارجع لصلاحيات الدور
          </Button>
        )}
      </div>

      {sod.length > 0 && <SodNote pairs={sod} />}
    </Glass>
  )
}

/* ═══ Roles ═══ */

function RolesTab({ st, setSt, sel, onSel }: {
  st: PermState; setSt: SetSt; sel?: string; onSel: (k: string | undefined) => void
}) {
  const role = st.roles.find((r) => r.key === sel) ?? st.roles[0]
  const members = (k: string) => st.users.filter((u) => u.role === k)

  return (
    <div className="pm-split">
      <Glass className="pm-side">
        <Head title="الأدوار" />
        {/* Grouped by persona · the four «صفات اعتبارية» the system is designed around */}
        {PERSONAS.map((p) => {
          const list = st.roles.filter((r) => (r.persona ?? 'staff') === p.key)
          if (!list.length) return null
          return (
            <div className="pm-group" key={p.key}>
              <div className="pm-group-h">
                <b>{p.label}</b>
              </div>
              <ul className="pm-list" role="listbox" aria-label={p.label}>
                {list.map((r) => {
                  const m = members(r.key).length
                  return (
                    <li key={r.key}>
                      <Button plain
                        type="button"
                        role="option"
                        aria-selected={r.key === role.key}
                        className={`pm-item${r.key === role.key ? ' on' : ''}`}
                        onClick={() => onSel(r.key)}
                      >
                        <span className="pm-item-t">{r.label}</span>
                        <span className="pm-item-m sub">
                          {m > 0 ? <><Num>{m}</Num> مستخدم</> : 'بلا مستخدمين'}
                          {r.external && <> · من خارج المؤسسة</>}
                        </span>
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </Glass>

      <RoleEditor
        key={role.key + JSON.stringify(role.grants)}
        role={role}
        members={members(role.key)}
        onSave={(next, lines) =>
          setSt((x) => ({
            ...x,
            roles: x.roles.map((r) => (r.key === next.key ? next : r)),
            log: [...lines.map((l) => logRow(`دور ${next.label}`, l)), ...x.log],
          }))
        }
      />
    </div>
  )
}

function RoleEditor({ role, members, onSave }: {
  role: PermRole; members: PermUser[]; onSave: (r: PermRole, log: string[]) => void
}) {
  const [grants, setGrants] = useState<Grants>(role.grants)
  const draft: PermRole = { ...role, grants }

  const changes = useMemo(() => {
    const out: string[] = []
    for (const m of PERM_MODULES) {
      const a = role.grants[m.key]
      const b = grants[m.key]
      for (const act of m.actions) {
        const was = Boolean(a?.acts.includes(act))
        const now = Boolean(b?.acts.includes(act))
        if (was !== now) out.push(`${now ? 'إضافة' : 'إزالة'} «${ACT_LABEL[act]}» في ${m.label}`)
      }
      if (m.scoped && a?.scope !== b?.scope && b?.scope && b.acts.includes('view')) {
        out.push(`نطاق ${m.label}: ${SCOPES.find((s) => s.value === b.scope)?.label}`)
      }
    }
    return out
  }, [grants, role])

  const toggle = (mod: string, act: ActionKey, on: boolean) =>
    setGrants((x) => {
      const cur = x[mod] ?? { acts: [] }
      let acts = on ? [...new Set([...cur.acts, act])] : cur.acts.filter((a) => a !== act)
      /* Every other verb needs the module open: turning view off clears the row, and any verb turns
         it on, so a role can never "approve" in a module it can't see. */
      if (act === 'view' && !on) acts = []
      if (on && act !== 'view' && !acts.includes('view')) acts = ['view', ...acts]
      const scope = moduleByKey(mod)?.scoped ? cur.scope ?? 'own' : undefined
      return { ...x, [mod]: { acts, scope } }
    })

  const setScope = (mod: string, scope: Scope) =>
    setGrants((x) => ({ ...x, [mod]: { acts: x[mod]?.acts ?? [], scope } }))

  const sod = conflicts(draft, {})

  return (
    <Glass className="pm-main">
      <div className="pm-who">
        <div>
          <h3 className="pm-rt">{role.label}</h3>
        </div>
        <span className="pc-sp" />
        {changes.length > 0 && (
          <SaveBar
            count={changes.length}
            sentence={<>{changes.length === 1 ? 'تغيير غير محفوظ' : 'تغييرات غير محفوظة'} على دور {role.label}<span className="decsep" /><span className="sub">يطبَّق على <Num>{members.length}</Num> مستخدم</span></>}
            onSave={() => onSave(draft, changes)}
            onDiscard={() => setGrants(role.grants)}
          />
        )}
      </div>

      {members.length === 0 && <p className="sub cnote">لا يحمل هذا الدور أحد حاليًا</p>}

      {members.length > 0 && (
        <div className="pm-faces">
          {members.map((u) => <Person key={u.id} name={u.name} />)}
        </div>
      )}

      <PermMatrix
        mode="role"
        role={draft}
        overrides={{}}
        onToggle={toggle}
        onScope={setScope}
        locked={() => role.key === 'admin'}
      />

      {sod.length > 0 && <SodNote pairs={sod} />}
    </Glass>
  )
}

/* ═══ Log ═══ */

function LogTab({ log }: { log: PermLogRow[] }) {
  return (
    <Glass className="tblcard">
      <Head title="سجل التغييرات" />
      {log.length === 0 ? (
        <Empty title="لم يُسجَّل تغيير بعد." />
      ) : (
        <div className="tblwrap">
          <table className="tbl pm-log">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>بواسطة</th>
                <th>على</th>
                <th>التغيير</th>
              </tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <td><DateText>{l.at}</DateText></td>
                  <td><Person name={l.by} /></td>
                  <td>{l.target.startsWith('دور ') ? <span className="prs prs-sm"><span className="av av-28 av-ic" aria-hidden="true"><Icon name={icons.users} size="sm" /></span><span className="prs-n sub">{l.target}</span></span> : <Person name={l.target} />}</td>
                  <td className="pm-log-c">{l.change}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Glass>
  )
}

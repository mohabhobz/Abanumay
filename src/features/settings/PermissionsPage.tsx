import { AuthRulesCard } from './AuthRulesCard'
import { readRole } from '@/data/roles'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DateText, Empty, FieldSelect, Glass, Head, Icon, icons, Num, Person, SearchBox, Select, Switch, Tabs, Tag,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { DockSlotProvider, SaveBar, useDockSlot } from '@/components/shell'
import { ROUTES } from '@/app/routes'
import { useQueryParams } from '@/hooks/useQueryParams'
import { assistFor } from '@/data/mock/assistant'
import { useStored } from '@/lib/prefs'
import {
  ACTIONS, PERM_INITIAL, PERM_KEY, PERM_MODULES, PERM_USERS, PERSONAS, SCOPES, conflicts, moduleByKey,
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
                من يرى ماذا ويفعل ماذا في <Num>{PERM_MODULES.length}</Num> وحدة ·
                الدور يحمل الأساس، والتخصيص لمستخدم بعينه يبقى ظاهرًا
                ({ov > 0 ? <><Num>{ov}</Num> تخصيص حاليًا</> : 'لا تخصيصات'}) ·{' '}
                <Link className="tlink" to={ROUTES.settings}>إعدادات النظام</Link>
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

  return (
    <>
      <div className="pm-split">
        <Glass className="pm-side">
          <Head title="المستخدمون" meta={<><Num>{rows.length}</Num> من <Num>{st.users.length}</Num></>} />
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
                    <button
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
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Glass>

        {user && (
          <UserEditor
            key={user.id + JSON.stringify(user)}
            user={user}
            roles={st.roles}
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

function UserEditor({ user, roles, onSave }: {
  user: PermUser; roles: PermRole[]; onSave: (u: PermUser, log: string[]) => void
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
          يفتح <Num>{moduleCount(role, d.overrides)}</Num> من <Num>{PERM_MODULES.length}</Num> وحدة · آخر دخول: {d.seen}
        </span>
        <span className="pc-sp" />
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
        <div className="regf">
          <span className="lb">الدور</span>
          <FieldSelect
            value={d.role}
            options={roles.map((r) => ({ value: r.key, label: r.label }))}
            onChange={(x) => setD((y) => ({ ...y, role: x }))}
            label="دور المستخدم"
            disabled={self}
          />
          {self && <span className="sub">لا تغيّر دورك بنفسك · يغيّره مدير نظام آخر</span>}
        </div>
        <div className="regf">
          <span className="lb">الحساب</span>
          <Switch
            label={d.active ? 'مفعّل' : 'موقوف'}
            note={d.active ? 'يدخل ويعمل بصلاحياته' : 'لا يدخل · وتبقى سجلاته وأعماله باسمه'}
            on={d.active}
            onChange={(x) => setD((y) => ({ ...y, active: x }))}
            disabled={self}
            lockNote={self ? 'لا توقف حسابك بنفسك' : undefined}
          />
        </div>
      </div>

      <PermMatrix
        mode="user"
        role={role}
        overrides={d.overrides}
        onToggle={toggle}
        locked={(mod) => self && mod === 'permissions'}
      />

      <div className="pm-foot">
        <span className="sub">
          {n > 0 ? <><Num>{n}</Num> خانة مختلفة عن دور «{role?.label}»</> : <>مطابق لدور «{role?.label}» تمامًا</>}
        </span>
        <span className="pc-sp" />
        {n > 0 && (
          <button type="button" className="btn btn-2 btn-sm" onClick={() => setD((x) => ({ ...x, overrides: {} }))}>
            <Icon name={icons.redo} size="sm" />
            ارجع لصلاحيات الدور
          </button>
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
        <Head title="الأدوار" meta={<span className="sub">الأساس لكل من يحمله</span>} />
        {/* Grouped by persona · the four «صفات اعتبارية» the system is designed around */}
        {PERSONAS.map((p) => {
          const list = st.roles.filter((r) => (r.persona ?? 'staff') === p.key)
          if (!list.length) return null
          return (
            <div className="pm-group" key={p.key}>
              <div className="pm-group-h">
                <b>{p.label}</b>
                <span className="sub">{p.note}</span>
              </div>
              <ul className="pm-list" role="listbox" aria-label={p.label}>
                {list.map((r) => {
                  const m = members(r.key).length
                  return (
                    <li key={r.key}>
                      <button
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
                      </button>
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
  const custom = members.filter((u) => overrideCount(u.overrides) > 0).length

  return (
    <Glass className="pm-main">
      <div className="pm-who">
        <div>
          <h3 className="pm-rt">{role.label}</h3>
          <span className="sub">{role.note}</span>
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

      <p className="sub cnote">
        {members.length > 0 ? (
          <>
            يطبَّق الحفظ على <Num>{members.length}</Num> مستخدم فورًا
            {custom > 0 && <> · وتبقى تخصيصات <Num>{custom}</Num> منهم كما هي</>}
          </>
        ) : (
          'لا يحمل هذا الدور أحد حاليًا'
        )}
        {role.external && ' · دور من خارج المؤسسة، وما يُمنح له يُقرأ في حدود سجلاته وحدها'}
      </p>

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
        locked={(mod) => role.key === 'admin' && mod === 'permissions'}
      />

      {sod.length > 0 && <SodNote pairs={sod} />}
    </Glass>
  )
}

/* ═══ Log ═══ */

function LogTab({ log }: { log: PermLogRow[] }) {
  return (
    <Glass className="tblcard">
      <Head title="سجل التغييرات" meta={<span className="sub">لا يُحذف ولا يُعدَّل</span>} />
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

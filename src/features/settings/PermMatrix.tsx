import { Icon, icons, Select, Tag } from '@/components/ui'
import {
  ACTIONS, PERM_MODULES, SCOPES, conflicts, effective, moduleByKey,
  type ActionKey, type Overrides, type PermRole, type Scope,
} from '@/data/mock/permissions'

const ACT_LABEL = Object.fromEntries(ACTIONS.map((a) => [a.key, a.label])) as Record<ActionKey, string>

/* ═══ The matrix · shared by a user and a role ═══ */

export function PermMatrix({ mode, role, overrides, onToggle, onScope, locked = () => false, readOnly }: {
  mode: 'user' | 'role'
  role: PermRole | undefined
  overrides: Overrides
  onToggle?: (mod: string, act: ActionKey, on: boolean) => void
  onScope?: (mod: string, s: Scope) => void
  locked?: (mod: string) => boolean
  /** The holder's own view · marks instead of checkboxes, nothing to change */
  readOnly?: boolean
}) {
  return (
    <>
      <div className="tblwrap">
        <table className="tbl nfm pmx">
          <thead>
            <tr>
              <th>الوحدة</th>
              {ACTIONS.map((a) => <th key={a.key} className="nfm-c" title={a.note}>{a.label}</th>)}
              <th className="nfm-f">النطاق</th>
            </tr>
          </thead>
          <tbody>
            {PERM_MODULES.map((m) => {
              const grant = role?.grants[m.key]
              const lock = locked(m.key)
              const open = effective(role, overrides, m.key, 'view')
              return (
                <tr key={m.key} className={open ? '' : 'pm-closed'}>
                  <td>
                    <span className="pm-mod">
                      <b>{m.label}</b>
                      {m.admin && <Tag tone="mute">للجميع</Tag>}
                    </span>
                    <span className="sub pm-mod-n">{m.note}</span>
                  </td>
                  {ACTIONS.map((a) => {
                    if (!m.actions.includes(a.key)) {
                      return <td key={a.key} className="nfm-c"><span className="pm-na" aria-label="لا ينطبق">—</span></td>
                    }
                    const on = effective(role, overrides, m.key, a.key)
                    const ov = mode === 'user' && overrides[m.key]?.[a.key] !== undefined
                    if (readOnly) {
                      return (
                        <td key={a.key} className="nfm-c">
                          {on
                            ? <span className="pm-yes" role="img" aria-label={`${m.label} · ${a.label} · مسموح`}><Icon name={icons.check} size="sm" /></span>
                            : <span className="pm-no" role="img" aria-label={`${m.label} · ${a.label} · غير مسموح`} />}
                        </td>
                      )
                    }
                    return (
                      <td key={a.key} className={`nfm-c${ov ? ' pm-ov' : ''}`}>
                        <span className="nfm-box">
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={lock}
                            onChange={(ev) => onToggle?.(m.key, a.key, ev.target.checked)}
                            aria-label={`${m.label} · ${a.label}`}
                            title={
                              lock ? 'مقفل · حتى لا يُغلق باب الصلاحيات على من يديرها'
                                : ov ? `مختلف عن الدور · الدور ${role?.grants[m.key]?.acts.includes(a.key) ? 'يمنحه' : 'لا يمنحه'}`
                                  : undefined
                            }
                          />
                          {lock && <Icon name={icons.lock} size="sm" className="nfm-lock" />}
                          {ov && <i className="pm-dot" aria-hidden="true" />}
                        </span>
                      </td>
                    )
                  })}
                  <td className="nfm-f">
                    {!m.scoped ? (
                      <span className="sub">—</span>
                    ) : mode === 'role' && onScope ? (
                      <Select
                        value={grant?.scope ?? 'own'}
                        allowEmpty={false}
                        options={SCOPES}
                        disabled={!grant?.acts.includes('view')}
                        onChange={(x) => onScope(m.key, (x as Scope) ?? 'own')}
                      />
                    ) : (
                      <span className="sub">
                        {open ? SCOPES.find((s) => s.value === (grant?.scope ?? 'own'))?.label : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="sub pm-legend">
        {mode === 'user' && !readOnly && <span><i className="pm-dot" aria-hidden="true" /> مختلف عن الدور</span>}
        {readOnly && <span><span className="pm-yes"><Icon name={icons.check} size="sm" /></span> مسموح</span>}
        <span><span className="pm-na">—</span> لا ينطبق على الوحدة</span>
        {!readOnly && <span>أي صلاحية تفتح «عرض» معها، وإغلاق «عرض» يغلق الصف</span>}
        {mode === 'user' && <span>النطاق من الدور</span>}
      </p>
    </>
  )
}

export function SodNote({ pairs }: { pairs: ReturnType<typeof conflicts> }) {
  return (
    <div className="pm-sod" role="note">
      <Icon name={icons.alert} size="sm" />
      <div>
        <b>فصل المهام</b>
        <ul>
          {pairs.map((p) => (
            <li key={p.mod}>
              {moduleByKey(p.mod)?.label}: «{ACT_LABEL[p.a]}» و«{ACT_LABEL[p.b]}» معًا · من يرفع الطلب يعتمده بنفسه
            </li>
          ))}
        </ul>
        <span className="sub">تنبيه لا منع: الفريق الصغير قد يحتاجه، فليكن قرارًا مقصودًا.</span>
      </div>
    </div>
  )
}


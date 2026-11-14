import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button, Icon, icons } from '@/components/ui'
import { AuthShell, AuthField } from './AuthShell'
import { AFTER_LOGIN, ROUTES } from '@/app/routes'
import { signedAccount } from '@/data/roles'
import { signOut } from '@/data/session'
import { STAFF_PASS_RULES, mustChangePassword, setOwnPassword, staffPasswordOk } from '@/data/staffAuth'

/* Client 14 Nov · the first sign-in with a temporary password · the one screen it opens · the person
   picks their own password (the rules checked as they type, the same as the profile's), then the
   system opens · signing out here leaves the temporary password as it was */
export default function FirstPasswordPage() {
  const navigate = useNavigate()
  const me = signedAccount()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  if (!me) return <Navigate to={ROUTES.login} replace />
  if (!mustChangePassword(me.login)) return <Navigate to={AFTER_LOGIN} replace />

  const rules = STAFF_PASS_RULES.map((r) => ({ ...r, on: r.key === 'new' ? pw.length > 0 && staffPasswordOk(me.login, pw) !== true : r.test(pw, '') }))
  const match = pw2.length > 0 && pw === pw2
  const ready = rules.every((r) => r.on) && match

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) { setErr(!match ? 'التأكيد لا يطابق كلمة المرور' : 'كلمة المرور لا تستوفي الشروط'); setTimeout(() => setErr(''), 4000); return }
    setOwnPassword(me.login, pw)
    navigate(AFTER_LOGIN, { replace: true, state: { first: true } })
  }

  const eye = (
    <Button plain type="button" className="leye" onClick={() => setShow((v) => !v)} aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
      <Icon name={show ? icons.eyeOff : icons.eye} size="md" />
    </Button>
  )
  return (
    <AuthShell title="عيّن كلمة مرورك" sub={`أهلًا ${me.name.split(' ')[0]} · دخلت بكلمة مرور مؤقتة، اختر كلمة مرورك قبل المتابعة`} err={err}>
      <form className="lform" onSubmit={save} noValidate>
        <AuthField id="fp-new" name="new-password" label="كلمة المرور الجديدة" icon={icons.lock} type={show ? 'text' : 'password'}
          value={pw} onChange={setPw} autoComplete="new-password" enterKeyHint="next" trailing={eye} />
        <AuthField id="fp-new2" name="new-password-2" label="تأكيد كلمة المرور" icon={icons.lock} type={show ? 'text' : 'password'}
          value={pw2} onChange={setPw2} autoComplete="new-password" enterKeyHint="go" />
        <ul className="acc-rules" aria-live="polite">
          {rules.map((r) => (
            <li key={r.key} className={r.on ? 'on' : ''}><Icon name={r.on ? icons.check : icons.close} size="sm" />{r.key === 'new' ? 'تختلف عن كلمة المرور المؤقتة' : r.label}</li>
          ))}
          <li className={match ? 'on' : ''}><Icon name={match ? icons.check : icons.close} size="sm" />التأكيد مطابق</li>
        </ul>
        <Button variant="p" full type="submit" disabled={!ready}>احفظ وادخل</Button>
      </form>
      <div className="lalt">
        <Button variant="2" full type="button" onClick={() => { signOut(); navigate(ROUTES.login, { replace: true }) }}>تسجيل الخروج</Button>
      </div>
    </AuthShell>
  )
}

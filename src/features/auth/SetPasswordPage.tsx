import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Icon, icons } from '@/components/ui'
import { AuthShell, AuthField } from './AuthShell'
import { ROUTES } from '@/app/routes'
import { STAFF_PASS_RULES, inviteOf, redeemInvite } from '@/data/staffAuth'

/* Client 16 Nov · the link the invitation (or the reset) email carries · the person picks their own
   password here, then signs in with their work email and it · the link is single-use and lasts 48
   hours · a spent, unknown or late link says so and sends them to ask for a new one */
export default function SetPasswordPage() {
  const navigate = useNavigate()
  const [q] = useSearchParams()
  const token = q.get('t') ?? ''
  const { inv, state } = inviteOf(token)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')

  if (!inv || state !== 'ok') {
    return (
      <AuthShell title="الرابط غير صالح" sub={state === 'expired' ? 'انتهت صلاحية الرابط (48 ساعة)' : 'استُخدم الرابط من قبل أو لم يعد صالحًا'}>
        <p className="sub tcen">اطلب من مدير النظام إرسال رابط جديد إلى بريد عملك.</p>
        <Button variant="p" full type="button" onClick={() => navigate(ROUTES.login, { replace: true })}>صفحة الدخول</Button>
      </AuthShell>
    )
  }

  const rules = STAFF_PASS_RULES.filter((r) => r.key !== 'new').map((r) => ({ ...r, on: r.test(pw, '') }))
  const match = pw2.length > 0 && pw === pw2
  const ready = rules.every((r) => r.on) && match

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) { setErr(!match ? 'التأكيد لا يطابق كلمة المرور' : 'كلمة المرور لا تستوفي الشروط'); return }
    redeemInvite(token, pw)
    navigate(ROUTES.login, { replace: true, state: { reset: true, user: inv.email } })
  }

  const eye = (
    <Button plain type="button" className="leye" onClick={() => setShow((v) => !v)} aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
      <Icon name={show ? icons.eyeOff : icons.eye} size="md" />
    </Button>
  )
  return (
    <AuthShell
      title="عيّن كلمة مرورك"
      sub={inv.kind === 'invite' ? `أهلًا ${inv.name.split(' ')[0]} · حسابك في منح أبانمي جاهز، اختر كلمة مرورك لتدخل به` : `أهلًا ${inv.name.split(' ')[0]} · اختر كلمة مرور جديدة لحسابك`}
      err={err}
    >
      <form className="lform" onSubmit={save} noValidate>
        <AuthField id="sp-user" name="username" label="بريد العمل" icon={icons.user} value={inv.email} onChange={() => undefined} autoComplete="username" />
        <AuthField id="sp-new" name="new-password" label="كلمة المرور" icon={icons.lock} type={show ? 'text' : 'password'}
          value={pw} onChange={setPw} autoComplete="new-password" enterKeyHint="next" trailing={eye} />
        <AuthField id="sp-new2" name="new-password-2" label="تأكيد كلمة المرور" icon={icons.lock} type={show ? 'text' : 'password'}
          value={pw2} onChange={setPw2} autoComplete="new-password" enterKeyHint="go" />
        <ul className="acc-rules" aria-live="polite">
          {rules.map((r) => (
            <li key={r.key} className={r.on ? 'on' : ''}><Icon name={r.on ? icons.check : icons.close} size="sm" />{r.label}</li>
          ))}
          <li className={match ? 'on' : ''}><Icon name={match ? icons.check : icons.close} size="sm" />التأكيد مطابق</li>
        </ul>
        <Button variant="p" full type="submit" disabled={!ready}>احفظ كلمة المرور</Button>
      </form>
    </AuthShell>
  )
}

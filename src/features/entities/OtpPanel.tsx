import { useEffect, useState } from 'react'
import { OTP_SAY, mmss, useTick } from './otp'
import { Icon, icons, Mono, Num } from '@/components/ui'
import {
  OTP_LEN, expiresIn, otp, resendIn, sendOtp, triesLeft, verifyOtp, type OtpPurpose,
} from '@/data/entities/auth'

/* One-time code · registration (2.2.9), password reset (2.3.pw-4–6 · 2.3.pw-13–14) and identity on
   an update of email or mobile (2.3.upd-17 · 2.4.19). The rules — validity, wrong tries, the wait
   before a new code — come from settings and run in `data/entities/auth`; this is the one place
   they're shown, so the three journeys read the same.

   The countdown is the code's own: it starts when the code is sent and the screen re-reads it every
   second, so a reload keeps the same minute instead of handing out a fresh five. */

export function OtpPanel({
  purpose, to, account, onVerified, onEdit,
}: {
  purpose: OtpPurpose
  to: string[]
  account?: string
  onVerified: () => void
  /** «تعديل» beside the number · returns to the field it came from */
  onEdit?: () => void
}) {
  useTick()
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  /* A code for this journey is sent on arrival · a different journey's code is never reused */
  const where = to.join('|')
  useEffect(() => {
    const c = otp()
    if (!c || c.purpose !== purpose || c.dead) sendOtp(purpose, where.split('|'), account)
  }, [purpose, where, account])

  const c = otp()
  const left = expiresIn()
  const wait = resendIn()
  const dead = !c || c.dead || left === 0

  const check = () => {
    const r = verifyOtp(code)
    if (r === 'ok') { setMsg(''); onVerified(); return }
    setMsg(r === 'wrong' ? `${OTP_SAY.wrong} تبقّى ${triesLeft()} ${triesLeft() === 1 ? 'محاولة' : 'محاولات'}.` : OTP_SAY[r])
    setCode('')
  }

  return (
    <div className="otp">
      <p className="sub cnote">
        أُرسل رمز من <Num>{OTP_LEN}</Num> أرقام إلى{' '}
        {c?.to.map((t, i) => <span key={t}>{i > 0 && ' و'}<Mono>{t}</Mono></span>)}
        {onEdit && <> · <button type="button" className="lnk" onClick={onEdit}>تعديل</button></>}
      </p>
      <div className="otp-row">
        <label className="payamt otp-in">
          <span className="lb">رمز التحقّق</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            maxLength={OTP_LEN}
            disabled={dead}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter' && code.length === OTP_LEN) check() }}
            aria-label="رمز التحقّق"
          />
        </label>
        <button type="button" className="btn btn-p" disabled={dead || code.length !== OTP_LEN} onClick={check}>
          تحقّق
        </button>
        <button
          type="button"
          className="btn btn-2"
          disabled={wait > 0}
          title={wait > 0 ? `يُتاح رمز جديد بعد ${wait} ثانية` : 'أرسل رمزًا جديدًا'}
          onClick={() => { sendOtp(purpose, to, account); setMsg(''); setCode('') }}
        >
          <Icon name={icons.redo} size="sm" />
          {wait > 0 ? <>رمز جديد بعد <Num>{wait}</Num> ث</> : 'أرسل رمزًا جديدًا'}
        </button>
      </div>
      <p className="sub otp-meta">
        {dead
          ? <span className="bad">{c?.dead ? OTP_SAY.dead : OTP_SAY.expired}</span>
          : <>صالح لمدة <span className="num">{mmss(left)}</span> · <Num>{triesLeft()}</Num> محاولات متبقية</>}
        {msg && !dead && <> · <span className="bad">{msg}</span></>}
      </p>
      {/* There is no SMS gateway in the prototype · the code is shown so the journey can be walked */}
      {c && !c.dead && <p className="sub otp-demo">رمز النموذج التجريبي: <Mono>{c.code}</Mono></p>}
    </div>
  )
}

import { useState } from 'react'
import { Glass, Head, Switch } from '@/components/ui'
import { CfgNum } from './CfgEdit'
import { AUTH_RULES, DEMO, saveAuthRules, setSwitcher, type AuthRules } from '@/data/authGuard'

/* Batch 8 · sign-in protection · wrong tries, the lock and the idle session · edited by the system
   admin, applied on the next sign-in and the next idle tick */
export function AuthRulesCard({ by, admin }: { by: string; admin: boolean }) {
  const [d, setD] = useState<AuthRules>(() => ({ ...AUTH_RULES }))
  const [saved, setSaved] = useState<AuthRules>(() => ({ ...AUTH_RULES }))
  const dirty = JSON.stringify(d) !== JSON.stringify(saved)
  const [sw, setSw] = useState(DEMO.switcher)
  const row = (k: keyof AuthRules, label: string, note: string, suffix: string, min = 1) => (
    <li className="itk-sup">
      <span className="cfgl"><b>{label}</b><span className="sub">{note}</span></span>
      <span className="pc-sp" />
      {admin ? <CfgNum value={d[k]} label={label} suffix={suffix} min={min} onChange={(n) => setD({ ...d, [k]: Math.max(min, n) })} /> : <span className="num">{d[k]} {suffix}</span>}
    </li>
  )
  return (
    <Glass>
      <Head title="حماية الدخول" meta={dirty && admin ? <button type="button" className="btn btn-p btn-sm" onClick={() => { saveAuthRules(d, by); setSaved({ ...d }) }}>احفظ</button> : <span className="sub">تسري على الدخول التالي</span>} />
      <ul className="cfglist">
        {row('maxTries', 'محاولات كلمة المرور الخاطئة', 'بعدها يُقفل الحساب مؤقتًا', 'محاولات')}
        {row('lockMinutes', 'مدة القفل', 'ثم تُفتح المحاولات من جديد', 'دقيقة')}
        {row('idleMinutes', 'إنهاء الجلسة بعد خمول', 'بلا نقر ولا كتابة', 'دقيقة')}
        {row('warnSeconds', 'التنبيه قبل الإنهاء', 'شريط «ابقَ متصلًا»', 'ثانية', 15)}
      </ul>
      <Switch
        label="مبدّل الأشخاص للعرض التجريبي" disabled={!admin}
        note="اختصار الدخول باسم شخص آخر من قائمة الحساب · يُخفى قبل التشغيل الفعلي، أو يُطفأ عند البناء بالمتغيّر VITE_DEMO_SWITCHER=off"
        on={sw} onChange={(v) => { setSw(v); setSwitcher(v, by) }}
      />
    </Glass>
  )
}

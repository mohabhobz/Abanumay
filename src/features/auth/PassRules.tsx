import { Icon, icons } from '@/components/ui'
import { ENTITY_RULES } from '@/data/entities/rules'
import { PASS_PATTERN_RULE, passwordIssues, weakPattern } from '@/data/entities/validate'
import { STAFF_PASS_RULES } from '@/data/staffAuth'

/* Audit 26 Nov · a password's rules as a checklist that ticks itself while it's typed, and a strength
   bar above it · once every rule is met, one green line says «كلمة المرور مناسبة» · used wherever an
   entity sets a password (its account, the reset), on the same rules the check refuses by
   (`passwordIssues`), so the list and the verdict can't disagree */
export const passRules = (p: string, user: string) => [
  { ok: p.length >= ENTITY_RULES.passMin, say: `${ENTITY_RULES.passMin} أحرف على الأقل` },
  ...(ENTITY_RULES.passNeedsLetter ? [{ ok: /[A-Za-z\u0600-\u06FF]/.test(p), say: 'حرف واحد على الأقل' }] : []),
  ...(ENTITY_RULES.passNeedsDigit ? [{ ok: /\d/.test(p), say: 'رقم واحد على الأقل' }] : []),
  { ok: p.length > 0 && !weakPattern(p), say: PASS_PATTERN_RULE },
  ...(user ? [{ ok: !p || !p.toLowerCase().includes(user.toLowerCase().split('@')[0]), say: 'لا تتضمّن اسم المستخدم' }] : []),
]

/** 0-4 · the rules met, then length and a mix of cases and symbols on top */
export const passStrength = (p: string, user: string): number => {
  if (!p) return 0
  if (weakPattern(p)) return 1
  let n = passwordIssues(p, user).length ? 1 : 2
  if (p.length >= 12) n++
  if (/[^A-Za-z0-9]/.test(p) && /[A-Z]/.test(p) && /[a-z]/.test(p)) n++
  return Math.min(4, n)
}
const STRENGTH = ['', 'ضعيفة', 'مقبولة', 'جيدة', 'قوية']

/** A staff member's own password follows the staff rules (12 characters…) */
export const staffRules = (p: string) => STAFF_PASS_RULES.filter((r) => r.key !== 'new').map((r) => ({ ok: r.test(p, ''), say: r.label }))

export function PassRules({ pass, user, staff }: { pass: string; user: string; staff?: boolean }) {
  const rules = staff ? staffRules(pass) : passRules(pass, user)
  const lvl = passStrength(pass, user)
  return (
    <>
      <span className={`lmeter s-${lvl}`} aria-hidden="true"><i /><i /><i /><i /></span>
      {pass && rules.every((r) => r.ok)
        ? <span className="lrule ok"><Icon name={icons.check} size="sm" />كلمة المرور مناسبة · قوتها <b>{STRENGTH[lvl]}</b></span>
        : <ul className="lrules">
            {rules.map((r) => (
              <li key={r.say} className={`lrule${r.ok ? ' ok' : ''}`}>
                {r.ok ? <Icon name={icons.check} size="sm" /> : <i className="lrule-dot" aria-hidden="true" />}{r.say}
              </li>
            ))}
          </ul>}
    </>
  )
}

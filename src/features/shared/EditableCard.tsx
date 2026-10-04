import { Glass, Head, Icon, icons, Tag } from '@/components/ui'
import { editRule, type EditModule } from '@/data/editable'

/* «ما يُعدَّل الآن» · meeting 1 Oct, item A-6.

   Every detail page states, for the record's current state, who holds it, what they may still
   change and what an approval has already locked. Stated as text so it doesn't rely on a field
   merely looking grey — and read from one map (`@/data/editable`) so two pages can't disagree. */

export function EditableCard({ module, state, label }: { module: EditModule; state: string; label?: string }) {
  const rule = editRule(module, state)
  if (!rule) return null
  return (
    <Glass>
      <Head
        title="ما يُعدَّل في هذه الحالة"
        meta={label ? <Tag tone="mute">{label}</Tag> : undefined}
      />
      <p className="sub cnote">
        بيد <b>{rule.who}</b>
        {rule.why && <> · {rule.why}</>}
      </p>
      {rule.edit.length > 0 ? (
        <ul className="payq-ck mt-2">
          {rule.edit.map((x) => (
            <li key={x} className="ok">
              <Icon name={icons.edit} size="sm" />
              <span>{x}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sub cnote">لا يُعدَّل شيء في هذه الحالة.</p>
      )}
      {rule.locked.length > 0 && (
        <ul className="payq-ck mt-2 edlock">
          {rule.locked.map((x) => (
            <li key={x}>
              <Icon name={icons.lock} size="sm" />
              <span>{x}</span>
            </li>
          ))}
        </ul>
      )}
    </Glass>
  )
}

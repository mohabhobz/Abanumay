import { Person } from '@/components/ui'
import { staffNames } from '@/data/people'

/* Shared services · the pieces the escalation, notifications and audit pages share. */

/** A person's face beside a staff name · a desk, an entity or a role stays text (rule 7) */
export function Who({ name }: { name: string }) {
  return staffNames().includes(name) ? <Person name={name} /> : <span>{name || '—'}</span>
}

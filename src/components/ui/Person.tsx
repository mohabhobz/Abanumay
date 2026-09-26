import { isNobody, isPerson, person } from '@/data/people'

/* Person · face and name together.

   The name alone can be read, and the face can be recognized. In a list of five reviewers who all
   start with the same letter, telling them apart comes from **shape**, not from reading the line to
   the end — that's the difference between picking by glance and picking by comparison.

   Warning: **one component for every place a person appears.** If every screen drew its own avatar,
   sizes and corners would differ for the same thing — exactly the pattern the whole system was
   unified to get away from.

   Warning: **initials are deliberately neutral — no per-person color.** The temptation is for each
   face to get a color derived from its name, but the cost is a **new color family with no key**:
   chart colors are reserved for categories, status colors are reserved for status, and a third set
   stepping in between would make green on screen mean three different things. The real photo is
   what actually distinguishes people; the initial is just a placeholder until the photo loads. */

export interface PersonProps {
  /** Name as stored in the data · the record turns it into a face */
  name: string | null | undefined
  /** Text shown when there is no person (no owner · unassigned) */
  empty?: string
  /** 28px by default · `lg` = 34 for the decision bar and the account menu */
  size?: 'sm' | 'md' | 'lg'
  /** Face only, no name · for narrow cells */
  bare?: boolean
  /** Dims the name like `.sub` · the default in cards and cells */
  quiet?: boolean
}

/** Face only · reuses the same `.av`/`.pht` box as the account menu */
export function Face({ name, size = 'sm' }: { name: string; size?: PersonProps['size'] }) {
  const p = person(name)
  const box = size === 'lg' ? '34' : size === 'md' ? '30' : '28'
  const title = p.title ? `${p.name}، ${p.title}` : p.name
  if (p.photo) return <img className={`pht pht-${box}`} src={p.photo} alt="" title={title} />
  return <span className={`av av-${box}`} title={title} aria-hidden="true">{p.initial}</span>
}

export function Person({ name, empty = 'بلا مالك', size = 'sm', bare, quiet = true }: PersonProps) {
  /* Warning: "unassigned" is **not a person**, so it gets no face. An initials avatar on a value
     like this reads as a person literally named "unassigned." */
  if (!isPerson(name)) {
    /* Warning: **a role is shown by its name.** "Grants supervisor" is not "unassigned": a role has
       no face, but it does have a name. `empty` is only for values that are genuinely empty. */
    return <span className={quiet ? 'sub' : undefined}>{isNobody(name) ? empty : name!.trim()}</span>
  }
  const p = person(name)
  if (bare) return <Face name={p.name} size={size} />
  return (
    <span className={`prs prs-${size}`}>
      <Face name={p.name} size={size} />
      <span className={quiet ? 'prs-n sub' : 'prs-n'}>{p.name}</span>
    </span>
  )
}

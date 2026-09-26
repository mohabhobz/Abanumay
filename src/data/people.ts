/* People registry · a single source for face and name.

   People across the whole system are recorded as text — an owner field is a string, an actor field
   is a string, and a roster list is an array of strings. So there's no actual record for a person,
   and anything beyond a name (photo, initials, title) has nowhere to live.

   This file is that place. The key stays the name, so no existing data line needs to change, and
   the record attaches to it.

   Photos are picked up from a folder, not a list here. A build-time glob reads a dedicated assets
   folder, so adding a new face means dropping a file into that folder named by its slug — no
   import, no line to update, no one needing to remember this file exists. A missing one just falls
   back to its initials on its own. */

/** Photos dropped into the people assets folder · keyed by filename without extension */
const PHOTOS: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob('../assets/people/*.{jpg,jpeg,png,webp}', {
      eager: true,
      query: '?url',
      import: 'default',
    }) as Record<string, string>,
  ).map(([path, url]) => [path.replace(/^.*\/([^/]+)\.\w+$/, '$1'), url]),
)

export interface Person {
  name: string
  /** Two characters: first letter of the first name and first letter of the surname */
  initial: string
  /** Image filename in the people assets folder */
  slug?: string
  photo?: string
  /** Job title · shown in the tooltip, not in the line */
  title?: string
}

/* The slug is Latin while the name is Arabic. The filename gets typed in the terminal, in git, and
   in any build tool, and Arabic in a filename breaks in half of them. So the record links the two,
   and the folder stays Latin. */
const ROSTER: ReadonlyArray<Omit<Person, 'photo' | 'initial'> & { initial?: string }> = [
  /* Grants officers · same order as the roster list in the taxonomy file */
  { name: 'عمر قاسم', slug: 'omar-qasim', title: 'مشرف المنح' },
  { name: 'سعود البريكان', slug: 'saud-albraikan', title: 'مشرف المنح' },
  { name: 'عزام الخريف', slug: 'azzam-alkhereiji', title: 'مشرف المنح' },
  { name: 'أحمد العبداللطيف', slug: 'ahmed-alabdullatif', title: 'مشرف المنح' },
  { name: 'حصة النملة', slug: 'hessa-alnamlah', title: 'مشرفة المنح' },

  /* Approval chain */
  { name: 'عبدالله الدوسري', slug: 'abdullah-aldosari', title: 'مدير المنح' },
  { name: 'عبدالرحمن الهليّل', slug: 'abdulrahman-alhulail', title: 'المدير التنفيذي' },
  /* This name is written in the history file without one diacritic — both refer to the same person */
  { name: 'عبدالرحمن الهليل', slug: 'abdulrahman-alhulail', title: 'المدير التنفيذي' },
  { name: 'تركي الخنيزان', slug: 'turki-alkhunaizan', title: 'مدير الإدارة' },
  { name: 'محمد المطيري', slug: 'mohammed-almutairi', title: 'الإدارة المالية' },
  { name: 'سلطان العتيبي', slug: 'sultan-alotaibi', title: 'الإدارة المالية' },

  /* AI assistant personas */
  { name: 'ريم الشمري', slug: 'reem-alshammari', title: 'محللة بيانات' },
  { name: 'د. فهد العمري', slug: 'fahd-alomari', title: 'مستشار' },
]

/**
 * Two characters: first letter of the first name and first letter of the surname.
 *
 * Not a single character. Five names in the registry start with the same letter, so a single
 * initial would produce five identical avatars, and an avatar that can't tell people apart is
 * decoration, not information.
 */
export const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter((w) => w !== 'د.' && w !== 'أ.')
  if (parts.length === 0) return '؟'
  const first = parts[0].charAt(0)
  if (parts.length === 1) return first
  /* The surname is usually prefixed with the definite article · the letter after it differentiates more */
  const last = parts[parts.length - 1].replace(/^ال/, '')
  return first + (last.charAt(0) || '')
}

const BY_NAME = new Map<string, Person>(
  ROSTER.map((r) => {
    const p: Person = {
      name: r.name,
      slug: r.slug,
      title: r.title,
      initial: r.initial ?? initials(r.name),
      photo: r.slug ? PHOTOS[r.slug] : undefined,
    }
    return [r.name, p]
  }),
)

/* "No person" values aren't people. The data uses the same field for "unowned", "unassigned", "the
   system", "the entity", and "the executive committee" — these are roles or states, and giving them
   an initials avatar would make them read as if they were a person with that name. */
const NOT_A_PERSON = new Set([
  'بلا مالك', 'غير مُسنَد', 'غير مسند', 'النظام', 'الجهة',
  'اللجنة التنفيذية', 'لجنة المنح', 'مجلس الأمناء', 'المالية',
  'إدارة المنح', 'الإدارة المالية', 'مدير المشروع', 'المدير التنفيذي للجهة',
  /* Roles aren't people. "Grants officer" was rendering with an initials avatar on new entity
   documents — a role with no name is text, like "the system" */
  'مشرف المنح', 'مدير المنح', 'مسؤول النظام', 'المدير التنفيذي', 'القسم المالي',
  'الاتصال المؤسسي', 'المؤسسة',
])

/** "No one" · this is the only value replaced with the placeholder text `empty`. Every other value
 * is a role and is written out by its own name. */
const NOBODY = new Set(['بلا مالك', 'غير مُسنَد', 'غير مسند'])
export const isNobody = (name: string | null | undefined): boolean =>
  !name || !name.trim() || NOBODY.has(name.trim())

export const isPerson = (name: string | null | undefined): name is string =>
  Boolean(name && name.trim() && !NOT_A_PERSON.has(name.trim()))

/**
 * Lookup by name.
 *
 * A name not in the roster isn't a bug: entity staff are randomly generated from a name pool, so
 * they come back with just their initials and no photo — which is the correct look for a person
 * with no profile in the system.
 */
export const person = (name: string): Person =>
  BY_NAME.get(name.trim()) ?? { name: name.trim(), initial: initials(name) }

/** Faces still without a photo · printed by an internal script */
export const missingPhotos = (): string[] =>
  [...new Set(ROSTER.filter((r) => r.slug && !PHOTOS[r.slug]).map((r) => r.slug!))]

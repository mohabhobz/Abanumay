/* ═══════════════════════════════════════════════════════════
   سجلّ الأشخاص · **مصدر واحد للوش والاسم**.

   الأشخاص في النظام كله مكتوبين **كنصّ** — `row.owner` سلسلة،
   و`e.by` سلسلة، وقايمة `OWNERS` مصفوفة سلاسل. يعني مفيش سجلّ
   لشخص أصلًا، وأي حاجة زيادة على الاسم (صورة · حروف أوّلية ·
   مسمّى) مالهاش مكان تتحطّ فيه.

   الملف ده هو المكان ده. المفتاح فضل الاسم — عشان ما نلمسش
   ولا سطر من الداتا الموجودة — والسجلّ بيتعلّق بيه.

   ⚠️ **والصور بتتلقّط من المجلّد لا من قايمة هنا.** `import.meta.glob`
   بيقرا `src/assets/people/` وقت البِناء، فإضافة وش جديد =
   **رمي ملف في المجلّد باسم الـslug**، بلا `import` ولا سطر
   يتحدَّث ولا حدّ يفتكر الملف ده. والناقص بيرجع لحروفه الأوّلية
   لوحده.
   ═══════════════════════════════════════════════════════════ */

/** الصور المرمية في `src/assets/people/` · المفتاح = اسم الملف بلا امتداد */
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
  /** حرفان: أول الاسم وأول اللقب */
  initial: string
  /** اسم ملف الصورة في `src/assets/people/` */
  slug?: string
  photo?: string
  /** المسمّى الوظيفي · بيتعرض في التلميح لا في السطر */
  title?: string
}

/* ⚠️ **الـslug لاتيني والاسم عربي.** اسم الملف بيتكتب في الطرفية
   وفي الـgit وفي أي أداة بِناء، والعربي في اسم ملف بيتكسر في
   نصّهم. فالسجلّ بيربط الاتنين، والمجلّد بيفضل لاتينيًّا. */
const ROSTER: ReadonlyArray<Omit<Person, 'photo' | 'initial'> & { initial?: string }> = [
  /* مشرفو المنح · نفس ترتيب `OWNERS` في `taxonomy.ts` */
  { name: 'عمر قاسم', slug: 'omar-qasim', title: 'مشرف المنح' },
  { name: 'سعود البريكان', slug: 'saud-albraikan', title: 'مشرف المنح' },
  { name: 'عزام الخريف', slug: 'azzam-alkhereiji', title: 'مشرف المنح' },
  { name: 'أحمد العبداللطيف', slug: 'ahmed-alabdullatif', title: 'مشرف المنح' },
  { name: 'حصة النملة', slug: 'hessa-alnamlah', title: 'مشرفة المنح' },

  /* سلسلة الاعتماد */
  { name: 'عبدالله الدوسري', slug: 'abdullah-aldosari', title: 'مدير المنح' },
  { name: 'عبدالرحمن الهليّل', slug: 'abdulrahman-alhulail', title: 'المدير التنفيذي' },
  /* الاسم ده مكتوب في `log.ts` بلا شدّة على اللام · الاتنين نفس الشخص */
  { name: 'عبدالرحمن الهليل', slug: 'abdulrahman-alhulail', title: 'المدير التنفيذي' },
  { name: 'تركي الخنيزان', slug: 'turki-alkhunaizan', title: 'مدير الإدارة' },
  { name: 'محمد المطيري', slug: 'mohammed-almutairi', title: 'القسم المالي' },
  { name: 'سلطان العتيبي', slug: 'sultan-alotaibi', title: 'القسم المالي' },

  /* شخصيات المساعد الذكي */
  { name: 'ريم الشمري', slug: 'reem-alshammari', title: 'محللة بيانات' },
  { name: 'د. فهد العمري', slug: 'fahd-alomari', title: 'مستشار' },
]

/**
 * حرفان: أول الاسم وأول اللقب.
 *
 * ⚠️ **مش حرفًا واحدًا.** خمسة من أسماء السجلّ بيبدأوا بعين
 * (عمر · عزام · عبدالله · عبدالرحمن · عبداللطيف) — فحرف واحد
 * بيدّي خمس أفاتارات متطابقة، والأفاتار اللي ما بيفرّقش
 * زخرفة لا معلومة.
 */
export const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter((w) => w !== 'د.' && w !== 'أ.')
  if (parts.length === 0) return '؟'
  const first = parts[0].charAt(0)
  if (parts.length === 1) return first
  /* اللقب غالبًا «ال…» · حرف بعد أداة التعريف بيفرّق أكتر */
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

/* ⚠️ **قيم «مفيش شخص» مش أشخاص.** الداتا بتحطّ في نفس الخانة
   «بلا مالك» و«غير مُسنَد» و«النظام» و«الجهة» و«اللجنة التنفيذية»
   — ودي أدوار أو حالات، ولو أخدت أفاتار بحروف أوّلية بتتقرا
   كأنها بني آدم اسمه كده. */
const NOT_A_PERSON = new Set([
  'بلا مالك', 'غير مُسنَد', 'غير مسند', 'النظام', 'الجهة',
  'اللجنة التنفيذية', 'لجنة المنح', 'مجلس الأمناء', 'المالية',
  'إدارة المنح', 'الإدارة المالية', 'مدير المشروع', 'المدير التنفيذي للجهة',
])

export const isPerson = (name: string | null | undefined): name is string =>
  Boolean(name && name.trim() && !NOT_A_PERSON.has(name.trim()))

/**
 * السجلّ من الاسم.
 *
 * الاسم اللي مش في `ROSTER` **مش خطأ**: موظّفو الجهات بيتولّدوا
 * عشوائيًّا من مخزن أسماء، فبيرجعوا بحروفهم الأوّلية بلا صورة —
 * وده الشكل الصحيح لشخص مالوش ملفّ في النظام.
 */
export const person = (name: string): Person =>
  BY_NAME.get(name.trim()) ?? { name: name.trim(), initial: initials(name) }

/** الوشوش اللي لسّه بلا صورة · بتتطبع في `tools/people.mjs` */
export const missingPhotos = (): string[] =>
  [...new Set(ROSTER.filter((r) => r.slug && !PHOTOS[r.slug]).map((r) => r.slug!))]

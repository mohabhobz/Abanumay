/**
 * Number and date formatting — one place so every screen displays them
 * the same way.
 */

/**
 * Every number in the system uses Latin digits (0–9), even inside
 * Arabic text. This isn't a stylistic choice: users copy these numbers
 * into emails, spreadsheets, and correspondence, and Arabic-Indic
 * digits break on transfer and make visually comparing two rows harder.
 * The rule is uniform, with no exceptions.
 */
export const nf = new Intl.NumberFormat('en-US')

/** Date in Arabic, with Latin digits. */
export const df = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
})

/**
 * Short date: "April 12, 2026." `df` also includes the weekday, which
 * is useful in the log ("Sunday") but becomes noise in a data row — the
 * date here is a fact, not an event.
 */
export const dfShort = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
  day: 'numeric', month: 'long', year: 'numeric',
})

/** Time in Arabic with Latin digits: "11:40 AM." */
export const tf = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
  hour: 'numeric', minute: '2-digit',
})

/**
 * Date and time: "September 22, 2026 · 11:40 AM."
 *
 * For comments and notes, not data dates. A comment is an event, and
 * two written the same day can't be told apart without the time — while
 * a data date (founding, licensing) has no meaningful time, so it
 * stays with `readDate`.
 */
export const readDateTime = (iso: string): string => {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return iso
  /* The time is one unit inside isolation: `isolate` isolates each group
     of digits on its own, so "10:20" would split into "10" and "20" with
     the colon between them taking the Arabic line's direction, reading as
     "20:10." Here, the whole time sits inside a single isolation, while
     the date is isolated normally. */
  const clock = tf.format(dt).replace(/\d{1,2}:\d{2}/, (m) => `\u2066${m}\u2069`)
  return `${isolate(dfShort.format(dt))} · ${clock}`
}

/** Current time in local `YYYY-MM-DDTHH:mm` format — for timestamping comments. */
export const nowStamp = (): string => {
  const d = new Date()
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`
}

/** Accepts `2026-04-12` or `12/4/2026` and returns a readable date. */
export const readDate = (value: string): string => {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const dt = iso
    ? new Date(value)
    : (() => {
        const [dd, mm, yy] = value.split('/').map(Number)
        return new Date(yy, mm - 1, dd)
      })()
  return Number.isNaN(dt.getTime()) ? value : dfShort.format(dt)
}

/** Date plus a number of days = the resulting date. */
export const addDays = (value: string, days: number): string => {
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return value
  dt.setDate(dt.getDate() + days)
  return dt.toISOString().slice(0, 10)
}

export const money = (n: number): string => nf.format(n)

export const percent = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((part / whole) * 100)

/**
 * A percentage ready to embed inside an Arabic sentence.
 *
 * The number is Latin, but that alone isn't enough: the bidi algorithm
 * places the `%` sign according to the direction of the surrounding
 * sentence, so "94%" inside Arabic text renders as "%94." These
 * characters (LRI … PDI) lock the number and its sign inside an island
 * with a fixed direction. In JSX this isolation is handled by `.num` in
 * CSS; this function is for text built as a plain string before it
 * reaches the DOM.
 */
export const pct = (n: number): string => `\u2066${n}%\u2069`
/**
 * Version number "V2" — the Latin prefix stays attached to its number
 * inside a single island (same idea as `pct`). It used to be
 * `V<span class="num">2</span>`, with the V outside the island landing
 * to the right of the number in the Arabic sentence: "2V."
 */
export const ver = (n: number): string => `\u2066V${n}\u2069`

/**
 * \u064a\u0639\u0632\u0644 \u0643\u0644 \u0631\u0642\u0645 \u062f\u0627\u062e\u0644 \u0646\u0635 \u0639\u0631\u0628\u064a \u062c\u0627\u0647\u0632.
 *
 * `pct` \u0628\u062a\u0634\u062a\u063a\u0644 \u0644\u0645\u0627 \u0625\u062d\u0646\u0627 \u0627\u0644\u0644\u064a \u0628\u0646\u0631\u0643\u0651\u0628 \u0627\u0644\u062c\u0645\u0644\u0629. \u0644\u0643\u0646 \u0641\u064a\u0647 \u0646\u0635\u0648\u0635 \u062c\u0627\u064a\u0629 \u0632\u064a \u0645\u0627
 * \u0647\u064a \u0645\u0646 \u0648\u062b\u064a\u0642\u0629 \u0627\u0644\u0639\u0645\u064a\u0644 \u2014 \u0635\u064a\u063a \u0627\u0644\u0645\u0624\u0634\u0631\u0627\u062a \u0645\u062b\u0644\u064b\u0627: \u00ab\u2026 \u00f7 \u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0634\u0627\u0631\u064a\u0639 \u00d7
 * 100%.\u00bb \u2014 \u0648\u0645\u0627 \u064a\u0646\u0641\u0639\u0634 \u0646\u0639\u064a\u062f \u0643\u062a\u0627\u0628\u062a\u0647\u0627. \u0627\u0644\u062f\u0627\u0644\u0629 \u062f\u064a \u0628\u062a\u0644\u0641\u0651 \u0643\u0644 \u062a\u0633\u0644\u0633\u0644 \u0631\u0642\u0645\u064a
 * (\u0648\u0645\u0639\u0627\u0647 \u0639\u0644\u0627\u0645\u0629 \u0627\u0644\u0646\u0633\u0628\u0629 \u0644\u0648 \u0645\u0644\u0627\u0635\u0642\u0629) \u0641\u064a \u062c\u0632\u064a\u0631\u0629 \u0627\u062a\u062c\u0627\u0647\u0647\u0627 \u062b\u0627\u0628\u062a\u060c \u0641\u0627\u0644\u0646\u0635
 * \u0628\u064a\u0641\u0636\u0644 \u062d\u0631\u0641\u064a\u064b\u0651\u0627 \u0632\u064a \u0627\u0644\u0648\u062b\u064a\u0642\u0629 \u0648\u0627\u0644\u0631\u0642\u0645 \u0628\u064a\u062a\u0631\u0633\u0645 \u0635\u062d.
 */
export const isolate = (text: string): string =>
  text.replace(/\d[\d,.]*(?:\s?%)?/g, (m) => `\u2066${m}\u2069`)

/**
 * Displayed project code: `PRJ-2026-00013`. Upper case like every other code in the system
 * (PAR-, PF-, AG-, CL-, SR-), so codes read as one family.
 *
 * The current system displays a bare sequential number (`20940`) that
 * says nothing about the year or type, and once copied into an email
 * becomes a number with no identity. This code carries the type, year,
 * and sequence, and is always laid out at the same width so the eye can
 * compare two rows stacked on top of each other.
 *
 * The identifier in the URL and API stays the raw number. The code is a
 * display format, not a key: changing it would break every saved link,
 * and require translating in both directions with the backend for no benefit.
 */
export const projectCode = (id: string, year?: string): string =>
  `PRJ-${(year ?? '').slice(0, 4) || '____'}-${id.padStart(5, '0')}`

/**
 * Displayed entity (partner) code: `PAR-2019-00712`.
 *
 * Year = the entity's registration year, serial = the entity id zero-padded to five digits. Like
 * the project code it is a display format only; URLs and the API keep the raw id.
 */
export const entityCode = (id: string, registeredAt?: string): string =>
  `PAR-${(registeredAt ?? '').slice(0, 4) || '____'}-${id.padStart(5, '0')}`

/** Accepts the full code or any part of it in search. */
export const matchesCode =(needle: string, id: string, year?: string): boolean =>
  projectCode(id, year).includes(needle.trim().toUpperCase())

/** Cost per beneficiary — the metric used to compare projects. */
export const costPerBeneficiary = (amount: number, beneficiaries: number): number =>
  beneficiaries === 0 ? 0 : Math.round(amount / beneficiaries)

/** Truncates long text while keeping the last word intact. */
export const trim = (text: string, max = 90): string =>
  text.length <= max ? text : `${text.slice(0, text.lastIndexOf(' ', max))}…`

/**
 * First letter for an entity's text logo.
 *
 * Strips the generic word ("Association/Foundation/Center") and the
 * definite article "Al-" — otherwise every entity would get the same
 * letter and the logos would be useless.
 */
export const initial = (name: string): string =>
  name
    .replace(/^(جمعية|مؤسسة|مركز|هيئة|لجنة|وقف)\s+/, '')
    .replace(/^ال/, '')
    .charAt(0)

/**
 * Arabic plural form.
 *
 * Arabic has five plural forms, and an interface that says "1 projects"
 * reads like a machine translation. This function takes the forms and
 * returns the correct one, along with the highlighted text so the
 * emphasis matches the text exactly.
 */
export interface PluralForms {
  /** One */
  one: string
  /** Two */
  two: string
  /** 3–10 */
  few: (n: number) => string
  /** 11 or more */
  many: (n: number) => string
}

export const plural = (n: number, f: PluralForms): string => {
  if (n === 1) return f.one
  if (n === 2) return f.two
  const mod = n % 100
  return mod >= 3 && mod <= 10 ? f.few(n) : f.many(n)
}

/**
 * Noun following a number displayed on its own (`<Num>` before it) —
 * "1 missing item" · "3 missing items" · "11 missing items." The number
 * stays visible so the eye catches it from a distance, and the noun
 * inflects with it ("1 missing items" and "3 missing item" used to
 * appear on the closing and agreements screens).
 */
export const nounAfter = (n: number, f: { one: string; few: string; many: string }): string => {
  const mod = n % 100
  /* "one hundred days" · "101 days" — after hundreds, the noun takes the
     genitive singular, not the accusative. */
  if (n <= 2 || mod <= 2) return f.one
  return mod >= 3 && mod <= 10 ? f.few : f.many
}
export const MISSING_ITEM = { one: 'بند ناقص', few: 'بنود ناقصة', many: 'بندًا ناقصًا' }
export const REQUEST_NOUN = { one: 'طلب', few: 'طلبات', many: 'طلبًا' }
/* Nouns following a number displayed on its own used to be hand-written
   in one fixed form regardless of the count ("3 entity" · "4 year" ·
   "10 day" · "5 item"), and that mismatch was found across 62 places.
   Each noun now has a single form here, and screens call
   `nounAfter(n, NOUN.x)`. */
export const NOUN = {
  day: { one: 'يوم', few: 'أيام', many: 'يومًا' },
  entity: { one: 'جهة', few: 'جهات', many: 'جهة' },
  year: { one: 'سنة', few: 'سنوات', many: 'سنة' },
  category: { one: 'فئة', few: 'فئات', many: 'فئة' },
  source: { one: 'مصدر', few: 'مصادر', many: 'مصدرًا' },
  budget: { one: 'ميزانية', few: 'ميزانيات', many: 'ميزانية' },
  request: REQUEST_NOUN,
  line: { one: 'بند', few: 'بنود', many: 'بندًا' },
  doc: { one: 'مستند', few: 'مستندات', many: 'مستندًا' },
  entry: { one: 'قيد', few: 'قيود', many: 'قيدًا' },
  plan: { one: 'خطة', few: 'خطط', many: 'خطة' },
  agreement: { one: 'اتفاقية', few: 'اتفاقيات', many: 'اتفاقية' },
  charity: { one: 'جمعية', few: 'جمعيات', many: 'جمعية' },
  city: { one: 'مدينة', few: 'مدن', many: 'مدينة' },
  region: { one: 'منطقة', few: 'مناطق', many: 'منطقة' },
  payment: { one: 'دفعة', few: 'دفعات', many: 'دفعة' },
  phase: { one: 'مرحلة', few: 'مراحل', many: 'مرحلة' },
  activity: { one: 'نشاط', few: 'أنشطة', many: 'نشاطًا' },
  project: { one: 'مشروع', few: 'مشاريع', many: 'مشروعًا' },
  type: { one: 'تصنيف', few: 'تصنيفات', many: 'تصنيفًا' },
  report: { one: 'تقرير', few: 'تقارير', many: 'تقريرًا' },
  level: { one: 'مستوى', few: 'مستويات', many: 'مستوى' },
  option: { one: 'خيار', few: 'خيارات', many: 'خيارًا' },
  row: { one: 'صف', few: 'صفوف', many: 'صفًّا' },
  note: { one: 'ملاحظة', few: 'ملاحظات', many: 'ملاحظة' },
  /* The blind spots that the expanded dictionary caught. */
  column: { one: 'عمود', few: 'أعمدة', many: 'عمودًا' },
  filter: { one: 'فلتر', few: 'فلاتر', many: 'فلترًا' },
  chart: { one: 'رسم', few: 'رسوم', many: 'رسمًا' },
  kind: { one: 'نوع', few: 'أنواع', many: 'نوعًا' },
  procedure: { one: 'إجراء', few: 'إجراءات', many: 'إجراءً' },
  beneficiary: { one: 'مستفيد', few: 'مستفيدين', many: 'مستفيدًا' },
  section: { one: 'قسم', few: 'أقسام', many: 'قسمًا' },
  indicator: { one: 'مؤشر', few: 'مؤشرات', many: 'مؤشرًا' },
  describedColumn: { one: 'عمود موصوف', few: 'أعمدة موصوفة', many: 'عمودًا موصوفًا' },
  /* Noun plus adjective — the adjective inflects with the count just like
     the noun ("open projects" · "an open project"), so both are handled
     in a single form. */
  openProject: { one: 'مشروع مفتوح', few: 'مشاريع مفتوحة', many: 'مشروعًا مفتوحًا' },
  requiredDoc: { one: 'مستند إلزامي', few: 'مستندات إلزامية', many: 'مستندًا إلزاميًا' },
  sentRequest: { one: 'طلب مرسَل', few: 'طلبات مرسَلة', many: 'طلبًا مرسَلًا' },
  finalReport: { one: 'تقرير ختامي', few: 'تقارير ختامية', many: 'تقريرًا ختاميًا' },
  pendingPayment: { one: 'دفعة معلّقة', few: 'دفعات معلّقة', many: 'دفعة معلّقة' },
  lateActivity: { one: 'نشاط متأخّر', few: 'أنشطة متأخّرة', many: 'نشاطًا متأخّرًا' },
  missingDoc: { one: 'مستند ناقص', few: 'مستندات ناقصة', many: 'مستندًا ناقصًا' },
} as const
/**
 * A unit written as text alongside a value (`{ value, unit: 'day' }`) —
 * the generic component (reading text, card, map, report builder)
 * doesn't know the noun, so the unit used to be written in one fixed
 * form regardless of the count. This function recognizes the first
 * word from the dictionary above and returns it inflected for the
 * count, leaving the rest unchanged. A unit not in the dictionary is
 * returned as-is.
 */
export const unitAfter = (n: number | string, unit: string): string => {
  const v = typeof n === 'number' ? n : Number(String(n).replace(/[,\u2066-\u2069]/g, ''))
  if (!Number.isFinite(v) || !unit) return unit
  const whole = [...Object.values(NOUN), MISSING_ITEM].find((x) => x.one === unit || x.few === unit || x.many === unit)
  if (whole) return nounAfter(v, whole)
  const [w, ...rest] = unit.split(' ')
  const f = Object.values(NOUN).find((x) => !x.one.includes(' ') && (x.one === w || x.few === w || x.many === w))
  return f ? [nounAfter(v, f), ...rest].join(' ') : unit
}
/**
 * Value with its unit as text — a "%" sign stays inside its number's
 * island (`pct`), not a following word.
 */
export const withUnit = (n: number, unit: string): string =>
  unit === '%' ? pct(n) : `${nf.format(n)} ${unitAfter(n, unit)}`
/**
 * "3 entities" · "11 entities" — the number is isolated and the noun
 * inflected — for plain text (not JSX).
 */
export const countOf = (n: number, f: { one: string; few: string; many: string }): string =>
  `${nf.format(n)} ${nounAfter(n, f)}`

/**
 * Recurring units used in reading text.
 *
 * `gen` = the form after a preposition ("min yawmayn," not "min
 * yawman"). Arabic changes the dual form depending on its grammatical
 * position, and a sentence like "from 2 day" or a mismatched dual gives
 * away that the text was auto-generated.
 */
const two = (nom: string, gen: string, isGen: boolean) => (isGen ? gen : nom)

export const units = {
  project: (n: number, gen = false) => plural(n, {
    one: 'مشروع واحد', two: two('مشروعان', 'مشروعين', gen),
    few: (x) => `${x} مشاريع`, many: (x) => `${x} مشروعًا`,
  }),
  entity: (n: number, gen = false) => plural(n, {
    one: 'جهة واحدة', two: two('جهتان', 'جهتين', gen),
    few: (x) => `${x} جهات`, many: (x) => `${x} جهة`,
  }),
  day: (n: number, gen = false) => plural(n, {
    one: 'يوم واحد', two: two('يومان', 'يومين', gen),
    few: (x) => `${x} أيام`, many: (x) => `${x} يومًا`,
  }),
  doc: (n: number, gen = false) => plural(n, {
    one: 'مستند واحد', two: two('مستندان', 'مستندين', gen),
    few: (x) => `${x} مستندات`, many: (x) => `${x} مستندًا`,
  }),
  case: (n: number, gen = false) => plural(n, {
    one: 'حالة واحدة', two: two('حالتان', 'حالتين', gen),
    few: (x) => `${x} حالات`, many: (x) => `${x} حالة`,
  }),
  line: (n: number, gen = false) => plural(n, {
    one: 'بند واحد', two: two('بندان', 'بندين', gen),
    few: (x) => `${x} بنود`, many: (x) => `${x} بندًا`,
  }),
  source: (n: number, gen = false) => plural(n, {
    one: 'مصدر واحد', two: two('مصدران', 'مصدرين', gen),
    few: (x) => `${x} مصادر`, many: (x) => `${x} مصدرًا`,
  }),
  month: (n: number, gen = false) => plural(n, {
    one: 'شهر واحد', two: two('شهران', 'شهرين', gen),
    few: (x) => `${x} أشهر`, many: (x) => `${x} شهرًا`,
  }),
  year: (n: number, gen = false) => plural(n, {
    one: 'سنة واحدة', two: two('سنتان', 'سنتين', gen),
    few: (x) => `${x} سنوات`, many: (x) => `${x} سنة`,
  }),
  reading: (n: number, gen = false) => plural(n, {
    one: 'قراءة واحدة', two: two('قراءتان', 'قراءتين', gen),
    few: (x) => `${x} قراءات`, many: (x) => `${x} قراءة`,
  }),
  /* Plan — "1 phases" and "0 activity" used to be written literally on
     the plan card, and zero especially reads wrong: "0 activity" would
     mean the plan is empty, when the correct phrasing is "no activities." */
  phase: (n: number, gen = false) => plural(n, {
    one: 'مرحلة واحدة', two: two('مرحلتان', 'مرحلتين', gen),
    few: (x) => `${x} مراحل`, many: (x) => `${x} مرحلة`,
  }),
  activity: (n: number, gen = false) => plural(n, {
    one: 'نشاط واحد', two: two('نشاطان', 'نشاطين', gen),
    few: (x) => `${x} أنشطة`, many: (x) => `${x} نشاطًا`,
  }),
  /* A non-breaking space — the symbol used to fall alone as an orphan on
     the next line. */
  riyal: (n: number) => `${nf.format(n)}\u00A0⃁`,
}

/* Amount spelled out in words.

   This isn't decoration. A disbursement order is a document that goes
   to the bank, and a digit that's off by one place reads wrong with
   nothing to catch it — the words are what anchors the number, which is
   why every disbursement voucher anywhere is written twice.

   Supported range goes up to the millions: the largest grant in the
   current system is under ten million, so there's no need for billions
   or fractions (all payments are whole riyal amounts). */

const ONES = [
  '', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة',
  'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر',
  'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر',
]
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون']
const HUNDREDS = [
  '', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة',
  'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة',
]

/** Numbers under a thousand, spelled out. */
function under1000(n: number): string {
  const parts: string[] = []
  const h = Math.floor(n / 100)
  const rest = n % 100
  if (h) parts.push(HUNDREDS[h]!)
  if (rest < 20) {
    if (rest) parts.push(ONES[rest]!)
  } else {
    const u = rest % 10
    const t = Math.floor(rest / 10)
    /* Arabic says "one and twenty" — the ones place comes before the tens. */
    parts.push(u ? `${ONES[u]} و${TENS[t]}` : TENS[t]!)
  }
  return parts.join(' و')
}

/** Unit form by count — dual, plural of paucity, and plural of abundance. */
function unitOf(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one
  if (n === 2) return two
  if (n % 100 >= 3 && n % 100 <= 10) return `${under1000(n)} ${few}`
  return `${under1000(n)} ${many}`
}

/**
 * Amount in Arabic words — "only two hundred thousand riyals and no
 * more" gets built around it. Returns the number without "only" or
 * "and no more" — whoever uses it adds those.
 */
export function riyals(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return 'صفر ريال'
  const amount = Math.round(n)

  const mil = Math.floor(amount / 1_000_000)
  const th = Math.floor((amount % 1_000_000) / 1000)
  const rest = amount % 1000

  const parts: string[] = []
  if (mil) parts.push(unitOf(mil, 'مليون', 'مليونان', 'ملايين', 'مليونًا'))
  /* Uses the dual construct form ("alfā"), not the standalone dual
     ("alfān"), in a genitive construct — "mi'ata alf" (two hundred
     thousand), not "mi'atān alf." */
  if (th) parts.push(unitOf(th, 'ألف', 'ألفان', 'آلاف', 'ألفًا'))
  if (rest) parts.push(under1000(rest))

  return `${parts.join(' و')} ريال`
}

import type { EntityRow } from '@/types/domain'
import { BANKS, ENTITY_DOCS } from './taxonomy'

/**
 * ملف الجهة المشتقّ — التعريف والاتصال والأشخاص والمستندات
 * والحسابات البنكية وسجل الجهة.
 *
 * **ليه مولَّد لا مكتوب:** نفس سبب `detail.ts` في المشاريع. صفحة
 * الجهة كانت بتعرض تسعة حقول من أصل **٣٥** موجودين في النظام
 * العامل، فالكلاينت يفتح أي جهة ويلاقي الملف نص فاضي — مش لأن
 * التصميم ناقص لكن لأن الداتا مش موجودة. الملف ده بيبني الباقي من
 * الصف نفسه، فكل جهة في النموذج تبقى قابلة للتجربة.
 *
 * **مطابقة للنظام العامل** — الحقول والمجموعات دي مقروءة من موديول
 * الجهات في ١٧ سبتمبر ٢٠٢٦ (راجع `Abanumay_System_Live_Audit.md`
 * قسم ٦):
 *
 *  - التعريف ٩ · الاتصال ٤ · الأشخاص ٥ · المستندات ٨ · النظام ٦
 *  - الحسابات البنكية بأعمدتها الثمانية، وستة بنوك، و**سبعة أسباب
 *    رفض مقنّنة** — النظام ما بيسيبش سبب الرفض نصًّا حرًّا.
 *  - الإجراء على الجهة: «قبول و تفعيل» / «رفض وإيقاف» ومعاه
 *    **ملاحظة إدارية إلزامية**.
 *
 * **القاعدة الحاكمة** (زي المشاريع): التفاصيل بتتبع **حالة الجهة**.
 * الجهة الجديدة مالهاش حساب بنكي مفعّل ولا سجل قرارات؛ الموقوفة
 * سجلها بينتهي بقيد إيقاف وسببه؛ والمقبولة القديمة لها الدورة كلها.
 *
 * ⚠️ كل اسم ورقم هنا **وهمي** — المستودع عام. اللي حقيقي هو البنية.
 *
 * لما الباك اند يجهز: `GET /entities/:id/detail` بنفس الشكل،
 * والملف ده يتشال.
 */

/* ═══════════════════ الأنواع ═══════════════════ */

export interface EntityDoc {
  name: string
  uploaded: boolean
  /** تاريخ الرفع — للمرفوع بس */
  at?: string
  /** تاريخ الانتهاء للمستندات اللي ليها صلاحية */
  expires?: string
  /** انتهت صلاحيته وهو مرفوع — أسوأ من الناقص لأنه بيعدّي بالنظرة */
  expired?: boolean
}

export interface BankAccount {
  id: string
  bank: string
  shortName: string
  accountName: string
  iban: string
  status: 'مفعل' | 'غير مفعل' | 'بانتظار التفعيل'
  /** سبب الرفض — واحد من السبعة المقنّنة، للمرفوض بس */
  reason?: string
  certificate: string
  attachment?: string
}

export type EntityEventKind = 'reg' | 'accept' | 'reject' | 'stop' | 'edit' | 'bank' | 'doc'

export interface EntityEvent {
  id: string
  kind: EntityEventKind
  action: string
  by: string
  at: string
  time: string
  /** الملاحظة الإدارية — إلزامية على القبول والرفض في النظام */
  note?: string
  fields?: { k: string; v: string }[]
}

export interface EntityDetail {
  /* التعريف */
  foundedAt: string
  licenseEndsAt: string
  licenseExpired: boolean
  boardMandateEndsAt: string
  boardExpired: boolean
  exceptionGeneral: boolean
  exceptionWaqf: boolean
  /* الاتصال */
  phone: string
  website: string
  /* الأشخاص */
  directorName: string
  directorMobile: string
  clerkName: string
  clerkMobile: string
  clerkEmail: string
  /* النظام */
  updatedAt: string
  userNo: string
  username: string
  accountType: string
  adminNote: string
  /* الملفات */
  docs: EntityDoc[]
  banks: BankAccount[]
  log: EntityEvent[]
}

/* ═══════════════════ البذرة ═══════════════════ */

/** نفس الجهة تدّي نفس الملف في كل تحميل — وإلا الأرقام بتتغيّر تحت إيد الكلاينت */
const seeded = (id: string) => {
  let h = 7
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0
    return h / 0x100000000
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const dmy = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
const shift = (isoDate: string, days: number) => {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + days)
  return d
}

/* أسماء وهمية — تركيب سعودي مألوف بلا ما يقصد شخصًا بعينه */
const FIRST = ['عبدالله', 'محمد', 'سلطان', 'خالد', 'فهد', 'ناصر', 'سعود', 'بندر', 'ماجد', 'تركي']
const LAST = ['القحطاني', 'العتيبي', 'الدوسري', 'الشمري', 'الحربي', 'المطيري', 'الزهراني', 'الغامدي']

const NOTES_ACCEPT = [
  'الملف مكتمل والترخيص ساري — قُبلت الجهة وفُعّل حسابها.',
  'استُكملت المستندات الناقصة بعد المراجعة، وفُعّل الحساب.',
  'روجعت اللائحة الأساسية ومحضر المجلس، ولا ملاحظة — قُبلت.',
]
const NOTES_STOP = [
  'أُوقفت لانتهاء صلاحية الترخيص، وتُستأنف بعد رفع الترخيص المجدّد.',
  'أُوقفت لعدم استكمال المستندات المطلوبة خلال المهلة.',
  'أُوقفت بناءً على ملاحظة على القوائم المالية المدققة.',
]

/**
 * أسباب رفض الحساب البنكي — **سبعة مقنّنة** في النظام العامل.
 * محطوطة هنا كقائمة مقفولة عمدًا: ده نمط بنعمّمه، والرفض بسبب
 * مختار بيتحلّل وبيتقارن، والرفض بنصّ حرّ بيفضل حبيسًا في الصف.
 */
export const BANK_REJECT_REASONS = [
  'إلغاء الحساب بناءً على طلب الجمعية',
  'الحساب لا يعود للجمعية',
  'الحساب مفعل مسبقًا',
  'عدم تطابق اسم الحساب مع الشهادة',
  'عدم تطابق الآيبان مع الشهادة',
  'عدم وجود الآيبان في المرفق',
  'عدم وضوح المرفق',
] as const

export const ACCOUNT_TYPES = ['جهة مستفيدة', 'جهة مستفيدة — وقفية', 'جهة حكومية'] as const

/* ═══════════════════ المولّد ═══════════════════ */

export function entityDetail(e: EntityRow): EntityDetail {
  const rnd = seeded(e.id)
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1))

  const stopped = e.activation.startsWith('معلق') || e.activation === 'مرفوض'
  const fresh = e.activation === 'معلق (جديد)'

  /* التأسيس قبل التسجيل عندنا بسنتين لسبع — الجهة بتسجّل عندنا بعد
     ما تشتغل، مش يوم ما تتأسس. */
  const founded = shift(e.registeredAt, -int(2, 7) * 365 - int(0, 300))
  /* الترخيص بيتجدّد كل خمس سنين، والمنتهي بيوقف التعاقد — فبنخلّي
     جزءًا من الجهات فعلًا منتهي الترخيص عشان الحالة دي تتشاف. */
  const licenseEnds = shift(e.registeredAt, int(1, 6) * 365 + int(0, 200))
  const licenseExpired = licenseEnds.getTime() < Date.now()
  const boardEnds = shift(e.registeredAt, int(2, 8) * 365)
  const boardExpired = boardEnds.getTime() < Date.now()

  const director = `${pick(FIRST)} ${pick(LAST)}`
  const clerk = `${pick(FIRST)} ${pick(LAST)}`

  /* ── المستندات ──
     العدد المرفوع بييجي من الصف نفسه (`docsUploaded`) عشان الرقم
     اللي في الجدول والشريط ما يخالفش القايمة اللي جوّه. */
  const docs: EntityDoc[] = ENTITY_DOCS.map((name, i) => {
    const uploaded = i < e.docsUploaded
    if (!uploaded) return { name, uploaded: false }
    const at = iso(shift(e.registeredAt, int(0, 400)))
    /* التلاتة الأولى بس ليها صلاحية — الترخيص والسجل والزكاة */
    if (i > 2) return { name, uploaded: true, at }
    const exp = shift(at, int(200, 900))
    return { name, uploaded: true, at, expires: iso(exp), expired: exp.getTime() < Date.now() }
  })

  /* ── الحسابات البنكية ──
     الجهة الجديدة مالهاش حساب مفعّل: التفعيل إجراء بيحصل بعد
     القبول، فحسابها بيفضل «بانتظار التفعيل». */
  const bankCount = fresh ? 1 : int(1, 3)
  const banks: BankAccount[] = Array.from({ length: bankCount }, (_, i) => {
    const bank = BANKS[(Number(e.id) + i) % BANKS.length]
    const status: BankAccount['status'] = fresh
      ? 'بانتظار التفعيل'
      : i === 0
        ? 'مفعل'
        : rnd() < 0.55 ? 'غير مفعل' : 'مفعل'
    return {
      id: `${e.id}-b${i + 1}`,
      bank,
      shortName: e.name.split(' ').slice(0, 2).join(' '),
      accountName: e.name,
      /* آيبان وهمي بشكل صحيح (SA + ٢٢ رقم) بس بأرقام غير حقيقية */
      iban: `SA${pad(int(10, 99))}XXXX${String(int(1000, 9999))}XXXXXXXXXXXX`,
      status,
      reason: status === 'غير مفعل' ? pick(BANK_REJECT_REASONS) : undefined,
      certificate: `شهادة-بنكية-${bank.replace(/\s/g, '-')}.pdf`,
      attachment: rnd() < 0.7 ? `خطاب-تفويض-${e.id}.pdf` : undefined,
    }
  })

  /* ── سجل الجهة ──
     نفس منطق سجل المشروع: القيد له نوع وحمولة، مش سطر نصّ. */
  const log: EntityEvent[] = []
  const at = (d: Date) => ({ at: dmy(d), time: `${pad(int(8, 15))}:${pad(int(0, 59))}` })
  const staff = () => `${pick(FIRST)} ${pick(LAST)}`

  const dReg = new Date(e.registeredAt)
  log.push({
    id: 'reg',
    kind: 'reg',
    action: 'تسجيل جهة جديدة',
    by: clerk,
    ...at(dReg),
    fields: [
      { k: 'التصنيف', v: e.type },
      { k: 'الجهة المرخِّصة', v: e.licensor },
      { k: 'رقم الترخيص', v: e.licenseNo },
      { k: 'المنطقة', v: `${e.region} · ${e.city}` },
    ],
  })

  if (!fresh) {
    const dAccept = shift(e.registeredAt, int(2, 21))
    log.push({
      id: 'accept',
      kind: 'accept',
      action: 'قبول و تفعيل',
      by: staff(),
      ...at(dAccept),
      note: pick(NOTES_ACCEPT),
      fields: [{ k: 'حالة التفعيل', v: 'مقبول' }],
    })

    const activated = banks.filter((b) => b.status === 'مفعل')
    if (activated.length) {
      log.push({
        id: 'bank-on',
        kind: 'bank',
        action: 'تفعيل حساب بنكي',
        by: staff(),
        ...at(shift(iso(dAccept), int(1, 30))),
        fields: [
          { k: 'المصرف', v: activated[0].bank },
          { k: 'اسم الحساب', v: activated[0].accountName },
          { k: 'الآيبان', v: activated[0].iban },
        ],
      })
    }

    const refused = banks.find((b) => b.status === 'غير مفعل')
    if (refused) {
      log.push({
        id: 'bank-off',
        kind: 'bank',
        action: 'رفض حساب بنكي',
        by: staff(),
        ...at(shift(iso(dAccept), int(20, 120))),
        note: refused.reason,
        fields: [
          { k: 'المصرف', v: refused.bank },
          { k: 'سبب الرفض', v: refused.reason ?? '—' },
        ],
      })
    }

    if (e.activation === 'محدث' || rnd() < 0.5) {
      log.push({
        id: 'edit',
        kind: 'edit',
        action: 'تحديث بيانات الجهة',
        by: clerk,
        ...at(shift(iso(dAccept), int(60, 400))),
        fields: [
          { k: 'الحقل المعدَّل', v: rnd() < 0.5 ? 'جوال المدير التنفيذي' : 'اسم المدير التنفيذي' },
          { k: 'الحالة', v: 'بانتظار مراجعة المشرف' },
        ],
      })
    }
  }

  if (stopped) {
    log.push({
      id: 'stop',
      kind: e.activation === 'مرفوض' ? 'reject' : 'stop',
      action: e.activation === 'مرفوض' ? 'رفض وإيقاف' : 'إيقاف الجهة',
      by: staff(),
      ...at(shift(e.registeredAt, int(120, 700))),
      note: pick(NOTES_STOP),
      fields: [{ k: 'حالة التفعيل', v: e.activation }],
    })
  }

  /* الأحدث فوق — بترتيب **التاريخ الفعلي** لا ترتيب البناء.
     القيود بتتبني بمنطق الحالة لا بالزمن (الإيقاف بيتبني آخر حاجة
     وتاريخه ممكن يبقى أقدم من تحديث البيانات)، و`d/m/yyyy` نصًّا
     بيترتّب أبجديًا فـ«5/5» بتيجي قبل «15/5». فالمقارنة بالوقت. */
  const ts = (e: EntityEvent) => {
    const [dd, mm, yy] = e.at.split('/').map(Number)
    const [h, mi] = e.time.split(':').map(Number)
    return new Date(yy, mm - 1, dd, h, mi).getTime()
  }
  log.sort((a, b) => ts(b) - ts(a))

  const last = log[0]

  return {
    foundedAt: iso(founded),
    licenseEndsAt: iso(licenseEnds),
    licenseExpired,
    boardMandateEndsAt: iso(boardEnds),
    boardExpired,
    exceptionGeneral: rnd() < 0.18,
    exceptionWaqf: e.type === 'وقفية',
    phone: '011XXXXXXX',
    website: `https://${e.type === 'وقفية' ? 'waqf' : 'org'}-${e.id}.example.org`,
    directorName: director,
    directorMobile: '9665XXXXXXXX',
    clerkName: clerk,
    clerkMobile: '9665XXXXXXXX',
    clerkEmail: `clerk-${e.id}@example.org`,
    updatedAt: last ? last.at : dmy(new Date(e.registeredAt)),
    userNo: `U-${e.id}`,
    username: `dept${e.id}`,
    accountType: e.type === 'وقفية' ? ACCOUNT_TYPES[1] : ACCOUNT_TYPES[0],
    adminNote: last?.note ?? '—',
    docs,
    banks,
    log,
  }
}

import type { EntityRow } from '@/types/domain'
import { BANKS, ENTITY_DOCS } from './taxonomy'

/**
 * Derived entity file · identification, contact, people, documents, bank accounts, and entity history.
 *
 * Generated rather than hand-written: the entity page shows only 9 of the 35 fields tracked by the
 * live system, so opening any entity would reveal mostly empty content — not from incomplete design
 * but missing data. This file derives the rest from the row itself, so every entity stays
 * explorable.
 *
 * Field counts mirror the live system: identification 9, contact 4, people 5, documents 8, system
 * 6. Bank accounts have 8 columns, 6 banks, and 7 standardized rejection reasons (no free-text
 * rejection). Entity actions are "Accept & Activate" / "Reject & Suspend", each requiring a
 * mandatory admin note.
 *
 * Governing rule: details follow entity status. A new entity has no active bank account or decision
 * history; a suspended entity's history ends with a suspension entry and reason; an accepted legacy
 * entity has the full cycle.
 *
 * All names and numbers here are fictional; only the structure is real.
 *
 * Once the backend is ready, GET /entities/:id/detail will return the same shape and this file can
 * be removed.
 */

/* Types */

export interface EntityDoc {
  name: string
  uploaded: boolean
  /** Upload date · only for uploaded documents */
  at?: string
  /** Expiry date for documents that have one */
  expires?: string
  /** Expired while still marked as uploaded · worse than missing since it passes at a glance */
  expired?: boolean
}

export interface BankAccount {
  id: string
  bank: string
  shortName: string
  accountName: string
  iban: string
  status: 'مفعل' | 'غير مفعل' | 'بانتظار التفعيل'
  /** Rejection reason · one of the seven standardized reasons, only for rejected documents */
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
  /** Admin note · mandatory on both accept and reject actions */
  note?: string
  fields?: { k: string; v: string }[]
}

export interface EntityDetail {
  /* Identification */
  foundedAt: string
  licenseEndsAt: string
  licenseExpired: boolean
  boardMandateEndsAt: string
  boardExpired: boolean
  exceptionGeneral: boolean
  exceptionWaqf: boolean
  /* Contact */
  phone: string
  website: string
  /* People */
  directorName: string
  directorMobile: string
  clerkName: string
  clerkMobile: string
  clerkEmail: string
  /* System */
  updatedAt: string
  userNo: string
  username: string
  accountType: string
  adminNote: string
  /* Files */
  docs: EntityDoc[]
  banks: BankAccount[]
  log: EntityEvent[]
}

/* Seed */

/** The same entity produces the same file on every load, otherwise the numbers would shift while
 * the client is looking at them */
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
const shift = (isoDate: string, days: number) => {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + days)
  return d
}

/* Fictional names · a familiar Saudi naming pattern, not referring to any real person */
const FIRST = ['عبدالله', 'محمد', 'سلطان', 'خالد', 'فهد', 'ناصر', 'سعود', 'بندر', 'ماجد', 'تركي']
const LAST = ['القحطاني', 'العتيبي', 'الدوسري', 'الشمري', 'الحربي', 'المطيري', 'الزهراني', 'الغامدي']

const NOTES_ACCEPT = [
  'الملف مكتمل والترخيص سارٍ، فقُبلت الجهة وفُعّل حسابها.',
  'استُكملت المستندات الناقصة بعد المراجعة، وفُعّل الحساب.',
  'روجعت اللائحة الأساسية ومحضر المجلس دون ملاحظات، وقُبلت الجهة.',
]
const NOTES_STOP = [
  'أُوقفت لانتهاء صلاحية الترخيص، وتُستأنف بعد رفع الترخيص المجدّد.',
  'أُوقفت لعدم استكمال المستندات المطلوبة خلال المهلة.',
  'أُوقفت بسبب ملاحظة على القوائم المالية المدققة.',
]

/**
 * Bank account rejection reasons · the seven standardized values used by the live system.
 * Kept as a deliberately closed list: a reason picked from a fixed set can be analyzed and
 * compared, while free-text rejection stays locked inside the row.
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

export const ACCOUNT_TYPES = ['جهة مستفيدة', 'جهة مستفيدة، وقفية', 'جهة حكومية'] as const

/* Generator */

export function entityDetail(e: EntityRow): EntityDetail {
  const rnd = seeded(e.id)
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1))

  const stopped = e.activation.startsWith('معلق') || e.activation === 'مرفوض'
  const fresh = e.activation === 'معلق (جديد)'

  /* Founding date is one to seven years before registration with us — an entity registers after it's
   already operating, not on the day it's founded. */
  const founded = shift(e.registeredAt, -int(2, 7) * 365 - int(0, 300))
  /* License expiry is NOT generated. It used to be `shift(e.registeredAt, int(1,6) * 365 +
   int(0,200))`, which tied the license to the entity's registration date with us — but that's not
   what it represents. The license renews every five years with the licensing authority, and its age
   has nothing to do with the entity's registration date.

     The result was a visible contradiction on screen: an entity registered in 2016, with
     "excellent" governance, "accepted" status, and 11 projects — next to "License expiry: 2019",
     i.e. ten years without a single renewal. The generated number had no awareness of the status
     shown beside it.

     It is now a field on `EntityRow` that is read and rendered like any other data point, and the
     expired state appears on three entities deliberately, so it can be seen. */
  const licenseEnds = new Date(e.licenseEndsAt)
  const licenseExpired = licenseEnds.getTime() < Date.now()
  const boardEnds = shift(e.registeredAt, int(2, 8) * 365)
  const boardExpired = boardEnds.getTime() < Date.now()

  const director = `${pick(FIRST)} ${pick(LAST)}`
  const clerk = `${pick(FIRST)} ${pick(LAST)}`

  /* Documents
     The uploaded count comes from the row itself (`docsUploaded`) so the number in the table and
     the progress bar never contradicts the list inside. */
  const docs: EntityDoc[] = ENTITY_DOCS.map((name, i) => {
    const uploaded = i < e.docsUploaded
    if (!uploaded) return { name, uploaded: false }
    const at = iso(shift(e.registeredAt, int(0, 400)))
    /* Only the first three have an expiry date · license, registration, and zakat certificate */
    if (i > 2) return { name, uploaded: true, at }
    const exp = shift(at, int(200, 900))
    return { name, uploaded: true, at, expires: iso(exp), expired: exp.getTime() < Date.now() }
  })

  /* Bank accounts
     A new entity has no active account: activation happens after acceptance, so its account stays
     "pending activation". */
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
      /* A validly formatted fake IBAN (SA + 22 digits) using non-real numbers */
      iban: `SA${pad(int(10, 99))}XXXX${String(int(1000, 9999))}XXXXXXXXXXXX`,
      status,
      reason: status === 'غير مفعل' ? pick(BANK_REJECT_REASONS) : undefined,
      certificate: `شهادة-بنكية-${bank.replace(/\s/g, '-')}.pdf`,
      attachment: rnd() < 0.7 ? `خطاب-تفويض-${e.id}.pdf` : undefined,
    }
  })

  /* Entity history
     Same logic as project history: an entry has a type and payload, not a text line. */
  const log: EntityEvent[] = []
  const at = (d: Date) => ({ at: iso(d), time: `${pad(int(8, 15))}:${pad(int(0, 59))}` })
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
          { k: 'سبب الرفض', v: refused.reason ?? 'غير مسجَّل' },
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
          { k: 'الحالة', v: 'بانتظار مشرف المنح' },
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

  /* Most recent first · ordered by actual date, not build order.
     Entries are built by status logic, not chronologically (the suspension entry is built last and
     its date can be earlier than the latest data update), and `d/m/yyyy` as a string sorts
     alphabetically, so "5/5" comes before "15/5". Hence comparing by time value. */
  const ts = (e: EntityEvent) => {
    const [h, mi] = e.time.split(':').map(Number)
    const d = new Date(e.at)
    d.setHours(h, mi)
    return d.getTime()
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
    exceptionWaqf: e.type === 'وقف',
    phone: '011XXXXXXX',
    website: `https://${e.type === 'وقف' ? 'waqf' : 'org'}-${e.id}.example.org`,
    directorName: director,
    directorMobile: '9665XXXXXXXX',
    clerkName: clerk,
    clerkMobile: '9665XXXXXXXX',
    clerkEmail: `clerk-${e.id}@example.org`,
    updatedAt: last ? last.at : iso(new Date(e.registeredAt)),
    userNo: `U-${e.id}`,
    username: `dept${e.id}`,
    accountType: e.type === 'وقف' ? ACCOUNT_TYPES[1] : ACCOUNT_TYPES[0],
    adminNote: last?.note ?? 'لا توجد ملاحظات',
    docs,
    banks,
    log,
  }
}

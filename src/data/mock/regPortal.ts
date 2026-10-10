import type { Reading } from '@/components/assistant/reading'
import { REG_DOCS, type RegState } from './registration'
import type { ThreadMessage } from './detail'
import { MISSING_ITEM, nounAfter } from '@/lib/format'

/* Entity portal · the entity's account and its request status.

   This is a deliberate, documented exception to the rule that there's no account before approval,
   which used to be read literally: the entity would submit its request and disappear until an email
   arrived. As a result the most common state in the system (pending completion) ran entirely on
   email: an email saying something is missing, the entity replying with an attachment, and a
   reviewer attaching it by hand.

   The rule still holds: the entity has no account in the system. What changed is that it now has an
   account for its own request:

   Entity account (portal): sees only its own request; created at registration; scope limited to one
   request.
   Approved entity account (system): sees its projects, payments, and agreements; generated after
   approval; scope covers the entity's full file.

   That distinction has to stay visible on the screen itself, because an entity opening the portal
   and seeing one request needs to understand this isn't "the system is incomplete" — it's all they
   have until the request is approved. */

/** What the entity sees in its portal · one status and the action required of it */
export interface PortalView {
  state: RegState
  /** The sentence shown in the header */
  say: string
  /**
   * The action required of the entity right now · empty means none.
   *
   * "No action" doesn't always mean "wait": rejected is final, and approved gets a whole system to
   * log into. A final state labeled "wait" tells the entity something more is coming, when nothing
   * is.
   */
  act: string
  waiting?: boolean
  tone: 'mute' | 'warn' | 'ret' | 'ok' | 'no'
  /** Can the request still be edited? · pending completion is the only such state */
  editable: boolean
}

export const portalViewOf = (s: RegState): PortalView => {
  switch (s) {
    case 'draft':
      return {
        state: s, tone: 'mute', editable: true,
        say: 'الطلب مسودة · لم يُرسل إلى المؤسسة بعد',
        act: 'أكمل البيانات وأرسل الطلب',
      }
    case 'review':
      return {
        state: s, tone: 'warn', editable: false, waiting: true,
        say: 'الطلب قيد المراجعة لدى المؤسسة',
        act: '',
      }
    case 'completion':
      return {
        state: s, tone: 'ret', editable: true,
        say: 'أعادت المؤسسة الطلب لاستكمال النواقص',
        act: 'ارفع الناقص أو عدّل ما عليه ملاحظة، ثم أعد الإرسال',
      }
    case 'approved':
      return {
        state: s, tone: 'ok', editable: false,
        say: 'اعتُمد الطلب · وسُجّلت الجهة في النظام',
        act: 'ادخل إلى حساب الجهة الكامل',
      }
    default:
      return {
        state: s, tone: 'no', editable: false,
        say: 'اعتذرت المؤسسة عن قبول الطلب · السبب مذكور أدناه',
        act: '',
      }
  }
}

/* Notifications sent to the entity.

   Email on every transition, SMS only for confirmation. The OTP is sent once to the entity's phone
   to prove the submitter owns the registered number — after that everything goes by email, since
   email can carry a link and SMS can't. */
export interface RegMail {
  on: RegState | 'submitted' | 'otp'
  to: 'email' | 'mobile'
  title: string
  body: string
}

export const REG_MAILS: RegMail[] = [
  {
    on: 'otp', to: 'mobile',
    title: 'رمز التحقق من الطلب',
    body: 'رمز من 6 أرقام يُرسل إلى جوال الجهة المسجَّل · للتحقق من أن الطلب مُرسل من صاحب الرقم.',
  },
  {
    on: 'submitted', to: 'email',
    title: 'استلمت المؤسسة الطلب',
    body: 'رقم الطلب ورابط بوابة المنح · لتتأكد الجهة من وصول الطلب فعلًا، ولا تبقى في انتظار غير معلوم.',
  },
  {
    on: 'completion', to: 'email',
    title: 'الطلب بحاجة إلى استكمال',
    body: 'الملاحظة والنواقص بأسمائها، ورابط يفتح الطلب في البوابة مباشرةً.',
  },
  {
    on: 'approved', to: 'email',
    title: 'اعتُمد الطلب',
    body: /* doc rule 2 */ 'بيانات الدخول إلى حساب الجهة الكامل: يُنشأ الحساب عند الاعتماد لا قبله.',
  },
  {
    on: 'rejected', to: 'email',
    title: 'صدر قرار في الطلب',
    body: /* doc rule 28 */ 'مع ذكر السبب · ويُؤرشف الطلب ولا يُحذف.',
  },
]

/* Assistant in the portal.

   With every step it flags where the problems are; if a file is uploaded, it says whether that file
   looks fine or has an issue.

   The assistant advises, it doesn't block. What blocks submission is missing required fields alone,
   computed from the fields themselves, not from the assistant's opinion. If the assistant blocked,
   the user would be up against an opinion rather than a rule — and no one can argue with an
   opinion.

   The assistant's judgment on a document is about its form, not its content. It reads the file
   name, extension, and size, it doesn't open the document. So it says "this doesn't look like the
   required document" rather than "this license has expired" — that distinction has to be in the
   wording itself, or the entity will think the document was actually reviewed. */

export type AdviceTone = 'ok' | 'warn' | 'no'

export interface Advice {
  key: string
  tone: AdviceTone
  say: string
  /** How to fix it · empty if the line is reassurance */
  fix?: string
}

/** Formal check on the file name · says "looks like", not "is" */
export const docAdvice = (docKey: string, fileName: string): Advice => {
  const d = REG_DOCS.find((x) => x.key === docKey)
  const label = d?.label ?? docKey
  const ext = (fileName.split('.').pop() ?? '').toLowerCase()

  if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) {
    return {
      key: `${docKey}-ext`, tone: 'no',
      say: `الامتداد .${ext} غير مقبول في «${label}».`,
      fix: 'ارفع ملف PDF أو صورة · هذا فحص لنوع الملف لا لمحتواه.',
    }
  }
  if (ext !== 'pdf') {
    return {
      key: `${docKey}-scan`, tone: 'warn',
      say: `«${label}» صورة لا PDF · وهي مقبولة، لكن الصورة لا تُقرأ آليًا.`,
      fix: 'إن توفرت نسخة PDF فارفعها بدلًا منها · فالمراجعة بها أسرع.',
    }
  }
  return {
    key: `${docKey}-ok`, tone: 'ok',
    say: `رُفع «${label}» · شكل الملف سليم.`,
    fix: 'ملاحظة: هذا الفحص على الملف لا على محتواه · والمراجِع هو من يقرأ المستند.',
  }
}

/* Assistant guidance per station.

   The difference from a plain "3 missing" badge on the card: the badge counts, the assistant
   explains why and how. "3 missing" makes the user hunt for which three; a line saying "license
   expiry date is empty, and that's what blocks contracting if it's expired" gives the reason along
   with the field.

   Line order is deliberate: the blocker comes first. Users read the first line or two and skip the
   rest, so if the reassuring line is on top and the blocker is below, they'll close it thinking
   they're done. */

export interface StageAdvice {
  /** Actually blocks submission · computed from the rules, not from an opinion */
  blocking: Advice[]
  /** Notes that improve the request without blocking it */
  notes: Advice[]
}

const MIN_PASS = 8

export const stageAdvice = (
  stage: string,
  val: Record<string, string>,
  short: string[],
  bankSays: string[],
  docNames: { key: string; name: string }[],
): StageAdvice => {
  const blocking: Advice[] = []
  const notes: Advice[] = []

  for (const label of short) {
    blocking.push({ key: `short-${label}`, tone: 'no', say: `لم يُعبَّأ «${label}» بعد.` })
  }

  if (stage === 'account') {
    const p = val.acctPass ?? ''
    const p2 = val.acctPass2 ?? ''
    if (p && p.length < MIN_PASS) {
      blocking.push({
        key: 'pass-short', tone: 'no',
        say: `كلمة المرور أقصر من ${MIN_PASS} أحرف.`,
        fix: 'يفتح هذا الحساب بيانات الجهة، لذا فالطول شرط لا اقتراح.',
      })
    }
    if (p && p2 && p !== p2) {
      blocking.push({ key: 'pass-diff', tone: 'no', say: 'كلمتا المرور غير متطابقتين. أعد كتابة التأكيد.' })
    }
    if (val.acctEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val.acctEmail)) {
      blocking.push({ key: 'mail-bad', tone: 'no', say: 'أدخل بريدًا إلكترونيًا صحيحًا، مثل name@org.sa' })
    }
    notes.push({
      key: 'acct-why', tone: 'ok',
      say: 'هذا الحساب خاص بطلبك فقط.',
      fix: 'يتيح حفظ الطلب والعودة إليه، ومتابعة حالته بعد الإرسال · أما حساب الجهة الكامل فيُنشأ بعد الاعتماد.',
    })
  }

  if (stage === 'contact') {
    /* This note appears **before** submission, not after: the entity needs to confirm the number
       they entered works while they're still in the field, not after the request is stuck on a code
       that never arrived. */
    notes.push({
      key: 'otp', tone: 'warn',
      say: 'بعد إكمال البيانات يُرسل رمز التحقق إلى جوال الجهة.',
      fix: 'تأكّد أن الرقم المُدخل أعلاه يعمل ومتاح الآن · لا يُرسل الطلب قبل إدخال الرمز.',
    })
  }

  if (stage === 'bank') {
    for (const say of bankSays) blocking.push({ key: `bank-${say}`, tone: 'no', say })
    notes.push({
      key: 'bank-why', tone: 'ok',
      say: 'يمكن إضافة حساب لكل وجه خير.',
      fix: 'يُسجَّل المشروع على حساب واحد منذ البداية، ولا تُقسَّم الدفعة على أكثر من حساب.',
    })
  }

  if (stage === 'docs') {
    for (const d of docNames) notes.push(docAdvice(d.key, d.name))
  }

  return { blocking, notes }
}

/* Station guidance as readings.

   The card that used to be here drew its own lines by hand. `ReadingBlock` is documented as the
   system's single renderer for this kind of guidance, after project analytics were found drawing
   their own blocks and duplicating the same information in two different shapes. The registration
   assistant had made the same mistake: its own list, tone, and color, so a user would see one style
   of assistant on the entity page and a different one during registration.

   This function converts the guidance into `Reading[]`, and rendering now goes through the same
   `AnalysisCard` — same highlight, same "review" label, same collapse behavior, same progressive
   text.

   Order is the message: the blocker comes first. A collapsed card previews `readings[0]`, so if the
   reassuring line is first, the user reads "all good", closes it, and misses four missing fields. */

/** A journey step · its name and what's missing in it */
export interface RegStepShort {
  key: string
  label: string
  short: string[]
}

export const regReadings = (
  stage: string,
  steps: RegStepShort[],
  advice: StageAdvice,
  goto: (key: string) => void,
): Reading[] => {
  const here = steps.find((s) => s.key === stage)
  /* The step the user is currently on is removed from "what's left" — its gaps already show above
     as lines, and repeating it below would suggest there are additional gaps */
  const left = steps.filter((s) => s.key !== stage && s.short.length > 0)
  const out: Reading[] = []

  advice.blocking.forEach((a, i) => {
    out.push({
      id: `b-${a.key}`,
      kind: 'flag',
      label: i === 0 ? here?.label : undefined,
      metric: i === 0
        ? { value: String(advice.blocking.length), unit: nounAfter(advice.blocking.length, MISSING_ITEM) }
        : undefined,
      text: a.fix ? `${a.say} ${a.fix}` : a.say,
      /* The source isn't decoration — it's what separates a rule from an opinion. Only required
         fields block submission, so the line explains that, rather than adding to it.

         And only on the first line. Repeating it under every line was literally duplicated three
         times on one card — a repeated source turns into background noise the eye tunes out, so it
         gets lost exactly when it differs. */
      src: i === 0 ? /* doc rule 21 */ 'الحقول الإلزامية للتصنيف الحالي' : undefined,
    })
  })

  advice.notes.forEach((a) => {
    out.push({
      id: `n-${a.key}`,
      kind: 'note',
      text: a.fix ? `${a.say} ${a.fix}` : a.say,
      /* The check covers the attachment as a file, not its content — wording that implies a real
         review would let the entity submit with false reassurance */
      src: a.key.endsWith('-ok') || a.key.endsWith('-scan') || a.key.endsWith('-ext')
        ? 'فحص شكل الملف · والمراجِع هو من يقرأ المستند'
        : undefined,
    })
  })

  for (const s of left) {
    out.push({
      id: `s-${s.key}`,
      kind: 'flag',
      label: s.label,
      metric: { value: String(s.short.length), unit: 'ناقص' },
      text: s.short.join(' · '),
      actions: [{ label: `افتح ${s.label}`, onClick: () => goto(s.key) }],
    })
  }

  if (out.length === 0 || (advice.blocking.length === 0 && left.length === 0)) {
    out.push({
      id: 'done',
      kind: 'note',
      label: 'مكتمل',
      text: 'اكتملت الحقول والمستندات الإلزامية للتصنيف الحالي · يمكن إرسال الطلب من الشريط أدناه.',
      src: 'محسوبة من الحقول لا من رأي المساعد',
    })
  }

  return out
}

/* A station's status in the stepper · written once, shared by both.

   "Nothing missing" doesn't mean "done". A station the user hasn't reached yet shouldn't get a
   checkmark, and the "bank accounts" station specifically has no computed required fields, so it
   used to show as complete while the user was still on the first station.

   The rule: checked = passed while clean. Anything ahead of that is `todo` regardless of its count,
   and the current one is `now`. */
export const stepState = (
  /** This station's order */
  at: number,
  /** The order of the station the user is currently on */
  here: number,
  /** Number of gaps in this station */
  short: number,
): 'done' | 'now' | 'todo' => {
  if (at === here) return 'now'
  if (at < here && short === 0) return 'done'
  return 'todo'
}

/* Request messaging · the channel the entity replies through.

   This channel isn't a general chat. The live system showed zero messages across dozens of
   projects, and the one thread that existed was entirely about a stuck receipt — meaning it only
   opens when an action is stuck on one side. So messages here are tied to request status: a request
   under review has no messages, and one returned with notes carries the reviewer's message under
   their name.

   An official note isn't a message. "What the organization requested" is a decision recorded on the
   request and stays visible on the card; a message is conversation between the two sides. Mixing
   them would bury the decision down in the thread. */
/** Shows sample messages in the thread · collapsed so the layout isn't built around an empty state */
const SEEDED = false

export const regThread = (state: RegState, name: string): ThreadMessage[] => {
  /* The channel starts empty — this is its normal look, not the exception (zero messages across
     dozens of projects in the live system), and the empty state is what the layout is built around.
     Messages below appear by switching `SEEDED` when a working thread needs to be shown in a demo. */
  if (!SEEDED) return []

  if (state === 'completion') {
    return [
      {
        by: 'مسؤول النظام', from: 'staff', at: '2026-09-02',
        body: 'راجعت المؤسسة الطلب، وتنقصه شهادة هيئة الزكاة والدخل وشهادة ضريبة القيمة المضافة. ارفعهما من البطاقة، ثم أعد إرسال الطلب لنستكمل المراجعة من حيث توقفنا.',
      },
      {
        by: name, from: 'entity', at: '2026-09-03',
        body: 'شكرًا لكم · شهادة الزكاة متوفرة لدينا، وشهادة الضريبة قيد الاستخراج وستكون جاهزة هذا الأسبوع.',
      },
    ]
  }
  if (state === 'rejected') {
    return [
      {
        by: 'مسؤول النظام', from: 'staff', at: '2026-09-05',
        body: /* doc rule 8 */ 'رقم الترخيص المسجَّل في الطلب يخص جهة أخرى بالتصنيف نفسه، و تمنع التكرار. أُرشف الطلب، ويمكن التقدّم مرة أخرى برقم ترخيص صحيح.',
      },
    ]
  }
  if (state === 'approved') {
    return [
      {
        by: 'مسؤول النظام', from: 'staff', at: '2026-09-08',
        body: 'اعتُمد الطلب · أُنشئ حساب الجهة الكامل، وأُرسلت بيانات الدخول إلى بريد الحساب.',
      },
    ]
  }
  return []
}

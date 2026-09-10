import type { ProjectRow, Tone } from '@/types/domain'
import { nf } from '@/lib/format'
import type { AgreementDetail, PaymentDetail, ProjectDetail } from './detail'

/**
 * سجل المشروع — الدورة كاملة، مولَّدة من حالة المشروع.
 *
 * **الاكتشاف اللي بنى الملف ده:** قيد السجل في النظام العامل مش
 * موحَّد. كل نوع إجراء له **حقوله**: «دراسة المشروع» فيه ٣٧ حقلًا
 * (عشرين معيار وزن وسبع إجابات نعم/لا وتوصية نصية طويلة)، و«صرف
 * الدفعة» فيه تلاتة، و«توصية» فيه واحد. فالسجل مش تايم لاين نصوص —
 * ده **سجل أحداث لكل حدث حمولته**.
 *
 * والفاعل نوعه بيفرق: موظف، ولا الجهة نفسها (بترفع السندات والتقارير
 * وبتقبل الاتفاقية)، ولا كيان جماعي («اللجنة التنفيذية» · «لجنة
 * المنح»)، ولا النظام (القيود اللي مالهاش «بواسطة»). أربعة أنواع
 * لازم يتفرّقوا بصريًا.
 *
 * والمتابعات **بتيجي جوّه نفس التايم لاين** مرتّبة بالتاريخ بين
 * إجراءات العمل — مش تاب منفصل. ده اللي النظام بيعمله فعلًا.
 *
 * المصدر: `12940` · `20191` · `12935` · `14982` — راجع
 * `Abanumay_Project_Tabs_Data.md`.
 *
 * ⚠️ نموذج. مكانه في الإنتاج `GET /projects/:id/log`.
 */

export type ActorKind = 'staff' | 'entity' | 'committee' | 'system'

export interface LogField {
  k: string
  v: string
  /** قيمة قرار لا تفصيلة — بتتبرز */
  strong?: boolean
}

export interface LogEvent {
  id: string
  /** «طلب استكمال» — بالظبط زي ما النظام بيسمّيه */
  action: string
  dept: string
  by: string
  actor: ActorKind
  at: string
  time: string
  /** المدة في القسم قبل الإجراء ده */
  days: number
  hours: number
  limit: number
  fields: LogField[]
  files?: string[]
  tone: Tone
  /** متابعة لا إجراء — نفس التايم لاين، وسم مختلف */
  followUp?: string
}

const LIMIT = 900

/** الحدّ ٩٠٠ ساعة ثابت على كل الأقسام في كل قيد قرأناه */
const HH = ['08:12', '09:17', '10:04', '11:35', '13:11', '14:29', '15:52', '16:18']

export interface LogInput {
  row: ProjectRow
  entityName: string
  detail: Pick<ProjectDetail, 'payments' | 'followUps' | 'agreement'>
}

/** باني السجل: بيضيف بالترتيب الزمني الصاعد وبيقلبه في الآخر */
class Builder {
  private out: LogEvent[] = []
  private day = 0
  private i = 0
  constructor(private start: Date) {}

  private stamp(add: number) {
    this.day += add
    const x = new Date(this.start)
    x.setDate(x.getDate() + this.day)
    return {
      at: `${x.getDate()}/${x.getMonth() + 1}/${x.getFullYear()}`,
      time: HH[this.i % HH.length],
    }
  }

  add(
    e: Omit<LogEvent, 'id' | 'at' | 'time' | 'days' | 'hours' | 'limit'> & { after: number },
  ) {
    const { after, ...rest } = e
    const { at, time } = this.stamp(after)
    this.out.push({
      ...rest,
      id: `lg-${this.i++}`,
      at,
      time,
      days: after,
      hours: after * 24,
      limit: LIMIT,
    })
  }

  /** الأحدث أولًا، زي النظام */
  done() {
    return [...this.out].reverse()
  }
}

const REACHED = [
  'استكمال بيانات المشروع', 'دراسة المشروع', 'اعتماد الإتفاقية',
  'اعتماد الإتفاقية الكترونيًا', 'الإتفاقيات الورقية', 'المشرف إذن الصرف',
  'إذن صرف معاد', 'اصدار سند الصرف', 'رفع سند القبض والقيد', 'رفع تقرير مرحلي',
  'طلب التقرير الختامي', 'رفع التقرير الختامي', 'اعتماد التقرير الختامي',
  'تقييم المشروع', 'مشروع مكتمل',
]

const got = (row: ProjectRow, stage: string) => {
  if (row.statusGroup === 'مكتمل') return true
  if (row.statusGroup === 'معتذر عنه') return false
  const a = REACHED.indexOf(row.stage)
  const b = REACHED.indexOf(stage)
  return a >= 0 && b >= 0 && a >= b
}

const yn = (v: boolean) => (v ? 'نعم' : 'لا')

export function projectLog({ row, entityName, detail }: LogInput): LogEvent[] {
  const b = new Builder(new Date(row.submittedAt || '2026-01-15'))
  const owner = row.owner ?? 'سعود البريكان'
  const manager = 'عبدالرحمن الهليل'
  const director = 'تركي الخنيزان'
  const finance = 'محمد المطيري'
  const grant = row.amountGranted || row.amountRequested
  const media = row.impact || grant >= 500_000

  /* ٠ · التحويل — ربع النظام بلا مالك، والتحويل بين الباحثين شائع.
     القيد ده بيحمل إعادة تصنيف كاملة زي ما شفناه في النظام. */
  if (row.owner) {
    b.add({
      after: 0,
      action: 'تحويل المشروع إلى باحث آخر',
      dept: 'دراسة المشروع',
      by: 'سلطان العتيبي',
      actor: 'staff',
      tone: 'mute',
      fields: [
        { k: 'المُحوَّل إليه', v: owner, strong: true },
        { k: 'السنة', v: `${row.year.slice(0, 4)} · ${row.funding === 'waqf' ? 'الوقف' : 'المؤسسة'}` },
        { k: 'المسار', v: row.track },
        { k: 'المجال', v: row.field },
        { k: 'الهدف', v: row.goal },
        { k: 'الملاحظات', v: 'المشروع ضمن تخصص الزميل، محوّل لاستكمال الدراسة.' },
      ],
    })
  }

  /* ١ · الدراسة عند المشرف — أضخم قيد في النظام */
  b.add({
    after: 2,
    action: 'دراسة المشروع',
    dept: 'دراسة المشروع',
    by: owner,
    actor: 'staff',
    tone: 'ret',
    fields: [
      { k: 'السنة', v: `${row.year.slice(0, 4)} · ${row.funding === 'waqf' ? 'الوقف' : 'المؤسسة'}` },
      { k: 'المجال', v: row.field },
      { k: 'الهدف', v: row.goal },
      { k: 'وزن المشروع', v: `${row.weight} من 100`, strong: true },
      { k: 'رأي الباحث', v: row.statusGroup === 'معتذر عنه' ? 'الاعتذار عن المشروع' : 'دعم المشروع', strong: true },
      { k: 'مبلغ الدعم الموصى به', v: nf.format(Math.round((grant * 1.16) / 1000) * 1000), strong: true },
      { k: 'عدد الدفعات', v: String(detail.payments.length || 1) },
      { k: 'مدة التنفيذ بالأيام', v: String(row.durationDays) },
      { k: 'عدد المستفيدين', v: nf.format(row.beneficiaries) },
      { k: 'هل يلزم تقرير مرحلي', v: yn(row.hasInterimReport) },
      { k: 'هل المشروع منح تشاركي', v: yn(row.shared) },
      { k: 'هل الإتفاقية الكترونية', v: yn(row.stage !== 'الإتفاقيات الورقية') },
      { k: 'زيارة ميدانية للمشروع', v: yn(row.fieldVisit) },
      {
        k: 'توصيات الباحث',
        v:
          `الجهة ${row.weight >= 85 ? 'ذات سجل جيد معنا' : 'جديدة علينا'} والمشروع في ` +
          `${row.region} وهي منطقة ${row.weight >= 80 ? 'محتاجة' : 'مخدومة نسبيًا'}. ` +
          `التكلفة ${row.beneficiaries > 0 ? `${nf.format(Math.round(row.amountRequested / Math.max(1, row.beneficiaries)))} ريالًا للمستفيد` : 'غير محسوبة لغياب عدد المستفيدين'}، ` +
          `وأرى ${row.statusGroup === 'معتذر عنه' ? 'الاعتذار لتكرار الدعم في نفس الهدف' : `منحهم ${nf.format(grant)} ريال`}.`,
      },
    ],
  })

  /* ٢ · مسار الاعتذار — خمسة قيود وخلاص */
  if (row.statusGroup === 'معتذر عنه') {
    b.add({
      after: 3, action: 'معتذر عنه', dept: 'اعتماد دراسة المشروع', by: manager,
      actor: 'staff', tone: 'no',
      fields: [
        { k: 'سبب الاعتذار', v: row.declineReason ?? 'الاكتفاء بالمشاريع المدعومة في الهدف', strong: true },
        { k: 'سبب الإعتذار عن دعم المشروع', v: 'ممارسة الجهة في هذا النوع من المشاريع ليست الأفضل، والجهة غير معروفة لدينا.' },
      ],
    })
    b.add({
      after: 86, action: 'رفض المشروع', dept: 'المشاريع المرفوضة', by: 'لجنة المنح',
      actor: 'committee', tone: 'no',
      fields: [
        { k: 'سبب الاعتذار', v: row.declineReason ?? 'الاكتفاء بالمشاريع المدعومة في الهدف', strong: true },
        { k: 'مبررات الرفض', v: `انتهاء المخصص لسنة ${row.year.slice(0, 4)}، ووجود فترة استقبال جديدة للسنة التالية.` },
        { k: 'الدروس المستفادة في الرفض', v: 'إبلاغ الجهة مبكرًا بحالة المخصص قبل استكمال الدراسة.' },
        { k: 'سبب التأخر في الإجراء', v: '.' },
      ],
    })
    b.add({
      after: 0, action: 'مشروع معتذر عنه', dept: 'مشروع معتذر عنه', by: 'النظام',
      actor: 'system', tone: 'mute',
      fields: [{ k: 'الحالة', v: 'مشروع معتذر عنه', strong: true }],
    })
    return merge(b.done(), detail.followUps)
  }

  /* ٢ب · طلب الاستكمال — الوحيد اللي سببه نص حرّ في النظام، بينما
     الاعتذار ورفض الحساب البنكي أسبابهم مقنّنة. */
  if (row.stage === 'استكمال بيانات المشروع' || row.hoursInStage > row.stageLimit) {
    b.add({
      after: 4,
      action: 'طلب استكمال',
      dept: 'دراسة المشروع',
      by: owner,
      actor: 'staff',
      tone: 'warn',
      fields: [
        { k: 'الملاحظات', v: 'كرمًا تحديث البيانات وإرفاق الموازنة التفصيلية ثم إرجاع المشروع بعد الحفظ.' },
        { k: 'سبب التأخر في الإجراء', v: '.' },
      ],
    })
  }

  /* ٣ · الاعتماد */
  if (!got(row, 'اعتماد الإتفاقية') && row.stage !== 'دراسة المشروع') {
    b.add({
      after: 7, action: 'إرجاع المشروع للباحث', dept: 'اعتماد دراسة المشروع', by: manager,
      actor: 'staff', tone: 'warn',
      fields: [{ k: 'ملاحظات', v: 'جهد مشكور، ومهم إرفاق كراسة المواصفات ورسم إطار المخرجات قبل الاعتماد.' }],
    })
  }

  if (got(row, 'اعتماد الإتفاقية')) {
    const big = grant >= 500_000
    if (big) {
      b.add({
        after: 6, action: 'رفع المشروع لـ اللجنة التنفيذية', dept: 'اعتماد دراسة المشروع',
        by: manager, actor: 'staff', tone: 'ret',
        fields: [
          { k: 'مبلغ الدعم', v: nf.format(grant), strong: true },
          { k: 'عدد الدفعات', v: String(detail.payments.length || 1) },
          { k: 'هل يحتاج تغطية إعلامية', v: yn(media) },
        ],
      })
      b.add({
        after: 6, action: 'دعم المشروع باستخدام صلاحية اللجنة التنفيذية', dept: 'اللجنة التنفيذية',
        by: 'اللجنة التنفيذية', actor: 'committee', tone: 'ok',
        fields: [
          { k: 'مبلغ الدعم', v: nf.format(grant), strong: true },
          { k: 'عدد الدفعات', v: String(detail.payments.length || 1) },
          { k: 'هل يلزم تقرير انجاز', v: yn(row.hasInterimReport) },
          { k: 'هل الإتفاقية الكترونية', v: yn(row.stage !== 'الإتفاقيات الورقية') },
          { k: 'هل يحتاج تدشين إعلامي', v: yn(media) },
          { k: 'إبراز شعار المؤسسة على إعلانات ومنتجات المشروع', v: 'نعم' },
        ],
      })
    } else {
      b.add({
        after: 5, action: 'دعم مباشر باستخدام صلاحية المدير التنفيذي', dept: 'اعتماد دراسة المشروع',
        by: manager, actor: 'staff', tone: 'ok',
        fields: [
          { k: 'مبلغ الدعم', v: nf.format(grant), strong: true },
          { k: 'عدد الدفعات', v: String(detail.payments.length || 1) },
          { k: 'هل المشروع منح تشاركي؟', v: yn(row.shared) },
          { k: 'هل الإتفاقية الكترونية', v: yn(row.stage !== 'الإتفاقيات الورقية') },
          { k: 'هل يلزم تقرير مرحلي', v: yn(row.hasInterimReport) },
        ],
      })
    }
    agreementEvents(b, row, detail.agreement, entityName, owner, manager, director, finance, grant, media)
  }

  /* ٤ · الصرف — دورة رباعية لكل دفعة */
  detail.payments.forEach((p) => paymentEvents(b, p, entityName, owner, finance))

  /* ٥ · التقارير */
  if (row.hasInterimReport) {
    b.add({
      after: 40, action: 'طلب تقرير مرحلي', dept: 'طلب تقرير مرحلي', by: owner,
      actor: 'staff', tone: 'ret',
      fields: [{ k: 'ملاحظات', v: 'يرجى رفع تقرير الإنجاز.' }],
    })
    b.add({
      after: 35, action: 'رفع التقرير المرحلي', dept: 'رفع تقرير مرحلي', by: entityName,
      actor: 'entity', tone: 'ok', files: ['تقرير الإنجاز.pdf'],
      fields: [{ k: 'ملف تقرير الإنجاز', v: 'مرفق' }],
    })
    b.add({
      after: 4, action: 'اعتماد التقرير', dept: 'اعتماد تقرير مرحلي', by: owner,
      actor: 'staff', tone: 'ok', fields: [{ k: 'ملاحظات', v: 'تقرير جيد.' }],
    })
  }

  if (row.hasFinalReport) {
    b.add({
      after: 12, action: 'طلب التقرير الختامي', dept: 'طلب التقرير الختامي', by: owner,
      actor: 'staff', tone: 'ret',
      fields: [{ k: 'ملاحظات', v: 'يرجى رفع التقرير الختامي.' }],
    })
    /* أهم قيد بعد الدراسة: **المخطط مقابل الفعلي**. ده اللي التقييم
       بعده بيتحسب عليه، وهو مدفون في النظام جوّه قيد في السجل. */
    const realBenef = Math.round(row.beneficiaries * 0.72)
    b.add({
      after: 26, action: 'رفع التقرير الختامي', dept: 'رفع التقرير الختامي', by: entityName,
      actor: 'entity', tone: 'ok', files: ['التقرير الختامي.pdf', 'صور المشروع.zip'],
      fields: [
        { k: 'مدة تنفيذ المشروع الفعلية بالأيام', v: `${row.durationDays} (المخطط ${row.durationDays})` },
        { k: 'عدد المستفيدين الفعلي', v: `${nf.format(realBenef)} (المخطط ${nf.format(row.beneficiaries)})`, strong: true },
        { k: 'موازنة المشروع الفعلية', v: `${nf.format(grant)} (المعتمد ${nf.format(grant)})` },
        { k: 'مخرجات المشروع الفعلية', v: 'نُفّذت المخرجات المتفق عليها وسُلّمت للمستفيدين وفق الخطة.' },
        { k: 'رابط لصور أو فيديو', v: 'رابط خارجي مرفق' },
      ],
    })
    b.add({
      after: 60, action: 'قبول التقرير الختامي', dept: 'اعتماد التقرير الختامي', by: owner,
      actor: 'staff', tone: 'ok',
      fields: [
        { k: 'ملاحظات', v: 'الجهة متفاعلة والمشروع مقبول بعرض واضح.' },
        { k: 'سبب التأخر في الإجراء', v: 'لا يوجد تأخر' },
      ],
    })
    b.add({
      after: 38, action: 'توصية', dept: 'اعتماد التقرير الختامي', by: director,
      actor: 'staff', tone: 'ok',
      fields: [
        { k: 'ملاحظات', v: '' },
        { k: 'سبب التأخر في الإجراء', v: '.' },
      ],
    })
  }

  /* ٦ · التقييم والإغلاق */
  if (row.statusGroup === 'مكتمل' || row.stage === 'تقييم المشروع') {
    b.add({
      after: 27, action: 'تقييم المشروع', dept: 'تقييم المشروع', by: owner,
      actor: 'staff', tone: 'ret',
      fields: [
        { k: 'تقييم المشروع', v: `${row.score}%`, strong: true },
        { k: 'التطابق بين الخطة الزمنية الأساسية والفعلية (15)', v: '15' },
        { k: 'التطابق بين المخرجات الأساسية والفعلية (15)', v: '15' },
        { k: 'التطابق بين الموازنة الأساسية والفعلية (15)', v: '15' },
        { k: 'التطابق بين الفئة المستفيدة الأساسية والفعلية (10)', v: '10' },
        { k: 'التطابق بين عدد المستفيدين الأساسي والفعلي (10)', v: '7' },
        { k: 'جودة تقارير المشروع (15)', v: '12' },
        { k: 'مدى تفاعل الجهة في استكمال المتطلبات (10)', v: '10' },
        { k: 'التطابق بين الشراكة المخططة والفعلية (10)', v: '10' },
      ],
    })
  }

  if (row.statusGroup === 'مكتمل') {
    b.add({
      after: 1, action: 'توصية', dept: 'اعتماد التقييم', by: director,
      actor: 'staff', tone: 'ok', fields: [{ k: 'ملاحظات', v: '' }],
    })
    b.add({
      after: 0, action: 'مشروع مكتمل', dept: 'مشروع مكتمل', by: 'النظام',
      actor: 'system', tone: 'mute',
      fields: [{ k: 'الحالة', v: 'مشروع مكتمل', strong: true }],
    })
  }

  return merge(b.done(), detail.followUps)
}

/* ═══ الاتفاقية: توليد ← إرجاع ← ثلاث اعتمادات ← قبول الجهة ═══ */
function agreementEvents(
  b: Builder, row: ProjectRow, A: AgreementDetail | null, entityName: string,
  owner: string, manager: string, director: string, finance: string,
  grant: number, media: boolean,
) {
  const tpl = A?.template ?? ''
  const gen = (): LogField[] => [
    { k: 'النموذج', v: tpl, strong: true },
    { k: 'نص النموذج', v: `تلتزم المؤسسة تجاه مشروع (${row.name}) المقدم على بوابة المنح…` },
    { k: 'مدة التنفيذ', v: String(row.durationDays) },
    { k: 'عدد المستفيدين', v: nf.format(row.beneficiaries) },
    { k: 'مخرجات المشروع', v: 'المخرجات المتفق عليها في الدراسة، مصاغة في بنود الاتفاقية.' },
  ]

  b.add({
    after: 2, action: 'اعتماد الإتفاقية', dept: 'الإتفاقيات الإلكترونية', by: owner,
    actor: 'staff', tone: 'ret', fields: gen(),
  })

  if (A?.returned) {
    b.add({
      after: 1, action: 'طلب التعديل على الاتفاقية', dept: 'اعتماد الإتفاقية', by: manager,
      actor: 'staff', tone: 'warn',
      fields: [{ k: 'الملاحظات', v: A.returned.note }],
    })
    b.add({
      after: 1, action: 'اعتماد الإتفاقية', dept: 'الإتفاقيات الإلكترونية', by: owner,
      actor: 'staff', tone: 'ret', fields: gen(),
    })
  }

  b.add({
    after: 1, action: 'تحديث خصائص المشروع', dept: 'الإتفاقيات الإلكترونية', by: owner,
    actor: 'staff', tone: 'mute',
    fields: [
      { k: 'مدة التنفيذ', v: String(row.durationDays) },
      { k: 'عدد المستفيدين من المشرف', v: nf.format(row.beneficiaries) },
      { k: 'اسم البنك', v: 'مصرف الراجحي' },
      { k: 'رقم الحساب البنكي', v: 'SA44 8000 0344 6080 1020 0991' },
    ],
  })

  for (const [who, days] of [[manager, 1], [finance, 1], [director, 1]] as [string, number][]) {
    b.add({
      after: days, action: 'اعتماد', dept: 'اعتماد الإتفاقية', by: who,
      actor: 'staff', tone: 'ok', fields: [{ k: 'ملاحظات', v: '' }],
    })
  }

  b.add({
    after: 1, action: 'قبول الإتفاقية', dept: 'اعتماد الإتفاقية الكترونيًا', by: entityName,
    actor: 'entity', tone: 'ok',
    fields: [
      { k: 'ملاحظات', v: '' },
      { k: 'المبلغ المتفق عليه', v: nf.format(grant), strong: true },
      { k: 'الظهور الإعلامي', v: media ? 'مطلوب' : 'غير مطلوب' },
    ],
  })
}

/* ═══ الدفعة: إذن ← صرف ← سند ← قبول ═══ */
function paymentEvents(
  b: Builder, p: PaymentDetail, entityName: string, owner: string, finance: string,
) {
  b.add({
    after: 16, action: 'إذن صرف', dept: 'المشرف إذن الصرف', by: owner,
    actor: 'staff', tone: 'ret',
    fields: [
      { k: 'الدفعة', v: `${p.no} — ${nf.format(p.amount)} ريال`, strong: true },
      { k: 'ملاحظات', v: p.condition ?? '' },
    ],
  })

  if (p.status !== 'مدفوع') return

  b.add({
    after: 5, action: 'صرف الدفعة', dept: 'اصدار سند الصرف', by: finance,
    actor: 'staff', tone: 'ok', files: ['سند الصرف.pdf'],
    fields: [
      { k: 'التحويل تم عبر', v: p.via ?? 'حساب الجهة مباشر' },
      { k: 'المبلغ', v: nf.format(p.amount), strong: true },
      { k: 'التاريخ', v: p.date },
    ],
  })
  b.add({
    after: 8, action: 'رفع سند القبض والقيد', dept: 'رفع سند القبض والقيد', by: entityName,
    actor: 'entity', tone: 'ok', files: ['سند القبض.pdf', 'سند القيد.pdf'],
    fields: [
      { k: 'هل انت متأكد من استلام مبلغ الحوالة؟', v: 'نعم', strong: true },
      { k: 'مرفق سند القبض', v: 'مرفق' },
      { k: 'مرفق سند القيد', v: 'مرفق' },
    ],
  })
  b.add({
    after: 2, action: 'قبول سند القبض والقيد', dept: 'اعتماد سند القبض والقيد', by: finance,
    actor: 'staff', tone: 'ok', fields: [{ k: 'ملاحظات', v: '' }],
  })
}

/* ═══ دمج المتابعات في نفس التايم لاين ═══ */
const ts = (date: string) => {
  const [d, m, y] = date.split('/').map(Number)
  return new Date(y, m - 1, d).getTime()
}

function merge(events: LogEvent[], follows: ProjectDetail['followUps']): LogEvent[] {
  const asEvents: LogEvent[] = follows.map((f, i) => ({
    id: `fu-${i}`,
    action: f.body,
    dept: 'متابعة',
    by: f.by,
    actor: 'staff',
    at: f.at,
    time: '13:26',
    days: 0,
    hours: 0,
    limit: LIMIT,
    tone: 'mute',
    followUp: f.type,
    files: f.attachment ? [f.attachment] : undefined,
    fields: [],
  }))
  return [...events, ...asEvents].sort((a, b) => ts(b.at) - ts(a.at))
}

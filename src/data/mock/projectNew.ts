import type { ProjectStatusGroup } from '@/types/domain'
import { entityRows } from './entities'
import { projectRows } from './projects'
import {
  CITIES_BY_REGION, FIELDS_BY_TRACK, GOALS_BY_FIELD, REGIONS, TRACKS,
} from './taxonomy'
import { TARGET_GROUPS } from './settings'

/* ═══════════════════════════════════════════════════════════
   إنشاء مشروع · BPD-003 · ٢١ خطوة · ٣٣ قاعدة

   ⚠️ **الشاشة دي كانت غايبة، وهي أهم إجراء في السيستم.** المشاريع
   ٤٩٢٩ في النظام العامل، وما كانش فيها طريقة تضيف واحدًا.

   ═══ التلات قواعد اللي بتشكّل الشاشة ═══

   **قاعدة 31 · النموذج مرحلي.** أقسام مترابطة + **نسبة اكتمال**
   + تنقّل بين المراحل + حفظ مسودة. يعني المطلوب مش فورم طويل
   بسكرول، هو محطات بنسبة بتقول للمستخدم إنه فين.

   **قاعدة 13 · تاريخ بداية التنفيذ الفعلي كيان مستقل** عن تاريخ
   تقديم الطلب · فحقلان لا حقل، والفرق بينهم بيظهر في التقارير
   بعدين.

   **قاعدة 12 · حدّ أقصى لعدد المشاريع اللي الجهة تقدّمها في
   الفترة** · فاختيار الجهة مش مجرد قايمة، هو تحقّق: الجهة اللي
   وصلت الحدّ بتتقال قبل ما المستخدم يكمّل.

   ⚠️ **والقاعدة معروضة لا مفروضة** · نفس درس ج-15: الجهة اللي
   وصلت الحدّ بتفضل في القايمة ومعاها السبب، لا بتختفي منها.
   الاختفاء بيخلّي المستخدم يدوّر على جهة مش لاقيها.

   ⚠️ **ومفيش «نسبة اكتمال» على حقول اختيارية.** النسبة بتتحسب على
   الإلزامي وحده · وإلا بتوصل ٧٠٪ وكل الإلزامي ناقص، وبتبقى رقمًا
   بيطمّن غلط.
   ═══════════════════════════════════════════════════════════ */

export type FieldKind = 'text' | 'long' | 'num' | 'date' | 'select' | 'multi'

export interface PFieldDef {
  key: string
  label: string
  kind: FieldKind
  req?: boolean
  hint?: string
  /** خيارات ثابتة · أو بتتحسب من `dependsOn` */
  options?: readonly string[]
  dependsOn?: string
  unit?: string
}

export interface PStageDef {
  key: string
  label: string
  note: string
  fields: PFieldDef[]
}

/**
 * حدّ مشاريع الجهة في الفترة · قاعدة 12.
 *
 * ⚠️ الرقم **افتراض** · الوثيقة بتقول إن الحدّ من الإعدادات من غير
 * ما تدّي قيمة، زي سقوف الاعتماد بالظبط. فالشاشة بتوسمه افتراضًا.
 */
export const ENTITY_PROJECT_CAP = 5

/**
 * كام مشروع **مفتوح** للجهة دي · وده اللي بيقيس الحدّ.
 *
 * ⚠️ «مفتوح» = لسّه بياخد وقت من الفريق: في الدراسة أو في التشغيل
 * أو متعثر. المكتمل والمعتذر عنه **خلصوا** فما بيتعدّوش · الحدّ
 * على الشغل الجاري لا على تاريخ الجهة كله.
 */
const OPEN_GROUPS: ProjectStatusGroup[] = ['في الدراسة', 'في التشغيل', 'متعثر']

export const openProjectsOf = (entityId: string): number =>
  projectRows.filter((p) => p.entityId === entityId && OPEN_GROUPS.includes(p.statusGroup)).length

export interface EntityOption {
  id: string
  name: string
  open: number
  /** وصل الحدّ · بيفضل في القايمة ومعاه السبب */
  capped: boolean
  /** الجهة غير مفعَّلة ما تقدّمش · قاعدة في تسجيل الجهات */
  inactive: boolean
}

export const entityOptions = (): EntityOption[] =>
  entityRows.map((e) => {
    const open = openProjectsOf(e.id)
    return {
      id: e.id,
      name: e.name,
      open,
      capped: open >= ENTITY_PROJECT_CAP,
      inactive: e.activation !== 'مقبول',
    }
  })

/* ═══ محطات النموذج · قاعدة 31 ═══
   خمسة، وكل واحدة بتجاوب سؤالًا واحدًا: مين · إيه · فين · بكام ·
   إمتى. الترتيب ده مش شكلي: الجهة بتحدد الحدّ، والمسار بيحدد
   المجال، والمجال بيحدد الهدف · فاللي بعده متوقّف على اللي قبله. */
export const P_STAGES: PStageDef[] = [
  {
    key: 'who',
    label: 'الجهة',
    note: 'الجهة التي تقدّم المشروع · ويُتحقَّق هنا من حدّ مشاريعها قبل أي خطوة أخرى',
    fields: [
      { key: 'entityId', label: 'الجهة المستفيدة', kind: 'select', req: true },
    ],
  },
  {
    key: 'what',
    label: 'تعريف المشروع',
    note: 'الاسم والتصنيف · المجال يتبع المسار، والهدف يتبع المجال',
    fields: [
      { key: 'name', label: 'اسم المشروع', kind: 'text', req: true, hint: 'كما سيظهر في الاتفاقية' },
      { key: 'track', label: 'المسار', kind: 'select', req: true, options: TRACKS },
      { key: 'field', label: 'المجال', kind: 'select', req: true, dependsOn: 'track' },
      { key: 'goal', label: 'الهدف', kind: 'select', req: true, dependsOn: 'field' },
      { key: 'summary', label: 'وصف المشروع', kind: 'long', req: true, hint: 'المشكلة والحل في فقرة واحدة' },
    ],
  },
  {
    key: 'where',
    label: 'النطاق والمستفيدون',
    note: 'مكان التنفيذ والمستفيدون · وعليهما تُبنى تقارير الأثر',
    fields: [
      { key: 'region', label: 'المنطقة', kind: 'select', req: true, options: REGIONS },
      { key: 'city', label: 'المحافظة / المدينة', kind: 'select', req: true, dependsOn: 'region' },
      { key: 'targets', label: 'الفئات المستهدفة', kind: 'multi', req: true, options: TARGET_GROUPS },
      { key: 'reach', label: 'عدد المستفيدين المتوقَّع', kind: 'num', req: true, unit: 'مستفيد' },
    ],
  },
  {
    key: 'money',
    label: 'التمويل',
    note: 'المبلغ المطلوب وتكلفة المستفيد · ويُحدَّد المبلغ المعتمد في الدراسة لا هنا',
    fields: [
      { key: 'amountRequested', label: 'المبلغ المطلوب', kind: 'num', req: true, unit: 'ريال' },
      {
        key: 'selfFund', label: 'مساهمة الجهة', kind: 'num', unit: 'ريال',
        hint: 'اختياري · يرفع أولوية المشروع في الدراسة',
      },
    ],
  },
  {
    key: 'when',
    label: 'المدة',
    note: 'قاعدة 13 · تاريخ التنفيذ الفعلي مستقل عن تاريخ التقديم',
    fields: [
      { key: 'startAt', label: 'بداية التنفيذ الفعلي', kind: 'date', req: true, hint: 'يختلف عن تاريخ تقديم الطلب' },
      { key: 'endAt', label: 'نهاية التنفيذ', kind: 'date', req: true },
      {
        key: 'multiYear', label: 'يمتد لأكثر من سنة مالية', kind: 'select',
        options: ['لا', 'نعم'],
        hint: 'يُتحقَّق منه في الدراسة (الخطوتان 14 و15)',
      },
    ],
  },
]

/** خيارات الحقل التابع · نفس تسلسل الفلاتر في باقي الشاشات */
export const optionsFor = (f: PFieldDef, parent: string): readonly string[] => {
  if (f.options) return f.options
  if (f.dependsOn === 'track') return FIELDS_BY_TRACK[parent] ?? []
  if (f.dependsOn === 'field') return GOALS_BY_FIELD[parent] ?? []
  if (f.dependsOn === 'region') return CITIES_BY_REGION[parent] ?? []
  return []
}

export type PValues = Record<string, string>

/** الإلزامي الناقص في محطة · الاختياري ما بيتعدّش */
export const shortIn = (st: PStageDef, val: PValues): string[] =>
  st.fields.filter((f) => f.req && !val[f.key]?.trim()).map((f) => f.label)

/**
 * نسبة الاكتمال · قاعدة 31.
 *
 * ⚠️ **على الإلزامي وحده.** لو حسبناها على كل الحقول، المستخدم
 * بيملا الاختياري ويشوف ٧٠٪ وكل الإلزامي ناقص · رقم بيطمّن غلط.
 */
export const completion = (val: PValues): number => {
  const req = P_STAGES.flatMap((s) => s.fields.filter((f) => f.req))
  const done = req.filter((f) => val[f.key]?.trim()).length
  return req.length === 0 ? 0 : Math.round((done / req.length) * 100)
}

/* ═══ التحقّق · القواعد اللي بتتقال قبل الإرسال ═══ */
export interface PIssue { key: string; say: string; rule: string }

export const projectIssues = (val: PValues): PIssue[] => {
  const out: PIssue[] = []

  const ent = entityOptions().find((e) => e.id === val.entityId)
  if (ent?.capped) {
    out.push({
      key: 'cap',
      say: `لدى «${ent.name}» ${ent.open} مشاريع مفتوحة، والحدّ ${ENTITY_PROJECT_CAP} مشاريع في الفترة. اختر جهة أخرى أو انتظر إغلاق أحد مشاريعها.`,
      rule: 'قاعدة 12',
    })
  }
  if (ent?.inactive) {
    out.push({
      key: 'inactive',
      say: `«${ent.name}» غير نشطة، ولا تُقبل مشاريع من جهة غير نشطة.`,
      rule: 'تسجيل الجهات',
    })
  }

  /* ⚠️ المقارنة على النصّ مباشرةً · التواريخ هنا `yyyy-mm-dd`
     فالترتيب المعجمي هو الترتيب الزمني، ومفيش داعي لـ`Date` */
  if (val.startAt && val.endAt && val.endAt < val.startAt) {
    out.push({ key: 'dates', say: 'تاريخ نهاية التنفيذ يسبق تاريخ بدايته. عدّل أحد التاريخين.', rule: 'قاعدة 13' })
  }

  const asked = Number(val.amountRequested) || 0
  const reach = Number(val.reach) || 0
  if (asked > 0 && reach > 0) {
    const per = Math.round(asked / reach)
    if (per > 50_000) {
      out.push({
        key: 'per',
        say: `تكلفة المستفيد ${per.toLocaleString('en-US')} ريال، وهي مرتفعة. راجع عدد المستفيدين أو المبلغ المطلوب.`,
        rule: 'مؤشر الأثر',
      })
    }
  }

  return out
}

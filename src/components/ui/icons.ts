/**
 * أيقونات النظام · **Phosphor** (phosphoricons.com) من ٢٣ سبتمبر.
 *
 * ليه اتنقلنا من لوسيد: لوسيد خطّ بس، مالهاش نسخة مملوءة، فقاعدة
 * «خطّ = عادي · ملء = نشِط» ما كانتش ممكنة، والبند النشِط في الريل
 * كان بيتعرف من أرضيته وبس. وهي كمان الافتراضي في shadcn فبتتكرّر
 * في معظم اللوحات. Phosphor نفس الشبكة ونفس التغطية تقريبًا، وستّ
 * أوزان: `regular` افتراضي · `fill` للنشِط · `duotone` للحالات
 * الفاضية والنجاح بس. DDR-013.
 *
 * ── التاريخ القديم (لوسيد) ──
 *
 * قبل كده كانت ٥٤ أيقونة مرسومة بإيدنا كنصوص `<path>` على شبكة
 * ٢٤×٢٤. ده كان بيشتغل، بس كل أيقونة جديدة كانت قرار رسم مستقل:
 * سُمك الخط والنهايات والوزن البصري بيتحدّدوا في اللحظة، فبعد
 * خمسين أيقونة العايلة ما بقتش عايلة.
 *
 * لوسيد بتحلّ ده من الجذر: مكتبة واحدة، شبكة ٢٤×٢٤، سُمك ٢،
 * نهايات دائرية · كلهم مرسومين مع بعض بنفس القواعد. وبتديّنا كمان
 * ١٥٠٠+ أيقونة جاهزة، فالشاشة الجديدة ما بتحتاجش رسمًا.
 *
 * **الخريطة تحت بتختار حسب اللي الأيقونة بترسمه لا حسب اسمها
 * عندنا** · لأن اللي المستخدم بيشوفه هو الرسم. فـ`gear` كانت
 * بترسم مزالج (sliders) مش ترسًا، فبقت `SlidersHorizontal`.
 *
 * الاستعمال زي ما هو:  <Icon name={icons.home} size={20} />
 */
import {
  ArrowClockwise, ArrowDown, ArrowLeft, ArrowsIn, ArrowsOut, Buildings, CalendarDots, CaretDown,
  CaretLeft, CaretRight, CaretUp, ChartBar, ChatCircle, Check, Clock, Copy,
  CreditCard, DotsSixVertical, DotsThreeVertical, DownloadSimple, Envelope, Eye, EyeSlash, File,
  FileText, Folder, Funnel, GridFour, House, Leaf, LinkSimple, List, ListChecks,
  Lock, MagnifyingGlass, MapPin, Monitor, Moon, Paperclip, PencilSimple, Plus,
  PushPin, Rows, SidebarSimple, SignOut, Signature, SlidersHorizontal, SortDescending, SquaresFour,
  Sun, ThumbsDown, ThumbsUp, Trash, UploadSimple, User, Users, Wallet,
  WarningCircle, X,
  type Icon as PhIcon,
} from '@phosphor-icons/react'

/** شكل الأيقونة · مكوّن من Phosphor */
export type IconGlyph = PhIcon

export const icons = {
  home: House,
  sun: Sun,
  panel: SidebarSimple,
  leaf: Leaf,
  moon: Moon,
  device: Monitor,
  user: User,
  /* كانت بترسم مزالج لا ترسًا · والرسم هو اللي بيتقري */
  gear: SlidersHorizontal,
  logout: SignOut,
  lock: Lock,
  /** البريد · حقل التسجيل والإشعارات */
  mail: Envelope,
  eye: Eye,
  eyeOff: EyeSlash,
  doc: FileText,
  /* المجلّد · البند اللي تحته بنود في شجرة الميزانية */
  folder: Folder,
  entity: Buildings,
  budget: Wallet,
  contract: Signature,
  /* الخطة · قائمة أنشطة بعلامات، لا مستندًا موقَّعًا زي الاتفاقية */
  plan: ListChecks,
  pay: CreditCard,
  chart: ChartBar,
  chat: ChatCircle,
  alert: WarningCircle,
  /* RTL: `chevron` بيشاور «لقدّام» يعني شمال، و`chevronBack` يمين */
  chevron: CaretLeft,
  chevronBack: CaretRight,
  /* التاريخ · حقل التقويم المرسوم (لا تقويم المتصفّح) */
  date: CalendarDots,
  search: MagnifyingGlass,
  file: File,
  clip: Paperclip,
  send: ArrowLeft,
  /* المساعد = ورقة من شجرة الهوية · مش شرارة ✦ (٢٣ سبتمبر) */
  spark: Leaf,
  close: X,
  expand: ArrowsOut,
  shrink: ArrowsIn,
  plus: Plus,
  dots: DotsThreeVertical,
  pin: PushPin,
  edit: PencilSimple,
  trash: Trash,
  menu: List,
  down: ArrowDown,
  /* التصدير ≠ سهم عارٍ لتحت: السهم لوحده بيتقري «رتّب تنازليًا».
     `Download` فيه الصينية اللي بتقول «الملف بينزل على جهازك». */
  export: DownloadSimple,
  /* الرفع · الرسم سهم لفوق فوق خطّ · عكس التنزيل بالظبط */
  upload: UploadSimple,
  copy: Copy,
  check: Check,
  redo: ArrowClockwise,
  up: ThumbsUp,
  downv: ThumbsDown,
  grip: DotsSixVertical,
  chevronDown: CaretDown,
  /* «قراءات» · تلات نجوم. الشرارة الواحدة بتقول «ذكاء اصطناعي» بس */
  insight: Leaf,
  /** لوحة «اليوم» · شبكة بلاطات لا نجمة المساعد */
  dashboard: SquaresFour,
  sort: SortDescending,
  chevronUp: CaretUp,
  grid: GridFour,
  rows: Rows,
  /* القمع لا الشُرَط المتناقصة · دي أيقونة «محاذاة» في كل مكان تاني */
  filter: Funnel,
  clock: Clock,
  pinMap: MapPin,
  users: Users,
  link: LinkSimple,
} as const satisfies Record<string, IconGlyph>

export type IconName = keyof typeof icons

/**
 * أيقونات النظام — **لوسيد** (lucide.dev).
 *
 * قبل كده كانت ٥٤ أيقونة مرسومة بإيدنا كنصوص `<path>` على شبكة
 * ٢٤×٢٤. ده كان بيشتغل، بس كل أيقونة جديدة كانت قرار رسم مستقل:
 * سُمك الخط والنهايات والوزن البصري بيتحدّدوا في اللحظة، فبعد
 * خمسين أيقونة العايلة ما بقتش عايلة.
 *
 * لوسيد بتحلّ ده من الجذر: مكتبة واحدة، شبكة ٢٤×٢٤، سُمك ٢،
 * نهايات دائرية — كلهم مرسومين مع بعض بنفس القواعد. وبتديّنا كمان
 * ١٥٠٠+ أيقونة جاهزة، فالشاشة الجديدة ما بتحتاجش رسمًا.
 *
 * **الخريطة تحت بتختار حسب اللي الأيقونة بترسمه لا حسب اسمها
 * عندنا** — لأن اللي المستخدم بيشوفه هو الرسم. فـ`gear` كانت
 * بترسم مزالج (sliders) مش ترسًا، فبقت `SlidersHorizontal`.
 *
 * الاستعمال زي ما هو:  <Icon name={icons.home} size={20} />
 */
import {
  House, Sun, PanelLeft, Leaf, Moon, Monitor, User, SlidersHorizontal,
  LogOut, Lock, Eye, EyeOff, FileText, Building2, Wallet, FileSignature,
  CreditCard, ChartColumn, MessageCircle, CircleAlert, ChevronLeft,
  ChevronRight, Search, File, Paperclip, ArrowLeft, Sparkle, X, Maximize2,
  Plus, EllipsisVertical, Pin, Pencil, Trash2, Menu, ArrowDown, Download,
  Copy, Check, RotateCw, ThumbsUp, ThumbsDown, GripVertical, ChevronDown,
  Sparkles, ArrowDownWideNarrow, ChevronUp, LayoutGrid, Rows3, Funnel,
  Clock, MapPin, Users, Link2,
  type LucideIcon,
} from 'lucide-react'

export const icons = {
  home: House,
  sun: Sun,
  panel: PanelLeft,
  leaf: Leaf,
  moon: Moon,
  device: Monitor,
  user: User,
  /* كانت بترسم مزالج لا ترسًا — والرسم هو اللي بيتقري */
  gear: SlidersHorizontal,
  logout: LogOut,
  lock: Lock,
  eye: Eye,
  eyeOff: EyeOff,
  doc: FileText,
  entity: Building2,
  budget: Wallet,
  contract: FileSignature,
  pay: CreditCard,
  chart: ChartColumn,
  chat: MessageCircle,
  alert: CircleAlert,
  /* RTL: `chevron` بيشاور «لقدّام» يعني شمال، و`chevronBack` يمين */
  chevron: ChevronLeft,
  chevronBack: ChevronRight,
  search: Search,
  file: File,
  clip: Paperclip,
  send: ArrowLeft,
  spark: Sparkle,
  close: X,
  expand: Maximize2,
  plus: Plus,
  dots: EllipsisVertical,
  pin: Pin,
  edit: Pencil,
  trash: Trash2,
  menu: Menu,
  down: ArrowDown,
  /* التصدير ≠ سهم عارٍ لتحت: السهم لوحده بيتقري «رتّب تنازليًا».
     `Download` فيه الصينية اللي بتقول «الملف بينزل على جهازك». */
  export: Download,
  copy: Copy,
  check: Check,
  redo: RotateCw,
  up: ThumbsUp,
  downv: ThumbsDown,
  grip: GripVertical,
  chevronDown: ChevronDown,
  /* «قراءات» — تلات نجوم. الشرارة الواحدة بتقول «ذكاء اصطناعي» بس */
  insight: Sparkles,
  sort: ArrowDownWideNarrow,
  chevronUp: ChevronUp,
  grid: LayoutGrid,
  rows: Rows3,
  /* القمع لا الشُرَط المتناقصة — دي أيقونة «محاذاة» في كل مكان تاني */
  filter: Funnel,
  clock: Clock,
  pinMap: MapPin,
  users: Users,
  link: Link2,
} as const satisfies Record<string, LucideIcon>

export type IconName = keyof typeof icons

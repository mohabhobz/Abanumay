/**
 * System icons · **Phosphor** (phosphoricons.com).
 *
 * Why the switch from Lucide: Lucide is line-only with no filled variant, so the "line = normal,
 * filled = active" rule wasn't possible, and the active item in the timeline could only be told
 * apart by its background. It's also the default in shadcn, so it repeats across most dashboards.
 * Phosphor covers roughly the same grid and coverage, with six weights: `regular` as default,
 * `fill` for active, `duotone` for empty states and success only.
 *
 * -- Prior history (Lucide) --
 *
 * Before this there were 54 icons hand-drawn as `<path>` elements on a 24x24 grid. That worked, but
 * every new icon was an independent drawing decision: stroke width, line caps, and visual weight
 * were decided in the moment, so after fifty icons the family stopped being a family.
 *
 * Lucide fixes this at the root: one library, a 24x24 grid, stroke 2, round caps — all drawn
 * together under the same rules. It also gives us 1500+ ready-made icons, so a new screen doesn't
 * need a drawing.
 *
 * **The map below picks by what the icon actually draws, not by its name here** — because what the
 * user sees is the drawing. `gear` used to draw sliders, not a gear, so it became
 * `SlidersHorizontal`.
 *
 * Usage stays the same: <Icon name={icons.home} size={20} />
 */
import {
  Briefcase, Path, SealCheck, Bell, Checks,
  ArrowClockwise, ArrowDown, ArrowLeft, ArrowsIn, ArrowsOut, Buildings, CalendarDots, CaretDown,
  CaretLeft, CaretRight, CaretUp, ChartBar, ChatCircle, Check, Clock, Copy,
  CreditCard, DotsSixVertical, DotsThreeVertical, DownloadSimple, Envelope, Eye, EyeSlash, File,
  ChartLineUp, FileText, Folder, Funnel, GridFour, House, LinkSimple, List, ListChecks,
  Lock, MagnifyingGlass, MapPin, Monitor, Moon, Paperclip, PencilSimple, Plus,
  PushPin, Rows, SidebarSimple, SignOut, Signature, SlidersHorizontal, SortDescending, SquaresFour,
  Sun, ThumbsDown, ThumbsUp, Trash, UploadSimple, User, Users, Wallet,
  WarningCircle, Info, X,
  type Icon as PhIcon,
} from '@phosphor-icons/react'
import { AbLeafGlyph } from '@/components/soul/motifs'

/** The icon's shape · a component from Phosphor */
export type IconGlyph = PhIcon

export const icons = {
  home: House,
  sun: Sun,
  panel: SidebarSimple,
  moon: Moon,
  device: Monitor,
  user: User,
  /* Used to draw sliders, not a gear · the drawing is what gets read */
  gear: SlidersHorizontal,
  logout: SignOut,
  lock: Lock,
  /** Mail · registration field and notifications */
  mail: Envelope,
  eye: Eye,
  eyeOff: EyeSlash,
  doc: FileText,
  /* Folder · a node with children in the budget tree */
  folder: Folder,
  entity: Buildings,
  budget: Wallet,
  contract: Signature,
  /* Plan · a checklist of activities, not a signed document like the agreement */
  plan: ListChecks,
  /* Timeline-specific icons · separate keys because `doc`, `plan`, and `check` are used elsewhere
   with their generic meaning */
  navProjects: Briefcase,
  navPlans: Path,
  navClosings: SealCheck,
  pay: CreditCard,
  chart: ChartBar,
  chat: ChatCircle,
  alert: WarningCircle,
  /* Note, not warning · guidance alerts and disclosures */
  info: Info,
  /* RTL: `chevron` points "forward," meaning left, and `chevronBack` points right */
  chevron: CaretLeft,
  chevronBack: CaretRight,
  /* Date · the hand-drawn calendar field (not the browser calendar) */
  date: CalendarDots,
  search: MagnifyingGlass,
  file: File,
  clip: Paperclip,
  send: ArrowLeft,
  /* Assistant = a leaf from the identity tree, not a spark */
  /* Assistant · `AbLeaf`, the single leaf glyph (motion 4) · used to be Phosphor's `Leaf` */
  spark: AbLeafGlyph,
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
  /* Export is not a bare arrow pointing down: an arrow alone reads as "sort descending." `Download`
   includes the tray, which says "the file is coming down to your device." */
  export: DownloadSimple,
  /* Upload · drawn as an arrow pointing up over a line · the exact opposite of download */
  upload: UploadSimple,
  copy: Copy,
  check: Check,
  /** Notification bell in the timeline · plus the "mark all as read" mark */
  bell: Bell,
  checks: Checks,
  redo: ArrowClockwise,
  up: ThumbsUp,
  downv: ThumbsDown,
  grip: DotsSixVertical,
  chevronDown: CaretDown,
  /* "Insights" · three stars. A single spark only reads as "AI." */
  /* A reading computed by a rule, not the assistant · the leaf is reserved for a single meaning */
  insight: ChartLineUp,
  /** "Today" panel · a grid of tiles, not the assistant's star */
  dashboard: SquaresFour,
  sort: SortDescending,
  chevronUp: CaretUp,
  grid: GridFour,
  rows: Rows,
  /* The funnel, not descending bars · that's the "align" icon everywhere else */
  filter: Funnel,
  clock: Clock,
  pinMap: MapPin,
  users: Users,
  link: LinkSimple,
} as const satisfies Record<string, IconGlyph>

export type IconName = keyof typeof icons

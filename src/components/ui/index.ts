/** نقطة الدخول لعناصر نظام التصميم · الاستيراد دايمًا من هنا */
export { Icon, type IconProps } from './Icon'
export { icons, type IconName } from './icons'
export {
  Glass, Head, Tag, Num, Riyal, Money, Mono, DateText, KV, Tabs, Timeline, Empty, Stat, BackTo,
  type GlassProps, type KVRow, type TabItem, type TimelineEvent, type StatBar,
} from './primitives'
export { Person, Face, type PersonProps } from './Person'
export { GateArc, type GateArcProps, type CurrentStandingInfo } from './GateArc'
export { CeilingLadder } from './CeilingLadder'
export { Steps, type StepItem, type StepState, type StepsProps } from './Steps'
export {
  SearchBox, Select, MultiSelect, GroupPicker, Toggle, Segments, Pager, PageSize, PAGE_SIZES, ViewToggle,
  type SelectProps, type MultiSelectProps, type SegItem, type SelectOption,
} from './filters'
export { FieldSelect, type FieldSelectProps } from './FieldSelect'
/* ⚠️ حقل التاريخ · تقويم مرسوم لا `type="date"` (شوف tools/nonative.mjs) */
export { DateField, type DateFieldProps } from './DateField'
/* ⚠️ اللوحة الوحيدة · أي قائمة في السيستم بترسم منها (شوف tools/onemenu.mjs) */
export { MenuPanel, MenuOpt, type MenuPanelProps, type MenuOptProps } from './menu'

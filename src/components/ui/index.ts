/** Entry point for design-system elements · always import from here */
export { Icon, type IconProps } from './Icon'
export { icons, type IconName } from './icons'
export {
  Glass, Head, Tag, Num, Nil, Riyal, Money, Mono, CopyId, DateText, KV, Tabs, Timeline, Empty, Stat, BackTo, StepLink,
  type GlassProps, type KVRow, type TabItem, type TimelineEvent, type StatBar,
} from './primitives'
export { Person, Face, type PersonProps } from './Person'
export { EntityMark } from './EntityMark'
export {
  GateArc, StepArc, type GateArcProps, type CurrentStandingInfo, type GateStep, type GateStepState,
  type StepArcProps,
} from './GateArc'
export { CeilingLadder } from './CeilingLadder'
export { Steps, type StepItem, type StepState, type StepsProps } from './Steps'
/* Warning: "blocks submission" · one single version (used to be three) */
export { Blockers, DockWhy, StopsPopup, blockerCount, type Blocker } from './Blockers'
export {
  SearchBox, Select, MultiSelect, GroupPicker, Toggle, Segments, Pager, PageSize, PAGE_SIZES, ViewToggle,
  type SelectProps, type MultiSelectProps, type SegItem, type SelectOption,
} from './filters'
export { FieldSelect, FieldMultiSelect, type FieldSelectProps, type FieldMultiSelectProps } from './FieldSelect'
export { Switch } from './Switch'
export { MoneyField } from './MoneyField'
/* Warning: date field · a hand-drawn calendar, not `type="date"` */
export { DateField, type DateFieldProps } from './DateField'
/* Warning: the one panel · every list in the system renders from it */
export { MenuPanel, MenuOpt, CheckMark, type MenuPanelProps, type MenuOptProps } from './menu'
export { CheckChip, type CheckChipProps } from './CheckChip'
/* Client 24 Oct · one editor for every data section · its «تعديل» button */
export { EditModal, EditButton, type EditField, type EditChange, type EditKind, type EditModalProps } from './EditModal'
export { OrgName } from './OrgName'
/* Client 26 Oct · every action-bar decision confirms in one popup · its reason inside it */
export { DecisionDialog, DockActions, type DecisionDialogProps, type DockAction } from './DecisionDialog'
export { Hint } from './Hint'
export { StatRow } from './primitives'
export { BankCard, BankGrid, type BankCardProps } from './BankCard'
export { WeekdayPicker } from './WeekdayPicker'

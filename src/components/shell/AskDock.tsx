/**
 * «اسأل أبانمي» — الزرار العايم الثابت في السيستم كله.
 *
 * كان بندًا في آخر شريط التنقّل: مكان صحّ للتنقّل، غلط للسؤال. حاجتان
 * كانوا بيضيّعوه هناك — إنه **يتقري كصفحة** جنب الرئيسية والمشاريع
 * والتقارير وهو مش صفحة، وإنه **بعيد عن مكان القرار**: المستخدم
 * بيبصّ على شريط القرار أسفل الشاشة ويسأل في اللحظة دي بالظبط، مش
 * بيرجّع عينه لأعلى اليمين.
 *
 * فبقى عايمًا في نفس الرصيف اللي فيه شريط القرار، على الشمال، وثابتًا
 * في كل شاشة. ولمّا يبقى فيه شريط قرار، الشريط بياخد العرض ناقص
 * مساحة الزرار — الاتنين في صفّ واحد، مفيش واحد فوق التاني.
 *
 * وهو نفس الزرار: بيفتح نفس اللوح، وبيستجيب لـ⌘K.
 */
export interface AskDockProps {
  open: boolean
  onToggle: () => void
  /** بيصغّر الزرار على الشاشات الضيقة ويخلّيه أيقونة */
  compact?: boolean
}

export function AskDock({ open, onToggle, compact }: AskDockProps) {
  return (
    <button
      type="button"
      className={`askfab${open ? ' on' : ''}${compact ? ' mini' : ''}`}
      onClick={onToggle}
      aria-expanded={open}
      aria-label="اسأل أبانمي"
      title="اسأل أبانمي · ⌘K"
    >
      <span className="badge badge-30"><span className="aispark" /></span>
      {!compact && (
        <>
          <span className="askfab-t">اسأل أبانمي</span>
          <kbd>⌘K</kbd>
        </>
      )}
    </button>
  )
}

import { isPerson, person } from '@/data/people'

/* ═══════════════════════════════════════════════════════════
   الشخص · الوش والاسم مع بعض.

   الاسم لوحده بيتقرا، والوش بيتعرف. في قايمة فيها خمس مشرفين
   كلهم بيبدأوا بعين، الفرق بينهم بيتاخد من **شكل** لا من قراءة
   السطر لآخره — وده الفرق بين اختيار بنظرة واختيار بمقارنة.

   ⚠️ **كمبوننت واحد لكل مكان فيه شخص.** لو كل شاشة رسمت وشّها
   بإيدها، هيبقى عندنا مقاسات وأركان مختلفة لنفس الحاجة — وده
   بالظبط النمط اللي السيستم كله اتوحّد عشان يخرج منه.

   ⚠️ **والحروف الأوّلية محايدة عن قصد · بلا لون لكل شخص.**
   المغري إن كل وش ياخد لونًا مشتقًّا من اسمه، والتمن إن ده
   **عيلة ألوان جديدة بلا مفتاح**: ألوان الجراف محجوزة للفئات،
   وألوان الحالة محجوزة للحالة، وثالثة بتدخل بينهم بتخلّي
   الأخضر في الشاشة يعني تلات حاجات. الوش الحقيقي هو اللي
   بيفرّق، والحرف نايب مؤقّت لحدّ ما الصورة تنزل.
   ═══════════════════════════════════════════════════════════ */

export interface PersonProps {
  /** الاسم زي ما هو في الداتا · السجلّ بيحوّله لوش */
  name: string | null | undefined
  /** اللي يتكتب لو مفيش شخص (بلا مالك · غير مُسنَد) */
  empty?: string
  /** ٢٨px الافتراضي · `lg` = ٣٤ لشريط القرار وقايمة الحساب */
  size?: 'sm' | 'md' | 'lg'
  /** الوش وحده بلا اسم · للخلايا الضيّقة */
  bare?: boolean
  /** يخفّت الاسم زي `.sub` · الافتراضي في الكروت والخلايا */
  quiet?: boolean
}

/** الوش وحده · بيستعمل نفس صندوق `.av`/`.pht` بتاع الحساب */
export function Face({ name, size = 'sm' }: { name: string; size?: PersonProps['size'] }) {
  const p = person(name)
  const box = size === 'lg' ? '34' : size === 'md' ? '30' : '28'
  const title = p.title ? `${p.name}، ${p.title}` : p.name
  if (p.photo) return <img className={`pht pht-${box}`} src={p.photo} alt="" title={title} />
  return <span className={`av av-${box}`} title={title} aria-hidden="true">{p.initial}</span>
}

export function Person({ name, empty = 'بلا مالك', size = 'sm', bare, quiet = true }: PersonProps) {
  /* ⚠️ «بلا مالك» **مش شخص**، فما بياخدش وشًّا. الأفاتار بحروف
     أوّلية على قيمة زي دي بيتقرا كأنه بني آدم اسمه «بلا مالك». */
  if (!isPerson(name)) return <span className="sub">{empty}</span>
  const p = person(name)
  if (bare) return <Face name={p.name} size={size} />
  return (
    <span className={`prs prs-${size}`}>
      <Face name={p.name} size={size} />
      <span className={quiet ? 'prs-n sub' : 'prs-n'}>{p.name}</span>
    </span>
  )
}

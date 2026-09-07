import Logo from '@/assets/LogoColor'
import { AccountMenu } from './AccountMenu'
import type { CurrentUser } from '@/types/domain'

/**
 * شريط علوي للموبايل: الشعار والصورة اللي كانوا في الريل.
 *
 * الصورة هنا هي قائمة الحساب نفسها لا صورة للزينة: كانت صورة
 * ساكتة فوق ونسخة شغّالة تحت في الشريط السفلي — المستخدم بيدوس
 * على اللي فوق لأنه المكان المتوقّع وما يحصلش حاجة. ونقلها فوق
 * بيفضّي خانة في شريط سفلي فيه ست مداخل أصلًا.
 */
export function MobileTop({ user, onSignOut }: { user: CurrentUser; onSignOut?: () => void }) {
  return (
    <div className="mobtop chrome">
      <span className="mark mark-38 logo"><Logo /></span>
      <span className="mobtitle">منح أبانمي</span>
      <AccountMenu user={user} onSignOut={onSignOut} drop />
    </div>
  )
}

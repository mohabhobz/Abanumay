import Logo from '@/assets/LogoColor'
import { Avatar } from './Avatar'
import type { CurrentUser } from '@/types/domain'

/** شريط علوي للموبايل: الشعار والصورة اللي كانوا في الريل */
export function MobileTop({ user }: { user: CurrentUser }) {
  return (
    <div className="mobtop chrome">
      <span className="mark mark-38 logo"><Logo /></span>
      <span className="mobtitle">منح أبانمي</span>
      <Avatar user={user} />
    </div>
  )
}

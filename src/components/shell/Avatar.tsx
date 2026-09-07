import type { CurrentUser } from '@/types/domain'

/** الصورة الشخصية، والحرف احتياطي لو الصورة ما حمّلتش */
export function Avatar({ user }: { user: CurrentUser }) {
  if (!user.photo) return <span className="av">{user.initial}</span>
  return (
    <img className="pht pht-34" src={user.photo} alt="" title={`${user.name}، ${user.role}`} />
  )
}

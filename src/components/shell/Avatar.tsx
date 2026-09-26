import type { CurrentUser } from '@/types/domain'

/** The profile photo, with a letter as a fallback if the image doesn't load. */
export function Avatar({ user }: { user: CurrentUser }) {
  if (!user.photo) return <span className="av">{user.initial}</span>
  return (
    <img className="pht pht-34" src={user.photo} alt="" title={`${user.name}، ${user.role}`} />
  )
}

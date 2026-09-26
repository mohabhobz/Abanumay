import { Icon } from './Icon'
import { icons } from './icons'

/**
 * Entity mark · the entity's logo if available, otherwise an entity icon.
 *
 * Warning: this used to be the name's first letter (`initial()`). A letter makes the entity read as
 * a person (same shape as the `Person` avatar), and duplicates the name already written next to it.
 * The icon matches the "entities" icon used elsewhere, so the badge says "this is an organization,"
 * not "this is a person."
 * The name is always shown next to it, so this is decorative for screen readers (`aria-hidden`).
 */
export function EntityMark({ logo, size = 'md' }: { logo?: string; size?: 'md' | 'lg' }) {
  const cls = `ec-init ec-mark${size === 'lg' ? ' ec-init-lg' : ''}`
  if (logo) {
    return (
      <span className={`${cls} ec-logo`} aria-hidden="true">
        <img src={logo} alt="" loading="lazy" />
      </span>
    )
  }
  return (
    <span className={cls} aria-hidden="true">
      <Icon name={icons.entity} size={size === 'lg' ? 'lg' : 'md'} />
    </span>
  )
}

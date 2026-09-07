import { useCallback, useEffect, useState } from 'react'
import { asUser, readRole, roleByKey, writeRole, type Role, type RoleKey } from '@/data/roles'
import type { CurrentUser } from '@/types/domain'

const EVENT = 'ab:role'

/**
 * الدور الحالي، مشترك بين كل الكومبوننتس.
 *
 * التبديل بيبعت حدثًا على الويندو بدل ما يحطّ كونتكست فوق التطبيق —
 * الحالة الوحيدة المشتركة هنا هي دي، والكونتكست كان هيبقى بنية أكبر
 * من الحاجة. ولما التوكن يبقى هو مصدر الدور، الهوك ده بيتحوّل لسطر
 * واحد بيقرأ من الجلسة والمبدّل بيختفي.
 */
export function useRole(): {
  role: Role
  user: CurrentUser
  setRole: (key: RoleKey) => void
} {
  const [key, setKey] = useState<RoleKey>(readRole)

  useEffect(() => {
    const onChange = (e: Event) => setKey((e as CustomEvent<RoleKey>).detail)
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [])

  const setRole = useCallback((next: RoleKey) => {
    writeRole(next)
    window.dispatchEvent(new CustomEvent<RoleKey>(EVENT, { detail: next }))
  }, [])

  const role = roleByKey(key)
  return { role, user: asUser(role), setRole }
}

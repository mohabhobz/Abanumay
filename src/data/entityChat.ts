import { entityById } from '@/data/mock/entities'
import { regRequestById, regRows } from '@/data/mock/registration'
import { regThread } from '@/data/mock/regPortal'
import type { ThreadMessage } from '@/data/mock/detail'

/* Client 9 Nov · the entity's general line to the foundation · the one its portal opens, and the
   one every other screen of its own falls back to when the screen has no thread of its own · an
   entity that came through registration keeps its registration's thread, an entity registered
   before the portal existed has a thread of its own, keyed by its id */

export interface EntityChat { channel: string; messages: ThreadMessage[]; name: string }

export function entityChat(scope: { entityId?: string; reqId?: string }): EntityChat | undefined {
  const r = scope.reqId ? regRequestById(scope.reqId) : scope.entityId ? regRows.find((x) => x.entityId === scope.entityId) : undefined
  if (r) return { channel: `reg:${r.id}`, messages: regThread(r.state, r.name), name: r.name }
  const e = scope.entityId ? entityById(scope.entityId) : undefined
  if (e) return { channel: `entity:${e.id}`, messages: [], name: e.name }
  return undefined
}

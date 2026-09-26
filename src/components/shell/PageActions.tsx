import { Link } from 'react-router-dom'
import { Icon, icons } from '@/components/ui'
import type { ReactNode } from 'react'

/* Header actions — **one place, one order, across every screen**.

   ⚠️ Across five screens there were three different spots and three different orders for the same
   action:

     Entities      header - settings, registration requests, create
     Budget        header - settings, create, **cycle switcher after it**
     Disbursement  toolbar - create, overdue, export, switcher
     Agreements    none
     Projects      header - settings alone

   So "add" jumped between the header and the toolbar depending on the screen, and even within the
   header its order shifted. A user working across four screens a day has to hunt for the button
   every time.

   === The rule ===

   **Create sits in the header, last, pinned to the corner.**

   Why the header, not the toolbar: the toolbar works entirely **on the displayed result** — search,
   filter, grouping, export, view switcher. Create isn't one of those: it adds to the collection,
   unrelated to what's currently filtered in front of you. Putting it there mixes two different
   kinds of action into one group.

   And why **last**: the group is pinned to the end of the row, so its last item's edge sits at the
   page edge **regardless of how many items sit beside it**. Any other position moves depending on
   whether a given screen has a secondary button — the corner is the one truly fixed spot.

   Order from the title toward the corner:
     1 - Settings (quiet), furthest from daily work
     2 - Secondary actions with a counter, leads to another collection
     3 - Create, in the corner

   ⚠️ **And context switchers aren't actions.** The budget cycle switcher changes what you're
   looking at, not what you're adding, so it belongs with the filters — it used to sit right after
   the create button, pushing it off the corner and breaking the rule on the one screen that has a
   switcher. */

export interface PageActionLink {
  label: string
  to: string
  icon?: string
  /** A number next to the name — a waiting queue, not decoration. */
  count?: number
}

export interface PageActionsProps {
  /** The quiet one — module settings. */
  settings?: string
  /** The secondary one — leads to another collection, with a counter. */
  secondary?: PageActionLink[]
  /** Create — the only action that adds to the module. */
  create?: PageActionLink
  /** Something only this screen needs — placed before create. */
  extra?: ReactNode
}

export function PageActions({ settings, secondary, create, extra }: PageActionsProps) {
  if (!settings && !secondary?.length && !create && !extra) return null

  return (
    <div className="hacts">
      {settings && (
        <Link className="btn btn-ghost" to={settings}>
          <Icon name={icons.gear} size="sm" />
          الإعدادات
        </Link>
      )}

      {secondary?.map((a) => (
        <Link key={a.to} className="btn btn-2" to={a.to}>
          {a.icon && <Icon name={icons[a.icon as keyof typeof icons]} size="sm" />}
          {a.label}
          {a.count !== undefined && a.count > 0 && <b className="num">{a.count}</b>}
        </Link>
      ))}

      {extra}

      {create && (
        <Link className="btn btn-p" to={create.to}>
          <Icon name={icons.plus} size="sm" />
          {create.label}
        </Link>
      )}
    </div>
  )
}

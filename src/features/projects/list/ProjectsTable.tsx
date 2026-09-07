import { Link } from 'react-router-dom'
import { Mono, Riyal, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { nf } from '@/lib/format'
import { stagePressure } from '@/data/repository'
import type { ProjectRow } from '@/types/domain'
import { days, groupTone } from '@/lib/tone'

export interface ProjectsTableProps {
  rows: ProjectRow[]
  selected: Set<string>
  onSelect: (id: string, on: boolean) => void
  onSelectAll: (on: boolean) => void
}

/**
 * عرض الجدول — للمسح السريع لا للقرار.
 *
 * 12 عمودًا مش 62: الباقي عايش في صفحة المشروع. العمود الحاسم هو
 * «القسم ومدته» — هو اللي بيخلي التأخير مرئي من غير ما تفتح صف.
 */
export function ProjectsTable({ rows, selected, onSelect, onSelectAll }: ProjectsTableProps) {
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id))

  return (
    <div className="tblwrap">
      <table className="tbl plist-t">
        <thead>
          <tr>
            <th style={{ width: 34 }}>
              <input
                type="checkbox"
                checked={allOn}
                onChange={(e) => onSelectAll(e.target.checked)}
                aria-label="تحديد كل الصفوف المعروضة"
              />
            </th>
            <th>رقم</th>
            <th>المشروع</th>
            <th>الجهة</th>
            <th>المنطقة</th>
            <th>القسم الإجرائي</th>
            <th className="n">المدة</th>
            <th className="n">المبلغ</th>
            <th className="n">الوزن</th>
            <th>المالك</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const p = stagePressure(r)
            return (
              <tr key={r.id} className={selected.has(r.id) ? 'sel' : ''}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={(e) => onSelect(r.id, e.target.checked)}
                    aria-label={`تحديد مشروع ${r.id}`}
                  />
                </td>
                <td><Mono>{r.id}</Mono></td>
                <td>
                  <Link to={ROUTES.project(r.id)} className="tlink">{r.name}</Link>
                </td>
                <td>
                  <Link to={ROUTES.entity(r.entityId)} className="tlink sub">{r.entityName}</Link>
                </td>
                <td className="sub">{r.region}</td>
                <td>{r.stage}</td>
                <td className={`n num${p > 1 ? ' over' : ''}`}>
                  {r.stageLimit > 0 ? days(r.hoursInStage) : '—'}
                </td>
                <td className="n num">
                  {nf.format(r.amountGranted > 0 ? r.amountGranted : r.amountRequested)}{' '}
                  <Riyal />
                </td>
                <td className="n num">{r.weight}</td>
                <td className="sub">{r.owner ?? '—'}</td>
                <td><Tag tone={groupTone(r.statusGroup)}>{r.statusGroup}</Tag></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

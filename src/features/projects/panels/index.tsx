import { Glass, Head, Tag, Num, Mono } from '@/components/ui'
import type { Entity, LogEntry } from '@/types/domain'

export { QuickAnalysis, type QuickAnalysisProps } from './QuickAnalysis'

/** مشاريع الجهة — سياق ثابت جنب المشروع المفتوح */
export function EntityProjectsPanel({
  entity: E,
  onOpen,
}: {
  entity: Entity
  onOpen: () => void
}) {
  return (
    <Glass>
      <Head title="مشاريع الجهة" meta={E.projects.length} />
      <div className="col-s">
        {E.projects.map((p) => (
          <button className="data li" key={p.id} style={{ padding: '.75rem 0' }} onClick={onOpen}>
            <div>
              <div className="t">{p.name}</div>
              <div className="s">
                <Mono>{p.id}</Mono>
                <Tag tone={p.tone}>{p.status}</Tag>
              </div>
            </div>
            <span className="sub">وزن <Num>{p.weight}</Num></span>
          </button>
        ))}
      </div>
    </Glass>
  )
}

/** آخر إجراء — الاختصار اللي بيغني عن فتح السجل كامل */
export function LastActionPanel({
  entry,
  onOpen,
}: {
  entry?: LogEntry
  onOpen: () => void
}) {
  if (!entry) return null

  return (
    <Glass>
      <Head title="آخر إجراء" meta={<a onClick={onOpen}>السجل كامل</a>} />
      <div className="well" style={{ padding: '.9rem 0 0' }}>
        <div style={{ fontSize: '.86rem', lineHeight: 1.7 }}>
          <b>{entry.action}</b> — {entry.body}
        </div>
        <div className="sub" style={{ marginTop: '.45rem' }}>
          {entry.by} · <Mono>{entry.at}</Mono>
        </div>
        <div className="sub" style={{ marginTop: '.25rem', color: 'var(--no)' }}>
          {entry.days} يومًا · <Num>{entry.hours}</Num> من <Num>{entry.limit}</Num> ساعة
        </div>
      </div>
    </Glass>
  )
}

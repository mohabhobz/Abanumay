import { useNavigate } from 'react-router-dom'
import { Glass, Head, Empty, Icon, icons } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { assistFor } from '@/data/mock/assistant'

export interface ModulePlaceholderProps {
  title: string
  /**
   * What will appear on this screen once it's built — prevents it from
   * feeling like something's missing.
   */
  scope: string
  /** Real figures from the current system, so the scale is visible from the start. */
  facts?: { k: string; v: string }[]
  /** The first screen built in the project, for comparison. */
  demoTo?: { label: string; to: string }
}

/**
 * A module screen not yet built.
 *
 * Not an empty "coming soon": it states what will go here and with what
 * real figures, so the client can gauge scale, and the developer knows
 * what's required.
 */
export function ModulePlaceholder({ title, scope, facts, demoTo }: ModulePlaceholderProps) {
  const navigate = useNavigate()

  return (
    <AppLayout assistantContext={assistFor.page(title)}>
      <div className="viewstack">
        <div className="screen col">
          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">{title}</h1>
            </div>
          </header>

          {facts && facts.length > 0 && (
            <Glass>
              <Head title="الحجم الفعلي في النظام" meta="مصدره النظام العامل" />
              <div className="imp" style={{ '--n': facts.length } as React.CSSProperties}>
                {facts.map((f) => (
                  <div key={f.k}>
                    <div className="v num">{f.v}</div>
                    <div className="k">{f.k}</div>
                  </div>
                ))}
              </div>
            </Glass>
          )}

          <Glass>
            <Head title="الشاشة قيد البناء" />
            {/* "Germinating" (animation 3). */}
            <Empty
              art={{ done: 0, total: 2 }}
              title={`${title}، لم تُبنَ بعد في هذا النموذج.`}
              note={scope}
              actions={
                demoTo && (
                  <button className="btn btn-2" onClick={() => navigate(demoTo.to)}>
                    <Icon name={icons.doc} size="sm" />
                    {demoTo.label}
                  </button>
                )
              }
            />
          </Glass>
        </div>
      </div>
    </AppLayout>
  )
}

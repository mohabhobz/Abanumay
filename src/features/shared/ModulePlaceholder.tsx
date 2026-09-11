import { useNavigate } from 'react-router-dom'
import { Glass, Head, Empty, Icon, icons } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { assistFor } from '@/data/mock/assistant'

export interface ModulePlaceholderProps {
  title: string
  /** اللي هيظهر في الشاشة دي لما تتبني — بيمنع إحساس إن الشاشة ناقصة */
  scope: string
  /** الأرقام الحقيقية من النظام العامل، عشان الحجم يبان من دلوقتي */
  facts?: { k: string; v: string }[]
  /** أول شاشة اتبنت في المشروع، للمقارنة */
  demoTo?: { label: string; to: string }
}

/**
 * شاشة موديول لسه ما اتبنتش.
 *
 * مش «قريبًا» فاضية: بتقول إيه اللي هيقع هنا وبأي أرقام حقيقية،
 * فالعميل يقيس الحجم، والمطوّر يعرف إيه المطلوب.
 */
export function ModulePlaceholder({ title, scope, facts, demoTo }: ModulePlaceholderProps) {
  const navigate = useNavigate()

  return (
    <AppLayout assistantContext={assistFor.page(title)}>
      <div className="viewstack">
        <div className="screen col">
          <nav className="crumb" aria-label="مسار التنقّل">
            <span className="now">{title}</span>
          </nav>

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
            <Empty
              title={`${title} — لم تُبنَ بعد في هذا النموذج.`}
              note={scope}
              actions={
                demoTo && (
                  <button className="btn btn-2" onClick={() => navigate(demoTo.to)}>
                    <Icon name={icons.doc} size={16} />
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

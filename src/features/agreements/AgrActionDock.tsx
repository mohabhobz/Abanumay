import { useRef, useState } from 'react'
import { ButtonLabel, FormField, Button, DecisionDialog, Icon, icons, Money, Person, Tag } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'
import type { AgreementRow } from '@/types/domain'
import type { AgrAction } from '@/data/agreements/store'
import { noteFirst } from '@/lib/dock'

/* Agreement exits · what differentiates the stations of the flow (BPD-008).

   A return doesn't have a single destination, and that's easy to forget. The spec names each
   return's destination individually, and they differ:

   Manager's return → grants supervisor
   Executive's return → **the grants manager**, not the supervisor (8.2.19)
   Entity's return → **the grants supervisor**, not the manager (8.2.25)

   So the destination is written into the button's own name. Sending to the entity doesn't exist
   before the executive's approval · not disabled, simply absent (8.4.13). And after signing there
   are no content exits · a change opens a new version (8.4.17).

   The actions come from the store (`agrActions`) and run through it · this dock only collects the
   note or the signed copy, and states why an action is blocked. */

export interface AgrActionDockProps {
  who: string
  agreement: AgreementRow
  actions: AgrAction[]
  /** Why the forward action is blocked · the completeness check's first finding */
  stop?: string
  /** The store's answer to the last action · shown in the bar */
  said?: string
  /** Runs the action · returns what refused it, which the popup shows */
  onAct: (a: AgrAction, file?: string, note?: string) => string[] | void
}

export function AgrActionDock({ who, agreement, actions, stop, said, onAct }: AgrActionDockProps) {
  const bar = useRef<HTMLDivElement>(null)
  useProximity(bar)
  const [pick, setPick] = useState<AgrAction | null>(null)
  const [file, setFile] = useState('')

  return (
    <div className="decdock">
      <div className="chrome decbar payact" ref={bar}>
        <div className="rowf gp-3 payact-w">
          <Person name={who} size="lg" quiet={false} />
          <span className="decsent">
            قرارك في اتفاقية <b>{agreement.projectName}</b>
            <span className="decsep" />
            <Money>{agreement.amount}</Money>
            {said && <><span className="decsep" /><span className="bad">{said}</span></>}
          </span>
        </div>

        {/* Client 26 Oct · the bar holds the buttons only · each one confirms in its popup, with the
            reason (a return) or the signed copy (a paper signature) asked there */}
        <div className="payact-g">
          <div className="rowf gp-2">
            {noteFirst(actions).map((x) => {
              const why = x.kind === 'btn-p' && !x.needsFile && stop ? stop : ''
              return (
                <Button plain
                  key={x.label}
                  className={`btn ${x.kind}`}
                  data-needs-note={x.needsNote ? '' : undefined}
                  disabled={Boolean(why)}
                  title={why || undefined /* doc · step x.step */}
                  onClick={() => { if (x.act === 'entitySign') { onAct(x); return } setPick(x); setFile('') }}
                >
                  {x.needsFile && <Icon name={icons.upload} size="sm" />}{x.label}
                </Button>
              )
            })}
          </div>
        </div>
      </div>
      {pick && (
        <DecisionDialog
          title={pick.label}
          tone={pick.kind === 'btn-d' ? 'btn-d' : 'btn-p'}
          subject={<>اتفاقية {agreement.projectName} · <Money>{agreement.amount}</Money></>}
          note={pick.needsNote ? 'required' : 'optional'}
          notePlaceholder={pick.needsNote ? /* doc 8.2.15 */ 'سبب الإعادة · يصل مع الاتفاقية إلى صاحب الخطوة السابقة' : undefined}
          ready={!pick.needsFile || Boolean(file)}
          onClose={() => setPick(null)}
          onConfirm={(n) => onAct(pick, file || undefined, n)}
        >
          {pick.needsFile && (
            <FormField label={pick.label} required as="div">
              <span className="apv-row">
                <ButtonLabel variant="2" size="sm">
                  <Icon name={icons.upload} size="sm" />{file ? 'استبدل الملف' : 'ارفع الملف'}
                  <input className="vis-h" type="file" accept=".pdf,.jpg,.png" aria-label={pick.label} onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f.name); e.target.value = '' }} />
                </ButtonLabel>
                {file ? <Tag tone="ok">{file}</Tag> : <span className="sub">لا ملف بعد</span>}
              </span>
            </FormField>
          )}
        </DecisionDialog>
      )}
    </div>
  )
}

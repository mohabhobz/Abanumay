import { useRef, useState } from 'react'
import { ButtonLabel, FormField, FieldBox, Button, DecisionDialog, Icon, icons, Money, Person, Tag } from '@/components/ui'
import { nf } from '@/lib/format'
import { useProximity } from '@/hooks/useProximity'
import { payStops, type PayAction } from '@/data/payments/store'
import type { CurrentUser, PayRequest } from '@/types/domain'
import { noteFirst } from '@/lib/dock'

/* A payment record's exits · v3 · 9.2.7 · 9.2.10 · 9.2.12 · 9.2.14 · 9.2.16 · 9.4.24.

   One record, one dock · the exits come from the payments store (`payActions`), which also refuses
   what the stage or the controls don't allow, so the dock only states the reason before the click.

     Grants supervisor · 9.2.7   -> approve the requirements («مؤهلة للصرف») · return to the entity
     Grants supervisor · 9.2.10  -> create the permit by hand, with its amount (9.4.4)
     Grants manager · 9.2.12     -> approve · return to the supervisor · final rejection · cancel
     Finance · 9.2.14 · 9.2.16   -> the order, then the transfer · its proof picked, then confirmed
     Manager / executive · 9.4.24 -> cancel a permit before the transfer, with its reason

   A return, a rejection or a cancellation always takes a note. After the transfer there are no exits. */

export interface ActionDockProps {
  user: CurrentUser
  request: PayRequest
  actions: PayAction[]
  /** Runs the decision · returns what refused it, which the popup shows */
  onAct: (a: PayAction, file?: string, amount?: number, note?: string) => string[] | void
}

export function ActionDock({ user, request, actions, onAct }: ActionDockProps) {
  const bar = useRef<HTMLDivElement>(null)
  useProximity(bar)
  const [pick, setPick] = useState<PayAction | null>(null)
  const needAmount = Boolean(pick?.needsAmount)
  const [amount, setAmount] = useState('')
  const amt = amount === '' ? request.due : Number(amount) || 0
  /* 9.2.16 · the transfer's proof is picked first, then the transfer confirmed · a pick alone never executes it */
  const [proof, setProof] = useState<{ act: string; name: string } | null>(null)

  return (
    <div className="decdock">
      <div className="chrome decbar payact" ref={bar}>
        <div className="rowf gp-3 payact-w">
          <Person name={user.name} size="lg" quiet={false} />
          <span className="decsent">
            قرارك بشأن <b>{request.projectName}</b> · الدفعة <b>{request.no}</b>
            <span className="decsep" />
            <Money>{needAmount ? amt : request.asked}</Money>
          </span>
        </div>

        {/* Client 26 Oct · the bar holds the buttons only · each one opens its popup · the amount, the
            proof and the reason the decision needs are asked there */}
        <div className="payact-g">
          <div className="rowf gp-2">
            {noteFirst(actions).map((a) => {
              /* Rules 9 · 14 · 11 · 10 - a forward exit stays locked until every control passes,
                 and the reason is written in `title`, not hidden in color alone. */
              const stops = payStops(request, a.act, a.needsAmount ? request.due : request.asked)
              return (
                <Button plain
                  key={a.label}
                  className={`btn ${a.kind}`}
                  data-needs-note={a.needsNote ? '' : undefined}
                  disabled={Boolean(stops[0]) && !a.needsAmount}
                  title={stops[0] || undefined /* doc · step a.step */}
                  onClick={() => { setPick(a); setAmount(''); setProof(null) }}
                >
                  {a.label}
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
          subject={<>{request.projectName} · الدفعة {request.no} · <Money>{pick.needsAmount ? amt : request.asked}</Money></>}
          note={pick.needsNote ? 'required' : 'optional'}
          notePlaceholder={pick.needsNote ? 'السبب وما يلزم استكماله · يصل مع القرار' : undefined}
          stops={payStops(request, pick.act, pick.needsAmount ? amt : request.asked)}
          ready={!pick.needsFile || Boolean(proof)}
          confirmLabel={pick.confirm ?? `تأكيد: ${pick.label}`}
          onClose={() => setPick(null)}
          onConfirm={(n) => onAct(pick, proof?.name, pick.needsAmount ? amt : undefined, n)}
        >
          {pick.needsAmount && (
            <FormField label="قيمة إذن الصرف" required>
              <FieldBox>
                <input className="num" inputMode="numeric" aria-label="قيمة إذن الصرف"
                  value={nf.format(amount === '' ? request.due : Number(amount) || 0)}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
              </FieldBox>
            </FormField>
          )}
          {pick.needsFile && (
            <FormField label={pick.needsFile} required as="div">
              <span className="apv-row">
                <ButtonLabel variant="2" size="sm">
                  <Icon name={icons.upload} size="sm" />{proof ? 'استبدل الملف' : 'ارفع الملف'}
                  <input className="vis-h" type="file" accept=".pdf,.jpg,.png" aria-label={`${pick.label} · ${pick.needsFile}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) setProof({ act: pick.act, name: f.name }); e.target.value = '' }} />
                </ButtonLabel>
                {proof ? <Tag tone="ok">{proof.name}</Tag> : <span className="sub">لا ملف بعد</span>}
              </span>
            </FormField>
          )}
        </DecisionDialog>
      )}
    </div>
  )
}

import { useRef, useState } from 'react'
import { Icon, icons, Money, Person } from '@/components/ui'
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
  note: string
  onNote: (v: string) => void
  onAct: (a: PayAction, file?: string, amount?: number) => void
}

export function ActionDock({ user, request, actions, note, onNote, onAct }: ActionDockProps) {
  const bar = useRef<HTMLDivElement>(null)
  useProximity(bar)
  const needNote = actions.some((a) => a.needsNote)
  const needAmount = actions.some((a) => a.needsAmount)
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

        {/* The field and buttons form one group that wraps together. */}
        <div className="payact-g">
          {needAmount && (
            <label className="payact-a">
              <span className="vis-h">قيمة إذن الصرف</span>
              <input
                className="num" inputMode="numeric" aria-label="قيمة إذن الصرف"
                value={nf.format(amount === '' ? request.due : Number(amount) || 0)}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              />
            </label>
          )}
          {needNote && (
            <label className="payact-n">
              <span className="vis-h">ملاحظات الإعادة</span>
              <input
                value={note}
                onChange={(e) => onNote(e.target.value)}
                placeholder="السبب وما يلزم استكماله · إلزامي للإعادة والرفض والإلغاء"
              />
            </label>
          )}

          <div className="rowf gp-2">
            {noteFirst(actions).map((a) => {
              /* Rules 9 · 14 · 11 · 10 - a forward exit stays locked until every control passes,
                 and the reason is written in `title`, not hidden in color alone. */
              const stops = payStops(request, a.act, a.needsAmount ? amt : request.asked)
              const stop = a.needsNote && !note.trim() ? 'اكتب السبب أولًا' : stops[0] ?? ''
              if (a.needsFile && !stop) {
                const picked = proof?.act === a.act ? proof : null
                return (
                  <span key={a.label} className="rowf gp-2">
                    <label className={`btn ${picked ? 'btn-2' : a.kind}`} title={`ارفع ${a.needsFile}` /* doc · step a.step */}>
                      <Icon name={icons.upload} size="sm" />{picked ? picked.name : a.needsFile}
                      <input className="vis-h" type="file" accept=".pdf,.jpg,.png" aria-label={`${a.label} · ${a.needsFile}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) setProof({ act: a.act, name: f.name }); e.target.value = '' }} />
                    </label>
                    <button className={`btn ${a.kind}`} disabled={!picked} title={picked ? undefined : `ارفع ${a.needsFile} أولًا`} onClick={() => { if (picked) { onAct(a, picked.name); setProof(null) } }}>
                      {a.confirm ?? a.label}
                    </button>
                  </span>
                )
              }
              return (
                <button
                  key={a.label}
                  className={`btn ${a.kind}`}
                  data-needs-note={a.needsNote ? '' : undefined}
                  disabled={Boolean(stop)}
                  title={stop || undefined /* doc · step a.step */}
                  onClick={() => onAct(a, undefined, a.needsAmount ? amt : undefined)}
                >
                  {a.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

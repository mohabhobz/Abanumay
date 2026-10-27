import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { DockActions, DateText, FieldSelect, Icon, KV, Money, Num, Person, Tag, icons } from '@/components/ui'
import { CfgNum } from '@/features/settings/CfgEdit'
import { linesFor } from '@/features/budget/lines'
import { isolate, nf } from '@/lib/format'
import { docTitle, moneyOf } from '@/data/mock/budgetTree'
import type { ProjectRow } from '@/types/domain'
import { meOf, readRole } from '@/data/roles'
import { docOf, linkOf, useBudget, type LinkShare } from '@/data/budget/store'
import {
  RELOC_SAY, SCOPE_SAY, decideRelocation, mayApproveRelocation, mayRequestRelocation, movingOf, nextRelocationId,
  openRelocation, paidPayments, relocationEffects, relocationIssues, relocationsOf, saveRelocation, useRelocations,
  type NewShare, type RelocScope, type Relocation,
} from '@/data/budget/relocate'

/* v3 · 1.3b · «إعادة تسكين مشروع» on the project's funding card · the requests on the project, the
   form that writes one and the approver's decision. The current and the new link sit side by side
   with the payments made and each line's balance before and after, so the move reads before it runs
   (1.3b.4). */

const TONE: Record<Relocation['state'], 'ok' | 'warn' | 'mute' | 'no'> = { draft: 'mute', submitted: 'warn', returned: 'no', approved: 'ok' }

const titleOf = (x: { docId: string; nodeId: string }) => docOf(x.docId)?.nodes.find((n) => n.id === x.nodeId)?.label ?? x.nodeId
const budgetOf = (x: { docId: string }) => { const d = docOf(x.docId); return d ? docTitle(d) : x.docId }

function SideBySide({ from, to, scope }: { from: LinkShare[]; to: NewShare[]; scope: RelocScope }) {
  return (
    <div className="rl-side">
      <div>
        <h4 className="fnd-h">الارتباط الحالي</h4>
        <ul className="apv-list">
          {from.map((x) => (
            <li key={`${x.docId}/${x.nodeId}`}>
              <span className="apv-t"><b>{titleOf(x)}</b><span className="sub">{budgetOf(x)} · المصروف <Money sm>{x.paid}</Money>{scope === 'unpaid' && x.paid > 0 ? ' · يبقى على بنده' : ''}</span></span>
              <span className="pc-sp" /><Money sm>{x.amount}</Money>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="fnd-h">الارتباط الجديد</h4>
        <ul className="apv-list">
          {to.filter((x) => x.nodeId).map((x) => (
            <li key={`${x.docId}/${x.nodeId}`}>
              <span className="apv-t"><b>{titleOf(x)}</b><span className="sub">{budgetOf(x)}</span></span>
              <span className="pc-sp" /><Money sm>{x.amount}</Money>
            </li>
          ))}
          {!to.some((x) => x.nodeId) && <li className="sub">لم يُختر بعد</li>}
        </ul>
      </div>
    </div>
  )
}

function Effects({ r }: { r: Pick<Relocation, 'from' | 'to' | 'scope'> }) {
  const eff = relocationEffects(r)
  if (!eff.length) return null
  return (
    <>
      <h4 className="fnd-h">الأثر على الأرصدة المتاحة</h4>
      <ul className="apv-list">
        {eff.map((e) => (
          <li key={e.key}>
            <span className="apv-t"><b>{e.label}</b><span className="sub">{e.budget}</span></span>
            <span className="pc-sp" />
            <span className="sub"><Money sm>{e.before}</Money> ← <Money sm>{e.after}</Money></span>
            <Tag tone={e.delta >= 0 ? 'ok' : 'warn'}>{e.delta >= 0 ? 'يُحرَّر' : 'يُحجز'} <Num>{Math.abs(e.delta)}</Num></Tag>
          </li>
        ))}
      </ul>
    </>
  )
}

export function RelocationPanel({ row }: { row: ProjectRow }) {
  useRelocations()
  useBudget()
  const role = readRole()
  const me = meOf(role)
  const l = linkOf(row.id)
  const list = relocationsOf(row.id)
  const open = openRelocation(row.id)
  const [edit, setEdit] = useState<Relocation | 'new' | null>(null)
  const [said, setSaid] = useState<string[]>([])
  const paid = paidPayments(row.id)

  if (!l || l.stage !== 'final') return list.length ? <RelocList list={list} /> : null
  const canAsk = mayRequestRelocation(role) && (!open || (open.state !== 'submitted' && open.by === me))

  return (
    <>
      <h4 className="fnd-h">إعادة تسكين المشروع{/* doc 1.3b */}</h4>
      {list.length > 0 && <RelocList list={list} />}
      {open?.state === 'submitted' && mayApproveRelocation(role) && (
        <div className="apv-rec">
          <div className="apv-rec-h"><b>{open.id} · بانتظار اعتمادك</b><span className="pc-sp" /><Person name={open.by} /></div>
          <KV rows={[
            { k: 'المبالغ المعاد تسكينها', v: <>{SCOPE_SAY[open.scope]} · <Money sm>{movingOf(l.shares, open.scope)}</Money></> },
            { k: 'السبب', v: open.reason },
            { k: 'المستند الداعم', v: open.files.length ? open.files.join(' · ') : 'لا مرفق' },
          ]} />
          {/* The live link · a payment since the request was written shows */}
          <SideBySide from={l.shares} to={open.to} scope={open.scope} />
          <Effects r={{ ...open, from: l.shares }} />
          <div className="apv-row mt-2">
            {/* Client 26 Oct · the decision confirms in its popup · the return's reason there */}
            <DockActions
              actions={[{ label: 'أعد للمراجعة', kind: 'btn-2 btn-sm', needsNote: true, d: 'return' as const }, { label: 'اعتمد ونفّذ', kind: 'btn-p btn-sm', d: 'approve' as const }]}
              subject={<>{open.id} · {SCOPE_SAY[open.scope]}</>}
              placeholder="ملاحظات القرار"
              onRun={(x, n) => { const w = decideRelocation(open.id, x.d, n, me); setSaid(w); return w }}
            />
          </div>
          {said.length > 0 && <ul className="apv-sig">{said.map((x) => <li key={x} className="no"><Icon name={icons.alert} size="sm" /><span>{x}</span></li>)}</ul>}
        </div>
      )}
      {canAsk && (
        <button className="btn btn-2 btn-sm" onClick={() => setEdit(open ?? 'new')}>
          <Icon name={icons.edit} size="sm" />{open ? `عدّل ${open.id} وأرسله` : 'طلب إعادة تسكين'}
        </button>
      )}
      {edit && <RelocForm row={row} base={edit === 'new' ? undefined : edit} paid={paid} onClose={() => setEdit(null)} />}
    </>
  )
}

function RelocList({ list }: { list: Relocation[] }) {
  return (
    <ul className="apv-list">
      {list.map((r) => (
        <li key={r.id}>
          <Tag tone={TONE[r.state]}>{RELOC_SAY[r.state]}</Tag>
          <span className="apv-t">
            <b>{r.id} · {SCOPE_SAY[r.scope]} · <Money sm>{movingOf(r.from, r.scope)}</Money></b>
            <span className="sub">{r.reason}{r.decided?.note ? ` · ${r.decided.note}` : ''}</span>
          </span>
          <span className="pc-sp" />
          <Person name={r.decided?.by ?? r.by} />
          <span className="sub"><DateText>{(r.decided?.at ?? r.at).slice(0, 10)}</DateText></span>
        </li>
      ))}
    </ul>
  )
}

function RelocForm({ row, base, paid, onClose }: { row: ProjectRow; base?: Relocation; paid: { no: number; amount: number; at: string }[]; onClose: () => void }) {
  const me = meOf(readRole())
  const l = linkOf(row.id)!
  const lines = useMemo(() => linesFor(row.year), [row.year])
  const [scope, setScope] = useState<RelocScope>(base?.scope ?? 'unpaid')
  const need = movingOf(l.shares, scope)
  const [to, setTo] = useState<NewShare[]>(base?.to ?? [{ docId: '', nodeId: '', amount: need }])
  const [reason, setReason] = useState(base?.reason ?? '')
  const [files, setFiles] = useState<string[]>(base?.files ?? [])
  const [said, setSaid] = useState<string[]>([])
  const id = base?.id ?? nextRelocationId()

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  /* One line carries the whole moving amount · a split asks for each part */
  const fit = (xs: NewShare[], n = need) => (xs.length === 1 ? [{ ...xs[0], amount: n }] : xs)
  const req = { id, projectId: row.id, projectName: row.name, by: me, scope, reason, files, to: to.filter((x) => x.nodeId) }
  const issues = relocationIssues(req)

  return createPortal(
    <div className="bmask" role="presentation" onClick={onClose}>
      <div className="chrome modal modal-w" role="dialog" aria-modal="true" aria-label="طلب إعادة تسكين مشروع" onClick={(e) => e.stopPropagation()}>
        <div className="mh">
          <Icon name={icons.budget} size="md" />
          <b>طلب إعادة تسكين · {id}</b>
          <span className="pc-sp" />
          <span className="sub trim1">{row.name}</span>
        </div>
        <div className="mb col bglink">
          <div className="regf">
            <span className="lb">المبالغ المراد إعادة تسكينها<b className="regf-r" aria-label="إلزامي">*</b></span>
            <div className="cfgchips" role="radiogroup" aria-label="المبالغ المراد إعادة تسكينها">
              {(['unpaid', 'all'] as const).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={scope === v} className={`cfgchip${scope === v ? ' on' : ''}`} onClick={() => { setScope(v); setTo((xs) => fit(xs, movingOf(l.shares, v))) }}>
                  {SCOPE_SAY[v]} · {nf.format(movingOf(l.shares, v))}
                </button>
              ))}
            </div>
          </div>
          <div className="regf">
            <span className="lb">الارتباط المالي الجديد<b className="regf-r" aria-label="إلزامي">*</b></span>
            <ul className="bgsrc">
              {to.map((x, i) => (
                <li key={i}>
                  <FieldSelect
                    value={x.nodeId ? `${x.docId}/${x.nodeId}` : ''}
                    label={i === 0 ? 'بند الارتباط الجديد' : `بند الارتباط الجديد ${i + 1}`}
                    placeholder="اختر البند الفرعي"
                    searchAt={6}
                    options={lines.map((o) => ({ value: o.key, label: isolate(`${o.node.label} · متاح ${nf.format(moneyOf(o.doc.nodes, o.node.id).available)}`) }))}
                    onChange={(v) => { const [docId, nodeId] = v.split('/'); setTo((xs) => fit(xs.map((y, j) => (j === i ? { ...y, docId, nodeId } : y)))) }}
                  />
                  {to.length > 1
                    ? <CfgNum value={x.amount} label={`مبلغ البند ${i + 1}`} onChange={(n) => setTo((xs) => xs.map((y, j) => (j === i ? { ...y, amount: n } : y)))} />
                    : <span className="sub"><Money sm>{need}</Money></span>}
                  {to.length > 1 ? (
                    <button type="button" className="btn btn-ghost btn-sm" aria-label={`احذف السطر ${i + 1}`} onClick={() => setTo((xs) => fit(xs.filter((_, j) => j !== i)))}><Icon name={icons.close} size="sm" /></button>
                  ) : <span />}
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-2 btn-sm bglink-go" onClick={() => setTo((xs) => [...xs, { docId: '', nodeId: '', amount: Math.max(0, need - xs.reduce((a, y) => a + y.amount, 0)) }])}>
              <Icon name={icons.plus} size="sm" />أضف بندًا آخر
            </button>
          </div>

          <SideBySide from={l.shares} to={to} scope={scope} />
          <h4 className="fnd-h">الدفعات المصروفة <span className="sub"><Num>{paid.length}</Num></span></h4>
          {paid.length ? (
            <ul className="apv-list">{paid.map((x) => <li key={x.no}><span className="apv-t"><b>الدفعة <Num>{x.no}</Num></b></span><span className="pc-sp" /><Money sm>{x.amount}</Money><span className="sub"><DateText>{x.at}</DateText></span></li>)}</ul>
          ) : <p className="sub cnote">لا دفعات مصروفة على المشروع.</p>}
          <Effects r={{ from: l.shares, to: to.filter((x) => x.nodeId), scope }} />

          <label className="regf">
            <span className="lb">سبب إعادة التسكين<b className="regf-r" aria-label="إلزامي">*</b></span>
            <span className="fld"><input value={reason} onChange={(e) => setReason(e.target.value)} aria-label="سبب إعادة التسكين" placeholder="مثال: نقل التمويل إلى بند الهدف الصحيح بعد إعادة الهيكلة" /></span>
          </label>
          <div className="apv-row">
            {files.map((f) => <Tag key={f} tone="ok"><Icon name={icons.clip} size="sm" /> {f}</Tag>)}
            <label className="btn btn-2 btn-sm">
              <Icon name={icons.upload} size="sm" />أرفق القرار أو المستند الداعم
              <input className="vis-h" type="file" accept=".pdf,.doc,.docx,.png,.jpg" aria-label="المستند الداعم لإعادة التسكين" onChange={(e) => { const x = e.target.files?.[0]; if (x) setFiles((fs) => [...new Set([...fs, x.name])]); e.target.value = '' }} />
            </label>
          </div>
          {(said.length > 0 || issues.length > 0) && (
            <ul className="apv-sig" aria-live="polite">{(said.length ? said : issues).map((x) => <li key={x} className="no"><Icon name={icons.alert} size="sm" /><span>{x}</span></li>)}</ul>
          )}
        </div>
        <div className="mf">
          <button className="btn btn-p" disabled={issues.length > 0} title={issues[0]} onClick={() => { const w = saveRelocation(req, true); setSaid(w); if (!w.length) onClose() }}>أرسل للاعتماد النهائي</button>
          <button className="btn btn-2" onClick={() => { const w = saveRelocation(req, false); setSaid(w); if (!w.length) onClose() }}>احفظ مسودة</button>
          <button className="btn btn-2" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

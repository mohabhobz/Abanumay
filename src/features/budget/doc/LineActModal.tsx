import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon, MultiSelect, icons } from '@/components/ui'
import { childrenOf, pathOf, type BudgetDoc, type BudgetNode } from '@/data/mock/budgetTree'
import { CYCLE } from '@/data/intake/cycle'
import { lineDeps, ownersOf, setLineOwners, setLineStatus } from '@/data/budget/store'

/* A line on an approved budget · its structure is fixed (changes go through an operation request),
   but two things stay open to whoever settings name: its status, and the supervisors of a domain.

   Turning a line off stops it taking new projects and carries down to every line beneath it; what
   was already held, committed and paid on it stays exactly where it is (1.4.38 · 1.4.39). The
   reason is written once and lands in the budget's history. */

export function LineActModal({ doc, node, me, mayStatus, onClose }: {
  doc: BudgetDoc; node: BudgetNode; me: string; mayStatus: boolean; onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [owners, setOwners] = useState<string[]>(ownersOf(node))
  const dep = lineDeps(doc, node.id)
  const below = (id: string): number => childrenOf(doc.nodes, id).reduce((a, k) => a + 1 + below(k.id), 0)
  const n = below(node.id)
  const domain = node.kind === 'main' && node.parentId !== null && doc.nodes.find((x) => x.id === node.parentId)?.kind === 'main'
  const ownersChanged = JSON.stringify(owners) !== JSON.stringify(ownersOf(node))

  return createPortal(
    <div className="bmask" role="presentation" onClick={onClose}>
      <div className="chrome modal" role="dialog" aria-modal="true" aria-label={`إجراء على ${node.label}`} onClick={(x) => x.stopPropagation()}>
        <div className="mh">
          <Icon name={icons.budget} size="md" />
          <b>{node.label}</b>
          <span className="pc-sp" />
          <span className="sub trim1">{pathOf(doc.nodes, node.id)}</span>
        </div>
        <div className="mb col">
          {mayStatus && (
            <>
              <p className="sub cnote">
                {node.active
                  ? <>إيقاف البند يمنع ربط مشاريع جديدة عليه{n ? <> ويوقف معه <b className="num">{n}</b> بندًا تحته</> : null} · ويبقى ما عليه من حجز والتزام وصرف كما هو.</>
                  : 'تفعيل البند يعيده للتقديم والربط · ويعود معه ما أوقفه إيقافه وحده.'}
              </p>
              {node.active && dep.projects.length > 0 && (
                <p className="sub cnote">عليه <b className="num">{dep.projects.length}</b> مشروع قائم · لا يتأثر بالإيقاف.</p>
              )}
              <label className="regf">
                <span className="lb">السبب{node.active && <b className="regf-r" aria-label="إلزامي">*</b>}</span>
                <span className="fld"><input autoFocus value={reason} onChange={(x) => setReason(x.target.value)} aria-label="السبب" /></span>
              </label>
            </>
          )}
          {domain && (
            <label className="regf">
              <span className="lb">مشرف المنح المسؤول</span>
              <MultiSelect
                label="مشرف المنح المسؤول"
                all="بلا إسناد"
                people
                values={owners}
                options={CYCLE.supervisors.map((s) => ({ value: s, label: s }))}
                onChange={setOwners}
              />
              <span className="sub regf-h">يُوزَّع عليه ما يرد من مشاريع المجال في دورة الاستقبال</span>
            </label>
          )}
        </div>
        <div className="mf">
          {mayStatus && (
            <button
              className={`btn ${node.active ? 'btn-d' : 'btn-p'}`}
              disabled={node.active && !reason.trim()}
              onClick={() => { setLineStatus(doc.id, node.id, !node.active, reason.trim(), me); onClose() }}
            >
              {node.active ? 'أوقف البند' : 'فعّل البند'}
            </button>
          )}
          {domain && (
            <button className="btn btn-2" disabled={!ownersChanged} onClick={() => { setLineOwners(doc.id, node.id, owners, me); onClose() }}>
              احفظ الإسناد
            </button>
          )}
          <button className="btn btn-2" onClick={onClose}>تراجع</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

import { useState } from 'react'
import { FormField, FieldBox, Modal, ModalHead, Button, FieldMultiSelect, icons } from '@/components/ui'
import { childrenOf, pathOf, type BudgetDoc, type BudgetNode } from '@/data/mock/budgetTree'
import { CYCLE } from '@/data/intake/cycle'
import { ownersOf, setLineOwners, setLineStatus } from '@/data/budget/store'

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
  const below = (id: string): number => childrenOf(doc.nodes, id).reduce((a, k) => a + 1 + below(k.id), 0)
  const n = below(node.id)
  const domain = node.kind === 'main' && node.parentId !== null && doc.nodes.find((x) => x.id === node.parentId)?.kind === 'main'
  const ownersChanged = JSON.stringify(owners) !== JSON.stringify(ownersOf(node))

  return <Modal label={`إجراء على ${node.label}`} onClose={onClose}>
        <ModalHead icon={icons.budget} title={node.label}>
          <span className="pc-sp" />
          <span className="sub trim1">{pathOf(doc.nodes, node.id)}</span>
        </ModalHead>
        <div className="mb col">
          {mayStatus && (
            <>
              {node.active && n > 0 && (
                <p className="sub cnote">يتوقف معه <b className="num">{n}</b> بندًا تحته.</p>
              )}
              <FormField label="السبب" required={node.active}>
                <FieldBox><input autoFocus value={reason} onChange={(x) => setReason(x.target.value)} aria-label="السبب" /></FieldBox>
              </FormField>
            </>
          )}
          {domain && (
            <FormField label="مشرف المنح المسؤول">
              <FieldMultiSelect
                label="مشرف المنح المسؤول"
                placeholder="بلا إسناد"
                people
                values={owners}
                options={CYCLE.supervisors.map((s) => ({ value: s, label: s }))}
                onChange={setOwners}
              />

            </FormField>
          )}
        </div>
        <div className="mf">
          {mayStatus && (
            <Button
              variant={node.active ? 'd' : 'p'}
              disabled={node.active && !reason.trim()}
              onClick={() => { setLineStatus(doc.id, node.id, !node.active, reason.trim(), me); onClose() }}
            >
              {node.active ? 'أوقف البند' : 'فعّل البند'}
            </Button>
          )}
          {domain && (
            <Button variant="2" disabled={!ownersChanged} onClick={() => { setLineOwners(doc.id, node.id, owners, me); onClose() }}>
              احفظ الإسناد
            </Button>
          )}
          <Button variant="2" onClick={onClose}>تراجع</Button>
        </div>
      </Modal>
}

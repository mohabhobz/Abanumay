import { useState } from 'react'
import { FormField, FieldBox, Button, DateText, FieldSelect, Glass, Head, Icon, Money, MoneyField, Num, Person, Tag, icons } from '@/components/ui'
import type { ProjectRow } from '@/types/domain'
import { HOLDER_LABEL, type Holder } from '@/data/holders'
import { meOf, readRole } from '@/data/roles'
import { docSources } from '@/data/mock/budgetTree'
import { sourceName, useBudget } from '@/data/budget/store'
import { nf } from '@/lib/format'
import {
  addLevelNote, appFlowOf, changeAmount, changeBeneficiaries, finPosition, holdLine, optionSeat, planKind, setFundingSource,
  setPlanNeed, supportAmount, useApprovals,
} from '@/data/approvals/store'
import { TransferModal } from '@/features/projects/TransferModal'

/* Client 24 Oct (#82 – #84) · «خيارات الاعتماد» · what the level holding the decision may change with it.

   The grants manager: whether the project has a plan, its funding source, re-housing it (track, field
   and goal, with its financial link), its supervisor, the support amount, the beneficiaries and his
   notes · the executive director: the amount, the beneficiaries and his notes · the committee and the
   board take the same three with their session decision (SessionPage). Every change is written to
   the project's log with its value before and after; the history of each reads under its row. */

export function ApprovalOptions({ row }: { row: ProjectRow }) {
  useApprovals()
  useBudget()
  const role = readRole()
  const me = meOf(role)
  const seat = optionSeat(row, role)
  const f = appFlowOf(row.id)
  const [to, setTo] = useState(0)
  const [why, setWhy] = useState('')
  const [bTo, setBTo] = useState(0)
  const [bWhy, setBWhy] = useState('')
  const [note, setNote] = useState('')
  const [said, setSaid] = useState<string[]>([])
  const [modal, setModal] = useState<'owner' | 'rehouse' | null>(null)
  /* The committee and the board decide in their session · their options sit there */
  if (!seat || seat === 'committee' || seat === 'board') return null
  const mgr = seat === 'manager'
  const amount = supportAmount(row)
  const fin = finPosition(row)
  const hold = holdLine(row.id)
  const sources = hold?.doc ? docSources(hold.doc) : []
  const pk = planKind(row)
  const benefs = f.benefs ?? []
  const notes = f.levelNotes ?? []

  return (
    <Glass>
      <Head title="خيارات الاعتماد" meta={<Tag tone="warn">{HOLDER_LABEL[seat as Holder]}</Tag>} />
      <ul className="cfglist">
        {mgr && (
          <li>
            <span className="cfgl"><b>هل المشروع له خطة؟</b></span>
            {pk === 'regular' ? (
              <span className="cfgchips" role="radiogroup" aria-label="الخطة">
                {([true, false] as const).map((v) => (
                  <Button plain key={String(v)} type="button" role="radio" aria-checked={f.needsPlan === v} className={`cfgchip${f.needsPlan === v ? ' on' : ''}`} onClick={() => setSaid(setPlanNeed(row, v, me))}>
                    {v ? 'يتطلب خطة' : 'لا يتطلب خطة'}
                  </Button>
                ))}
              </span>
            ) : <Tag tone="mute">{pk === 'portfolio' ? 'يتطلب خطة' : 'لا يتطلب خطة'}</Tag>}
          </li>
        )}
        {mgr && (
          <li>
            <span className="cfgl"><b>مصدر التمويل</b>{!hold?.doc && <span className="sub">يُختار بعد ربط المشروع بالميزانية</span>}</span>
            {sources.length > 0 ? (
              <FieldSelect value={f.source?.code ?? ''} label="مصدر التمويل" placeholder="اختر المصدر"
                options={sources.map((x) => ({ value: x.code, label: sourceName(x.code) }))}
                onChange={(v) => setSaid(setFundingSource(row, v, sourceName(v), me))} />
            ) : <span className="sub">{f.source?.name ?? '—'}</span>}
          </li>
        )}
        {mgr && (
          <li>
            <span className="cfgl"><b>إعادة تسكين المشروع</b><span className="sub">{row.track} · {row.field} · {row.goal}</span></span>
            <Button type="button" variant="2" size="sm" onClick={() => setModal('rehouse')}>أعد التسكين</Button>
          </li>
        )}
        {mgr && (
          <li>
            <span className="cfgl"><b>مشرف المنح</b></span>
            {row.owner ? <Person name={row.owner} /> : <Tag tone="warn">غير مُسنَد</Tag>}
            <Button type="button" variant="2" size="sm" onClick={() => setModal('owner')}>عدّل المشرف</Button>
          </li>
        )}
        <li className="aopt-ed">
          <span className="cfgl"><b>مبلغ الدعم · <Money sm>{amount}</Money></b>{fin && <span className="sub">الحد الأعلى للزيادة <Money sm>{fin.maxRaise}</Money></span>}</span>
            <FormField label="المبلغ الجديد">
              <MoneyField value={to ? String(to) : ''} label="مبلغ الدعم الجديد" onChange={(x) => setTo(Number(x) || 0)} />
            </FormField>
            <FormField label="مبررات التعديل" required wide>
              <FieldBox><input value={why} onChange={(e) => setWhy(e.target.value)} aria-label="مبررات تعديل المبلغ" placeholder="مثال: خفض بند التجهيزات بعد مقارنة التكلفة بالمجال" /></FieldBox>
            </FormField>
            <Button type="button" variant="2" size="sm" disabled={!(to > 0) || !why.trim() || to === amount} onClick={() => { const w = changeAmount(row, seat, to, why, me); setSaid(w); if (!w.length) { setTo(0); setWhy('') } }}>ثبّت المبلغ الجديد</Button>
          </li>
        <li className="aopt-ed">
          <span className="cfgl"><b>عدد المستفيدين · <span className="num">{nf.format(row.beneficiaries)}</span></b>{benefs.length > 0 && <span className="sub">عُدّل {nf.format(benefs.length)} مرة</span>}</span>
            <FormField label="العدد الجديد">
              <FieldBox><input className="num" inputMode="numeric" value={bTo ? nf.format(bTo) : ''} aria-label="عدد المستفيدين الجديد" onChange={(e) => setBTo(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} /></FieldBox>
            </FormField>
            <FormField label="مبررات التعديل" required wide>
              <FieldBox><input value={bWhy} onChange={(e) => setBWhy(e.target.value)} aria-label="مبررات تعديل عدد المستفيدين" placeholder="مثال: الفئة المستهدفة في المدينة أقل من تقدير الجهة" /></FieldBox>
            </FormField>
            <Button type="button" variant="2" size="sm" disabled={!(bTo > 0) || !bWhy.trim() || bTo === row.beneficiaries} onClick={() => { const w = changeBeneficiaries(row, seat, bTo, bWhy, me); setSaid(w); if (!w.length) { setBTo(0); setBWhy('') } }}>ثبّت العدد الجديد</Button>
          </li>
        <li className="aopt-ed">
          <span className="cfgl"><b>ملاحظات {HOLDER_LABEL[seat as Holder]}</b></span>
          <FormField label="الملاحظة" wide>
            <FieldBox><input value={note} onChange={(e) => setNote(e.target.value)} aria-label="ملاحظة على القرار" placeholder="ملاحظة تُحفظ مع القرار في سجل المشروع" /></FieldBox>
          </FormField>
          <Button type="button" variant="2" size="sm" disabled={!note.trim()} onClick={() => { const w = addLevelNote(row, seat, note, me); setSaid(w); if (!w.length) setNote('') }}>أضف الملاحظة</Button>
        </li>
      </ul>

      {said.length > 0 && <ul className="apv-sig">{said.map((x) => <li key={x} className="no"><Icon name={icons.alert} size="sm" /><span>{x}</span></li>)}</ul>}

      {(benefs.length > 0 || notes.length > 0) && (
        <ul className="apv-list mt-2">
          {benefs.map((x, i) => (
            <li key={`b${i}`}>
              <Tag tone="warn">المستفيدون</Tag>
              <span className="apv-t"><b>{HOLDER_LABEL[x.level]} · <Num>{x.from}</Num> ← <Num>{x.to}</Num></b><span className="sub">المبررات: {x.reason}</span></span>
              <span className="pc-sp" /><Person name={x.by} /><span className="sub"><DateText>{x.at}</DateText></span>
            </li>
          ))}
          {notes.map((n) => (
            <li key={n.id}>
              <Tag tone="mute">ملاحظة</Tag>
              <span className="apv-t"><b>{n.text}</b><span className="sub">{HOLDER_LABEL[n.level]}</span></span>
              <span className="pc-sp" /><Person name={n.by} /><span className="sub"><DateText>{n.at}</DateText></span>
            </li>
          ))}
        </ul>
      )}

      {modal && <TransferModal row={row} me={me} mode={modal} onClose={() => setModal(null)} />}
    </Glass>
  )
}

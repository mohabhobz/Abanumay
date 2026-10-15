import { useState } from 'react'
import { DateField, MoneyField } from '@/components/ui'
import { amendRequest, flowOf, parseOutputs } from '@/data/intake/flow'
import { projectById } from '@/data/mock/projects'
import { OutputsEditor } from '@/features/projects/OutputsEditor'

/* v3 · 3.2.10 · a request returned for completion · the entity corrects what the supervisor asked
   for: the name, the description, the objectives and outputs, the figures and the dates. The change
   is logged and the next version carries it when the entity sends it again. */

export function ReturnedEdit({ id, by, onDone }: { id: string; by: string; onDone: () => void }) {
  const p = projectById(id)
  const f = flowOf(id)
  const last = { ...([...f.versions].reverse().find((v) => v.values)?.values ?? {}), ...(f.amended ?? {}) }
  const [v, setV] = useState<Record<string, string>>(() => ({
    name: p?.name ?? '',
    summary: last.summary ?? '',
    objectives: f.objectives.join('\n'),
    outputs: JSON.stringify(f.entityOutputs ?? parseOutputs(last.outputs)),
    amountRequested: String(p?.amountRequested ?? ''),
    reach: String(p?.beneficiaries ?? ''),
    startAt: p?.startAt ?? last.startAt ?? '',
    workDays: String(p?.durationDays ?? ''),
  }))
  const [bad, setBad] = useState<string[]>([])
  const put = (k: string, x: string) => setV((s) => ({ ...s, [k]: x }))
  return (
    <span className="ptl-edit">
      <span className="regfields">
        <label className="regf">
          <span className="lb">اسم المشروع</span>
          <span className="fld"><input value={v.name} aria-label="اسم المشروع" onChange={(e) => put('name', e.target.value)} /></span>
        </label>
        <label className="regf">
          <span className="lb">المبلغ المطلوب</span>
          <MoneyField value={v.amountRequested ?? ''} label="المبلغ المطلوب" onChange={(x) => put('amountRequested', String(x))} />
        </label>
        <label className="regf">
          <span className="lb">عدد المستفيدين المتوقَّع</span>
          <span className="fld"><input className="num" inputMode="numeric" value={v.reach} aria-label="عدد المستفيدين المتوقَّع" onChange={(e) => put('reach', e.target.value.replace(/[^\d]/g, ''))} /></span>
        </label>
        <label className="regf">
          <span className="lb">تاريخ بدء التنفيذ المتوقع</span>
          <DateField value={v.startAt ?? ''} onChange={(x) => put('startAt', x)} label="تاريخ بدء التنفيذ المتوقع" />
        </label>
        <label className="regf">
          <span className="lb">مدة التنفيذ بأيام التنفيذ</span>
          <span className="fld"><input className="num" inputMode="numeric" value={v.workDays} aria-label="مدة التنفيذ" onChange={(e) => put('workDays', e.target.value.replace(/[^\d]/g, ''))} /></span>
        </label>
        <label className="regf regf-w">
          <span className="lb">وصف المشروع</span>
          <span className="fld fld-a"><textarea rows={3} value={v.summary} aria-label="وصف المشروع" onChange={(e) => put('summary', e.target.value)} /></span>
        </label>
        <label className="regf regf-w">
          <span className="lb">الأهداف التفصيلية</span>
          <span className="fld fld-a"><textarea rows={3} value={v.objectives} aria-label="الأهداف التفصيلية" onChange={(e) => put('objectives', e.target.value)} /></span>
        </label>
        <span className="regf regf-w">
          <span className="lb">مخرجات المشروع</span>
          <OutputsEditor list={parseOutputs(v.outputs)} onChange={(x) => put('outputs', JSON.stringify(x))} />
        </span>
      </span>
      {bad.map((b) => <span key={b} className="bad cnote">{b}</span>)}
      <span className="apv-row mt-2">
        <button type="button" className="btn btn-p btn-sm" onClick={() => { const out = amendRequest(id, v, by); setBad(out); if (!out.length) onDone() }}>احفظ التعديلات</button>
        <button type="button" className="btn btn-2 btn-sm" onClick={onDone}>تراجع</button>
      </span>
    </span>
  )
}

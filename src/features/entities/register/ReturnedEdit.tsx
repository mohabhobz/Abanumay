import { useState } from 'react'
import { FormField, FieldBox, Button, DateField, MoneyField } from '@/components/ui'
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
    endAt: p?.endAt ?? last.endAt ?? '',
  }))
  const [bad, setBad] = useState<string[]>([])
  const put = (k: string, x: string) => setV((s) => ({ ...s, [k]: x }))
  return (
    <span className="ptl-edit">
      <span className="regfields">
        <FormField label="اسم المشروع">
          <FieldBox><input value={v.name} aria-label="اسم المشروع" onChange={(e) => put('name', e.target.value)} /></FieldBox>
        </FormField>
        <FormField label="المبلغ المطلوب">
          <MoneyField value={v.amountRequested ?? ''} label="المبلغ المطلوب" onChange={(x) => put('amountRequested', String(x))} />
        </FormField>
        <FormField label="عدد المستفيدين المتوقَّع">
          <FieldBox><input className="num" inputMode="numeric" value={v.reach} aria-label="عدد المستفيدين المتوقَّع" onChange={(e) => put('reach', e.target.value.replace(/[^\d]/g, ''))} /></FieldBox>
        </FormField>
        <FormField label="تاريخ بدء التنفيذ المتوقع">
          <DateField value={v.startAt ?? ''} onChange={(x) => put('startAt', x)} label="تاريخ بدء التنفيذ المتوقع" />
        </FormField>
        {/* Client 21 Oct (#28) · the end is a date · the duration follows the two dates */}
        <FormField label="تاريخ انتهاء التنفيذ المتوقع">
          <DateField value={v.endAt ?? ''} onChange={(x) => put('endAt', x)} label="تاريخ انتهاء التنفيذ المتوقع" />
        </FormField>
        <FormField label="وصف المشروع" wide>
          <FieldBox area><textarea rows={3} value={v.summary} aria-label="وصف المشروع" onChange={(e) => put('summary', e.target.value)} /></FieldBox>
        </FormField>
        <FormField label="الأهداف التفصيلية" wide>
          <FieldBox area><textarea rows={3} value={v.objectives} aria-label="الأهداف التفصيلية" onChange={(e) => put('objectives', e.target.value)} /></FieldBox>
        </FormField>
        <FormField label="مخرجات المشروع" wide as="span">
          <OutputsEditor list={parseOutputs(v.outputs)} onChange={(x) => put('outputs', JSON.stringify(x))} />
        </FormField>
      </span>
      {bad.map((b) => <span key={b} className="bad cnote">{b}</span>)}
      <span className="apv-row mt-2">
        <Button type="button" variant="p" size="sm" onClick={() => { const out = amendRequest(id, v, by); setBad(out); if (!out.length) onDone() }}>احفظ التعديلات</Button>
        <Button type="button" variant="2" size="sm" onClick={onDone}>تراجع</Button>
      </span>
    </span>
  )
}

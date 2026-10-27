import { FieldBox, Button, DateField, Icon, icons } from '@/components/ui'
import type { ExecStage } from '@/data/intake/flow'

/* Client sheet 24 Oct (#92) · the execution stages in the request form, inside the duration station ·
   each stage its name, description and expected start and end. The dates are held to the project's
   own start and end (the calendar refuses a day outside them), and the form's issues name a stage
   left without a name or with its end before its start. */

const blank = (): ExecStage => ({ name: '', desc: '', from: '', to: '' })

export function StagesEditor({ list, onChange, from, to }: { list: ExecStage[]; onChange: (x: ExecStage[]) => void; from?: string; to?: string }) {
  const rows = list.length ? list : [blank()]
  const put = (i: number, k: keyof ExecStage, v: string) => onChange(rows.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  return (
    <span className="stgs">
      {rows.map((x, i) => (
        <span key={i} className="stgs-r">
          <span className="stgs-n sub">المرحلة <b className="num">{i + 1}</b></span>
          <FieldBox><input value={x.name} aria-label={`اسم المرحلة ${i + 1}`} placeholder="اسم المرحلة" onChange={(e) => put(i, 'name', e.target.value)} /></FieldBox>
          <FieldBox><input value={x.desc} aria-label={`وصف المرحلة ${i + 1}`} placeholder="وصف المرحلة" onChange={(e) => put(i, 'desc', e.target.value)} /></FieldBox>
          <span className="stgs-d stgs-d1">
            <span className="sub">البدء المتوقع</span>
            <DateField value={x.from} label={`بدء المرحلة ${i + 1}`} min={from || undefined} max={x.to || to || undefined} onChange={(v) => put(i, 'from', v)} />
          </span>
          <span className="stgs-d">
            <span className="sub">الانتهاء المتوقع</span>
            <DateField value={x.to} label={`انتهاء المرحلة ${i + 1}`} min={x.from || from || undefined} max={to || undefined} end onChange={(v) => put(i, 'to', v)} />
          </span>
          {rows.length > 1 ? (
            <Button plain type="button" className="iact" aria-label={`احذف المرحلة ${i + 1}`} title="احذف" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <Icon name={icons.close} size="sm" />
            </Button>
          ) : <span aria-hidden="true" />}
        </span>
      ))}
      <Button type="button" variant="2" size="sm" className="outs-add" onClick={() => onChange([...rows, { ...blank(), from: rows[rows.length - 1]?.to ?? '' }])}>
        <Icon name={icons.plus} size="sm" />
        أضف مرحلة
      </Button>
    </span>
  )
}

import { Icon, icons } from '@/components/ui'
import type { Output } from '@/data/intake/flow'

/* v3 · 0.def.14 · 0.def.15 · a list of outputs · each one its text, its indicator and its target
   value. The entity fills it in the request; the supervisor and the grants manager edit the
   foundation's copy in the study. One editor for both, so the two read the same. */

const blank = (): Output => ({ text: '', indicator: '', target: '' })

export function OutputsEditor({ list, onChange, disabled, label = 'المخرج' }: { list: Output[]; onChange: (x: Output[]) => void; disabled?: boolean; label?: string }) {
  const rows = list.length ? list : [blank()]
  const put = (i: number, k: keyof Output, v: string) => onChange(rows.map((o, j) => (j === i ? { ...o, [k]: v } : o)))
  return (
    <span className="outs">
      {rows.map((o, i) => (
        <span key={i} className="outs-r">
          <span className="fld"><input value={o.text} disabled={disabled} aria-label={`${label} ${i + 1}`} placeholder={label} onChange={(e) => put(i, 'text', e.target.value)} /></span>
          <span className="fld"><input value={o.indicator} disabled={disabled} aria-label={`مؤشر ${label} ${i + 1}`} placeholder="المؤشر" onChange={(e) => put(i, 'indicator', e.target.value)} /></span>
          <span className="fld"><input value={o.target} disabled={disabled} aria-label={`القيمة المستهدفة ${i + 1}`} placeholder="القيمة المستهدفة" onChange={(e) => put(i, 'target', e.target.value)} /></span>
          {!disabled && rows.length > 1 && (
            <button type="button" className="iact" aria-label={`احذف ${label} ${i + 1}`} title="احذف" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <Icon name={icons.close} size="sm" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <button type="button" className="btn btn-2 btn-sm outs-add" onClick={() => onChange([...rows, blank()])}>
          <Icon name={icons.plus} size="sm" />
          أضف مخرجًا
        </button>
      )}
    </span>
  )
}

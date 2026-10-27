import { useState } from 'react'
import { ButtonLabel, FieldBox, Button, Glass, Head, Icon, Money, MoneyField, Num, Tag, icons } from '@/components/ui'
import { DocList } from '@/components/docs'
import { isolate, nf, unitAfter } from '@/lib/format'
import { addReportFiles, dropReportFile, reportFileUrl, useClosing } from '@/data/closing/store'
import type { CloseRow } from '@/types/domain'
import { targetRows, type TvaKey } from './reportData'

/* The final report's shared parts · client meeting 21 Oct.

   · #4 · the report's terms · the sections any report must hold, whichever template the entity uses
   · #5 · #6 · the target against the actual, side by side · the target comes from the approved
     project, the entity writes only the actual · the costs are two figures (the project's whole
     budget and the foundation's support), not a split by line
   · #7 · the execution files go to the foundation's storage, many at once, and open in the
     browser without a download

   The editor and the review page draw the same table · one shape for the same comparison, so what
   the entity wrote is what the reviewer reads. */

const pctDiff = (t: number, a: number) => (t > 0 ? Math.round(((a - t) / t) * 100) : 0)

/** The target against the actual · `edit` puts the entity's inputs in the actual column */
export function TargetActual({
  c, edit, values, onValue, outputs, onOutput,
}: {
  c: CloseRow
  edit?: boolean
  /** The editor's draft values by row · the review reads the saved report */
  values?: Partial<Record<TvaKey, string>>
  onValue?: (k: TvaKey, v: string) => void
  outputs?: { text: string; achieved: string }[]
  onOutput?: (i: number, v: string) => void
}) {
  const rows = targetRows(c)
  const outs = outputs ?? c.report.outputs ?? []
  return (
    <div className="tblwrap">
      <table className="tbl tva">
        <colgroup><col className="tva-c-k" /><col className="tva-c-v" /><col className="tva-c-v" />{!edit && <col className="tva-c-d" />}</colgroup>
        <thead>
          <tr>
            <th><span className="th-t">البند</span></th>
            <th className="n"><span className="th-t">المستهدف</span></th>
            <th className="n"><span className="th-t">الفعلي</span></th>
            {!edit && <th className="n"><span className="th-t">الفرق</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const v = values?.[r.key] ?? ''
            const actual = edit ? (v === '' ? null : Number(v)) : r.actual
            const d = actual === null ? null : pctDiff(r.target, actual)
            return (
              <tr key={r.key}>
                <td className="tva-w"><b className="tva-k">{r.label}</b></td>
                <td className="n">{r.money ? <Money sm>{r.target}</Money> : <><Num>{r.target}</Num> <span className="sub unit">{unitAfter(r.target, r.unit ?? '')}</span></>}</td>
                <td className="n">
                  {edit
                    ? r.money
                      ? <MoneyField value={v} onChange={(x) => onValue?.(r.key, x)} label={`${r.label} · الفعلي`} />
                      : <FieldBox><input inputMode="numeric" value={v} onChange={(e) => onValue?.(r.key, e.target.value.replace(/\D/g, ''))} aria-label={`${r.label} · الفعلي`} placeholder="0" /></FieldBox>
                    : actual === null ? <span className="sub">لم يُدخل</span> : r.money ? <Money sm>{actual}</Money> : <><Num>{actual}</Num> <span className="sub unit">{unitAfter(actual, r.unit ?? '')}</span></>}
                </td>
                {!edit && (
                  <td className="n">
                    {d === null ? <span className="sub">—</span> : <Tag tone={Math.abs(d) >= 10 ? 'warn' : 'mute'}><Num>{pctOut(d)}</Num></Tag>}
                  </td>
                )}
              </tr>
            )
          })}
          {outs.map((o, i) => (
            <tr key={`o-${o.text}`}>
              <td className="tva-w"><b className="tva-k">مخرج <Num>{i + 1}</Num></b></td>
              <td className="tva-w">{isolate(o.text)}</td>
              <td className="tva-w" colSpan={edit ? 1 : 2}>
                {edit
                  ? <FieldBox><input value={o.achieved} onChange={(e) => onOutput?.(i, e.target.value)} aria-label={`المتحقق · ${o.text}`} placeholder="المتحقق فعلًا" /></FieldBox>
                  : o.achieved ? isolate(o.achieved) : <span className="sub">لم يُذكر المتحقق</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* RTL · the sign stays with its number inside the island */
const pctOut = (d: number) => `${d > 0 ? '+' : ''}${nf.format(d)}%`

const sizeSay = (b: number) => (b >= 1024 * 1024 ? `${nf.format(Math.round(b / 1024 / 102.4) / 10)} ميجابايت` : `${nf.format(Math.max(1, Math.round(b / 1024)))} كيلوبايت`)

/** #7 · the execution files in the foundation's storage · many picked at once · each opens in place */
export function ReportFiles({ c, edit, by }: { c: CloseRow; edit: boolean; by: string }) {
  useClosing()
  const [bad, setBad] = useState<string[]>([])
  const list = c.report.uploads ?? []
  return (
    <Glass>
      <Head
        title="ملفات التنفيذ"
        meta={<span className="sub"><Num>{list.length}</Num> ملف</span>}
      />
      {edit && (
        <ButtonLabel variant="2" className="upbtn rptup">
          <input
            type="file"
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
            aria-label="ارفع ملفات التنفيذ"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              setBad(files.length ? addReportFiles(c.id, files, by) : [])
              e.target.value = ''
            }}
          />
          <Icon name={icons.upload} size="sm" />
          ارفع ملفات
        </ButtonLabel>
      )}
      {list.length > 0
        ? <DocList
            label="ملفات التنفيذ المرفوعة"
            rows={list.map((f) => ({
              name: f.name, meta: `${sizeSay(f.size)} · ${f.by}`, uploaded: true, src: reportFileUrl(f.id) || undefined, mime: f.type,
              action: edit ? <Button type="button" variant="ghost" size="sm" onClick={() => dropReportFile(c.id, f.id, by)}>احذف</Button> : undefined,
            }))}
          />
        : <p className="sub cnote">لا ملفات مرفوعة بعد.</p>}
      {bad.map((b) => <p key={b} className="bad cnote" role="alert">{b}</p>)}
    </Glass>
  )
}

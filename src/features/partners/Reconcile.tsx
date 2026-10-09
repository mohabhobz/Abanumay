import { useState } from 'react'
import { DateText, Glass, Head, Money, Num, Tag } from '@/components/ui'
import { UploadButton } from '@/components/docs/UploadButton'
import { nf } from '@/lib/format'
import { downloadCsv, readTable } from '@/lib/sheetRead'
import {
  RECON_SAY, RECON_TONE, addRun, compare, reconRuns, reconTotals, resolveItem, rowsOfTable, sampleTable, useReconcile,
  type ReconItem, type ReconKind,
} from '@/data/partners/reconcile'
import { Said } from './parts'

/* «مطابقة إحسان» · finance uploads the platform's export and sees every difference with what's
   recorded here (partners#34 · batch 8). See `data/partners/reconcile.ts` for the rules. */

export function ReconcileTab({ me, canAct }: { me: string; canAct: boolean }) {
  useReconcile()
  const runs = reconRuns()
  const [pick, setPick] = useState<string>('')
  const run = runs.find((r) => r.id === pick) ?? runs[0]
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState<ReconKind | ''>('')

  const take = async (f: File) => {
    setBusy(true)
    try {
      const { rows, errors } = rowsOfTable(await readTable(f))
      if (!rows.length) { setSaid({ bad: errors }); return }
      const id = addRun(f.name, rows, me)
      setPick(id)
      setSaid({ ok: `قُرئ ${nf.format(rows.length)} سطرًا من «${f.name}»${errors.length ? ` · ${errors.length} ملاحظة: ${errors.slice(0, 3).join('، ')}` : ''}` })
    } catch (e) {
      setSaid({ bad: [e instanceof Error ? e.message : 'تعذّر قراءة الملف'] })
    } finally { setBusy(false) }
  }

  const items = run ? compare(run) : []
  const t = reconTotals(items)
  const shown = kind ? items.filter((x) => x.kind === kind) : items

  return (
    <>
      <Glass>
        <Head title="مطابقة دفعات إحسان مع المنصة" meta={<span className="sub"><bdi>11.4.23 · 11.4.24</bdi></span>} />
        <p className="sub">صدّر عمليات الصرف من منصة إحسان (CSV أو Excel) وارفعها هنا · تُطابق كل عملية برقمها مع الدفعة المسجّلة في النظام، وتظهر الفروق لمراجعتها.</p>
        <p className="sub cnote">الأعمدة المطلوبة: «رقم العملية» و«المبلغ» · واختياري: «التاريخ» و«المشروع».</p>
        <div className="rowf gp-2 mt-2">
          {canAct && <UploadButton label="ملف عمليات المنصة" accept=".csv,.xlsx" onPick={(f) => { void take(f) }} />}
          <button type="button" className="btn btn-2 btn-sm" onClick={() => downloadCsv('قالب-مطابقة-إحسان.csv', [['رقم العملية', 'المبلغ', 'التاريخ', 'المشروع']])}>نزّل القالب</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadCsv('مثال-عمليات-إحسان.csv', sampleTable())}>نزّل ملف مثال</button>
          {busy && <span className="sub">جارٍ القراءة…</span>}
        </div>
        <Said said={said} />
      </Glass>

      {run ? (
        <>
          <Glass>
            <Head title={`المطابقة ${run.id}`} meta={<span className="sub">{run.file} · {run.by} · <DateText>{run.at.slice(0, 10)}</DateText></span>} />
            <ul className="ptn-slots">
              {(['matched', 'amount', 'date', 'platform', 'system'] as ReconKind[]).map((k) => (
                <li key={k}>
                  <button type="button" className="lnk" aria-pressed={kind === k} onClick={() => setKind(kind === k ? '' : k)}>
                    <Tag tone={RECON_TONE[k]}>{RECON_SAY[k]}</Tag> <b className="num"><Num>{t[k]}</Num></b>
                  </button>
                </li>
              ))}
            </ul>
            <p className="sub cnote">
              مجموع المنصة <Money sm>{t.platformSum}</Money> · مجموع النظام <Money sm>{t.systemSum}</Money> ·
              {t.open ? <> <b className="num"><Num>{t.open}</Num></b> فرق بانتظار المراجعة</> : ' لا فروق مفتوحة'}
            </p>
            {runs.length > 1 && (
              <div className="rowf gp-2 mt-2">
                <span className="sub">مطابقات سابقة:</span>
                {runs.map((r) => <button key={r.id} type="button" className={`btn btn-sm ${r.id === run.id ? 'btn-2' : 'btn-ghost'}`} onClick={() => setPick(r.id)}>{r.id}</button>)}
              </div>
            )}
          </Glass>
          <Glass className="tblcard">
            <div className="tblwrap">
              <table className="tbl" aria-label="نتيجة المطابقة">
                <thead><tr>
                  <th><span className="th-t">النتيجة</span></th><th><span className="th-t">رقم العملية</span></th><th><span className="th-t">المشروع</span></th>
                  <th className="n"><span className="th-t">المنصة</span></th><th className="n"><span className="th-t">النظام</span></th><th className="n"><span className="th-t">الفرق</span></th>
                  <th><span className="th-t">التاريخ</span></th><th><span className="th-t">المراجعة</span></th>
                </tr></thead>
                <tbody>{shown.map((x) => <Row key={x.key} x={x} runId={run.id} me={me} canAct={canAct} />)}</tbody>
              </table>
            </div>
          </Glass>
        </>
      ) : (
        <p className="sub cnote">لم تُرفع مطابقة بعد.</p>
      )}
    </>
  )
}

function Row({ x, runId, me, canAct }: { x: ReconItem; runId: string; me: string; canAct: boolean }) {
  const [note, setNote] = useState('')
  const [bad, setBad] = useState('')
  const sysDate = x.system?.paidAt ?? ''
  const platDate = x.platform?.paidAt ?? ''
  return (
    <tr>
      <td><Tag tone={RECON_TONE[x.kind]}>{RECON_SAY[x.kind]}</Tag></td>
      <td><bdi className="num">{x.ref}</bdi></td>
      <td className="sub">{x.target}</td>
      <td className="n">{x.platform ? <Money sm>{x.platform.amount}</Money> : <span className="sub">—</span>}</td>
      <td className="n">{x.system ? <Money sm>{x.system.amount}</Money> : <span className="sub">—</span>}</td>
      <td className="n">{x.kind === 'matched' || x.kind === 'date' ? <span className="sub">—</span> : <b className="num">{nf.format(x.diff)}</b>}</td>
      <td className="sub">{platDate && <DateText>{platDate}</DateText>}{platDate && sysDate && platDate !== sysDate ? <> · النظام <DateText>{sysDate}</DateText></> : !platDate && sysDate ? <DateText>{sysDate}</DateText> : null}</td>
      <td>
        {x.kind === 'matched' ? <span className="sub">—</span>
          : x.resolved ? <span className="sub">روجع · {x.resolved.note} · {x.resolved.by}</span>
          : canAct ? (
            <span className="rowf gp-2">
              <span className="fld"><input value={note} onChange={(e) => setNote(e.target.value)} aria-label={`مراجعة ${x.ref}`} placeholder="ما تبيّن" /></span>
              <button type="button" className="btn btn-2 btn-sm" onClick={() => { const out = resolveItem(runId, x.key, note, me); setBad(out[0] ?? '') }}>علّم مراجَعًا</button>
              {bad && <span className="bad" role="alert">{bad}</span>}
            </span>
          ) : <span className="sub">بانتظار المالية</span>}
      </td>
    </tr>
  )
}

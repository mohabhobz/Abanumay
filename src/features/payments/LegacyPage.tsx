import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, DockActions, BackTo, DateText, Glass, Head, Money, Num, Tag } from '@/components/ui'
import { UploadButton } from '@/components/docs/UploadButton'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { nf } from '@/lib/format'
import { downloadCsv, readTable } from '@/lib/sheetRead'
import { projectRows } from '@/data/mock/projects'
import {
  checkTable, importBatch, legacyBatches, legacySample, useLegacy, withdrawBatch, type LegacyCheck,
} from '@/data/payments/legacy'

/* «دفعات النظام السابق» · batch 8 · finance imports the old system's vouchers instead of the system
   inferring «paid in full» from a project's status. Read, checked row by row, then imported as one
   batch that can be withdrawn whole. See `data/payments/legacy.ts`. */

export default function LegacyPage() {
  useLegacy()
  const { role, user } = useRole()
  const can = role.key === 'finance' || role.key === 'admin'
  const [file, setFile] = useState('')
  const [rows, setRows] = useState<LegacyCheck[]>([])
  const [errs, setErrs] = useState<string[]>([])
  const [said, setSaid] = useState('')
  const [wErr, setWErr] = useState<Record<string, string>>({})
  const batches = legacyBatches()
  const good = rows.filter((r) => !r.errors.length)

  const take = async (f: File) => {
    setSaid('')
    try {
      const out = checkTable(await readTable(f))
      setFile(f.name); setRows(out.rows); setErrs(out.errors)
    } catch (e) { setErrs([e instanceof Error ? e.message : 'تعذّر قراءة الملف']); setRows([]) }
  }

  return (
    <AppLayout assistantContext={assistFor.page('دفعات النظام السابق')}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo to={ROUTES.payments} label="الصرف" />
          <header>
            <div>
              <h1 className="ptitle">دفعات النظام السابق</h1>
            </div>
          </header>

          <Glass>
            <Head title="استيراد ملف" meta={<span className="sub">CSV أو Excel</span>} />
            <div className="rowf gp-2 mt-2">
              {can ? <UploadButton label="ملف سندات النظام السابق" accept=".csv,.xlsx" onPick={(f) => { void take(f) }} /> : <Tag tone="mute">الاستيراد للإدارة المالية</Tag>}
              <Button type="button" variant="2" size="sm" onClick={() => downloadCsv('قالب-سندات-النظام-السابق.csv', [['رقم المشروع', 'رقم السند', 'المبلغ', 'تاريخ الصرف', 'رقم الدفعة']])}>نزّل القالب</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => downloadCsv('مثال-سندات-النظام-السابق.csv', legacySample())}>نزّل ملف مثال</Button>
            </div>
            {errs.map((e) => <p key={e} className="bad" role="alert">{e}</p>)}
            {said && <p className="sub cnote">{said}</p>}
          </Glass>

          {rows.length > 0 && (
            <Glass className="tblcard">
              <Head title={`معاينة «${file}»`} meta={<span className="sub"><Num>{good.length}</Num> سليم من <Num>{rows.length}</Num></span>} />
              <div className="tblwrap">
                <table className="tbl" aria-label="معاينة الاستيراد">
                  <thead><tr>
                    <th className="n"><span className="th-t">السطر</span></th><th><span className="th-t">المشروع</span></th><th><span className="th-t">السند</span></th>
                    <th className="n"><span className="th-t">المبلغ</span></th><th><span className="th-t">التاريخ</span></th><th className="n"><span className="th-t">الدفعة</span></th><th><span className="th-t">الفحص</span></th>
                  </tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={`${r.row}-${r.voucher}`}>
                        <td className="n">{r.row}</td>
                        <td>{projectRows.find((p) => p.id === r.projectId) ? <Link className="tlink" to={ROUTES.project(r.projectId)}>{projectRows.find((p) => p.id === r.projectId)!.name}</Link> : <span className="sub">{r.projectId || '—'}</span>}</td>
                        <td><bdi className="num">{r.voucher}</bdi></td>
                        <td className="n"><Money sm>{r.amount}</Money></td>
                        <td className="sub">{r.paidAt ? <DateText>{r.paidAt}</DateText> : '—'}</td>
                        <td className="n">{r.no ?? '—'}</td>
                        <td>{r.errors.length ? <span className="bad">{r.errors.join(' · ')}</span> : <Tag tone="ok">سليم</Tag>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rowf gp-2 mt-2">
                <Button type="button" variant="p" size="sm" disabled={!good.length} onClick={() => {
                  const out = importBatch(file, rows, user.name)
                  if (out.errors.length) { setErrs(out.errors); return }
                  setSaid(`استُورد ${nf.format(good.length)} سندًا في الدفعة ${out.id}${good.length < rows.length ? ` · تُرك ${nf.format(rows.length - good.length)} صف فيه ملاحظة` : ''}`)
                  setRows([]); setErrs([])
                }}>استورد <Num>{good.length}</Num> سندًا سليمًا</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setRows([]); setErrs([]) }}>إلغاء</Button>
              </div>
            </Glass>
          )}

          <Glass>
            <Head title="دفعات الاستيراد" meta={<span className="sub"><Num>{batches.length}</Num></span>} />
            {batches.length === 0 ? <p className="sub">لم يُستورد شيء بعد.</p> : (
              <ul className="cfglist">
                {batches.slice().reverse().map((b) => {
                  const total = b.vouchers.reduce((s, v) => s + v.amount, 0)
                  const projects = new Set(b.vouchers.map((v) => v.projectId)).size
                  return (
                    <li key={b.id} className="itk-sup">
                      <span className="cfgl">
                        <b>{b.id} · {b.file}</b>
                        <span className="sub"><Num>{b.vouchers.length}</Num> سند · <Num>{projects}</Num> مشروع · <Money sm>{total}</Money> · {b.by} · <DateText>{b.at.slice(0, 10)}</DateText></span>
                        {b.withdrawn && <span className="sub">سُحبت · {b.withdrawn.reason} · {b.withdrawn.by}</span>}
                      </span>
                      <span className="pc-sp" />
                      {b.withdrawn ? <Tag tone="mute">مسحوبة</Tag> : can ? (
                        <span className="rowf gp-2">
                          {/* Client 26 Oct · the reason in the decision's popup */}
                          <DockActions
                            actions={[{ label: 'اسحب الدفعة', kind: 'btn-ghost btn-sm', needsNote: true }]}
                            subject={<>{b.id} · {b.vouchers.length} سند</>}
                            placeholder="سبب السحب"
                            onRun={(_x, n) => { const out = withdrawBatch(b.id, n, user.name); setWErr({ ...wErr, [b.id]: out[0] ?? '' }); return out }}
                          />
                          {wErr[b.id] && <span className="bad" role="alert">{wErr[b.id]}</span>}
                        </span>
                      ) : <Tag tone="ok">سارية</Tag>}
                    </li>
                  )
                })}
              </ul>
            )}
          </Glass>
        </div>
      </div>
    </AppLayout>
  )
}

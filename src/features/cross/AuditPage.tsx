import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DateText, Empty, Glass, Icon, icons, Num, Pager, SearchBox, Select, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { assistFor } from '@/data/mock/assistant'
import { exportXlsx, type Sheet } from '@/lib/export'
import { auditRows, MODULE_SAY, type AuditModule } from '@/data/shared/audit'
import { Who } from './parts'
import { useAllStores } from './useAllStores'

/* The audit log · cross «سجل التدقيق».

   One reader over every module's history, append-only: there's no edit and no delete on this
   page or anywhere a row comes from. Filters by module, by who acted, by period and by text (the
   action, the record, the note and every before/after value), and exports what it shows. */

const MODS = Object.keys(MODULE_SAY) as AuditModule[]
const PERIODS = [
  { value: '7', label: 'آخر 7 أيام' },
  { value: '30', label: 'آخر 30 يومًا' },
  { value: '90', label: 'آخر 90 يومًا' },
]
const PAGE = 30

export default function AuditPage() {
  useAllStores()
  const [q, setQ] = useState('')
  const [mod, setMod] = useState<string | undefined>()
  const [by, setBy] = useState<string | undefined>()
  const [days, setDays] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<string | null>(null)

  const all = auditRows()
  const people = [...new Set(all.map((r) => r.by).filter(Boolean))].sort()
  const since = days ? new Date(Date.now() - Number(days) * 86_400_000).toISOString().slice(0, 10) : ''
  const n = q.trim()
  const rows = all.filter((r) =>
    (!mod || r.module === mod) && (!by || r.by === by) && (!since || r.at.slice(0, 10) >= since) &&
    (!n || [r.action, r.ref, r.note ?? '', r.by, ...r.fields.map((f) => `${f.k} ${f.v}`)].some((t) => t.includes(n))))
  const shown = rows.slice((page - 1) * PAGE, page * PAGE)
  const reset = () => setPage(1)

  const sheet: Sheet = {
    file: `abanumay-audit-${new Date().toISOString().slice(0, 10)}`,
    title: 'سجل التدقيق',
    headers: ['التاريخ', 'الوحدة', 'السجل', 'الإجراء', 'المنفّذ', 'الملاحظة', 'القيم'],
    rows: rows.map((r) => [r.at, MODULE_SAY[r.module], r.ref, r.action, r.by, r.note ?? '', r.fields.map((f) => `${f.k}: ${f.v}`).join(' · ')]),
  }

  return (
    <AppLayout assistantContext={assistFor.page('سجل التدقيق')}>
      <div className="viewstack">
        <div className="screen col">
          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">سجل التدقيق</h1>
              <p className="sub mt-1"><Num>{all.length}</Num> عملية في جميع الوحدات · سجل للقراءة فقط لا يُعدَّل ولا يُحذف</p>
            </div>
            <button type="button" className="btn btn-2 btn-sm" onClick={() => exportXlsx(sheet)}>
              <Icon name={icons.export} size="sm" />
              صدّر إلى إكسل
            </button>
          </header>

          <Glass className="ftoolbar">
            <div className="ftool-r">
              <div className="ftool-f">
                <SearchBox value={q} onChange={(v) => { setQ(v); reset() }} placeholder="ابحث في الإجراء أو السجل أو القيم…" />
                <Select label="الوحدة" all="كل الوحدات" value={mod} options={MODS.map((m) => ({ value: m, label: MODULE_SAY[m] }))} onChange={(v) => { setMod(v); reset() }} />
                <Select label="المنفّذ" all="كل المنفّذين" value={by} options={people} onChange={(v) => { setBy(v); reset() }} />
                <Select label="الفترة" all="كل الفترات" value={days} options={PERIODS} onChange={(v) => { setDays(v); reset() }} />
              </div>
            </div>
          </Glass>

          <Glass className="tblcard">
            {rows.length === 0 ? <Empty title="لا عمليات بهذه التصفية." /> : (
              <div className="tblwrap">
                <table className="tbl" aria-label="سجل التدقيق">
                  <thead>
                    <tr>
                      <th><span className="th-t">التاريخ</span></th>
                      <th><span className="th-t">الوحدة</span></th>
                      <th><span className="th-t">السجل</span></th>
                      <th><span className="th-t">الإجراء</span></th>
                      <th><span className="th-t">المنفّذ</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => {
                      const more = r.fields.length > 0 || Boolean(r.note)
                      return (
                        <tr key={r.id} className={open === r.id ? 'sel' : undefined} onClick={() => more && setOpen(open === r.id ? null : r.id)}>
                          <td><DateText>{r.at.slice(0, 10)}</DateText>{r.at.length > 10 && <div className="sub"><bdi>{r.at.slice(11, 16)}</bdi></div>}</td>
                          <td><Tag tone="mute">{MODULE_SAY[r.module]}</Tag></td>
                          <td><Link className="tlink" to={r.href} onClick={(e) => e.stopPropagation()}>{r.ref}</Link></td>
                          <td>
                            <div>{r.action}</div>
                            {open === r.id ? (
                              <dl className="xs-vals">
                                {r.note && <div><dt>الملاحظة</dt><dd>{r.note}</dd></div>}
                                {r.fields.map((f, i) => <div key={i}><dt>{f.k}</dt><dd><bdi>{f.v}</bdi></dd></div>)}
                              </dl>
                            ) : more ? <div className="sub trim1">{r.note ?? r.fields.map((f) => `${f.k}: ${f.v}`).join(' · ')}</div> : null}
                          </td>
                          <td><Who name={r.by} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Glass>
          {rows.length > PAGE && <Pager page={page} pageSize={PAGE} total={rows.length} onPage={setPage} onPageSize={() => undefined} />}
        </div>
      </div>
    </AppLayout>
  )
}

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, DateText, Empty, Glass, Head, MultiSelect, Mono, Num, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { planOfProject } from '@/data/mock/plans'
import { payRequests } from '@/data/mock/disbursements'
import { PROGRESS_SAY, PROGRESS_TONE, actSerial, progressOf } from '@/data/plans/timing'
import { actsOfPay, payOfAct, setPayActs, usePayActs } from '@/data/payments/payActs'
import type { PayRequest } from '@/types/domain'

/* Client 27 Oct · «الأنشطة المتعلقة بالدفعة» · replaces the requirements-and-conditions card on the
   payment's «المتطلبات» tab. Every activity of the project's plan is listed whatever its state, and
   any number of them can be picked for this payment at once · an activity another payment of the
   project already holds is shown with that payment and can't be picked twice. */

export function PayActivities({ r, canEdit, me }: { r: PayRequest; canEdit: boolean; me: string }) {
  usePayActs()
  const plan = planOfProject(r.projectId)
  const saved = actsOfPay(r.id)
  const [pick, setPick] = useState<string[] | null>(null)
  const [cats, setCats] = useState<string[]>([])
  const [sts, setSts] = useState<string[]>([])

  const rows = useMemo(() => (plan?.phases ?? []).flatMap((ph) => ph.activities.map((a) => ({ a, cat: ph.name || 'بلا تصنيف' }))), [plan])
  const others = payRequests.filter((x) => x.projectId === r.projectId && x.id !== r.id)
  const elsewhere = (id: string) => others.find((x) => x.id === payOfAct(id, others.map((o) => o.id)))

  const sel = pick ?? saved
  const dirty = pick !== null && (pick.length !== saved.length || pick.some((x) => !saved.includes(x)))
  const free = rows.filter(({ a }) => !elsewhere(a.id))
  const catOptions = [...new Set(rows.map((x) => x.cat))]
  const stOptions = (Object.keys(PROGRESS_SAY) as (keyof typeof PROGRESS_SAY)[]).filter((k) => rows.some((x) => progressOf(x.a) === k))
  const shown = rows.filter((x) => (!cats.length || cats.includes(x.cat)) && (!sts.length || sts.includes(progressOf(x.a))))

  const toggle = (id: string) => setPick((p) => { const cur = p ?? saved; return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] })
  const allOn = free.length > 0 && free.every(({ a }) => sel.includes(a.id))

  return (
    <Glass>
      <Head
        title="الأنشطة المتعلقة بالدفعة"
        meta={sel.length ? <Tag tone="teal"><Num>{sel.length}</Num> {sel.length === 1 ? 'نشاط مرتبط' : 'أنشطة مرتبطة'}</Tag> : <span className="sub">لا أنشطة مرتبطة</span>}
      />
      {!plan || rows.length === 0 ? (
        <Empty title={plan ? 'خطة المشروع بلا أنشطة.' : 'لا خطة تنفيذ لهذا المشروع بعد.'} />
      ) : (
        <>
          <div className="acttbl-f rowf gp-2">
            <MultiSelect label="التصنيف" values={cats} all="كل التصنيفات" options={catOptions} onChange={setCats} />
            <MultiSelect label="حالة الإنجاز" values={sts} all="كل الحالات" options={stOptions.map((k) => ({ value: k, label: PROGRESS_SAY[k] }))} onChange={setSts} />
            <span className="pc-sp" />
            <span className="sub"><Num>{shown.length}</Num> من <Num>{rows.length}</Num></span>
          </div>
          {shown.length === 0 ? (
            <p className="sub cnote acttbl-empty">لا أنشطة تطابق الفلاتر.</p>
          ) : (
            <div className="tblwrap acttbl-w">
              <table className="tbl payacts">
                <colgroup>
                  {canEdit && <col className="c-chk" />}
                  <col className="c-name" /><col className="c-cat" /><col className="c-d" /><col className="c-st" /><col className="c-pay" />
                </colgroup>
                <thead>
                  <tr>
                    {canEdit && <th className="tchk"><input type="checkbox" aria-label="تحديد كل الأنشطة المتاحة" checked={allOn}
                      onChange={(e) => setPick(e.target.checked ? [...new Set([...sel, ...free.map(({ a }) => a.id)])] : sel.filter((x) => !free.some(({ a }) => a.id === x)))} /></th>}
                    <th><span className="th-t">النشاط · م</span></th>
                    <th><span className="th-t">التصنيف</span></th>
                    <th><span className="th-t">البدء · الانتهاء</span></th>
                    <th><span className="th-t">حالة الإنجاز</span></th>
                    <th><span className="th-t">الدفعة</span></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(({ a, cat }) => {
                    const st = progressOf(a)
                    const other = elsewhere(a.id)
                    const on = sel.includes(a.id)
                    return (
                      <tr key={a.id} className={on ? 'on' : undefined}>
                        {canEdit && <td className="tchk">
                          <input type="checkbox" aria-label={`ربط ${a.name} بالدفعة`} checked={on} disabled={Boolean(other)}
                            title={other ? `مرتبط بالدفعة ${other.no}` : undefined} onChange={() => toggle(a.id)} />
                        </td>}
                        <td className="acttbl-2"><b className="acttbl-n" title={a.name}>{a.name}</b><Mono>{actSerial(plan.id, a.id)}</Mono></td>
                        <td><span className="trim1" title={cat}>{cat}</span></td>
                        <td className="acttbl-2 acttbl-d"><span><DateText>{a.from}</DateText></span><span className="sub">حتى <DateText>{a.to}</DateText></span></td>
                        <td><Tag tone={PROGRESS_TONE[st]}>{PROGRESS_SAY[st]}</Tag></td>
                        <td>
                          {on ? <Tag tone="teal">مرتبط</Tag>
                            : other ? <Link className="tlink" to={ROUTES.payment(other.id)}>الدفعة <Num>{other.no}</Num></Link>
                            : <span className="sub">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {canEdit && dirty && (
            <div className="rowf gp-2 payacts-save">
              <span className="sub">اخترت <Num>{sel.length}</Num> {sel.length === 1 ? 'نشاطًا' : 'أنشطة'} · لم يُحفظ بعد</span>
              <span className="pc-sp" />
              <Button variant="ghost" size="sm" onClick={() => setPick(null)}>تراجع</Button>
              <Button variant="p" size="sm" onClick={() => { setPayActs(r.id, sel, me); setPick(null) }}>احفظ الأنشطة</Button>
            </div>
          )}
        </>
      )}
    </Glass>
  )
}

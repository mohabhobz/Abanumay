import { useState } from 'react'
import { DateText, FieldSelect, Glass, Head, Icon, Money, Riyal, Tag, icons } from '@/components/ui'
import { isolate, nf } from '@/lib/format'
import type { ProjectRow } from '@/types/domain'
import { docTitle, fiscalYears, yearById } from '@/data/mock/budgetTree'
import { payRequests, payStateLabel } from '@/data/mock/disbursements'
import { TODAY } from '@/data/intake/cycle'
import {
  paidInYear, payYearIssue, planIssues, planOf, savePlan, usableLines, useBudget,
  type FundingPlan, type PlanYear,
} from '@/data/budget/store'

/* The project's financial plan · decided by the grants supervisor in the study (3.2.14 · 3.2.15).

   One fiscal year, or several: each year carries its own amount, and the years sum to the approved
   funding (1.4.46 · 1.4.47 · 3.4.33 · 3.4.34). A year's share can come from more than one budget of
   that year, each with its amount (1.4.50). On saving, every share is recorded on its line as a
   future commitment, not a hold (1.4.48); when a year starts its share is held on its own, line by
   line, and refused whole — with the people concerned notified — if a line lacks the balance
   (1.4.49 · 1.4.51 · 3.4.35). Payments in a year stay inside what that year holds (1.4.52), and a
   later edit moves commitments and holds but never below what a year already paid (1.4.53). */

const digits = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0

export function FundingPlanCard({ row, amount, editable, me }: {
  row: ProjectRow; amount: number; editable: boolean; me: string
}) {
  useBudget()
  const saved = planOf(row.id)
  const thisYear = fiscalYears.find((y) => TODAY >= y.from && TODAY <= y.to) ?? fiscalYears[0]
  const guess = (yearId: string) => usableLines(yearId).find((l) => l.node.label === row.goal)

  const blank = (): Omit<FundingPlan, 'at' | 'version'> => {
    const g = guess(thisYear.id)
    return {
      projectId: row.id, projectName: row.name, kind: 'single', total: amount, by: me,
      years: [{ yearId: thisYear.id, amount, shares: g ? [{ docId: g.doc.id, nodeId: g.node.id, amount }] : [] }],
    }
  }
  const [p, setP] = useState<Omit<FundingPlan, 'at' | 'version'>>(() =>
    saved ? { ...structuredClone(saved), total: saved.total } : blank())
  const [msg, setMsg] = useState('')
  /* A single-year plan is its total, on one year · a lone share takes the whole of it */
  const norm: Omit<FundingPlan, 'at' | 'version'> = p.kind === 'single'
    ? { ...p, years: p.years.slice(0, 1).map((y) => ({ ...y, amount: p.total, shares: y.shares.length === 1 ? [{ ...y.shares[0], amount: p.total }] : y.shares })) }
    : p
  const issues = planIssues(norm)
  const pick = (x: Omit<FundingPlan, 'at' | 'version'>) => JSON.stringify({ k: x.kind, t: x.total, y: x.years.map((y) => ({ i: y.yearId, a: y.amount, s: y.shares })) })
  const dirty = !saved || pick(saved) !== pick(norm)

  const setYear = (i: number, y: Partial<PlanYear>) => {
    setP((x) => ({ ...x, years: x.years.map((v, j) => (j === i ? { ...v, ...y } : v)) }))
    setMsg('')
  }
  const addYear = () => {
    const used = new Set(p.years.map((y) => y.yearId))
    const next = [...fiscalYears].reverse().find((y) => !used.has(y.id) && y.from >= thisYear.from)
    if (!next) return
    const g = guess(next.id)
    setP((x) => ({ ...x, years: [...x.years, { yearId: next.id, amount: 0, shares: g ? [{ docId: g.doc.id, nodeId: g.node.id, amount: 0 }] : [] }] }))
  }
  const lineOpts = (yearId: string) =>
    usableLines(yearId).map((l) => ({ value: l.key, label: isolate(`${docTitle(l.doc)} · ${l.node.label} · متاح ${nf.format(l.free)}`) }))
  const pays = payRequests.filter((r) => r.projectId === row.id)

  const statusOf = (y: PlanYear) => {
    const s = saved?.years.find((x) => x.yearId === y.yearId)
    if (s?.heldAt) return <Tag tone="ok">محجوزة · <DateText>{s.heldAt}</DateText></Tag>
    if (s?.refused) return <Tag tone="no">تعذّر الحجز</Tag>
    const fy = yearById(y.yearId)
    return fy && fy.from > TODAY ? <Tag tone="mute">التزام مستقبلي · يُحجز في <DateText>{fy.from}</DateText></Tag> : <Tag tone="warn">يُحجز عند الحفظ</Tag>
  }

  return (
    <Glass>
      <Head
        title="الخطة المالية للمشروع"
        meta={<Tag tone={p.kind === 'multi' ? 'warn' : 'mute'}>{p.kind === 'multi' ? 'متعدد السنوات' : 'سنة مالية واحدة'}</Tag>}
      />
      <div className="cfgchips" role="radiogroup" aria-label="نوع المشروع من حيث المدة المالية">
        {(['single', 'multi'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={p.kind === k}
            disabled={!editable}
            className={`cfgchip${p.kind === k ? ' on' : ''}`}
            onClick={() => setP((x) => (k === 'single'
              ? { ...x, kind: k, years: [{ ...x.years[0], amount: x.total, shares: x.years[0].shares.slice(0, 1).map((s) => ({ ...s, amount: x.total })) }] }
              : { ...x, kind: k }))}
          >
            {k === 'single' ? 'لسنة مالية واحدة' : 'متعدد السنوات'}
          </button>
        ))}
      </div>
      <p className="sub cnote">
        قيمة التمويل المعتمد <b><Money sm>{p.total}</Money></b>
        {amount !== p.total && editable && (
          <> · المبلغ الموصى به في الدراسة <Money sm>{amount}</Money> <button className="btn btn-2 btn-sm" onClick={() => setP((x) => ({ ...x, total: amount }))}>اعتمده</button></>
        )}
      </p>

      <ul className="bgplan">
        {p.years.map((y, i) => {
          const yn = yearById(y.yearId)?.name ?? ''
          const opts = lineOpts(y.yearId)
          const paid = paidInYear(row.id, yn)
          return (
            <li key={`${y.yearId}-${i}`} className="well">
              <div className="bgplan-h">
                <FieldSelect
                  value={y.yearId}
                  label={`السنة المالية ${i + 1}`}
                  disabled={!editable}
                  options={fiscalYears.map((f) => ({ value: f.id, label: f.name }))}
                  onChange={(v) => setYear(i, { yearId: v, shares: [] })}
                />
                <span className="fld">
                  <input type="text" inputMode="numeric" disabled={!editable || p.kind === 'single'} value={y.amount ? nf.format(y.amount) : ''} onChange={(e) => setYear(i, { amount: digits(e.target.value) })} aria-label={`مبلغ سنة ${yn}`} />
                  <Riyal />
                </span>
                {statusOf(y)}
                {editable && p.kind === 'multi' && p.years.length > 1 && (
                  <button className="btn btn-ghost btn-sm" aria-label={`احذف سنة ${yn}`} onClick={() => setP((x) => ({ ...x, years: x.years.filter((_, j) => j !== i) }))}>
                    <Icon name={icons.close} size="sm" />
                  </button>
                )}
              </div>
              {opts.length === 0 ? (
                <p className="sub cnote">لا ميزانية معتمدة لسنة <span className="num">{yn}</span> بعد · تبقى الحصة التزامًا بلا بند حتى تُعتمد، ويتعذّر حجزها عند بداية السنة.</p>
              ) : (
                <ul className="bgplan-s">
                  {y.shares.map((s, k) => (
                    <li key={`${s.docId}-${s.nodeId}-${k}`}>
                      <FieldSelect
                        value={`${s.docId}/${s.nodeId}`}
                        label={`بند تمويل سنة ${yn}`}
                        searchAt={6}
                        disabled={!editable}
                        options={opts}
                        onChange={(v) => { const [docId, nodeId] = v.split('/'); setYear(i, { shares: y.shares.map((x, j) => (j === k ? { ...x, docId, nodeId } : x)) }) }}
                      />
                      <span className="fld">
                        <input type="text" inputMode="numeric" disabled={!editable || (p.kind === 'single' && y.shares.length === 1)} value={(p.kind === 'single' && y.shares.length === 1 ? p.total : s.amount) ? nf.format(p.kind === 'single' && y.shares.length === 1 ? p.total : s.amount) : ''} onChange={(e) => setYear(i, { shares: y.shares.map((x, j) => (j === k ? { ...x, amount: digits(e.target.value) } : x)) })} aria-label={`حصة البند من سنة ${yn}`} />
                        <Riyal />
                      </span>
                      {editable && y.shares.length > 1 && (
                        <button className="btn btn-ghost btn-sm" aria-label="احذف الحصة" onClick={() => setYear(i, { shares: y.shares.filter((_, j) => j !== k) })}>
                          <Icon name={icons.close} size="sm" />
                        </button>
                      )}
                    </li>
                  ))}
                  {editable && (
                    <li>
                      <button className="btn btn-2 btn-sm" onClick={() => setYear(i, { shares: [...y.shares, { docId: '', nodeId: '', amount: 0 }] })}>
                        <Icon name={icons.plus} size="sm" />
                        {y.shares.length ? 'موّل الحصة من ميزانية أخرى' : 'اختر بند التمويل'}
                      </button>
                    </li>
                  )}
                </ul>
              )}
              {saved?.years.find((x) => x.yearId === y.yearId)?.refused && (
                <p className="bad cnote">{saved.years.find((x) => x.yearId === y.yearId)!.refused} · أُشعر مشرف المنح ومدير المنح والإدارة المالية.</p>
              )}
              {paid > 0 && <p className="sub cnote">صُرف من حصة <span className="num">{yn}</span> <Money sm>{paid}</Money> · لا تقل الحصة عنه.</p>}
            </li>
          )
        })}
      </ul>
      {editable && p.kind === 'multi' && (
        <button className="btn btn-2 btn-sm" onClick={addYear}>
          <Icon name={icons.plus} size="sm" />
          أضف سنة مالية
        </button>
      )}

      {/* Payments against their year's share (1.4.52) */}
      {saved?.kind === 'multi' && pays.length > 0 && (
        <>
          <h3 className="stdy-h mt-3">الدفعات حسب السنة المالية</h3>
          <ul className="eprq">
            {pays.map((r) => {
              const why = r.state === 'paid' ? '' : payYearIssue(row.id, r.dueAt, r.asked)
              return (
                <li key={r.id} className="eprq-r">
                  <Icon name={icons.pay} size="sm" />
                  <span className="eprq-b">
                    <b>الدفعة <span className="num">{r.no}</span> · <Money sm>{r.asked}</Money></b>
                    <span className="sub">تستحق <DateText>{r.dueAt}</DateText> · {payStateLabel(r.state)}</span>
                  </span>
                  <span className="pc-sp" />
                  {why ? <Tag tone="no">{why}</Tag> : <Tag tone="ok">في حدود حصة السنة</Tag>}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {issues.length > 0 && editable && (
        <ul className="bgplan-i">
          {issues.map((t) => <li key={t} className="bad">{t}</li>)}
        </ul>
      )}
      {editable && (
        <div className="regfoot">
          <span className="decsent">{msg || (issues.length ? `${issues.length} ملاحظة قبل الحفظ` : dirty ? 'الخطة جاهزة · حصص السنوات القادمة تُسجَّل التزامات' : 'محفوظة')}</span>
          <span className="pc-sp" />
          <button
            type="button"
            className="btn btn-p"
            disabled={issues.length > 0 || !dirty}
            onClick={() => { savePlan({ ...norm, by: me }); setMsg('حُفظت الخطة المالية · سُجّلت الالتزامات والحجوزات') }}
          >
            احفظ الخطة المالية
          </button>
        </div>
      )}
      {!editable && !saved && <p className="sub cnote">لم يحدّد مشرف المنح الخطة المالية بعد.</p>}
    </Glass>
  )
}

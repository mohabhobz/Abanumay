import { StatRow, Glass, Head, KV, Money, Stat, Tag, Riyal, Num } from '@/components/ui'
import { docTitle, pathOf, yearById } from '@/data/mock/budgetTree'
import { HOLD_STAGE_SAY, fundingReport, linkOf, lineBalances, planOf, useBudget, type HoldStage } from '@/data/budget/store'
import { FundingCard } from '@/features/funding/FundingCard'
import type { ProjectRow } from '@/types/domain'

/* «الربط المالي» · client 24 Oct (#85) · the project's link to the budget, its own tab.

   The tab opens on the standing of the link — linked or not, held initially or finally, released —
   with the year and the budget lines it sits on, and what the project's hold took from each line
   (the line's available balance before the project's hold and after it). Under it the link itself
   (`FundingCard`): each share, the checks before a decision, the relocation request and the link's
   history, with the actions the seat or the budget settings allow. */

const TONE: Record<HoldStage, 'ok' | 'warn' | 'mute'> = { planned: 'mute', initial: 'warn', final: 'ok', closed: 'mute' }
/** The standing as a status word · the stage names read as what happened to the money */
const STANDING: Record<HoldStage, string> = {
  planned: 'مربوط بلا حجز', initial: 'محجوز مبدئيًا', final: 'محجوز نهائيًا', closed: 'مُحرَّر · أُعيد الوفر',
}

/* Client 28 Oct · on a payment the tab reads where the money sits, not how much · each budget line
   with its budget, track, field and goal, and no link card (the link is the project's to manage) */
export function FundingTab({ row, pay = false }: { row: ProjectRow; pay?: boolean }) {
  useBudget()
  const l = linkOf(row.id)
  const plan = planOf(row.id)
  const multi = !l && plan?.kind === 'multi' ? plan : undefined
  const rep = fundingReport(row.id)
  const live = l?.stage === 'initial' || l?.stage === 'final'

  const status = l
    ? <Tag tone={TONE[l.stage]}>{STANDING[l.stage]}</Tag>
    : multi
      ? <Tag tone={multi.released ? 'mute' : 'ok'}>{multi.released ? 'حُرّرت حصص الخطة' : 'ممول بخطة متعددة السنوات'}</Tag>
      : <Tag tone="mute">لا ربط</Tag>

  const years = rep
    ? [...new Set(rep.rows.map((r) => (r.doc ? yearById(r.doc.yearId)?.name : '') ?? ''))].filter(Boolean).join('، ')
    : multi ? multi.years.map((y) => yearById(y.yearId)?.name ?? '').filter(Boolean).join('، ') : ''

  /* the line's own track · field · goal · named by the node's category when the tree has one, else by
     depth (the budget · its track · the track's field · the field's goal), else the project's own */
  const pathRows = (r: NonNullable<typeof rep>['rows'][number]) => {
    const chain: NonNullable<typeof r.doc>['nodes'] = []
    let cur = r.doc?.nodes.find((n) => n.id === r.share.nodeId)
    while (cur) {
      chain.unshift(cur)
      const pid = cur.parentId
      cur = pid ? r.doc?.nodes.find((n) => n.id === pid) : undefined
    }
    const up: Record<string, string> = {}
    for (const n of chain) if (n.category && !up[n.category]) up[n.category] = n.label
    if (!Object.keys(up).length) (['track', 'field', 'goal'] as const).forEach((k, i) => { const n = chain[i + 1]; if (n) up[k] = n.label })
    const line = r.node?.label ?? r.share.nodeId
    return [
      /* the line itself only when it isn't the goal it already reads as */
      ...(line !== up.goal ? [{ k: 'البند', v: line }] : []),
      { k: 'الميزانية', v: r.doc ? docTitle(r.doc) : r.share.docId },
      { k: 'المسار', v: up.track ?? row.track },
      { k: 'المجال', v: up.field ?? row.field },
      { k: 'الهدف', v: up.goal ?? row.goal },
    ]
  }

  const impactPath = (
    <Glass>
      <Head title="أثر الربط على البنود" />
      {rep && rep.rows.length > 0
        ? rep.rows.map((r, i) => <KV key={`${r.share.docId}-${r.share.nodeId}-${i}`} rows={pathRows(r)} />)
        : <KV rows={[{ k: 'المسار', v: row.track }, { k: 'المجال', v: row.field }, { k: 'الهدف', v: row.goal }]} />}
    </Glass>
  )

  return (
    <>
      {pay && impactPath}
      <StatRow title="الربط المالي">
        <Stat label="حالة الربط المالي" value={status} note={l ? `نوع الحجز: ${HOLD_STAGE_SAY[l.stage]}` : undefined} />
        <Stat label="المبلغ المرتبط" value={<Num>{rep?.totals.amount ?? multi?.years.reduce((a, y) => a + y.amount, 0) ?? 0}</Num>} unit={<Riyal />} note={years ? `ميزانية ${years}` : '—'} />
        <Stat label="المصروف منه" value={<Num>{rep?.totals.paid ?? 0}</Num>} unit={<Riyal />} />
        <Stat label={l?.stage === 'closed' ? 'أُعيد للبنود' : 'المتبقي'} value={<Num>{l?.stage === 'closed' ? rep?.totals.released ?? 0 : rep?.totals.remaining ?? 0}</Num>} unit={<Riyal />} />
      </StatRow>

      {/* Client 27 Oct · the budget path the project sits on · track, field and goal */}
      {!pay && <Glass>
        <Head title="بند الميزانية" />
        <KV rows={[
          { k: 'المسار', v: row.track },
          { k: 'المجال', v: row.field },
          { k: 'الهدف', v: row.goal },
        ]} />
      </Glass>}

      {!pay && rep && rep.rows.length > 0 && (
        <Glass>
          <Head title="أثر الربط على البنود" />
          <KV
            rows={rep.rows.map((r) => {
              const b = r.doc ? lineBalances(r.doc, r.share.nodeId) : undefined
              const after = b?.available ?? 0
              const before = after + (live ? r.held : 0)
              return {
                k: r.node?.label ?? r.share.nodeId,
                v: (
                  <span className="apv-t">
                    <span className="sub">{r.doc ? `${docTitle(r.doc)} · ${pathOf(r.doc.nodes, r.share.nodeId).split(' · ').slice(1, -1).join(' · ')}` : r.share.docId}</span>
                    <span>
                      المرتبط <b><Money sm>{r.share.amount}</Money></b>
                      {' · '}المتاح <Money sm>{before}</Money> ← <b><Money sm>{after}</Money></b>
                      {!live && <span className="sub"> · لا حجز قائم الآن</span>}
                    </span>
                  </span>
                ),
              }
            })}
          />
        </Glass>
      )}

      {/* the link itself · shares, checks, relocation and its history, with the allowed actions */}
      {!pay && <FundingCard row={row} />}

    </>
  )
}

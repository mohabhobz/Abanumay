import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BackTo, Empty, Glass, icons, Mono, Money, Num, Person, Select } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { assistFor } from '@/data/mock/assistant'
import { ROUTES } from '@/app/routes'
import { countOf, nf, NOUN, nounAfter, pct, unitAfter } from '@/lib/format'
import { highlight } from '@/components/assistant'
import { boardCards, PERIODS } from '@/data/reportDefs'
import { closingRows, knowledgeRows } from '@/data/closing'
import { budgetByTrack, budgetForYear } from '@/data/budget'
import { projectRows } from '@/data/mock/projects'
import { entityRows } from '@/data/mock/entities'
import { ENTITY_DOCS_TOTAL, stagePressure } from '@/data/repository'
import { days } from '@/lib/tone'
import { type Sheet } from '@/lib/export'
import { ExportMenu } from '@/components/export'

/**
 * Full report.
 *
 * Every card on the dashboard opens here. The page keeps the same rule:
 * reading text on top, rows below. What's on top is the same text as the
 * card — not a repeat, but the bridge: the user came in from a sentence,
 * so the first thing they see is that same sentence together with the
 * rows it's built on.
 *
 * Export exists on every report: it's the most requested item in the
 * review, and the first reason a user would go back to the old system
 * after this ships.
 */

type Row = Record<string, string | number>

interface Table {
  /* `person` marks a column's value as a person's name — the cell gets
     their avatar. */
  cols: { key: string; label: string; n?: boolean; money?: boolean; person?: boolean }[]
  rows: Row[]
  /** Totals row — rendered in `tfoot`, not the table body. */
  foot?: Row
}

export default function ReportView() {
  const { key = '' } = useParams<{ key: string }>()
  const [period, setPeriod] = useState<string>(PERIODS[0].id)

  const card = boardCards(period).find((c) => c.key === key)
  const table = useMemo(() => buildTable(key, period), [key, period])

  if (!card || !table) {
    return (
      <AppLayout assistantContext={assistFor.page('التقارير')}>
        <div className="viewstack">
          <div className="screen col">
            <Glass>
              <Empty
                title="التقرير غير موجود."
                note="عُد إلى لوحة التقارير واختر تقريرًا منها."
                actions={<Link className="btn btn-2" to={ROUTES.reports}>العودة إلى لوحة التقارير</Link>}
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  const sheet: Sheet = {
    file: `abanumay-report-${key}-${period}`,
    title: `${card.question} · ${PERIODS.find((p) => p.id === period)?.label ?? ''}`,
    headers: table.cols.map((c) => c.label),
    rows: [...table.rows, ...(table.foot ? [table.foot] : [])].map((r) => table.cols.map((c) => String(r[c.key] ?? ''))),
  }

  return (
    <AppLayout assistantContext={assistFor.page(card.question)}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo to={ROUTES.reports} label="التقارير" />

          <header>
            <div>
              <h1 className="ptitle">{card.question}</h1>
              <p className="sub mt-1">{card.src}</p>
            </div>
          </header>

          {/* The same reading text as the dashboard — the bridge between the
              sentence and the rows. */}
          <Glass className="rvread">
            <span className="rvread-v">
              <b className="num">{card.value}</b>
              <small>{unitAfter(card.value, card.unit)}</small>
            </span>
            <p>{highlight(card.reading, card.bold ?? [], card.danger ?? [])}</p>
          </Glass>

          {/* The period filter sits in the system toolbar, same as the lists. */}
          <Glass className="ftoolbar rptb">
            <div className="ftool-r">
              <div className="ftool-f">
                <Select
                  icon={icons.chart}
                  value={period}
                  allowEmpty={false}
                  options={PERIODS.map((p) => ({ value: p.id, label: p.label }))}
                  onChange={(v) => setPeriod(v ?? PERIODS[0].id)}
                />
                <span className="sub">
                  <span className="num">{nf.format(table.rows.length)}</span> {nounAfter(table.rows.length, NOUN.row)}
                </span>
              </div>
              <div className="ftool-a">
                <ExportMenu
                  sheet={sheet}
                  note={`${card.question} · ${PERIODS.find((p) => p.id === period)?.label ?? ''} · ${countOf(table.rows.length, NOUN.row)}`}
                />
              </div>
            </div>
          </Glass>

          <Glass className="tblcard">
            {table.rows.length === 0 ? (
              <Empty title="لا توجد صفوف في هذه الفترة." note="جرّب سنة أو مصدر تمويل آخر." />
            ) : (
              <div className="tblwrap">
                <div className="tblock">
                  <table className="tbl">
                    <colgroup>
                      {table.cols.map((c) => (
                        <col key={c.key} style={{ width: c.n ? 110 : 180 }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        {table.cols.map((c) => (
                          <th key={c.key} className={c.n ? 'n' : undefined}>{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.slice(0, 200).map((r, i) => (
                        <tr key={i}>
                          {table.cols.map((c) => (
                            <td key={c.key} className={c.n ? 'n' : undefined} title={String(r[c.key] ?? '')}>
                              {render(r[c.key], c)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    {/* The total is a summary, not a fourth row of data — it used to be a row
                        with equal weight inside the body. `tfoot` gives it the border and
                        weight from the table's own foundation, and a screen reader announces
                        it as a summary. */}
                    {table.foot && (
                      <tfoot>
                        <tr>
                          {table.cols.map((c) => (
                            <td key={c.key} className={c.n ? 'n' : undefined}>{render(table.foot![c.key], c)}</td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}
          </Glass>

          {table.rows.length > 200 && (
            <p className="sub" style={{ textAlign: 'center' }}>
              تُعرض أول <span className="num">200</span> صف من{' '}
              <span className="num">{nf.format(table.rows.length)}</span> · يشمل التصدير جميع الصفوف
            </p>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

function render(v: string | number | undefined, c: Table['cols'][number]) {
  if (v === undefined || v === '') return <span className="sub"> </span>
  if (c.person) return <Person name={String(v)} quiet={false} />
  if (c.money && typeof v === 'number') return <Money>{v}</Money>
  if (c.n && typeof v === 'number') return <Num>{v}</Num>
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return <Mono>{s}</Mono>
  return s
}

/* Definition of each report */

function buildTable(key: string, yearId: string): Table | null {
  const rows = projectRows.filter((p) => p.year === yearId)

  switch (key) {
    /* Allocated and spent by track — the five values the system tracks. */
    case 'budget': {
      const total = budgetForYear(yearId)
      const line = (l: typeof total & { label: string }) => ({
        label: l.label, allocated: l.allocated, reserved: l.reserved,
        committed: l.committed, spent: l.spent, remaining: l.remaining,
      })
      return {
        foot: line({ ...total, label: 'الإجمالي' }),
        cols: [
          { key: 'label', label: 'المسار' },
          { key: 'allocated', label: 'المخصص', n: true, money: true },
          { key: 'reserved', label: 'المحجوز', n: true, money: true },
          { key: 'committed', label: 'الملتزم به', n: true, money: true },
          { key: 'spent', label: 'المصروف', n: true, money: true },
          { key: 'remaining', label: 'المتبقّي', n: true, money: true },
        ],
        rows: budgetByTrack(yearId).map((l) => line(l)),
      }
    }

    /* Planned versus actual — only the four columns present in `reports1_12`. */
    case 'actual': {
      /* Cumulative, like the card — see the comment in `reportDefs`. */
      const cs = closingRows
      return {
        cols: [
          { key: 'id', label: 'المشروع' },
          { key: 'name', label: 'الاسم' },
          { key: 'entityName', label: 'الجهة' },
          { key: 'planDays', label: 'المدة المخططة', n: true },
          { key: 'actualDays', label: 'المدة الفعلية', n: true },
          { key: 'dDays', label: 'الفرق', n: true },
          { key: 'planBeneficiaries', label: 'مستفيدو الاتفاقية', n: true },
          { key: 'actualBeneficiaries', label: 'المستفيدون الفعليون', n: true },
          { key: 'granted', label: 'المعتمد', n: true, money: true },
          { key: 'actualBudget', label: 'الميزانية الفعلية', n: true, money: true },
          { key: 'outputs', label: 'المخرجات الفعلية' },
        ],
        rows: cs.map((c) => ({
          id: c.id,
          name: c.name,
          entityName: c.entityName,
          planDays: c.planDays,
          actualDays: c.actualDays,
          dDays: c.actualDays - c.planDays,
          planBeneficiaries: c.planBeneficiaries,
          actualBeneficiaries: c.actualBeneficiaries,
          granted: c.granted,
          actualBudget: c.actualBudget,
          outputs: c.outputs,
        })),
      }
    }

    /* Spending by goal — the same chart as in disbursement allocation, but
       as numbers. */
    case 'spend': {
      const by = new Map<string, { granted: number; spent: number; n: number }>()
      for (const p of rows) {
        if (p.amountGranted <= 0) continue
        const g = by.get(p.goal) ?? { granted: 0, spent: 0, n: 0 }
        g.granted += p.amountGranted
        g.spent += p.amountSpent
        g.n += 1
        by.set(p.goal, g)
      }
      return {
        cols: [
          { key: 'goal', label: 'الهدف' },
          { key: 'n', label: 'المشاريع', n: true },
          { key: 'granted', label: 'المعتمد', n: true, money: true },
          { key: 'spent', label: 'المصروف', n: true, money: true },
          { key: 'rest', label: 'لم يُصرف', n: true, money: true },
          { key: 'share', label: 'حصته من المعتمد' },
        ],
        rows: (() => {
          const all = [...by.values()].reduce((s, g) => s + g.granted, 0) || 1
          return [...by.entries()]
            .sort((a, b) => b[1].granted - a[1].granted)
            .map(([goal, g]) => ({
              goal,
              n: g.n,
              granted: g.granted,
              spent: g.spent,
              rest: g.granted - g.spent,
              share: pct(Math.round((g.granted / all) * 100)),
            }))
        })(),
      }
    }

    /* Partners — the same columns as the system's partner report. */
    case 'partners':
      return {
        cols: [
          { key: 'name', label: 'الجهة' },
          { key: 'type', label: 'التصنيف' },
          { key: 'region', label: 'المنطقة' },
          { key: 'docs', label: 'المستندات' },
          { key: 'approved', label: 'معتمدة', n: true },
          { key: 'running', label: 'تحت التشغيل', n: true },
          { key: 'completed', label: 'مكتملة', n: true },
          { key: 'stalled', label: 'متعثّرة', n: true },
          { key: 'declined', label: 'معتذر عنها', n: true },
          { key: 'grantedTotal', label: 'إجمالي الممنوح', n: true, money: true },
          { key: 'inDisbursement', label: 'تحت الصرف', n: true, money: true },
        ],
        rows: entityRows.map((e) => ({
          name: e.name,
          type: e.type,
          region: e.region,
          docs: `${e.docsUploaded}/${ENTITY_DOCS_TOTAL}`,
          approved: e.projectsApproved,
          running: e.projectsRunning,
          completed: e.projectsCompleted,
          stalled: e.projectsStalled,
          declined: e.projectsDeclined,
          grantedTotal: e.grantedTotal,
          inDisbursement: e.inDisbursement,
        })),
      }

    /* Performance — time-in-stage against the threshold, which the system
       measures but doesn't surface at decision time. */
    case 'stages': {
      const late = rows.filter((p) => stagePressure(p) > 1)
      return {
        cols: [
          { key: 'id', label: 'المشروع' },
          { key: 'name', label: 'الاسم' },
          { key: 'stage', label: 'القسم الإجرائي' },
          { key: 'owner', label: 'المالك', person: true },
          { key: 'inDays', label: 'المكوث', n: true },
          { key: 'limit', label: 'الحدّ', n: true },
          { key: 'over', label: 'التجاوز' },
          { key: 'status', label: 'الحالة' },
        ],
        rows: late
          .sort((a, b) => stagePressure(b) - stagePressure(a))
          .map((p) => ({
            id: p.id,
            name: p.name,
            stage: p.stage,
            owner: p.owner ?? '',
            inDays: days(p.hoursInStage),
            limit: days(p.stageLimit),
            over: pct(Math.round(stagePressure(p) * 100 - 100)),
            status: p.statusGroup,
          })),
      }
    }

    /* Knowledge — with a column stating whether an entry holds a lesson or
       just a note. */
    case 'knowledge': {
      const ks = knowledgeRows
      return {
        cols: [
          { key: 'projectId', label: 'رقم المشروع' },
          { key: 'projectName', label: 'المشروع' },
          { key: 'entityName', label: 'الجهة' },
          { key: 'region', label: 'المنطقة' },
          { key: 'goal', label: 'الهدف' },
          { key: 'owner', label: 'مالك المشروع', person: true },
          { key: 'kind', label: 'النوع' },
          { key: 'quality', label: 'حالة النصّ' },
          { key: 'text', label: 'نصّ المعرفة' },
        ],
        rows: ks.map((k) => ({
          projectId: k.projectId,
          projectName: k.projectName,
          entityName: k.entityName,
          region: k.region,
          goal: k.goal,
          owner: k.owner,
          kind: k.kind,
          quality: k.empty ? 'فارغ' : k.real ? 'درس مكتوب' : 'نصّ قصير',
          text: k.text,
        })),
      }
    }

    default:
      return null
  }
}

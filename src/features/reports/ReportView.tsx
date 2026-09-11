import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BackTo, Empty, Glass, icons, Mono, Money, Num, Select } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { assistFor } from '@/data/mock/assistant'
import { ROUTES } from '@/app/routes'
import { nf, pct } from '@/lib/format'
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
 * تقرير كامل.
 *
 * كل كارت في اللوحة بيفتح هنا. والصفحة بتفضل على نفس القاعدة:
 * **القراءة فوق والصفوف تحت**. اللي فوق هو نفس نصّ الكارت · مش
 * تكرارًا، ده الجسر: المستخدم دخل من جملة، فأول حاجة يشوفها هي
 * نفس الجملة ومعاها الصفوف اللي بنتها.
 *
 * والتصدير موجود في كل تقرير: ده أكتر طلب في الأوديت، وأول سبب
 * بيخلّي المستخدم يفتح النظام القديم بعد ما نسلّم.
 */

type Row = Record<string, string | number>

interface Table {
  cols: { key: string; label: string; n?: boolean; money?: boolean }[]
  rows: Row[]
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
                title="تقرير غير معروف."
                note="ارجع للوحة واختر تقريرًا منها."
                actions={<Link className="btn btn-2" to={ROUTES.reports}>لوحة التقارير</Link>}
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
    rows: table.rows.map((r) => table.cols.map((c) => String(r[c.key] ?? ''))),
  }

  return (
    <AppLayout assistantContext={assistFor.page(card.question)}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo to={ROUTES.reports} label="التقارير" />

          <header>
            <div>
              <h1 className="ptitle">{card.question}</h1>
              <p className="sub" style={{ marginTop: '.3rem' }}>{card.src}</p>
            </div>
          </header>

          {/* القراءة نفسها اللي في اللوحة · الجسر بين الجملة والصفوف */}
          <Glass className="rvread">
            <span className="rvread-v">
              <b className="num">{card.value}</b>
              <small>{card.unit}</small>
            </span>
            <p>{highlight(card.reading, card.bold ?? [], card.danger ?? [])}</p>
          </Glass>

          <div className="ftool-r">
            <div className="ftool-f">
              <Select
                icon={icons.chart}
                value={period}
                all={PERIODS[0].label}
                options={PERIODS.map((p) => ({ value: p.id, label: p.label }))}
                onChange={(v) => setPeriod(v ?? PERIODS[0].id)}
              />
              <span className="sub">
                <span className="num">{nf.format(table.rows.length)}</span> صفًّا
              </span>
            </div>
            <div className="ftool-a">
              <ExportMenu
                sheet={sheet}
                note={`${card.question} · ${PERIODS.find((p) => p.id === period)?.label ?? ''} · ${nf.format(table.rows.length)} صفًّا`}
              />
            </div>
          </div>

          <Glass className="tblcard">
            {table.rows.length === 0 ? (
              <Empty title="لا صفوف في هذه الفترة." note="جرّب سنة أو مصدر تمويل آخر." />
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
                            <td key={c.key} className={c.n ? 'n num' : undefined} title={String(r[c.key] ?? '')}>
                              {render(r[c.key], c)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Glass>

          {table.rows.length > 200 && (
            <p className="sub" style={{ textAlign: 'center' }}>
              معروض أول <span className="num">200</span> صفًّا من{' '}
              <span className="num">{nf.format(table.rows.length)}</span> · التصدير بيطلع الكل
            </p>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

function render(v: string | number | undefined, c: Table['cols'][number]) {
  if (v === undefined || v === '') return <span className="sub"> </span>
  if (c.money && typeof v === 'number') return <Money>{v}</Money>
  if (c.n && typeof v === 'number') return <Num>{v}</Num>
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return <Mono>{s}</Mono>
  return s
}

/* ═══════════════════ تعريف كل تقرير ═══════════════════ */

function buildTable(key: string, yearId: string): Table | null {
  const rows = projectRows.filter((p) => p.year === yearId)

  switch (key) {
    /* المخصص والمصروف على المسارات · القيم الخمس اللي النظام بيمسكها */
    case 'budget': {
      const total = budgetForYear(yearId)
      const lines = [...budgetByTrack(yearId), { ...total, label: 'الإجمالي' }]
      return {
        cols: [
          { key: 'label', label: 'المسار' },
          { key: 'allocated', label: 'المخصص', n: true, money: true },
          { key: 'reserved', label: 'المحجوز', n: true, money: true },
          { key: 'committed', label: 'الملتزم به', n: true, money: true },
          { key: 'spent', label: 'المصروف', n: true, money: true },
          { key: 'remaining', label: 'المتبقّي', n: true, money: true },
        ],
        rows: lines.map((l) => ({
          label: l.label,
          allocated: l.allocated,
          reserved: l.reserved,
          committed: l.committed,
          spent: l.spent,
          remaining: l.remaining,
        })),
      }
    }

    /* المخطط مقابل الفعلي · الأعمدة الأربعة اللي في reports1_12 وبس */
    case 'actual': {
      /* تراكمي زي الكارت · راجع التعليق في `reportDefs` */
      const cs = closingRows
      return {
        cols: [
          { key: 'id', label: 'المشروع' },
          { key: 'name', label: 'الاسم' },
          { key: 'entityName', label: 'الجهة' },
          { key: 'planDays', label: 'المدة المخططة', n: true },
          { key: 'actualDays', label: 'المدة الفعلية', n: true },
          { key: 'dDays', label: 'الفرق', n: true },
          { key: 'planBeneficiaries', label: 'مستفيدو العقد', n: true },
          { key: 'actualBeneficiaries', label: 'المستفيدون الفعليون', n: true },
          { key: 'granted', label: 'المعتمد', n: true, money: true },
          { key: 'actualBudget', label: 'الموازنة الفعلية', n: true, money: true },
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

    /* الصرف حسب الهدف · الرسم اللي في مخصص الصرف، بس كأرقام */
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
          { key: 'n', label: 'مشاريع', n: true },
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

    /* الشركاء · نفس أعمدة تقرير الشركاء في النظام */
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
          { key: 'grantedTotal', label: 'كامل الممنوح', n: true, money: true },
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

    /* الأداء · المكوث مقابل الحدّ، وهو اللي النظام بيقيسه ولا بيعرضه عند القرار */
    case 'stages': {
      const late = rows.filter((p) => stagePressure(p) > 1)
      return {
        cols: [
          { key: 'id', label: 'المشروع' },
          { key: 'name', label: 'الاسم' },
          { key: 'stage', label: 'القسم الإجرائي' },
          { key: 'owner', label: 'المالك' },
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

    /* المعرفة · ومعاها عمود بيقول القيد ده فيه درس ولا نقطة */
    case 'knowledge': {
      const ks = knowledgeRows
      return {
        cols: [
          { key: 'projectId', label: 'رقم المشروع' },
          { key: 'projectName', label: 'المشروع' },
          { key: 'entityName', label: 'الجهة' },
          { key: 'region', label: 'المنطقة' },
          { key: 'goal', label: 'الهدف' },
          { key: 'owner', label: 'مالك المشروع' },
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

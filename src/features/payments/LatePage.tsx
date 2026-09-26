import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HEAT_TONE } from '@/lib/tone'
import {
  BackTo, DateText, Empty, Glass, Head, Icon, icons, Num, Person, Segments, Tag,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useQueryParams } from '@/hooks/useQueryParams'
import { assistFor } from '@/data/mock/assistant'
import { exportXlsx, printArea, type Sheet } from '@/lib/export'
import { countOf, nf, NOUN, nounAfter } from '@/lib/format'
import {
  PAY_LIMIT, PAY_STATES, payHeat, payKpi, payRequests, payStateLabel, payStateWho,
} from '@/data/mock/disbursements'
import type { PayRequest, PayState } from '@/types/domain'

const KEYS = ['heat'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

/* Late and stalled requests report - screen 6, escalation mechanism 9.5.

   Clause 3 names the report columns exactly: "a comprehensive report of late and stalled requests:
   current stage, delay start date, day count, responsible party." Four columns, all present here in
   that order.

   Note: this is a report, not an inbox. The difference isn't cosmetic: an inbox is ordered so you
   can decide on one request, while a report is printed and sent and read by stage so you can see
   where the bottleneck is. So grouping here is always by stage, and the output is export and print,
   not decision buttons.

   === And clause 4 too ===

   "Configuring and editing the escalation mechanism is the system admin's authority directly, with
   no approval path" - so the thresholds are shown here and editable on the same screen, not buried
   in a distant settings page. Whoever reads the report is the one who discovers the threshold
   itself is wrong.

   Note: the thresholds are placeholders: the spec says the day counts come "from settings" without
   giving numbers, the same as the empty "target value" column in the four indicators. So the screen
   says this explicitly instead of letting the number read as a commitment. */

const HEATS = [
  { key: '', label: 'المتأخر والمتعثر' },
  { key: 'late', label: 'متأخر' },
  { key: 'stuck', label: 'متعثر' },
]

/** Delay start date - the day the request crossed its stage's threshold. */
function lateSince(r: PayRequest): string {
  const lim = PAY_LIMIT[r.state]
  const d = new Date()
  d.setDate(d.getDate() - Math.round((r.hoursInState - lim) / 24))
  return d.toISOString().slice(0, 10)
}

/** Delay days - over the threshold, not from the start of the stage. */
const lateDays = (r: PayRequest) => Math.round((r.hoursInState - PAY_LIMIT[r.state]) / 24)

export default function LatePage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const k = payKpi()
  const [limits, setLimits] = useState<Record<string, number>>(() =>
    Object.fromEntries(PAY_STATES.filter((s) => PAY_LIMIT[s.key]).map((s) => [
      s.key, Math.round(PAY_LIMIT[s.key] / 24),
    ])),
  )

  const rows = useMemo(
    () =>
      payRequests
        .filter((r) => {
          const h = payHeat(r)
          if (h === 'ok') return false
          return v.heat ? h === v.heat : true
        })
        .sort((a, b) => lateDays(b) - lateDays(a)),
    [v.heat],
  )

  /* Grouping is always by stage - the report answers "where's the bottleneck". */
  const groups = PAY_STATES.map((s) => ({
    key: s.key as PayState,
    rows: rows.filter((r) => r.state === s.key),
  })).filter((g) => g.rows.length > 0)

  const sheet: Sheet = useMemo(() => {
    const stamp = new Date().toISOString().slice(0, 10)
    return {
      file: `abanumay-late-payments-${stamp}`,
      title: 'الطلبات المتأخرة والمتعثرة',
      headers: [
        'رقم الطلب', 'المشروع', 'الجهة', 'المرحلة الحالية',
        'تاريخ بدء التأخير', 'عدد الأيام', 'المسؤول', 'الحالة', 'المبلغ',
      ],
      rows: rows.map((r) => [
        r.id, r.projectName, r.entityName, payStateLabel(r.state),
        lateSince(r), String(lateDays(r)), r.owner,
        payHeat(r) === 'stuck' ? 'متعثر' : 'متأخر', nf.format(r.asked),
      ]),
      totals: ['', '', '', '', '', '', '', `${countOf(rows.length, NOUN.request)}`, nf.format(rows.reduce((s, r) => s + r.asked, 0))],
    }
  }, [rows])

  return (
    <AppLayout assistantContext={assistFor.page('المتأخر والمتعثر')}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="الصرف" onClick={() => navigate(ROUTES.payments)} />

          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">الطلبات المتأخرة والمتعثرة</h1>
              <p className="sub mt-1">
                آلية التصعيد · البند 3 ·{' '}
                <span className="num">{k.stuck}</span> متعثر و
                <span className="num">{k.late}</span> متأخر عن مدة المرحلة
              </p>
            </div>
            <div className="rowf gp-2">
              <button className="btn btn-2 btn-sm" onClick={() => exportXlsx(sheet)}>
                <Icon name={icons.export} size="sm" />
                صدّر إلى إكسل
              </button>
              <button className="btn btn-2 btn-sm" onClick={() => setTimeout(printArea, 60)}>
                اطبع
              </button>
            </div>
          </header>

          <Segments items={HEATS} active={v.heat ?? ''} onChange={(x) => set({ heat: x })} />

          {/* Clause 4 - configuration is the system admin's direct authority, so it sits alongside the report
   that reveals the threshold itself is wrong. */}
          <Glass>
            <Head
              title="مدد المراحل"
              meta={<Tag tone="warn">مؤقتة · بانتظار المؤسسة</Tag>}
            />
            <div className="paylim">
              {PAY_STATES.filter((s) => PAY_LIMIT[s.key]).map((s) => (
                <label className="paylim-i" key={s.key}>
                  <span className="lb">{s.label}</span>
                  <input
                    type="number"
                    min={1}
                    value={limits[s.key]}
                    onChange={(e) =>
                      setLimits((x) => ({ ...x, [s.key]: Number(e.target.value) || 1 }))
                    }
                  />
                  <span className="sub">يومًا · متعثر بعد <span className="num">{limits[s.key]! * 2}</span></span>
                </label>
              ))}
            </div>
            <p className="sub cnote">
              يجعل البند 4 إعداد الآلية صلاحية لمدير النظام مباشرة بلا مسار موافقات ·
              ويُطلق التجاوز تنبيهًا <b>مرة واحدة</b>، والتعثّر تنبيهًا <b>يوميًا</b> حتى
              اتخاذ الإجراء أو الانتقال.
            </p>
          </Glass>

          {rows.length === 0 ? (
            <Glass>
              <Empty
                title="لا يوجد طلب متأخر أو متعثر."
                note="كل الطلبات المفتوحة ضمن مدة مرحلتها."
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.payments)}>
                    العودة إلى صندوق الصرف
                  </button>
                }
              />
            </Glass>
          ) : (
            groups.map((g) => (
              <section className="paygrp" key={g.key}>
                <div className="paygrp-h">
                  <h2>{payStateLabel(g.key)}</h2>
                  <span className="sub">
                    عند {payStateWho(g.key)} · <span className="num">{g.rows.length}</span> {nounAfter(g.rows.length, NOUN.request)} ·{' '}
                    حدّ المرحلة <span className="num">{limits[g.key]}</span> {nounAfter(limits[g.key], NOUN.day)}
                  </span>
                </div>
                <Glass className="tblcard">
                  <div className="tblwrap">
                    <table className="latetbl">
                      <thead>
                        <tr>
                          <th>الطلب</th>
                          {/* Note: clause 3 names the column "current stage", and here it's the group heading above - so the
   column states status instead of repeating the stage. The exported file names the column
   explicitly since a spreadsheet has no group headings. */}
                          <th>الحالة</th>
                          <th>تاريخ بدء التأخير</th>
                          <th className="n">عدد الأيام</th>
                          <th>المسؤول</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.map((r) => {
                          const heat = payHeat(r)
                          return (
                            <tr key={r.id} onClick={() => navigate(ROUTES.payment(r.id))}>
                              <td>
                                <div className="trim1">{r.projectName}</div>
                                <div className="sub trim1">{r.entityName}</div>
                              </td>
                              <td>
                                <Tag tone={HEAT_TONE[heat]}>
                                  {heat === 'stuck' ? 'متعثر' : 'متأخر'}
                                </Tag>
                              </td>
                              <td><DateText>{lateSince(r)}</DateText></td>
                              <td className="n"><Num>{lateDays(r)}</Num></td>
                              <td><Person name={r.owner} /></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Glass>
              </section>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  )
}

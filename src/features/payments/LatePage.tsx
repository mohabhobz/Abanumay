import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BackTo, DateText, Empty, Glass, Head, Icon, icons, Num, Person, Segments, Tag,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useQueryParams } from '@/hooks/useQueryParams'
import { assistFor } from '@/data/mock/assistant'
import { exportXlsx, printArea, type Sheet } from '@/lib/export'
import { nf } from '@/lib/format'
import {
  PAY_LIMIT, PAY_STATES, payHeat, payKpi, payRequests, payStateLabel, payStateWho,
} from '@/data/mock/disbursements'
import type { PayRequest, PayState } from '@/types/domain'

const KEYS = ['heat'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

/* ═══════════════════════════════════════════════════════════
   تقرير المتأخر والمتعثر · شاشة 6 · آلية التصعيد 9.5

   البند 3 بيسمّي أعمدة التقرير بالحرف: «تقرير شامل بالطلبات
   المتأخرة والمتعثرة: **المرحلة الحالية · تاريخ بدء التأخير · عدد
   الأيام · المسؤول**». أربعة، وكلهم هنا وبالترتيب ده.

   ⚠️ **وده تقرير لا صندوق.** الفرق مش شكلي: الصندوق بيترتّب عشان
   تاخد قرار على طلب واحد، والتقرير بيتطبع ويتبعت وبيتقري بالمرحلة
   عشان تعرف **فين الاختناق**. فالتجميع هنا بالمرحلة دايمًا،
   والمخرج تصدير وطباعة لا أزرار قرار.

   ═══ والبند 4 كمان ═══

   «إعداد وتعديل آلية التصعيد صلاحية **مدير النظام مباشرة بلا مسار
   موافقات**» · فالمدد معروضة هنا وقابلة للتعديل في نفس الشاشة، مش
   مدفونة في إعدادات بعيدة. اللي بيقرا التقرير هو اللي بيكتشف إن
   الحدّ نفسه غلط.

   ⚠️ والمدد **مؤقتة**: الوثيقة بتقول الأيام «من الإعدادات» وما
   دّتش أرقامًا، زي عمود «القيمة المستهدفة» الفاضي في المؤشرات
   الأربعة. فالشاشة بتقول كده صراحةً بدل ما الرقم يتقري التزامًا.
   ═══════════════════════════════════════════════════════════ */

const HEATS = [
  { key: '', label: 'المتأخر والمتعثر' },
  { key: 'late', label: 'متأخر' },
  { key: 'stuck', label: 'متعثر' },
]

/** تاريخ بدء التأخير · اليوم اللي الطلب عدّى فيه حدّ مرحلته */
function lateSince(r: PayRequest): string {
  const lim = PAY_LIMIT[r.state]
  const d = new Date()
  d.setDate(d.getDate() - Math.round((r.hoursInState - lim) / 24))
  return d.toISOString().slice(0, 10)
}

/** أيام التأخير · فوق الحدّ لا من أول المرحلة */
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

  /* التجميع بالمرحلة دايمًا · التقرير بيجاوب «فين الاختناق» */
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
      totals: ['', '', '', '', '', '', '', `${rows.length} طلب`, nf.format(rows.reduce((s, r) => s + r.asked, 0))],
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
                <Icon name={icons.export} size={15} />
                إكسل
              </button>
              <button className="btn btn-2 btn-sm" onClick={() => setTimeout(printArea, 60)}>
                اطبع
              </button>
            </div>
          </header>

          <Segments items={HEATS} active={v.heat ?? ''} onChange={(x) => set({ heat: x })} />

          {/* البند 4 · الإعداد صلاحية مدير النظام مباشرة، فمكانه
              مع التقرير اللي بيكشف إن الحدّ نفسه غلط */}
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
              البند 4 بيخلّي إعداد الآلية صلاحية مدير النظام مباشرة بلا مسار موافقات ·
              والتجاوز بيدّي تنبيهًا <b>مرة واحدة</b>، والتعثّر تنبيهًا <b>يوميًا</b> لحدّ
              الإجراء أو الانتقال.
            </p>
          </Glass>

          {rows.length === 0 ? (
            <Glass>
              <Empty
                title="مفيش طلب متأخر ولا متعثر."
                note="كل الطلبات المفتوحة جوّه مدة مرحلتها."
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.payments)}>
                    ارجع للصندوق
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
                    عند {payStateWho(g.key)} · <span className="num">{g.rows.length}</span> طلب ·{' '}
                    حدّ المرحلة <span className="num">{limits[g.key]}</span> يومًا
                  </span>
                </div>
                <Glass className="tblcard">
                  <div className="tblwrap">
                    <table className="latetbl">
                      <thead>
                        <tr>
                          <th>الطلب</th>
                          {/* ⚠️ البند 3 بيسمّي العمود «المرحلة الحالية»،
                              وهي هنا **عنوان المجموعة** فوق · فالعمود
                              بيقول الحالة لا يكرّر المرحلة. والملف
                              المصدَّر فيه العمود باسمه لأن الإكسل
                              مالوش عناوين مجموعات. */}
                          <th>الحالة</th>
                          <th>تاريخ بدء التأخير</th>
                          <th>عدد الأيام</th>
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
                                <Tag tone={heat === 'stuck' ? 'no' : 'warn'}>
                                  {heat === 'stuck' ? 'متعثر' : 'متأخر'}
                                </Tag>
                              </td>
                              <td><DateText>{lateSince(r)}</DateText></td>
                              <td className="num"><Num>{lateDays(r)}</Num></td>
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

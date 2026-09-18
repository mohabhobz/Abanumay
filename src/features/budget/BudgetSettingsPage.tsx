import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DateField, BackTo, DateText, Glass, Head, Icon, icons, Mono, Num, Tabs, Tag,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import {
  budgetDocs, fiscalYears, fundSources, type FiscalYear, type FundSource,
} from '@/data/mock/budgetTree'

const KEYS = ['tab'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

const TABS = [
  { slug: 'years', label: 'السنوات المالية' },
  { slug: 'sources', label: 'مصادر التمويل' },
] as const

/* ═══════════════════════════════════════════════════════════
   إعدادات الميزانية · الماستر داتا اللي الميزانية بتتبني عليها

   ⚠️ **دي مش «إعدادات» بمعنى تفضيلات.** دي **ماستر داتا**: قيم
   بتتعرَّف مرة وبيتبني عليها كل ريكورد بعدها. والفرق بينها وبين
   الترانزكشن داتا إن دي بتتقري في كل مكان في السيستم والتانية
   بتتكتب مرة.

   ⚠️ **والسنة المالية كيان مستقل عن الميزانية، لا خانة فيها.**
   لو السنة اتكتبت جوّه الميزانية، كل حركة مالية تانية في السيستم
   هتحتاج تكتبها من تاني وتوفّق بينهم بالإيد · والتوفيق ده بالظبط
   هو اللي بيبوّظ التقارير لما تيجي تسأل «اتصرف كام في 2026».

   ⚠️ **ومفيش حذف.** السنة اللي عليها ميزانية، والميزانية اللي
   عليها مشاريع، والمشروع اللي عليه اتفاقيات ودفعات — السلسلة دي
   بتمنع الحذف من أولها. فالعمود الأخير بيقول **المتعلقات** لا
   بيعرض زرار سلة.
   ═══════════════════════════════════════════════════════════ */

export default function BudgetSettingsPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const tab = TABS.some((t) => t.slug === v.tab) ? (v.tab as string) : TABS[0].slug

  const [years, setYears] = useState<FiscalYear[]>(fiscalYears)
  const [sources, setSources] = useState<FundSource[]>(fundSources)

  const [yName, setYName] = useState('')
  const [yFrom, setYFrom] = useState('')
  const [yTo, setYTo] = useState('')
  const [sCode, setSCode] = useState('')
  const [sName, setSName] = useState('')

  /** كام ميزانية مبنية على السنة دي · وده اللي بيمنع حذفها */
  const usedYear = (id: string) => budgetDocs.filter((d) => d.yearId === id).length
  const usedSource = (code: string) => budgetDocs.filter((d) => d.sourceCode === code).length

  const yearTaken = years.some((y) => y.name === yName.trim())
  const codeTaken = sources.some((s) => s.code === sCode.trim().toUpperCase())
  const canAddYear = Boolean(yName.trim()) && Boolean(yFrom) && Boolean(yTo) && !yearTaken
  const canAddSource = Boolean(sCode.trim()) && Boolean(sName.trim()) && !codeTaken

  const addYear = () => {
    setYears((s) => [
      { id: `fy-${yName.trim()}`, name: yName.trim(), from: yFrom, to: yTo },
      ...s,
    ])
    setYName(''); setYFrom(''); setYTo('')
  }

  const addSource = () => {
    setSources((s) => [{ code: sCode.trim().toUpperCase(), name: sName.trim() }, ...s])
    setSCode(''); setSName('')
  }

  return (
    <AppLayout assistantContext={assistFor.page('إعدادات الميزانية')}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="الميزانية" onClick={() => navigate(ROUTES.budget)} />

          <header>
            <div>
              <h1 className="ptitle">إعدادات الميزانية</h1>
              <p className="sub mt-1">
                القيم اللي أي ميزانية بتتبني عليها · ما تعرفش تفتح ميزانية
                إلا لو سنتها ومصدر تمويلها متعرّفين هنا
              </p>
            </div>
          </header>

          <Tabs items={TABS} active={tab} onChange={(x) => set({ tab: x === 'years' ? undefined : x })} />

          {tab === 'years' ? (
            <>
              <Glass>
                <Head
                  title="سنة مالية جديدة"
                  meta={<span className="sub">الاسم والمدى · والاسم ما يتكررش</span>}
                />
                <div className="cfgrow">
                  <label className="regf">
                    <span className="lb">اسم السنة</span>
                    <span className="fld">
                      <input
                        value={yName}
                        onChange={(e) => setYName(e.target.value)}
                        placeholder="2027"
                        aria-label="اسم السنة"
                      />
                    </span>
                  </label>
                  <label className="regf">
                    <span className="lb">من تاريخ</span>
                    <span className="fld">
                      <DateField value={yFrom} onChange={setYFrom} label="من تاريخ" />
                    </span>
                  </label>
                  <label className="regf">
                    <span className="lb">إلى تاريخ</span>
                    <span className="fld">
                      <DateField value={yTo} onChange={setYTo} label="إلى تاريخ" min={yFrom || undefined} />
                    </span>
                  </label>
                  <button
                    className="btn btn-p cfgadd"
                    disabled={!canAddYear}
                    title={yearTaken ? 'السنة دي متعرَّفة قبل كده' : 'أضف السنة'}
                    onClick={addYear}
                  >
                    <Icon name={icons.plus} size={16} />
                    إضافة
                  </button>
                </div>
                {yearTaken && (
                  <p className="bad cnote">
                    السنة <b>{yName}</b> متعرَّفة قبل كده · السنة المالية ما تتكررش.
                  </p>
                )}
              </Glass>

              <Glass className="tblcard">
                <Head
                  title="السنوات المعرَّفة"
                  meta={<span className="sub"><Num>{years.length}</Num> سنة</span>}
                />
                <ul className="cfglist">
                  {years.map((y) => {
                    const used = usedYear(y.id)
                    return (
                      <li key={y.id}>
                        <b className="num">{y.name}</b>
                        <span className="sub">
                          <DateText>{y.from}</DateText>–<DateText>{y.to}</DateText>
                        </span>
                        <span className="pc-sp" />
                        {used > 0
                          ? <Tag tone="mute"><Num>{used}</Num> ميزانية عليها</Tag>
                          : <Tag tone="ok">بلا متعلقات</Tag>}
                      </li>
                    )
                  })}
                </ul>
                <p className="sub cnote">
                  السنة اللي عليها ميزانية ما تتحذفش · والميزانية عليها مشاريع،
                  والمشروع عليه اتفاقيات ودفعات · السلسلة بتمنع الحذف من أولها.
                </p>
              </Glass>
            </>
          ) : (
            <>
              <Glass>
                <Head
                  title="مصدر تمويل جديد"
                  meta={<span className="sub">الرمز والاسم · والرمز ما يتكررش</span>}
                />
                <div className="cfgrow">
                  <label className="regf">
                    <span className="lb">رمز المصدر</span>
                    <span className="fld">
                      <input
                        value={sCode}
                        onChange={(e) => setSCode(e.target.value)}
                        placeholder="SA"
                        aria-label="رمز المصدر"
                      />
                    </span>
                  </label>
                  <label className="regf cfgwide">
                    <span className="lb">اسم المصدر</span>
                    <span className="fld">
                      <input
                        value={sName}
                        onChange={(e) => setSName(e.target.value)}
                        placeholder="وقف …"
                        aria-label="اسم المصدر"
                      />
                    </span>
                  </label>
                  <button
                    className="btn btn-p cfgadd"
                    disabled={!canAddSource}
                    title={codeTaken ? 'الرمز مستعمل' : 'أضف المصدر'}
                    onClick={addSource}
                  >
                    <Icon name={icons.plus} size={16} />
                    إضافة
                  </button>
                </div>
                {/* ⚠️ الرمز هو اللي بيربط الحركة المالية بمصدرها لما
                    الانتجريشن ييجي · الاسم بيتغيّر، الرمز لأ. */}
                <p className="sub cnote">
                  الرمز بيفضل ثابتًا مدى عمر المصدر · الاسم ممكن يتعدّل،
                  والرمز هو اللي الحركات المالية بتتربط بيه.
                </p>
              </Glass>

              <Glass className="tblcard">
                <Head
                  title="المصادر المعرَّفة"
                  meta={<span className="sub"><Num>{sources.length}</Num> مصدر</span>}
                />
                <ul className="cfglist">
                  {sources.map((s) => {
                    const used = usedSource(s.code)
                    return (
                      <li key={s.code}>
                        <b><Mono>{s.code}</Mono></b>
                        <span>{s.name}</span>
                        <span className="pc-sp" />
                        {used > 0
                          ? <Tag tone="mute"><Num>{used}</Num> ميزانية عليها</Tag>
                          : <Tag tone="ok">بلا متعلقات</Tag>}
                      </li>
                    )
                  })}
                </ul>
                <p className="sub cnote">
                  الميزانية بتتعرّف بـ<b>سنة + مصدر</b> · فنفس السنة بمصدرين
                  بتدّي ميزانيتين منفصلتين، وده الوضع الطبيعي هنا.
                </p>
              </Glass>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DateField, BackTo, DateText, Glass, Head, Icon, icons, Mono, Num, Tabs, Tag,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { NOUN, nounAfter } from '@/lib/format'
import {
  budgetDocs, fiscalYears, fundSources, type FiscalYear, type FundSource,
} from '@/data/mock/budgetTree'

const KEYS = ['tab'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

const TABS = [
  { slug: 'years', label: 'السنوات المالية' },
  { slug: 'sources', label: 'مصادر التمويل' },
] as const

/* Budget settings - the master data the budget is built on.

   Note: this isn't "settings" in the sense of preferences. It's master data: values defined once
   that every later record is built on. The difference from transaction data is that this gets read
   everywhere in the system, while transaction data is written once.

   Note: the fiscal year is its own entity, not a field inside the budget. If the year were written
   inside the budget, every other financial transaction in the system would need to write it again
   and reconcile the two by hand - and that reconciliation is exactly what breaks reports when
   someone asks how much was spent in 2026.

   Note: nothing can be deleted. A year with a budget, a budget with projects, a project with
   agreements and payments - this chain blocks deletion from the start. So the last column shows
   dependents, not a trash-can button. */

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

  /** How many budgets are built on this year - what blocks deleting it. */
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
                القيم التي تُبنى عليها كل ميزانية · لا يمكن فتح ميزانية
                إلا بعد تعريف سنتها ومصدر تمويلها هنا
              </p>
            </div>
          </header>

          <Tabs items={TABS} active={tab} onChange={(x) => set({ tab: x === 'years' ? undefined : x })} />

          {tab === 'years' ? (
            <>
              <Glass>
                <Head
                  title="سنة مالية جديدة"
                  meta={<span className="sub">الاسم والمدى · ولا يتكرر الاسم</span>}
                />
                <div className="cfgrow">
                  <label className="regf">
                    <span className="lb">اسم السنة</span>
                    <span className="fld">
                      <input
                        value={yName}
                        onChange={(e) => setYName(e.target.value)}
                        placeholder="مثال: 2027"
                        aria-label="اسم السنة"
                      />
                    </span>
                  </label>
                  <label className="regf">
                    <span className="lb">من تاريخ</span>
                    {/* Note: `DateField` wraps `.fld` itself - the wrapper used to be a field
                        inside a field: a 52px box around a 36px box. */}
                    <DateField value={yFrom} onChange={setYFrom} label="من تاريخ" />
                  </label>
                  <label className="regf">
                    <span className="lb">إلى تاريخ</span>
                    <DateField value={yTo} onChange={setYTo} label="إلى تاريخ" min={yFrom || undefined} />
                  </label>
                  <button
                    className="btn btn-p cfgadd"
                    disabled={!canAddYear}
                    title={yearTaken ? 'هذه السنة معرَّفة من قبل' : 'أضف السنة'}
                    onClick={addYear}
                  >
                    <Icon name={icons.plus} size="sm" />
                    أضف السنة
                  </button>
                </div>
                {yearTaken && (
                  <p className="bad cnote">
                    السنة <b>{yName}</b> معرَّفة من قبل · أدخل اسمًا آخر، فالسنة المالية لا تتكرر.
                  </p>
                )}
              </Glass>

              <Glass className="tblcard">
                <Head
                  title="السنوات المعرَّفة"
                  meta={<span className="sub"><Num>{years.length}</Num> {nounAfter(years.length, NOUN.year)}</span>}
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
                          ? <Tag tone="mute"><Num>{used}</Num> {nounAfter(used, NOUN.budget)} عليها</Tag>
                          : <Tag tone="ok">بلا متعلقات</Tag>}
                      </li>
                    )
                  })}
                </ul>
                <p className="sub cnote">
                  لا تُحذف سنة عليها ميزانية · فالميزانية عليها مشاريع، والمشروع
                  عليه اتفاقيات ودفعات، وهذه السلسلة تمنع الحذف من أولها.
                </p>
              </Glass>
            </>
          ) : (
            <>
              <Glass>
                <Head
                  title="مصدر تمويل جديد"
                  meta={<span className="sub">الرمز والاسم · ولا يتكرر الرمز</span>}
                />
                <div className="cfgrow">
                  <label className="regf">
                    <span className="lb">رمز المصدر</span>
                    <span className="fld">
                      <input
                        value={sCode}
                        onChange={(e) => setSCode(e.target.value)}
                        placeholder="مثال: SA"
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
                        placeholder="مثال: وقف …"
                        aria-label="اسم المصدر"
                      />
                    </span>
                  </label>
                  <button
                    className="btn btn-p cfgadd"
                    disabled={!canAddSource}
                    title={codeTaken ? 'الرمز مستعمل من قبل' : 'أضف المصدر'}
                    onClick={addSource}
                  >
                    <Icon name={icons.plus} size="sm" />
                    أضف المصدر
                  </button>
                </div>
                {/* Note: the code is what ties the transaction to its source once integration
                    arrives - the name can change, the code can't. */}
                <p className="sub cnote">
                  يبقى الرمز ثابتًا طوال عمر المصدر · يمكن تعديل الاسم،
                  أما الرمز فهو ما تُربط به الحركات المالية.
                </p>
              </Glass>

              <Glass className="tblcard">
                <Head
                  title="المصادر المعرَّفة"
                  meta={<span className="sub"><Num>{sources.length}</Num> {nounAfter(sources.length, NOUN.source)}</span>}
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
                          ? <Tag tone="mute"><Num>{used}</Num> {nounAfter(used, NOUN.budget)} عليها</Tag>
                          : <Tag tone="ok">بلا متعلقات</Tag>}
                      </li>
                    )
                  })}
                </ul>
                <p className="sub cnote">
                  تُعرَّف الميزانية بـ<b>سنة + مصدر</b> · فالسنة نفسها بمصدرين
                  تعطي ميزانيتين منفصلتين، وهذا هو الوضع الطبيعي.
                </p>
              </Glass>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

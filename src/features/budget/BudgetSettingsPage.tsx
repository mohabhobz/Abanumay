import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  DateField, BackTo, DateText, Glass, Head, Icon, icons, Mono, MultiSelect, Num, Switch, Tabs, Tag,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { DockSlotProvider, SaveBar, useDockSlot } from '@/components/shell'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { NOUN, nf, nounAfter } from '@/lib/format'
import { fiscalYears, fundSources, docSources, yearOverlap } from '@/data/mock/budgetTree'
import { allBudgets } from '@/data/mock/chain'
import { APPROVAL_MATRIX } from '@/data/approval'
import { STAFF_ROLES, readRole, roleByKey, type RoleKey } from '@/data/roles'
import { CfgNum } from '@/features/settings/CfgEdit'
import {
  DIRECTIONS, addSource, addYear, renameSource, resetBudget, saveDirection, useBudget,
} from '@/data/budget/store'
import { BUDGET_RULES, LEVEL_SAY, saveBudgetRules, type BudgetRules, type Level } from '@/data/budget/rules'

const KEYS = ['tab'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

const TABS = [
  { slug: 'years', label: 'السنوات المالية' },
  { slug: 'sources', label: 'مصادر التمويل' },
  { slug: 'directions', label: 'التوجهات الاستراتيجية' },
  { slug: 'limits', label: 'حدود الصلاحيات' },
  { slug: 'rules', label: 'قواعد الاعتماد والمناقلة' },
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
   dependents, not a trash-can button.

   Everything added here goes through the budget store, so a year or a source added now is the one
   the new-budget screen offers (1.2.1 · 1.2.2); a year whose period overlaps another can't be
   added (1.4.1), nor one that ends before it starts (1.4.2). */

export default function BudgetSettingsPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const tab = TABS.some((t) => t.slug === v.tab) ? (v.tab as string) : TABS[0].slug
  useBudget()
  const dock = useDockSlot()

  return (
    <AppLayout assistantContext={assistFor.page('إعدادات الميزانية')}>
      <DockSlotProvider value={dock.value}>
      <div className={`viewstack${dock.on ? ' hasdock' : ''}`}>
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

          {tab === 'years' && <YearsTab />}
          {tab === 'sources' && <SourcesTab />}
          {tab === 'directions' && <DirectionsTab />}
          {tab === 'limits' && <LimitsTab />}
          {tab === 'rules' && <RulesTab />}
        </div>
        {/* The unsaved-changes dock · inside the view stack, so it spans the content column like the decision bar, not the rail */}
        <div className="dockslot" ref={dock.setEl} />
      </div>
      </DockSlotProvider>
    </AppLayout>
  )
}

const me = () => roleByKey(readRole()).name

function YearsTab() {
  const [yName, setYName] = useState('')
  const [yFrom, setYFrom] = useState('')
  const [yTo, setYTo] = useState('')

  const usedYear = (id: string) => allBudgets.filter((d) => d.yearId === id).length
  const name = yName.trim()
  const yearTaken = fiscalYears.some((y) => y.name === name)
  const reversed = Boolean(yFrom && yTo && yTo < yFrom)
  const overlap = yFrom && yTo && !reversed ? yearOverlap(fiscalYears, yFrom, yTo) : undefined
  const canAddYear = Boolean(name) && Boolean(yFrom) && Boolean(yTo) && !yearTaken && !reversed && !overlap

  const add = () => {
    addYear({ id: `fy-${name}`, name, from: yFrom, to: yTo }, me())
    setYName(''); setYFrom(''); setYTo('')
  }

  return (
    <>
      <Glass>
        <Head title="سنة مالية جديدة" meta={<span className="sub">الاسم والمدى · سنة واحدة لكل فترة</span>} />
        <div className="cfgrow">
          <label className="regf">
            <span className="lb">اسم السنة<b className="regf-r" aria-label="إلزامي">*</b></span>
            <span className="fld">
              <input value={yName} onChange={(e) => setYName(e.target.value)} placeholder="مثال: 2028" aria-label="اسم السنة" />
            </span>
          </label>
          <label className="regf">
            <span className="lb">من تاريخ<b className="regf-r" aria-label="إلزامي">*</b></span>
            {/* Note: `DateField` wraps `.fld` itself - the wrapper used to be a field inside a
                field: a 52px box around a 36px box. */}
            <DateField value={yFrom} onChange={setYFrom} label="من تاريخ" />
          </label>
          <label className="regf">
            <span className="lb">إلى تاريخ<b className="regf-r" aria-label="إلزامي">*</b></span>
            <DateField value={yTo} onChange={setYTo} label="إلى تاريخ" min={yFrom || undefined} />
          </label>
          <button
            className="btn btn-p cfgadd"
            disabled={!canAddYear}
            title={yearTaken ? 'هذه السنة معرَّفة من قبل' : overlap ? 'المدة تتداخل مع سنة معرَّفة' : 'أضف السنة'}
            onClick={add}
          >
            <Icon name={icons.plus} size="sm" />
            أضف السنة
          </button>
        </div>
        {yearTaken && (
          <p className="bad cnote">السنة <b>{yName}</b> معرَّفة من قبل · أدخل اسمًا آخر، فالسنة المالية لا تتكرر.</p>
        )}
        {reversed && <p className="bad cnote">تاريخ النهاية قبل تاريخ البداية · لا تنتهي السنة المالية قبل أن تبدأ.</p>}
        {overlap && (
          <p className="bad cnote">
            المدة تتداخل مع السنة <b className="num">{overlap.name}</b> (<DateText>{overlap.from}</DateText> – <DateText>{overlap.to}</DateText>) · لكل فترة مالية سنة واحدة.
          </p>
        )}
      </Glass>

      <Glass className="tblcard">
        <Head title="السنوات المعرَّفة" meta={<span className="sub"><Num>{fiscalYears.length}</Num> {nounAfter(fiscalYears.length, NOUN.year)}</span>} />
        <ul className="cfglist">
          {fiscalYears.map((y) => {
            const used = usedYear(y.id)
            return (
              <li key={y.id}>
                <b className="num">{y.name}</b>
                <span className="sub"><DateText>{y.from}</DateText>–<DateText>{y.to}</DateText></span>
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
  )
}

function SourcesTab() {
  const [sCode, setSCode] = useState('')
  const [sName, setSName] = useState('')
  const [edit, setEdit] = useState<{ code: string; name: string } | null>(null)

  const usedSource = (code: string) => allBudgets.filter((d) => docSources(d).some((x) => x.code === code)).length
  const codeTaken = fundSources.some((s) => s.code === sCode.trim().toUpperCase())
  const canAddSource = Boolean(sCode.trim()) && Boolean(sName.trim()) && !codeTaken

  return (
    <>
      <Glass>
        <Head title="مصدر تمويل جديد" meta={<span className="sub">الرمز والاسم · ولا يتكرر الرمز</span>} />
        <div className="cfgrow">
          <label className="regf">
            <span className="lb">رمز المصدر<b className="regf-r" aria-label="إلزامي">*</b></span>
            <span className="fld">
              <input value={sCode} onChange={(e) => setSCode(e.target.value)} placeholder="مثال: SA" aria-label="رمز المصدر" />
            </span>
          </label>
          <label className="regf cfgwide">
            <span className="lb">اسم المصدر<b className="regf-r" aria-label="إلزامي">*</b></span>
            <span className="fld">
              <input value={sName} onChange={(e) => setSName(e.target.value)} placeholder="مثال: وقف …" aria-label="اسم المصدر" />
            </span>
          </label>
          <button
            className="btn btn-p cfgadd"
            disabled={!canAddSource}
            title={codeTaken ? 'الرمز مستعمل من قبل' : 'أضف المصدر'}
            onClick={() => { addSource({ code: sCode.trim().toUpperCase(), name: sName.trim() }, me()); setSCode(''); setSName('') }}
          >
            <Icon name={icons.plus} size="sm" />
            أضف المصدر
          </button>
        </div>
        {codeTaken && <p className="bad cnote">الرمز <Mono>{sCode.trim().toUpperCase()}</Mono> مستعمل لمصدر آخر.</p>}
        {/* Note: the code is what ties the transaction to its source once integration arrives -
            the name can change, the code can't. */}
        <p className="sub cnote">يبقى الرمز ثابتًا طوال عمر المصدر · يمكن تعديل الاسم، أما الرمز فهو ما تُربط به الحركات المالية.</p>
      </Glass>

      <Glass className="tblcard">
        <Head title="المصادر المعرَّفة" meta={<span className="sub"><Num>{fundSources.length}</Num> {nounAfter(fundSources.length, NOUN.source)}</span>} />
        <ul className="cfglist">
          {fundSources.map((s) => {
            const used = usedSource(s.code)
            const editing = edit?.code === s.code
            return (
              <li key={s.code}>
                <b><Mono>{s.code}</Mono></b>
                {editing ? (
                  <span className="fld bgs-ren">
                    <input autoFocus value={edit.name} onChange={(e) => setEdit({ code: s.code, name: e.target.value })} aria-label={`اسم ${s.code}`} />
                  </span>
                ) : <span>{s.name}</span>}
                <span className="pc-sp" />
                {used > 0
                  ? <Tag tone="mute"><Num>{used}</Num> {nounAfter(used, NOUN.budget)} عليها</Tag>
                  : <Tag tone="ok">بلا متعلقات</Tag>}
                {editing ? (
                  <>
                    <button className="btn btn-p btn-sm" disabled={!edit.name.trim()} onClick={() => { renameSource(s.code, edit.name.trim(), me()); setEdit(null) }}>احفظ</button>
                    <button className="btn btn-2 btn-sm" onClick={() => setEdit(null)}>تراجع</button>
                  </>
                ) : (
                  <button className="btn btn-ghost btn-sm" aria-label={`عدّل اسم ${s.name}`} title="عدّل الاسم" onClick={() => setEdit({ code: s.code, name: s.name })}>
                    <Icon name={icons.edit} size="sm" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        <p className="sub cnote">
          للميزانية مصدر واحد أو أكثر بمبلغ لكل مصدر · ويُوزَّع مبلغ البند على مصادر ميزانيته عند إعداد الشجرة.
        </p>
      </Glass>
    </>
  )
}

function DirectionsTab() {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const used = (id: string) => allBudgets.filter((d) => d.directionIds?.includes(id)).length
  const taken = DIRECTIONS.some((d) => d.name === name.trim())

  return (
    <>
      <Glass>
        <Head title="توجه استراتيجي جديد" meta={<span className="sub"><bdi>{/* doc 1.1.input-1 */}</bdi></span>} />
        <div className="cfgrow">
          <label className="regf">
            <span className="lb">اسم التوجه<b className="regf-r" aria-label="إلزامي">*</b></span>
            <span className="fld"><input value={name} onChange={(e) => setName(e.target.value)} aria-label="اسم التوجه" /></span>
          </label>
          <label className="regf cfgwide">
            <span className="lb">التعريف</span>
            <span className="fld"><input value={note} onChange={(e) => setNote(e.target.value)} aria-label="تعريف التوجه" /></span>
          </label>
          <button
            className="btn btn-p cfgadd"
            disabled={!name.trim() || taken}
            onClick={() => { saveDirection({ id: `dir-${Date.now()}`, name: name.trim(), note: note.trim(), active: true }, me()); setName(''); setNote('') }}
          >
            <Icon name={icons.plus} size="sm" />
            أضف التوجه
          </button>
        </div>
        {taken && <p className="bad cnote">التوجه معرَّف من قبل.</p>}
        <p className="sub cnote">تُبنى كل ميزانية على توجه أو أكثر من هذه القائمة، ويرتبط بها كل بند في شجرتها · فيُقرأ التخصيص في التقرير المجمّع حسب التوجه.</p>
      </Glass>

      <Glass className="tblcard">
        <Head title="التوجهات المعرَّفة" meta={<span className="sub"><Num>{DIRECTIONS.length}</Num> توجهات</span>} />
        <ul className="cfglist">
          {DIRECTIONS.map((d) => (
            <li key={d.id}>
              <b>{d.name}</b>
              <span className="sub trim1">{d.note}</span>
              <span className="pc-sp" />
              {used(d.id) > 0 ? <Tag tone="mute"><Num>{used(d.id)}</Num> {nounAfter(used(d.id), NOUN.budget)}</Tag> : <Tag tone="ok">بلا متعلقات</Tag>}
              <Switch label={d.active ? 'مفعّل' : 'موقوف'} on={d.active} onChange={(on) => saveDirection({ ...d, active: on }, me())} />
            </li>
          ))}
        </ul>
        <p className="sub cnote">التوجه الموقوف لا يُختار لميزانية جديدة · ويبقى على الميزانيات المبنية عليه.</p>
      </Glass>
    </>
  )
}

const LEVELS: Level[] = ['manager', 'exec', 'committee', 'board']

function LimitsTab() {
  const [saved, setSaved] = useState(() => ({ ...BUDGET_RULES.spendCaps }))
  const [d, setD] = useState(() => ({ ...BUDGET_RULES.spendCaps }))
  const dirty = JSON.stringify(d) !== JSON.stringify(saved)
  const capped = LEVELS.filter((l) => d[l] !== null)
  const broken = capped.some((l, i) => i > 0 && (d[l] ?? 0) <= (d[capped[i - 1]] ?? 0))
  const approval = (l: Level) => APPROVAL_MATRIX.find((r) => r.key === l)?.upTo

  return (
    <>
      <Glass className="tblcard">
        <Head title="حدود الاعتماد والصرف لكل مستوى إداري" meta={<span className="sub"><bdi>{/* doc 1.1.input-6 */}</bdi></span>} />
        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>المستوى</th>
                <th className="n">حد اعتماد المشروع</th>
                <th className="n">حد اعتماد أمر الصرف</th>
              </tr>
            </thead>
            <tbody>
              {LEVELS.map((l) => {
                const a = approval(l)
                return (
                  <tr key={l}>
                    <td>{LEVEL_SAY[l]}</td>
                    <td className="n">{a === null || a === undefined ? <span className="sub">بلا حدّ</span> : <span className="num">{nf.format(a)}</span>}</td>
                    <td className="n">
                      {d[l] === null
                        ? <span className="sub">بلا حدّ</span>
                        : <CfgNum value={d[l] ?? 0} label={`حد صرف ${LEVEL_SAY[l]}`} suffix="ريال" onChange={(n) => setD((x) => ({ ...x, [l]: n }))} />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {broken && <p className="bad cnote">الحدود تتصاعد مستوى بعد مستوى · لا يصرف مستوى أعلى أقل من الذي تحته.</p>}
        <p className="sub cnote">
          حدود اعتماد المشروع من مصفوفة الاعتماد (مصدر واحد للنظام كله) · <Link className="lnk" to={`${ROUTES.projectSettings}?tab=approval`}>عدّلها في إعدادات المشاريع</Link>.
          وحد الصرف هو أكبر دفعة يعتمد صرفها المستوى · ما فوق حد مدير المنح يعتمده المدير التنفيذي قبل الإدارة المالية، وما فوق حدّه يُعتمد بقرار اللجنة أو المجلس.
        </p>
      </Glass>
      {dirty && (
        <SaveBar
          count={1}
          sentence={<>تعديل حدود الصرف<span className="decsep" /><span className="sub">تسري على طلبات الصرف فور الحفظ</span></>}
          onSave={() => { if (broken) return; saveBudgetRules({ ...BUDGET_RULES, spendCaps: d }); setSaved({ ...d }) }}
          onDiscard={() => setD({ ...saved })}
        />
      )}
    </>
  )
}

const ROLE_OPTS = STAFF_ROLES.map((r) => ({ value: r.key, label: r.title }))

function RulesTab() {
  const [saved, setSaved] = useState<BudgetRules>(() => structuredClone(BUDGET_RULES))
  const [d, setD] = useState<BudgetRules>(() => structuredClone(BUDGET_RULES))
  const dirty = JSON.stringify(d) !== JSON.stringify(saved)
  const put = <K extends keyof BudgetRules>(k: K, x: BudgetRules[K]) => setD((s) => ({ ...s, [k]: x }))
  const roles = (k: 'prepareBy' | 'managerBy' | 'financeBy' | 'execBy' | 'statusBy', label: string, note: string) => (
    <li className="itk-sup">
      <span className="cfgl"><b>{label}</b><span className="sub">{note}</span></span>
      <span className="pc-sp" />
      <MultiSelect all="لا أحد" values={d[k]} options={ROLE_OPTS} onChange={(x) => put(k, x as RoleKey[])} />
    </li>
  )

  return (
    <>
      <Glass>
        <Head title="مسار الاعتماد" meta={<span className="sub"><bdi>{/* doc 1.2.8–1.2.11 · 1.3.6–1.3.9 */}</bdi></span>} />
        <ul className="cfglist">
          {roles('prepareBy', 'إعداد الميزانية وطلبات العمليات', 'صاحب الصلاحية · يُنشئ ويرسل')}
          {roles('managerBy', 'مراجعة مدير المنح', 'موافقة وإحالة للإدارة المالية · أو إعادة للمُعِدّ')}
          {roles('financeBy', 'مراجعة الإدارة المالية', 'موافقة وإحالة للمدير التنفيذي · أو إعادة للمُعِدّ')}
          {roles('execBy', 'اعتماد المدير التنفيذي', 'اعتماد وتفعيل · أو إعادة للإدارة المالية')}
          {roles('statusBy', 'تفعيل البنود وإيقافها', 'على الميزانية المعتمدة · ويسري على ما تحت البند')}
        </ul>
      </Glass>

      <Glass>
        <Head title="سياسة المناقلة" meta={<span className="sub"><bdi>{/* doc 1.3.5 */}</bdi></span>} />
        <ul className="cfglist">
          <li className="itk-sup">
            <span className="cfgl"><b>أقصى ما ينقله طلب واحد</b><span className="sub">من مخصص البند المنقول منه</span></span>
            <span className="pc-sp" />
            <CfgNum value={d.maxTransferPct} min={1} label="أقصى نسبة للمناقلة" suffix="بالمئة" onChange={(n) => put('maxTransferPct', Math.min(100, n))} />
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>مرفق داعم إلزامي من مبلغ</b><span className="sub">على المناقلة والتعزيز والتخفيض</span></span>
            <span className="pc-sp" />
            <CfgNum value={d.attachAbove} label="مبلغ المرفق الإلزامي" suffix="ريال" onChange={(n) => put('attachAbove', n)} />
          </li>
        </ul>
      </Glass>

      <Glass>
        <Head title="الحجز والارتباط المالي" meta={<span className="sub"><bdi>{/* doc 5.4.19 · 1.4.27 · 1.4.28 · 1.4.56 */}</bdi></span>} />
        <ul className="cfglist">
          <li className="itk-sup">
            <span className="cfgl"><b>مرحلة الحجز على الميزانية</b><span className="sub">وفق السياسة المالية · ويثبت الحجز نهائيًّا عند الاعتماد في الحالتين</span></span>
            <span className="pc-sp" />
            <div className="cfgchips" role="radiogroup" aria-label="مرحلة الحجز">
              {(['recommend', 'approval'] as const).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={d.holdAt === v} className={`cfgchip${d.holdAt === v ? ' on' : ''}`} onClick={() => put('holdAt', v)}>
                  {v === 'recommend' ? 'مبدئي عند توصية مدير المنح' : 'عند الاعتماد النهائي'}
                </button>
              ))}
            </div>
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>تعديل الارتباط بعد الاعتماد</b><span className="sub">يُلغى الحجز السابق ويُحجز الجديد على كامل القيمة بسبب موثّق</span></span>
            <span className="pc-sp" />
            <MultiSelect all="لا أحد" values={d.relinkBy} options={ROLE_OPTS} onChange={(x) => put('relinkBy', x as RoleKey[])} />
          </li>
        </ul>
      </Glass>

      <Glass>
        <Head title="استقبال المشاريع" meta={<span className="sub"><bdi>{/* doc 1.1.output-5 · 1.4.37 */}</bdi></span>} />
        <Switch
          label="لا يُفتح التقديم إلا على المجالات الممولة في ميزانية معتمدة"
          note="المجال الذي لا بند نشطًا له في ميزانية السنة المعتمدة يُغلق في دورة الاستقبال · وتظهر للجهة الأهداف النشطة وحدها"
          on={d.requireFunding}
          onChange={(x) => put('requireFunding', x)}
        />
      </Glass>

      <Glass>
        <Head title="بيانات العرض التجريبي" />
        <p className="sub cnote">يُعيد الميزانيات وطلبات العمليات والخطط المالية والسنوات والمصادر المضافة إلى بداية العرض.</p>
        <button type="button" className="btn btn-2" onClick={resetBudget}>أعد ضبط بيانات الميزانية</button>
      </Glass>

      {dirty && (
        <SaveBar
          count={1}
          sentence={<>تعديل قواعد الميزانية<span className="decsep" /><span className="sub">تسري على الشاشات والطلبات فور الحفظ</span></>}
          onSave={() => { saveBudgetRules(d); setSaved(structuredClone(d)) }}
          onDiscard={() => setD(structuredClone(saved))}
        />
      )}
    </>
  )
}

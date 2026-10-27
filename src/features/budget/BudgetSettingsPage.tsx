import { TaxonomyTab } from './TaxonomyTab'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FormField, FieldBox, Button, FieldMultiSelect,
  DateField, BackTo, DateText, Glass, Head, Icon, icons, Mono, Num, Switch, Tabs, Tag } from '@/components/ui'
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
  /* Client sheet 26 Oct (#112) */
  { slug: 'taxonomy', label: 'المسارات والمجالات والأهداف' },
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
            </div>
          </header>

          <Tabs items={TABS} active={tab} onChange={(x) => set({ tab: x === 'years' ? undefined : x })} />

          {tab === 'years' && <YearsTab />}
          {tab === 'sources' && <SourcesTab />}
          {tab === 'directions' && <DirectionsTab />}
          {tab === 'taxonomy' && <TaxonomyTab />}
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
        <Head title="سنة مالية جديدة" />
        <div className="cfgrow">
          <FormField label="اسم السنة" required>
            <FieldBox>
              <input value={yName} onChange={(e) => setYName(e.target.value)} placeholder="مثال: 2028" aria-label="اسم السنة" />
            </FieldBox>
          </FormField>
          <FormField label="من تاريخ" required>
            {/* Note: `DateField` wraps `.fld` itself - the wrapper used to be a field inside a
                field: a 52px box around a 36px box. */}
            <DateField value={yFrom} onChange={setYFrom} label="من تاريخ" />
          </FormField>
          <FormField label="إلى تاريخ" required>
            <DateField value={yTo} onChange={setYTo} label="إلى تاريخ" min={yFrom || undefined} />
          </FormField>
          <Button
            variant="p" className="cfgadd"
            disabled={!canAddYear}
            title={yearTaken ? 'هذه السنة معرَّفة من قبل' : overlap ? 'المدة تتداخل مع سنة معرَّفة' : 'أضف السنة'}
            onClick={add}
          >
            <Icon name={icons.plus} size="sm" />
            أضف السنة
          </Button>
        </div>
        {yearTaken && (
          <p className="bad cnote">السنة <b>{yName}</b> معرَّفة من قبل.</p>
        )}
        {reversed && <p className="bad cnote">تاريخ النهاية قبل تاريخ البداية.</p>}
        {overlap && (
          <p className="bad cnote">
            المدة تتداخل مع السنة <b className="num">{overlap.name}</b> (<DateText>{overlap.from}</DateText> – <DateText>{overlap.to}</DateText>).
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
        <Head title="مصدر تمويل جديد" />
        <div className="cfgrow">
          <FormField label="رمز المصدر" required>
            <FieldBox>
              <input value={sCode} onChange={(e) => setSCode(e.target.value)} placeholder="مثال: SA" aria-label="رمز المصدر" />
            </FieldBox>
          </FormField>
          <FormField label="اسم المصدر" required className="cfgwide">
            <FieldBox>
              <input value={sName} onChange={(e) => setSName(e.target.value)} placeholder="مثال: وقف …" aria-label="اسم المصدر" />
            </FieldBox>
          </FormField>
          <Button
            variant="p" className="cfgadd"
            disabled={!canAddSource}
            title={codeTaken ? 'الرمز مستعمل من قبل' : 'أضف المصدر'}
            onClick={() => { addSource({ code: sCode.trim().toUpperCase(), name: sName.trim() }, me()); setSCode(''); setSName('') }}
          >
            <Icon name={icons.plus} size="sm" />
            أضف المصدر
          </Button>
        </div>
        {codeTaken && <p className="bad cnote">الرمز <Mono>{sCode.trim().toUpperCase()}</Mono> مستعمل لمصدر آخر.</p>}

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
                  <FieldBox className="bgs-ren">
                    <input autoFocus value={edit.name} onChange={(e) => setEdit({ code: s.code, name: e.target.value })} aria-label={`اسم ${s.code}`} />
                  </FieldBox>
                ) : <span>{s.name}</span>}
                <span className="pc-sp" />
                {used > 0
                  ? <Tag tone="mute"><Num>{used}</Num> {nounAfter(used, NOUN.budget)} عليها</Tag>
                  : <Tag tone="ok">بلا متعلقات</Tag>}
                {editing ? (
                  <>
                    <Button variant="p" size="sm" disabled={!edit.name.trim()} onClick={() => { renameSource(s.code, edit.name.trim(), me()); setEdit(null) }}>احفظ</Button>
                    <Button variant="2" size="sm" onClick={() => setEdit(null)}>تراجع</Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" aria-label={`عدّل اسم ${s.name}`} title="عدّل الاسم" onClick={() => setEdit({ code: s.code, name: s.name })}>
                    <Icon name={icons.edit} size="sm" />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>

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
          <FormField label="اسم التوجه" required>
            <FieldBox><input value={name} onChange={(e) => setName(e.target.value)} aria-label="اسم التوجه" /></FieldBox>
          </FormField>
          <FormField label="التعريف" className="cfgwide">
            <FieldBox><input value={note} onChange={(e) => setNote(e.target.value)} aria-label="تعريف التوجه" /></FieldBox>
          </FormField>
          <Button
            variant="p" className="cfgadd"
            disabled={!name.trim() || taken}
            onClick={() => { saveDirection({ id: `dir-${Date.now()}`, name: name.trim(), note: note.trim(), active: true }, me()); setName(''); setNote('') }}
          >
            <Icon name={icons.plus} size="sm" />
            أضف التوجه
          </Button>
        </div>
        {taken && <p className="bad cnote">التوجه معرَّف من قبل.</p>}

      </Glass>

      <Glass className="tblcard">
        <Head title="التوجهات المعرَّفة" meta={<span className="sub"><Num>{DIRECTIONS.length}</Num> توجهات</span>} />
        <ul className="cfglist cfgcols cfgend">
          {DIRECTIONS.map((d) => (
            <li key={d.id}>
              <b>{d.name}</b>
              <span className="sub trim1">{d.note}</span>
              <span className="pc-sp" />
              {used(d.id) > 0 ? <Tag tone="mute"><Num>{used(d.id)}</Num> {nounAfter(used(d.id), NOUN.budget)}</Tag> : <Tag tone="ok">بلا متعلقات</Tag>}
              {/* 1.6.2 · the priority weighs the allocation suggestion */}
              <CfgNum value={d.priority ?? 3} min={1} label={`أولوية ${d.name}`} suffix="من 5" onChange={(n) => saveDirection({ ...d, priority: Math.min(5, Math.max(1, n)) }, me())} />
              <Switch label={d.active ? 'مفعّل' : 'موقوف'} on={d.active} onChange={(on) => saveDirection({ ...d, active: on }, me())} />
            </li>
          ))}
        </ul>

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
        {/* doc 1.1.input-6 */}
        <Head
          title="حدود الاعتماد والصرف لكل مستوى إداري"
          meta={<Link className="lnk sub" to={`${ROUTES.projectSettings}?tab=approval`}>إعدادات المشاريع</Link>}
          hint="حدود اعتماد المشروع تُعدَّل من إعدادات المشاريع · ولا حد مالي لاعتماد إذن صرف الدفعات."
        />
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
        {broken && <p className="bad cnote">حد المستوى الأعلى أقل من الذي تحته.</p>}
      </Glass>
      {dirty && (
        <SaveBar
          count={1}
          sentence="تعديل حدود الصرف"
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
  const roles = (k: 'prepareBy' | 'managerBy' | 'financeBy' | 'execBy' | 'statusBy' | 'notifyLive', label: string) => (
    <li className="itk-sup">
      <span className="cfgl"><b>{label}</b></span>
      <span className="pc-sp" />
      <FieldMultiSelect placeholder="لا أحد" values={d[k]} options={ROLE_OPTS} onChange={(x) => put(k, x as RoleKey[])} />
    </li>
  )

  return (
    <>
      <Glass>
        {/* v3 · 1.1.desc-4 · doc 1.2.7–1.2.11 · 1.3.6–1.3.9 */}
        <Head title="مسار الاعتماد" />
        <ul className="cfglist">
          {roles('prepareBy', 'إعداد الميزانية وطلبات العمليات')}
          {roles('managerBy', 'مراجعة قبل الإدارة المالية (اختيارية)')}
          {roles('financeBy', 'مراجعة الإدارة المالية واعتمادها')}
          {roles('execBy', 'اعتماد المدير التنفيذي')}
          {roles('statusBy', 'تفعيل البنود وإيقافها')}
          {roles('notifyLive', 'يُبلَّغ بتفعيل الميزانية وتنفيذ العمليات')}
        </ul>
      </Glass>

      <Glass>
        <Head title="سياسة المناقلة" meta={<span className="sub"><bdi>{/* doc 1.3.5 */}</bdi></span>} />
        <ul className="cfglist">
          <li className="itk-sup">
            <span className="cfgl"><b>أقصى ما ينقله طلب واحد</b></span>
            <span className="pc-sp" />
            <CfgNum value={d.maxTransferPct} min={1} label="أقصى نسبة للمناقلة" suffix="بالمئة" onChange={(n) => put('maxTransferPct', Math.min(100, n))} />
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>مرفق داعم إلزامي من مبلغ</b></span>
            <span className="pc-sp" />
            <CfgNum value={d.attachAbove} label="مبلغ المرفق الإلزامي" suffix="ريال" onChange={(n) => put('attachAbove', n)} />
          </li>
          {/* Client 24 Oct (#87) · the operation's approval by amount, as every approval in the system */}
          <li className="itk-sup">
            <span className="cfgl"><b>تعتمد الإدارة المالية وتنفّذ حتى مبلغ</b></span>
            <span className="pc-sp" />
            <CfgNum value={d.opFinanceUpTo} label="حد اعتماد الإدارة المالية للعمليات" suffix="ريال" onChange={(n) => put('opFinanceUpTo', n)} />
          </li>
        </ul>
      </Glass>

      {/* Client 24 Oct (#87) · a returned or rejected operation picks its reason, as the other approvals do */}
      <Glass>
        <Head title="أسباب إعادة العمليات ورفضها" />
        <div className="g2 gp-4">
          <ReasonList title="أسباب الإعادة للمُعِدّ" list={d.opReturnReasons} onChange={(x) => put('opReturnReasons', x)} />
          <ReasonList title="أسباب الرفض" list={d.opRejectReasons} onChange={(x) => put('opRejectReasons', x)} />
        </div>
      </Glass>

      <Glass>
        <Head title="الحجز والارتباط المالي" meta={<span className="sub"><bdi>{/* doc 5.4.19 · 1.4.27 · 1.4.28 · 1.4.56 */}</bdi></span>} />
        <ul className="cfglist">
          <li className="itk-sup">
            <span className="cfgl"><b>مرحلة الحجز على الميزانية</b></span>
            <span className="pc-sp" />
            <div className="cfgchips" role="radiogroup" aria-label="مرحلة الحجز">
              {(['recommend', 'approval'] as const).map((v) => (
                <Button plain key={v} type="button" role="radio" aria-checked={d.holdAt === v} className={`cfgchip${d.holdAt === v ? ' on' : ''}`} onClick={() => put('holdAt', v)}>
                  {v === 'recommend' ? 'مبدئي عند توصية مدير المنح بالموافقة' : 'عند الاعتماد النهائي'}
                </Button>
              ))}
            </div>
          </li>
          {/* v3 · 1.3b · the link of an approved project moves by a relocation request */}
          <li className="itk-sup">
            <span className="cfgl"><b>طلب إعادة تسكين مشروع</b></span>
            <span className="pc-sp" />
            <FieldMultiSelect placeholder="لا أحد" values={d.relocateBy} options={ROLE_OPTS} onChange={(x) => put('relocateBy', x as RoleKey[])} />
          </li>
          <li className="itk-sup">
            <span className="cfgl"><b>اعتماد إعادة التسكين</b></span>
            <span className="pc-sp" />
            <FieldMultiSelect placeholder="لا أحد" values={d.relocateApproveBy} options={ROLE_OPTS} onChange={(x) => put('relocateApproveBy', x as RoleKey[])} />
          </li>
        </ul>
      </Glass>

      <Glass>
        <Head title="استقبال المشاريع" meta={<span className="sub"><bdi>{/* doc 1.1.output-5 · 1.4.37 */}</bdi></span>} />
        <Switch
          label="لا يُفتح التقديم إلا على المجالات الممولة في ميزانية معتمدة"

          on={d.requireFunding}
          onChange={(x) => put('requireFunding', x)}
        />
        {/* Client 24 Oct (#86) · the portal's support options follow the budget's balances */}
        <Switch
          label="ربط خيارات الدعم في البوابة بالميزانية"

          on={d.portalLink}
          onChange={(x) => put('portalLink', x)}
        />
        {d.portalLink && (
          <ul className="cfglist mt-3">
            <li className="itk-sup">
              <span className="cfgl"><b>تنبيه «المتاح قليل» تحت</b></span>
              <span className="pc-sp" />
              <CfgNum value={d.lowFundPct} min={0} label="نسبة تنبيه المتاح القليل" suffix="بالمئة" onChange={(n) => put('lowFundPct', Math.min(100, n))} />
            </li>
          </ul>
        )}
      </Glass>

      <Glass>
        <Head title="بيانات العرض التجريبي" />

        <Button type="button" variant="2" onClick={resetBudget}>أعد ضبط بيانات الميزانية</Button>
      </Glass>

      {dirty && (
        <SaveBar
          count={1}
          sentence="تعديل قواعد الميزانية"
          onSave={() => { saveBudgetRules(d); setSaved(structuredClone(d)) }}
          onDiscard={() => setD(structuredClone(saved))}
        />
      )}
    </>
  )
}

/* Client 24 Oct (#87) · one editable reason list · add, rename, remove · «أخرى» is always offered
   beside them in the decision, so it isn't a list item */
function ReasonList({ title, list, onChange }: { title: string; list: string[]; onChange: (x: string[]) => void }) {
  const [add, setAdd] = useState('')
  return (
    <div className="col">
      <h3 className="stdy-h">{title} <span className="sub">· <Num>{list.length}</Num></span></h3>
      <ul className="cfglist">
        {list.map((r, i) => (
          <li key={i}>
            <FieldBox><input value={r} aria-label={`${title} ${i + 1}`} onChange={(e) => onChange(list.map((y, j) => (j === i ? e.target.value : y)))} /></FieldBox>
            <span className="pc-sp" />
            <Button type="button" variant="2" size="sm" disabled={list.length <= 1} onClick={() => onChange(list.filter((_, j) => j !== i))}>احذف</Button>
          </li>
        ))}
        <li>
          <FieldBox><input value={add} aria-label={`${title} · سبب جديد`} placeholder="سبب جديد" onChange={(e) => setAdd(e.target.value)} /></FieldBox>
          <span className="pc-sp" />
          <Button type="button" variant="2" size="sm" disabled={!add.trim() || list.includes(add.trim())} onClick={() => { onChange([...list, add.trim()]); setAdd('') }}>أضف</Button>
        </li>
      </ul>
    </div>
  )
}

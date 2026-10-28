import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { FieldBox, Button, BackTo, Glass, Head, Num, Select, Tabs, Tag } from '@/components/ui'
import { useRole } from '@/hooks/useRole'
import { CLOSE_RULES, EVAL_CRITERIA_DEFAULT, MATRIX_SAY, RELEASE_SAY, saveCloseRules, useClosing, type CloseRules, type EvalCriterion, type MatrixKey, type MatrixRule } from '@/data/closing/store'
import { MoneyField } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { DockSlotProvider, useDockSlot } from '@/components/shell'
import { StageLimits } from '@/features/settings/CfgEdit'
import { CFG } from '@/lib/config'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { CLOSE_DOCS, CLOSE_LIMIT, CLOSE_STAGES, closeRows } from '@/data/mock/closing'
import type { CloseStage } from '@/types/domain'
import { NOUN, nounAfter } from '@/lib/format'

/* Closing settings - same layout as plan settings, exactly.

   Note: this module sits under the module, its settings, and its reports.

   Two different kinds live here, and mixing them hides the difference:
   - supporting documents - master data - and marking one required actually blocks submission (rules
   3 and 4), so the column states required or supporting.
   - stage limits - a business rule - the number changes behavior: a request past its limit shows up
   under "overdue".

   Note: all these numbers are assumptions, and the screen says so. The spec measures "average
   project closing duration" (indicator 1) and sets no limit for any individual stage - this is an
   open question for the institution.

   Note: the "uploaded in" column isn't decorative. A document with no use in any request means
   either it was added and never requested, or every entity skips it - and the number says so
   without anyone counting. */

const KEYS = ['tab'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

const TABS = [
  { slug: 'docs', label: 'المستندات الداعمة' },
  { slug: 'limits', label: 'حدود المحطات' },
  { slug: 'matrix', label: 'مصفوفة الصلاحيات' },
  { slug: 'eval', label: 'أسئلة التقييم' },
] as const

export default function CloseSettingsPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const tab = TABS.some((t) => t.slug === v.tab) ? (v.tab as string) : TABS[0].slug

  /** How many requests actually uploaded this document. */
  const usage = (key: string) =>
    closeRows.filter((c) => c.report.docs.includes(key)).length

  /** How many requests currently sit at this stage. */
  const dock = useDockSlot()
  const atStage = (k: CloseStage) => closeRows.filter((c) => c.stage === k).length

  return (
    <AppLayout assistantContext={assistFor.page('إعدادات الإغلاق')}>
      <DockSlotProvider value={dock.value}>
      <div className={`viewstack${dock.on ? ' hasdock' : ''}`}>
        <div className="screen col">
          <BackTo label="الإغلاق" onClick={() => navigate(ROUTES.closings)} />

          <header>
            <div>
              <h1 className="ptitle">إعدادات الإغلاق</h1>
            </div>
            <Tag tone="mute">قيم افتراضية</Tag>
          </header>

          <Tabs
            items={TABS}
            active={tab}
            onChange={(x) => set({ tab: x === TABS[0].slug ? undefined : x })}
          />

          {tab === 'matrix' ? <MatrixTab /> : tab === 'eval' ? <CriteriaTab /> : tab === 'docs' ? (
            <Glass className="tblcard">
              <Head
                title="المستندات الداعمة"
                meta={<span className="sub"><Num>{CLOSE_DOCS.length}</Num> {nounAfter(CLOSE_DOCS.length, NOUN.doc)}</span>}
              />
              <table className="tbl">
                <colgroup><col /><col /><col /></colgroup>
                <thead>
                  <tr>
                    <th><span className="th-t">المستند</span></th>
                    <th><span className="th-t">إلزامي</span></th>
                    <th className="n"><span className="th-t">مرفوع في</span></th>
                  </tr>
                </thead>
                <tbody>
                  {CLOSE_DOCS.map((d) => {
                    const n = usage(d.key)
                    return (
                      <tr key={d.key}>
                        <td>{d.label}</td>
                        <td>
                          {d.req
                            ? <Tag tone="mute">إلزامي{/* doc rule 4 */}</Tag>
                            : <span className="sub">داعم</span>}
                        </td>
                        <td className="n">
                          {n > 0
                            ? <><span className="num">{n}</span> {nounAfter(n, NOUN.request)}</>
                            : <span className="sub">لم يُرفع</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Glass>
          ) : (
            <Glass className="tblcard">
              <Head
                title="حدود المحطات"
              />
              <StageLimits
                title="مدد مراحل الإغلاق"
                stages={CLOSE_STAGES.map((x) => ({
                  key: x.key, label: x.label, who: x.who,
                  extra: <span className="sub">{x.cycle === 'report' ? 'التقرير الختامي' : 'تقييم المشروع'}</span>,
                }))}
                extraHead="الدورة"
                limits={CLOSE_LIMIT}
                cfgKey={CFG.closeLimits}
                countAt={(k) => atStage(k as CloseStage)}
              />
            </Glass>
          )}

          {/* 10.9.3 · 10.9.8 · how recovered money goes back to the domain allocation */}
          <ReleasePolicy />
        </div>
        {/* The unsaved-changes dock · inside the view stack, so it spans the content column like the decision bar, not the rail */}
        <div className="dockslot" ref={dock.setEl} />
      </div>
      </DockSlotProvider>
    </AppLayout>
  )
}

function ReleasePolicy() {
  useClosing()
  const { role, user } = useRole()
  /* Verifier · 16 Oct · a policy of the foundation · set by the executive, the admin, or finance */
  const may = role.key === 'ceo' || role.key === 'admin' || role.key === 'finance'
  const [mode, setMode] = useState<CloseRules['releaseMode']>(CLOSE_RULES.releaseMode)
  const [saved, setSaved] = useState(false)
  return (
    <Glass>
      <Head title="تحرير المبالغ إلى مخصص المجال" meta={<Tag tone="mute">سياسة المؤسسة</Tag>} />
      <div className="apv-row">
        <Select
          value={mode}
          allowEmpty={false}
          all="طريقة التحرير"
          options={(Object.keys(RELEASE_SAY) as CloseRules['releaseMode'][]).map((k) => ({ value: k, label: RELEASE_SAY[k] }))}
          onChange={(v) => { setMode((v as CloseRules['releaseMode']) ?? 'once'); setSaved(false) }}
        />
        <Button type="button" variant="2" size="sm" disabled={!may || mode === CLOSE_RULES.releaseMode} onClick={() => { saveCloseRules({ releaseMode: mode }, user.name); setSaved(true) }}>احفظ السياسة</Button>
      </div>
      {saved && <p className="ok-ink cnote">حُفظت السياسة</p>}
    </Glass>
  )
}

/* v3 · 10.4.11 · who approves each closing item last · the executive by default · the grants manager when
   set so, or below a value the foundation enters · nothing fixed in the code */
function MatrixTab() {
  useClosing()
  const { role, user } = useRole()
  const may = role.key === 'ceo' || role.key === 'admin'
  const keys = Object.keys(MATRIX_SAY) as MatrixKey[]
  const [rows, setRows] = useState<Record<MatrixKey, MatrixRule>>(() => Object.fromEntries(keys.map((k) => [k, { final: 'ceo', ...(CLOSE_RULES.matrix?.[k] ?? {}) }])) as Record<MatrixKey, MatrixRule>)
  const [saved, setSaved] = useState(false)
  const put = (k: MatrixKey, r: Partial<MatrixRule>) => { setRows((x) => ({ ...x, [k]: { ...x[k], ...r } })); setSaved(false) }
  return (
    <Glass className="tblcard">
      <Head title="مصفوفة صلاحيات الإغلاق" meta={<Tag tone="mute">{may ? 'يعدّلها المدير التنفيذي' : 'للعرض'}</Tag>} />
      <table className="tbl">
        <colgroup><col /><col /><col /></colgroup>
        <thead><tr><th><span className="th-t">القرار</span></th><th><span className="th-t">المعتمد النهائي</span></th><th className="n"><span className="th-t">مدير المنح تحت قيمة</span></th></tr></thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k}>
              <td>{MATRIX_SAY[k]}</td>
              <td>
                <Select value={rows[k].final} allowEmpty={false} all="المعتمد" disabled={!may}
                  options={[{ value: 'ceo', label: 'المدير التنفيذي' }, { value: 'grants-manager', label: 'مدير المنح' }]}
                  onChange={(v) => put(k, { final: (v as MatrixRule['final']) ?? 'ceo' })} />
              </td>
              <td className="n">{rows[k].final === 'ceo'
                ? <MoneyField value={rows[k].below ? String(rows[k].below) : ''} disabled={!may} onChange={(v) => put(k, { below: v ? Number(v) : undefined })} label={`حد تفويض ${MATRIX_SAY[k]}`} placeholder="بلا تفويض" />
                : <span className="sub">مدير المنح دائمًا</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {may && (
        <div className="act-a">
          <Button type="button" variant="p" size="sm" onClick={() => { saveCloseRules({ ...CLOSE_RULES, matrix: rows }, user.name); setSaved(true) }}>احفظ المصفوفة</Button>
        </div>
      )}
      {saved && <p className="ok-ink cnote">حُفظت المصفوفة · تسري على القرارات القادمة</p>}
    </Glass>
  )
}

/* v3 · 10.4.31 · the evaluation's questions and weights · for evaluations started after the change */
function CriteriaTab() {
  useClosing()
  const { role, user } = useRole()
  const may = role.key === 'ceo' || role.key === 'admin' || role.key === 'grants-manager'
  const [list, setList] = useState<EvalCriterion[]>(() => (CLOSE_RULES.evalCriteria ?? EVAL_CRITERIA_DEFAULT).map((x) => ({ ...x })))
  const [label, setLabel] = useState('')
  const [saved, setSaved] = useState(false)
  const total = list.reduce((n, x) => n + x.weight, 0)
  return (
    <Glass className="tblcard">
      <Head title="أسئلة تقييم المشروع ونقاطها" hint="يُعطي كل مقيِّم (مشرف المنح · مدير المنح · المدير التنفيذي) كل سؤال نقاطًا من حدّه · ويُحسب التقييم من 100" meta={<span className="sub">مجموع النقاط <Num>{total}</Num></span>} />
      <table className="tbl">
        <colgroup><col /><col /><col /></colgroup>
        <thead><tr><th><span className="th-t">السؤال</span></th><th className="n"><span className="th-t">النقاط</span></th><th><span className="th-t" /></th></tr></thead>
        <tbody>
          {list.map((x, i) => (
            <tr key={x.key}>
              <td>{x.label}</td>
              <td className="n"><FieldBox><input className="num" inputMode="numeric" disabled={!may} value={String(x.weight)} aria-label={`وزن ${x.label}`} onChange={(e) => { const w = Number(e.target.value.replace(/\D/g, '')) || 0; setList((l) => l.map((y, j) => (j === i ? { ...y, weight: w } : y))); setSaved(false) }} /></FieldBox></td>
              <td>{may && list.length > 1 && <Button type="button" variant="2" size="sm" onClick={() => { setList((l) => l.filter((_, j) => j !== i)); setSaved(false) }}>احذف</Button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {may && (
        <div className="apv-row mt-2">
          <FieldBox><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="سؤال جديد" aria-label="سؤال تقييم جديد" /></FieldBox>
          <Button type="button" variant="2" size="sm" disabled={!label.trim()} onClick={() => { setList((l) => [...l, { key: `q${Date.now().toString(36)}`, label: label.trim(), weight: 10, points: true }]); setLabel(''); setSaved(false) }}>أضف السؤال</Button>
          <Button type="button" variant="p" size="sm" disabled={!total} onClick={() => { saveCloseRules({ ...CLOSE_RULES, evalCriteria: list }, user.name); setSaved(true) }}>احفظ الأسئلة</Button>
        </div>
      )}
      {saved && <p className="ok-ink cnote">حُفظت · تسري على التقييمات الجديدة</p>}
    </Glass>
  )
}

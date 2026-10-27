import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackTo, Glass, Head, Money, Num, Tabs, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { DockSlotProvider, SaveBar, useDockSlot } from '@/components/shell'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { NOUN, nf, nounAfter, unitAfter } from '@/lib/format'
import { APPROVAL_MATRIX, MONEY_LIMITS, approverFor, projectsUnder } from '@/data/mock/settings'
import { logSettings } from '@/data/shared/settingsLog'
import { useRole } from '@/hooks/useRole'
import { AGREEMENT_STAGES, AGR_LIMIT, agreements } from '@/data/mock/agreements'
import { PAY_LIMIT, PAY_STATES, payRequests } from '@/data/mock/disbursements'
import { CFG, isConfigured, persist } from '@/lib/config'
import { CfgNum, StageLimits } from '@/features/settings/CfgEdit'
import { ConsultantsTab, CriteriaTab, CycleTab, ProspectsTab } from './IntakeSettings'
import { ApprovalRulesTab } from '@/features/approvals/ApprovalRulesTab'
import { ReadOnly } from '@/components/shell/ReadOnly'
import { REJECT_REASONS, saveRejectReasons } from '@/data/intake/reasons'
import { EXCLUSIONS, exclusionKey, saveExclusions, type Exclusion } from '@/data/intake/exclusion'
import { readRole, type RoleKey } from '@/data/roles'

/* v3 · 3.4.42 · the rules, the intake cycle and the prospects list are kept by the authority holders
   and the system administrator · every other role reads them */
const EDIT_BY: RoleKey[] = ['grants-manager', 'ceo', 'admin']

/* These are business rules, not master data. The difference: the number here changes the
   behavior of an action, not the content of a list — changing a cap moves projects from one
   queue to another immediately.

   Meeting 1 Oct, change item 9: every number here is **editable** — approval caps, financial and
   time limits, stage durations — and saving applies it across the system at once (the approval
   matrix feeds the roles' financial authority and the executive's queues in «اليوم»). Until the
   foundation confirms a value it stays tagged «افتراضي», so anyone reading knows it's a
   placeholder.

   The "projects under it" column isn't decorative. It's what reveals a wrong cap: if half the
   projects end up under one level, its cap is too low — and the number says so. */

const KEYS = ['tab'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

const TABS = [
  { slug: 'approval', label: 'مصفوفة الاعتماد' },
  /* Procedures 4–7 · what the matrix doesn't hold */
  { slug: 'path', label: 'مسار الاعتماد' },
  { slug: 'limits', label: 'الحدود المالية والزمنية' },
  { slug: 'stages', label: 'مدد المراحل' },
  /* Procedure 3 · what is set before requests arrive */
  { slug: 'cycle', label: 'دورة الاستقبال' },
  { slug: 'criteria', label: 'معايير التقييم' },
  /* Client 21 Oct (#20) · the yes/no questions answered before the scores */
  { slug: 'exclusion', label: 'معايير الاستبعاد' },
  { slug: 'consultants', label: 'المستشارون' },
  { slug: 'prospects', label: 'الجهات المقترحة' },
  /* v3 · 3.4.24 */
  { slug: 'reasons', label: 'أسباب الرفض' },
] as const

/** Amount tested against the matrix, so the rule reads for itself */
const TRY = 750_000

export default function ProjectSettingsPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const tab = TABS.some((t) => t.slug === v.tab) ? (v.tab as string) : TABS[0].slug
  const dock = useDockSlot()
  const viewOnly = !EDIT_BY.includes(readRole())

  return (
    <AppLayout assistantContext={assistFor.page('إعدادات المشاريع والصرف')}>
      <DockSlotProvider value={dock.value}>
      <div className={`viewstack${dock.on ? ' hasdock' : ''}`}>
        <div className="screen col">
          <BackTo label="المشاريع" onClick={() => navigate(ROUTES.projects)} />

          <header>
            <div>
              <h1 className="ptitle">إعدادات المشاريع والصرف</h1>
            </div>
            {viewOnly ? <Tag tone="mute">للاطلاع</Tag> : <Tag tone="mute">قابلة للإعداد</Tag>}
          </header>

          <Tabs items={TABS} active={tab} onChange={(x) => set({ tab: x === TABS[0].slug ? undefined : x })} />

          <ReadOnly on={viewOnly}>
          {tab === 'approval' && <ApprovalTab />}
          {tab === 'path' && <ApprovalRulesTab />}
          {tab === 'limits' && <LimitsTab />}
          {tab === 'stages' && <StagesTab />}
          {tab === 'cycle' && <CycleTab />}
          {tab === 'criteria' && <CriteriaTab />}
          {tab === 'exclusion' && <ExclusionTab />}
          {tab === 'consultants' && <ConsultantsTab />}
          {tab === 'prospects' && <ProspectsTab />}
          {tab === 'reasons' && <ReasonsTab />}
          </ReadOnly>
        </div>
        {/* The unsaved-changes dock · inside the view stack, so it spans the content column like the decision bar, not the rail */}
        <div className="dockslot" ref={dock.setEl} />
      </div>
      </DockSlotProvider>
    </AppLayout>
  )
}

/* ═══ Approval matrix ═══ */

function ApprovalTab() {
  const [probe, setProbe] = useState(String(TRY))
  const amount = Number(probe.replace(/[^\d]/g, '')) || 0
  const base = () => Object.fromEntries(APPROVAL_MATRIX.map((r) => [r.key, r.upTo]))
  const [saved, setSaved] = useState<Record<string, number | null>>(base)
  const { user } = useRole()
  const [d, setD] = useState<Record<string, number | null>>(saved)
  const [, tick] = useState(0)

  const changed = APPROVAL_MATRIX.filter((r) => d[r.key] !== saved[r.key])
  /* Caps must climb level by level, or a higher level would decide less than the one below it */
  const capped = APPROVAL_MATRIX.filter((r) => d[r.key] !== null)
  const broken = capped.some((r, i) => i > 0 && (d[r.key] ?? 0) <= (d[capped[i - 1].key] ?? 0))

  const save = () => {
    if (broken) return
    /* Re-audit 7 Oct · the caps join the settings history, before and after */
    const cap = (v: number | null | undefined) => (v === null || v === undefined ? 'بلا سقف' : nf.format(v))
    logSettings('مصفوفة صلاحيات الاعتماد', `${ROUTES.projectSettings}?tab=approval`, user.name, changed.map((r) => ({ k: r.role, from: cap(saved[r.key]), to: cap(d[r.key]) })))
    for (const r of APPROVAL_MATRIX) {
      r.upTo = d[r.key]
      if (changed.includes(r)) r.assumed = false
    }
    persist(CFG.approval, d)
    setSaved(d)
    tick((x) => x + 1)
  }

  const who = approverFor(amount)

  return (
    <>
      {/* The rule is understood by trying it: enter an amount and see who decides it */}
      <Glass>
        <Head title="جرّب المبلغ" />
        <div className="cfgrow">
          <label className="regf cfgwide">
            <span className="lb">مبلغ المشروع</span>
            <span className="fld">
              <input
                className="num"
                inputMode="numeric"
                value={probe}
                onChange={(e) => setProbe(e.target.value)}
                aria-label="مبلغ المشروع"
              />
            </span>
          </label>
        </div>
        <p className="sub cnote">
          مبلغ <Money>{amount}</Money> يعتمده <b>{who.role}</b>
        </p>
      </Glass>

      <Glass className="tblcard">
        <Head title="المصفوفة" meta={<span className="sub"><Num>{APPROVAL_MATRIX.length}</Num> مستويات</span>} />
        <ul className="cfglist cfgedit">
          {APPROVAL_MATRIX.map((r) => {
            const on = r.key === who.key
            return (
              <li key={r.key} className={on ? 'on' : ''}>
                <b>{r.role}</b>
                {d[r.key] === null ? (
                  <span className="sub">فما فوق · بلا حدّ مالي</span>
                ) : (
                  <CfgNum
                    value={d[r.key] as number}
                    min={1}
                    onChange={(x) => setD((y) => ({ ...y, [r.key]: x }))}
                    label={`الحدّ المالي لـ ${r.role}`}
                    suffix="ريال فما دون"
                  />
                )}
                <span className="pc-sp" />
                {r.assumed && <Tag tone="warn">افتراضي</Tag>}
                {on && <Tag tone="mute">يعتمد المبلغ المجرَّب</Tag>}
                <Tag tone="mute"><Num>{projectsUnder(r)}</Num> {nounAfter(projectsUnder(r), NOUN.project)} تحته</Tag>
              </li>
            )
          })}
        </ul>
        {broken && (
          <p className="sub cnote"><Tag tone="warn">ترتيب غير صحيح</Tag> كل مستوى يجب أن يكون حدّه أعلى من المستوى الذي تحته.</p>
        )}
      </Glass>

      {changed.length > 0 && (
        <SaveBar
          count={changed.length}
          sentence={<>{changed.length === 1 ? 'حدّ معدّل' : 'حدود معدّلة'} في مصفوفة الاعتماد<span className="decsep" /><span className="sub">{changed.map((r) => r.role).join('، ')}</span></>}
          onSave={save}
          onDiscard={() => setD(saved)}
          disabled={broken}
        />
      )}
    </>
  )
}

/* ═══ v3 · 3.4.24 · the reasons for a recommendation to reject ═══ */

function ReasonsTab() {
  const { user } = useRole()
  const [saved, setSaved] = useState<string[]>(() => [...REJECT_REASONS])
  const [d, setD] = useState<string[]>(saved)
  const [add, setAdd] = useState('')
  const [bad, setBad] = useState<string[]>([])
  const changed = d.join('|') !== saved.join('|')
  const save = () => {
    const out = saveRejectReasons(d, user.name)
    setBad(out)
    if (!out.length) { setSaved([...REJECT_REASONS]); setD([...REJECT_REASONS]) }
  }
  return (
    <Glass className="tblcard">
      <Head title="أسباب التوصية بالرفض" meta={<span className="sub"><Num>{d.length}</Num> سببًا</span>} />
      <ul className="cfglist">
        {d.map((r, i) => (
          <li key={i}>
            <span className="fld"><input value={r} aria-label={`السبب ${i + 1}`} onChange={(e) => setD((x) => x.map((y, j) => (j === i ? e.target.value : y)))} /></span>
            <span className="pc-sp" />
            <button type="button" className="btn btn-2 btn-sm" onClick={() => setD((x) => x.filter((_, j) => j !== i))}>احذف</button>
          </li>
        ))}
        <li>
          <span className="fld"><input value={add} aria-label="سبب جديد" placeholder="سبب جديد" onChange={(e) => setAdd(e.target.value)} /></span>
          <span className="pc-sp" />
          <button type="button" className="btn btn-2 btn-sm" disabled={!add.trim()} onClick={() => { setD((x) => [...x, add.trim()]); setAdd('') }}>أضف</button>
        </li>
      </ul>
      {bad.map((b) => <p key={b} className="bad cnote">{b}</p>)}
      {changed && (
        <SaveBar
          count={1}
          sentence={<>قائمة الأسباب معدّلة<span className="decsep" /><span className="sub"><Num>{d.length}</Num> سببًا</span></>}
          onSave={save}
          onDiscard={() => setD(saved)}
        />
      )}
    </Glass>
  )
}

/* ═══ Exclusion criteria · client 21 Oct (#20) ═══ */

function ExclusionTab() {
  const { user } = useRole()
  const [saved, setSaved] = useState<Exclusion[]>(() => EXCLUSIONS.map((x) => ({ ...x })))
  const [d, setD] = useState<Exclusion[]>(saved)
  const [add, setAdd] = useState('')
  const [bad, setBad] = useState<string[]>([])
  const changed = d.map((x) => x.label).join('|') !== saved.map((x) => x.label).join('|')
  const save = () => {
    const out = saveExclusions(d, user.name)
    setBad(out)
    if (!out.length) { setSaved(EXCLUSIONS.map((x) => ({ ...x }))); setD(EXCLUSIONS.map((x) => ({ ...x }))) }
  }
  return (
    <Glass className="tblcard">
      <Head title="معايير الاستبعاد" meta={<span className="sub"><Num>{d.length}</Num> {nounAfter(d.length, NOUN.criterion)}</span>} />
      <ul className="cfglist cfglist-w">
        {d.map((r, i) => (
          <li key={r.key}>
            <span className="fld"><input value={r.label} aria-label={`معيار الاستبعاد ${i + 1}`} onChange={(e) => setD((x) => x.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} /></span>
            <span className="pc-sp" />
            <button type="button" className="btn btn-2 btn-sm" onClick={() => setD((x) => x.filter((_, j) => j !== i))}>احذف</button>
          </li>
        ))}
        <li>
          <span className="fld"><input value={add} aria-label="معيار استبعاد جديد" placeholder="معيار جديد · سؤال يُجاب بنعم أو لا" onChange={(e) => setAdd(e.target.value)} /></span>
          <span className="pc-sp" />
          <button type="button" className="btn btn-2 btn-sm" disabled={!add.trim()} onClick={() => { setD((x) => [...x, { key: exclusionKey(), label: add.trim() }]); setAdd('') }}>أضف</button>
        </li>
      </ul>
      {bad.map((b) => <p key={b} className="bad cnote">{b}</p>)}
      {changed && (
        <SaveBar
          count={1}
          sentence={<>معايير الاستبعاد معدّلة<span className="decsep" /><span className="sub"><Num>{d.length}</Num> {nounAfter(d.length, NOUN.criterion)}</span></>}
          onSave={save}
          onDiscard={() => setD(saved)}
        />
      )}
    </Glass>
  )
}

/* ═══ Money and time limits ═══ */

function LimitsTab() {
  const base = () => Object.fromEntries(MONEY_LIMITS.map((l) => [l.key, l.value]))
  const [saved, setSaved] = useState<Record<string, number>>(base)
  const [d, setD] = useState<Record<string, number>>(saved)
  const changed = MONEY_LIMITS.filter((l) => d[l.key] !== saved[l.key])
  const { user } = useRole()

  const save = () => {
    logSettings('الحدود المالية والزمنية', `${ROUTES.projectSettings}?tab=limits`, user.name, changed.map((l) => ({ k: l.label, from: nf.format(saved[l.key]), to: nf.format(d[l.key]) })))
    for (const l of MONEY_LIMITS) {
      if (changed.includes(l)) l.assumed = false
      l.value = d[l.key]
    }
    persist(CFG.limits, d)
    setSaved(d)
  }

  return (
    <Glass className="tblcard">
      <Head title="الحدود" meta={<span className="sub"><Num>{MONEY_LIMITS.length}</Num> حدود</span>} />
      {/* The unit belongs next to the number, not in it: the value stays numeric */}
      <ul className="cfglist cfgcols">
        {MONEY_LIMITS.map((l) => (
          <li key={l.key}>
            <b>{l.label}</b>
            <span className="pc-sp" />
            {l.assumed && <Tag tone="warn">افتراضي</Tag>}
            <CfgNum
              value={d[l.key]}
              min={l.unit === '%' ? 1 : 0}
              onChange={(x) => setD((y) => ({ ...y, [l.key]: l.unit === '%' ? Math.min(100, x) : x }))}
              label={l.label}
              suffix={l.unit === 'ريال' ? 'ريال' : l.unit === '%' ? 'بالمئة' : l.unit === 'مشروع' ? nounAfter(d[l.key], NOUN.project) : unitAfter(d[l.key], l.unit)}
            />
          </li>
        ))}
      </ul>
      {changed.length > 0 && (
        <SaveBar
          count={changed.length}
          sentence={<>{changed.length === 1 ? 'حدّ معدّل' : 'حدود معدّلة'}<span className="decsep" /><span className="sub">{changed.map((l) => l.label).join('، ')}</span></>}
          onSave={save}
          onDiscard={() => setD(saved)}
        />
      )}
    </Glass>
  )
}

/* ═══ Stage durations · agreements and disbursement (escalation) ═══ */

function StagesTab() {
  return (
    <>
      <Glass className="tblcard">
        <Head
          title="مدد مراحل الاتفاقية"
          meta={isConfigured(CFG.agrLimits) ? <Tag tone="mute">مُعدّلة</Tag> : undefined}
        />
        <StageLimits
          stages={AGREEMENT_STAGES.map((s) => ({ key: s.key, label: s.label, who: s.who }))}
          limits={AGR_LIMIT}
          cfgKey={CFG.agrLimits}
          title="مدد مراحل الاتفاقيات"
          countAt={(k) => agreements.filter((a) => a.stage === k).length}
          unitLabel="الاتفاقيات فيها الآن"
        />
      </Glass>
      <Glass className="tblcard">
        <Head
          title="مدد مراحل الصرف"
        />
        <StageLimits
          stages={PAY_STATES.map((s) => ({ key: s.key, label: s.label, who: s.who }))}
          limits={PAY_LIMIT}
          cfgKey={CFG.payLimits}
          title="مدد مراحل الصرف"
          countAt={(k) => payRequests.filter((r) => r.state === k).length}
          unitLabel="الطلبات فيها الآن"
        />
      </Glass>
    </>
  )
}

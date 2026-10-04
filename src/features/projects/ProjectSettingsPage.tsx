import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackTo, Glass, Head, Money, Num, Tabs, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { DockSlotProvider, SaveBar, useDockSlot } from '@/components/shell'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { NOUN, nounAfter, pct as sayPct, unitAfter } from '@/lib/format'
import { APPROVAL_MATRIX, MONEY_LIMITS, approverFor, projectsUnder } from '@/data/mock/settings'
import { AGREEMENT_STAGES, AGR_LIMIT, agreements } from '@/data/mock/agreements'
import { PAY_LIMIT, PAY_STATES, payRequests } from '@/data/mock/disbursements'
import { CFG, isConfigured, persist } from '@/lib/config'
import { CfgNum, StageLimits } from '@/features/settings/CfgEdit'
import { ConsultantsTab, CriteriaTab, CycleTab, ProspectsTab } from './IntakeSettings'

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
  { slug: 'limits', label: 'الحدود المالية والزمنية' },
  { slug: 'stages', label: 'مدد المراحل' },
  /* Procedure 3 · what is set before requests arrive */
  { slug: 'cycle', label: 'دورة الاستقبال' },
  { slug: 'criteria', label: 'معايير التقييم' },
  { slug: 'consultants', label: 'المستشارون' },
  { slug: 'prospects', label: 'الجهات المقترحة' },
] as const

/** Amount tested against the matrix, so the rule reads for itself */
const TRY = 750_000

export default function ProjectSettingsPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const tab = TABS.some((t) => t.slug === v.tab) ? (v.tab as string) : TABS[0].slug
  const dock = useDockSlot()

  return (
    <AppLayout assistantContext={assistFor.page('إعدادات المشاريع والصرف')}>
      <DockSlotProvider value={dock.value}>
      <div className={`viewstack${dock.on ? ' hasdock' : ''}`}>
        <div className="screen col">
          <BackTo label="المشاريع" onClick={() => navigate(ROUTES.projects)} />

          <header>
            <div>
              <h1 className="ptitle">إعدادات المشاريع والصرف</h1>
              <p className="sub mt-1">
                الأرقام التي تحدّد صاحب الاعتماد ومتى يُعدّ الإجراء متأخّرًا · تُعدَّل من هنا بلا
                تعديل برمجي، وتسري على النظام كله فور الحفظ
              </p>
            </div>
            <Tag tone="mute">قابلة للإعداد</Tag>
          </header>

          <Tabs items={TABS} active={tab} onChange={(x) => set({ tab: x === TABS[0].slug ? undefined : x })} />

          {tab === 'approval' && <ApprovalTab />}
          {tab === 'limits' && <LimitsTab />}
          {tab === 'stages' && <StagesTab />}
          {tab === 'cycle' && <CycleTab />}
          {tab === 'criteria' && <CriteriaTab />}
          {tab === 'consultants' && <ConsultantsTab />}
          {tab === 'prospects' && <ProspectsTab />}
        </div>
      </div>
      <div className="dockslot" ref={dock.setEl} />
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
  const [d, setD] = useState<Record<string, number | null>>(saved)
  const [, tick] = useState(0)

  const changed = APPROVAL_MATRIX.filter((r) => d[r.key] !== saved[r.key])
  /* Caps must climb level by level, or a higher level would decide less than the one below it */
  const capped = APPROVAL_MATRIX.filter((r) => d[r.key] !== null)
  const broken = capped.some((r, i) => i > 0 && (d[r.key] ?? 0) <= (d[capped[i - 1].key] ?? 0))

  const save = () => {
    if (broken) return
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
        <Head title="جرّب المبلغ" meta={<span className="sub">تُقرأ القاعدة من الأسفل إلى الأعلى</span>} />
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
          مبلغ <Money>{amount}</Money> يعتمده <b>{who.role}</b> · صاحب القرار هو أول مستوى حدّه
          المالي أكبر من المبلغ أو يساويه. ومشرف المنح يوصي ولا يعتمد، فلا مستوى له.
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
          <p className="sub cnote"><Tag tone="warn">ترتيب غير صحيح</Tag> كل مستوى يجب أن يكون حدّه أعلى من المستوى الذي تحته، والحفظ متوقف حتى يُصحَّح.</p>
        )}
        <p className="sub cnote">
          الحفظ يغيّر الحدّ المالي لمدير المنح والمدير التنفيذي في كل الشاشات، وتوزيع المشاريع على
          قوائم المدير التنفيذي واللجنة والمجلس في «اليوم».
        </p>
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

/* ═══ Money and time limits ═══ */

function LimitsTab() {
  const base = () => Object.fromEntries(MONEY_LIMITS.map((l) => [l.key, l.value]))
  const [saved, setSaved] = useState<Record<string, number>>(base)
  const [d, setD] = useState<Record<string, number>>(saved)
  const changed = MONEY_LIMITS.filter((l) => d[l.key] !== saved[l.key])

  const save = () => {
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
      <ul className="cfglist">
        {MONEY_LIMITS.map((l) => (
          <li key={l.key}>
            <b>{l.label}</b>
            <span className="sub trim1">{l.where}</span>
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
      <p className="sub cnote">
        كل رقم هنا يظهر في إجراء · والعمود الثاني يبيّن موضعه بالتحديد، ليعرف من يغيّره أثر التغيير.
        {' '}الحالي: الدفعة الأولى حتى {sayPct(d.firstPayPct ?? 0)} من المنحة.
      </p>
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
          countAt={(k) => agreements.filter((a) => a.stage === k).length}
          unitLabel="الاتفاقيات فيها الآن"
        />
      </Glass>
      <Glass className="tblcard">
        <Head
          title="مدد مراحل الصرف"
          meta={<span className="sub">آلية التصعيد 9.5</span>}
        />
        <StageLimits
          stages={PAY_STATES.map((s) => ({ key: s.key, label: s.label, who: s.who }))}
          limits={PAY_LIMIT}
          cfgKey={CFG.payLimits}
          countAt={(k) => payRequests.filter((r) => r.state === k).length}
          unitLabel="الطلبات فيها الآن"
        />
      </Glass>
    </>
  )
}

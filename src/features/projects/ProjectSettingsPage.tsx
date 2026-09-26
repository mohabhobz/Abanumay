import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackTo, Glass, Head, Money, Num, Tabs, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { NOUN, nounAfter, pct as sayPct, unitAfter } from '@/lib/format'
import {
  APPROVAL_MATRIX, MONEY_LIMITS, approverFor, projectsUnder,
} from '@/data/mock/settings'

/* These are business rules, not master data. The difference: the number here changes the
   behavior of an action, not the content of a list — changing a reviewer's cap moves
   projects from one table to another immediately.

   All these numbers are defaults. The disbursement action says periods and caps come
   "from settings" without giving a single concrete value, like the empty "target value"
   in the metrics. So the screen marks them as defaults rather than showing them as
   agreed, and anyone reading knows they still need confirming.

   The "projects under it" column isn't decorative. It's what reveals a wrong cap: if
   half the projects end up under one reviewer, the cap they're under is too low —
   and the number says so without anyone having to calculate it. */

const KEYS = ['tab'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

const TABS = [
  { slug: 'approval', label: 'مصفوفة الاعتماد' },
  { slug: 'limits', label: 'الحدود المالية والزمنية' },
] as const

/**
 * Amount is tested against the matrix, so the rule reads for itself instead of needing an
 * explanation.
 */
const TRY = 750_000

export default function ProjectSettingsPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const tab = TABS.some((t) => t.slug === v.tab) ? (v.tab as string) : TABS[0].slug

  const [probe, setProbe] = useState(String(TRY))
  const amount = Number(probe.replace(/[^\d]/g, '')) || 0
  const who = approverFor(amount)

  return (
    <AppLayout assistantContext={assistFor.page('إعدادات المشاريع والصرف')}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="المشاريع" onClick={() => navigate(ROUTES.projects)} />

          <header>
            <div>
              <h1 className="ptitle">إعدادات المشاريع والصرف</h1>
              <p className="sub mt-1">
                الأرقام التي تحدّد صاحب الاعتماد ومتى يُعدّ الإجراء متأخّرًا ·
                وكلها تغيّر سلوك الإجراء لا محتوى قائمة
              </p>
            </div>
            <Tag tone="mute">قيم افتراضية</Tag>
          </header>

          <Tabs items={TABS} active={tab} onChange={(x) => set({ tab: x === TABS[0].slug ? undefined : x })} />

          {tab === 'approval' ? (
            <>
              {/* The rule is understood by trying it, not by explanation: the reviewer enters an
                  amount and sees who will approve it, instead of reading four rows and computing
                  it mentally. */}
              <Glass>
                <Head
                  title="جرّب المبلغ"
                  meta={<span className="sub">تُقرأ القاعدة من الأسفل إلى الأعلى</span>}
                />
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
                  مبلغ <Money>{amount}</Money> يعتمده <b>{who.role}</b> ·
                  صاحب القرار هو أول مستوى حدّه المالي أكبر من المبلغ.
                </p>
              </Glass>

              <Glass className="tblcard">
                <Head
                  title="المصفوفة"
                  meta={<span className="sub"><Num>{APPROVAL_MATRIX.length}</Num> مستويات</span>}
                />
                <ul className="cfglist">
                  {APPROVAL_MATRIX.map((r) => {
                    const on = r.key === who.key
                    return (
                      <li key={r.key} className={on ? 'on' : ''}>
                        <b>{r.role}</b>
                        <span className="sub">
                          {r.upTo === null
                            ? 'فما فوق · بلا حدّ مالي'
                            : <>حتى <Money>{r.upTo}</Money></>}
                        </span>
                        <span className="pc-sp" />
                        {on && <Tag tone="mute">يعتمد المبلغ المجرَّب</Tag>}
                        <Tag tone="mute"><Num>{projectsUnder(r)}</Num> {nounAfter(projectsUnder(r), NOUN.project)} تحته</Tag>
                      </li>
                    )
                  })}
                </ul>
                <p className="sub cnote">
                  هذه الأرقام <b>افتراضات</b> · تنصّ الوثيقة على أن السقوف «من
                  الإعدادات» دون أن تحدّد قيمة، والمؤسسة هي التي تحسمها.
                </p>
              </Glass>
            </>
          ) : (
            <Glass className="tblcard">
              <Head
                title="الحدود"
                meta={<span className="sub"><Num>{MONEY_LIMITS.length}</Num> حدود</span>}
              />
              {/* The unit belongs in the label, not the number: the value stays numeric so it can
                  be sorted and computed, and the unit is shown alongside it. */}
              <ul className="cfglist">
                {MONEY_LIMITS.map((l) => (
                  <li key={l.key}>
                    <b>{l.label}</b>
                    <span className="sub trim1">{l.where}</span>
                    <span className="pc-sp" />
                    {l.assumed && <Tag tone="warn">افتراضي</Tag>}
                    {/* The wrapper used to be `span.num` (ltr) around all of "15 day", which
                        wrapped the
                        word to the left of the number. The LTR island now covers only the number,
                        and
                        the unit is pluralized on its own ("15 days"). */}
                    <span>
                      {l.unit === 'ريال'
                        ? <Money>{l.value}</Money>
                        : l.unit === '%'
                          ? <span className="num">{sayPct(l.value)}</span>
                          : <><Num>{l.value}</Num> {unitAfter(l.value, l.unit)}</>}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="sub cnote">
                كل رقم هنا يظهر في إجراء · والعمود الثاني يبيّن موضعه
                بالتحديد، ليعرف من يغيّره أثر التغيير.
              </p>
            </Glass>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

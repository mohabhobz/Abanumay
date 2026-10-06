import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { BackTo, Glass, Head, Num, Select, Tabs, Tag } from '@/components/ui'
import { useRole } from '@/hooks/useRole'
import { CLOSE_RULES, RELEASE_SAY, saveCloseRules, useClosing, type CloseRules } from '@/data/closing/store'
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
              <p className="sub mt-1">
                المستندات التي يطلبها التقرير الختامي · وحدود المحطات التي
                تحدّد متى يُعدّ الطلب متأخرًا
              </p>
            </div>
            <Tag tone="mute">قيم افتراضية</Tag>
          </header>

          <Tabs
            items={TABS}
            active={tab}
            onChange={(x) => set({ tab: x === TABS[0].slug ? undefined : x })}
          />

          {tab === 'docs' ? (
            <Glass className="tblcard">
              <Head
                title="المستندات الداعمة"
                meta={<span className="sub"><Num>{CLOSE_DOCS.length}</Num> {nounAfter(CLOSE_DOCS.length, NOUN.doc)}</span>}
              />
              <p className="sub cnote">
                تُلزم القاعدة <span className="num">3</span> بإرفاق المستندات الداعمة
                قبل إرسال التقرير، وتسمح القاعدة <span className="num">5</span> بإرسال
                المواد الإعلامية والفيديوهات <b>روابط تخزين سحابي معتمدة</b>
                بدل رفعها · فهي عادةً أكبر من أي حدّ رفع.
              </p>
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
                            ? <Tag tone="mute">إلزامي · قاعدة 4</Tag>
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
                meta={<Tag tone="warn">لم تحدّد الوثيقة مدة</Tag>}
              />
              {/* Note: this sentence is what separates "a number we agreed on" from "a number we
                  put in so the screen would work." */}
              <p className="sub cnote">
                تقيس BPD-011 متوسط مدة الإغلاق (مؤشر <span className="num">1</span>)
                ولا تضع حدًّا لأي محطة · هذه الأرقام مؤقتة ليكون لوصف «متأخّر»
                معنى في النموذج، وتحتاج إلى تأكيد المؤسسة (السؤال س-18).
              </p>
              <StageLimits
                stages={CLOSE_STAGES.map((x) => ({
                  key: x.key, label: x.label, who: x.who,
                  extra: <span className="sub">{x.cycle === 'report' ? 'التقرير الختامي' : 'تقييم المشروع'}</span>,
                }))}
                extraHead="الدورة"
                limits={CLOSE_LIMIT}
                cfgKey={CFG.closeLimits}
                countAt={(k) => atStage(k as CloseStage)}
              />
              <p className="sub cnote">
                تُتخطّى محطة الاتصال المؤسسي إذا خلت الاتفاقية من التزام نشر
                إعلامي (القاعدة <span className="num">9</span>) · فيُحسب حدّها على
                الطلبات التي تمرّ بها فقط.
              </p>
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
  const { user } = useRole()
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
        <button type="button" className="btn btn-2 btn-sm" disabled={mode === CLOSE_RULES.releaseMode} onClick={() => { saveCloseRules({ releaseMode: mode }, user.name); setSaved(true) }}>احفظ السياسة</button>
      </div>
      {saved && <p className="ok-ink cnote">حُفظت السياسة</p>}
      <p className="sub cnote">
        يعود المحجوز غير المصروف عند الإيقاف أو الإغلاق إلى بنده مباشرة · أما المبالغ المستردة من
        الجهة فتعود دفعة واحدة عند اكتمال استردادها، أو تدريجيًّا مع كل مبلغ يُستلم (<bdi>10.9.8</bdi>).
      </p>
    </Glass>
  )
}

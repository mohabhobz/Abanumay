import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackTo, Glass, Head, Icon, icons, Num, Tabs, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { CITIES_BY_REGION, REGIONS } from '@/data/mock/taxonomy'
import {
  ENTITY_TYPES, LICENSORS, TARGET_GROUPS,
  cityUsed, licensorUsed, regionUsed, typeUsed,
} from '@/data/mock/settings'

/* ═══════════════════════════════════════════════════════════
   إعدادات الجهات · د-3

   مظفر: «أي قائمة منسدلة = ماستر داتا». والقوايم اللي في فورم
   تسجيل الجهة أربعة: المنطقة، والمدينة التابعة ليها، وتصنيف
   الجهة، وجهة الإشراف الفني · ومعاهم الفئات المستهدفة اللي
   بتتستعمل في المشروع.

   ⚠️ **وتصنيف الجهة مش قايمة عادية.** هو اللي بيحدد إلزامية تلات
   مستندات (قاعدتا 8 و9 في إجراء التسجيل) · فتعديله بيغيّر شرط
   قبول في فورم تاني. عشان كده الصف بيقول ده صريحًا.

   ⚠️ **ومفيش حذف.** العمود الأخير بيقول عدد الجهات المتعلقة ·
   السبب ظاهر قبل المحاولة لا رسالة خطأ بعدها (ج-19).
   ═══════════════════════════════════════════════════════════ */

const KEYS = ['tab', 'region'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

const TABS = [
  { slug: 'places', label: 'المناطق والمدن' },
  { slug: 'types', label: 'تصنيفات الجهة' },
  { slug: 'licensors', label: 'جهات الإشراف الفني' },
  { slug: 'targets', label: 'الفئات المستهدفة' },
] as const

export default function EntitySettingsPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const tab = TABS.some((t) => t.slug === v.tab) ? (v.tab as string) : TABS[0].slug

  const region = REGIONS.includes(v.region as never) ? (v.region as string) : REGIONS[0]
  const cities = CITIES_BY_REGION[region] ?? []

  const [draft, setDraft] = useState('')
  const clear = () => setDraft('')

  /* المجموعة المعروضة دلوقتي · الإضافة بتتصرف على نفس الشكل في
     الأربعة، فالفورم واحد والفرق في اللي بيتقرا منه */
  const addLabel =
    tab === 'places' ? `مدينة في ${region}`
      : tab === 'types' ? 'تصنيف جهة'
        : tab === 'licensors' ? 'جهة إشراف فني'
          : 'فئة مستهدفة'

  /* وحدة العدّ في الترويسة · «6 قيمة» مالهاش معنى لمّا الصفحة
     عارفة إنها مدن */
  const unit =
    tab === 'places' ? 'مدينة' : tab === 'types' ? 'تصنيف'
      : tab === 'licensors' ? 'جهة' : 'فئة'

  /* ⚠️ `used: null` معناه **مفيش رقم**، لا صفر · والفرق مهم: الصف
     اللي مالوش متعلقات محسوبة ما بيعرضش وسمًا خالص. أول نسخة كانت
     بتطبع «تُستعمَل في الفورم» على كل صف، ووسم متكرّر على كل الصفوف
     بيشغل مساحة وما بيقولش حاجة. */
  const rows: { k: string; used: number | null; note?: string }[] =
    tab === 'places'
      ? cities.map((c) => ({ k: c, used: cityUsed(c) }))
      : tab === 'types'
        ? ENTITY_TYPES.map((t) => ({
          k: t,
          used: typeUsed(t),
          note: t === 'شركة غير ربحية' ? 'بتفتح تلات مستندات إلزامية · قاعدتا 8 و9' : undefined,
        }))
        : tab === 'licensors'
          ? LICENSORS.map((l) => ({ k: l, used: licensorUsed(l) }))
          : TARGET_GROUPS.map((g) => ({ k: g, used: null }))

  return (
    <AppLayout assistantContext={assistFor.page('إعدادات الجهات')}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="الجهات" onClick={() => navigate(ROUTES.entities)} />

          <header>
            <div>
              <h1 className="ptitle">إعدادات الجهات</h1>
              <p className="sub mt-1">
                القوايم اللي فورم تسجيل الجهة وملفها مبنيين عليها ·
                أي قائمة منسدلة في الفورم ليها مجموعة هنا
              </p>
            </div>
          </header>

          <Tabs
            items={TABS}
            active={tab}
            onChange={(x) => { clear(); set({ tab: x === TABS[0].slug ? undefined : x }) }}
          />

          {tab === 'places' && (
            <Glass>
              <Head
                title="المناطق"
                meta={<span className="sub"><Num>{REGIONS.length}</Num> منطقة</span>}
              />
              {/* ⚠️ المنطقة هنا **مختارة لا مفلترة** · المدن تابعة
                  ليها، فلازم واحدة تكون شغّالة دايمًا ومفيش «الكل» */}
              <ul className="cfgchips">
                {REGIONS.map((r) => (
                  <li key={r}>
                    <button
                      className={`cfgchip${r === region ? ' on' : ''}`}
                      title={`${regionUsed(r)} جهة في ${r}`}
                      onClick={() => set({ region: r === REGIONS[0] ? undefined : r })}
                    >
                      {r}
                      <b className="num"><Num>{regionUsed(r)}</Num></b>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="sub cnote">
                الرقم جنب المنطقة هو عدد الجهات المسجَّلة فيها ·
                والمنطقة اللي عليها جهات ما تتحذفش.
              </p>
            </Glass>
          )}

          <Glass className="tblcard">
            <Head
              title={tab === 'places' ? `مدن ${region}` : TABS.find((t) => t.slug === tab)!.label}
              meta={<span className="sub"><Num>{rows.length}</Num> {unit}</span>}
            />

            <div className="cfgrow">
              <label className="regf cfgwide">
                <span className="lb">إضافة {addLabel}</span>
                <span className="fld">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={addLabel}
                    aria-label={`إضافة ${addLabel}`}
                  />
                </span>
              </label>
              <button
                className="btn btn-p cfgadd"
                disabled={!draft.trim() || rows.some((r) => r.k === draft.trim())}
                title={
                  rows.some((r) => r.k === draft.trim())
                    ? 'القيمة دي موجودة قبل كده'
                    : `أضف ${addLabel}`
                }
                onClick={clear}
              >
                <Icon name={icons.plus} size={16} />
                إضافة
              </button>
            </div>

            <ul className="cfglist">
              {rows.map((r) => (
                <li key={r.k}>
                  <b>{r.k}</b>
                  {r.note && <span className="sub trim1">{r.note}</span>}
                  <span className="pc-sp" />
                  {r.used !== null && (
                    r.used > 0
                      ? <Tag tone="mute"><Num>{r.used}</Num> جهة عليها</Tag>
                      : <Tag tone="ok">بلا متعلقات</Tag>
                  )}
                </li>
              ))}
            </ul>

            <p className="sub cnote">
              {tab === 'types'
                ? 'التصنيف مش وسمًا · هو اللي بيحدد المستندات الإلزامية في فورم التسجيل، فتغييره بيغيّر شرط قبول.'
                : 'القيمة اللي متعلّق بيها ريكورد ما تتحذفش · الرقم جنبها بيقول السبب قبل المحاولة.'}
            </p>
          </Glass>
        </div>
      </div>
    </AppLayout>
  )
}

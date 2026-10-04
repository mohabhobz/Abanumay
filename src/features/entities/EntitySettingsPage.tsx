import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackTo, Glass, Head, Icon, icons, Num, Tabs, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { DockSlotProvider, useDockSlot } from '@/components/shell'
import { EntityRulesTab } from './EntityRulesTab'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { CITIES_BY_REGION, REGIONS } from '@/data/mock/taxonomy'
import { NOUN, countOf, nounAfter, unitAfter } from '@/lib/format'
import {
  ENTITY_TYPES, LICENSORS, TARGET_GROUPS,
  cityUsed, licensorUsed, regionUsed, typeUsed,
} from '@/data/mock/settings'

/* Entity settings.

   Rule of thumb: any dropdown is master data. The dropdowns in the entity-registration form are
   four: region, the cities under it, entity classification, and the technical-oversight authority -
   plus the target categories used in a project.

   Note: entity classification isn't an ordinary list. It determines whether three documents are
   required (rules 8 and 9 in the registration procedure), so editing it changes an acceptance
   condition in a different form. That's why the row states this explicitly.

   Note: nothing can be deleted. The last column shows the count of related entities - the reason is
   visible before the attempt, not an error message after it. */

const KEYS = ['tab', 'region'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

const TABS = [
  { slug: 'places', label: 'المناطق والمدن' },
  { slug: 'types', label: 'تصنيفات الجهة' },
  { slug: 'licensors', label: 'جهات الإشراف الفني' },
  { slug: 'targets', label: 'الفئات المستهدفة' },
  /* BPD-002 · the switches and numbers behind registration, codes, passwords and updates */
  { slug: 'rules', label: 'قواعد التسجيل والتحديث' },
] as const

export default function EntitySettingsPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const tab = TABS.some((t) => t.slug === v.tab) ? (v.tab as string) : TABS[0].slug

  const region = REGIONS.includes(v.region as never) ? (v.region as string) : REGIONS[0]
  const cities = CITIES_BY_REGION[region] ?? []

  const dock = useDockSlot()
  const [draft, setDraft] = useState('')
  const clear = () => setDraft('')

  /* The group shown now - adding behaves the same way for all four, so the form is one, and only
     the source read from differs. */
  const addLabel =
    tab === 'places' ? `مدينة في ${region}`
      : tab === 'types' ? 'تصنيف جهة'
        : tab === 'licensors' ? 'جهة إشراف فني'
          : 'فئة مستهدفة'

  /* Count unit in the header - "6 value" means nothing when the page already knows they're cities. */
  const unit =
    tab === 'places' ? 'مدينة' : tab === 'types' ? 'تصنيف'
      : tab === 'licensors' ? 'جهة' : 'فئة'

  /* Note: `used: null` means no figure, not zero - and the difference matters: a row with no
     computed dependents shows no tag at all. The first version printed "used in the form" on every
     row, and a repeated tag on every row takes up space and says nothing. */
  const rows: { k: string; used: number | null; note?: string }[] =
    tab === 'places'
      ? cities.map((c) => ({ k: c, used: cityUsed(c) }))
      : tab === 'types'
        ? ENTITY_TYPES.map((t) => ({
          k: t,
          used: typeUsed(t),
          note: t === 'شركة غير ربحية' ? 'تجعل ثلاثة مستندات إلزامية · قاعدتا 8 و9' : undefined,
        }))
        : tab === 'licensors'
          ? LICENSORS.map((l) => ({ k: l, used: licensorUsed(l) }))
          : TARGET_GROUPS.map((g) => ({ k: g, used: null }))

  return (
    <AppLayout assistantContext={assistFor.page('إعدادات الجهات')}>
      <DockSlotProvider value={dock.value}>
      <div className={`viewstack${dock.on ? ' hasdock' : ''}`}>
        <div className="screen col">
          <BackTo label="الجهات" onClick={() => navigate(ROUTES.entities)} />

          <header>
            <div>
              <h1 className="ptitle">إعدادات الجهات</h1>
              <p className="sub mt-1">
                القوائم التي يُبنى عليها نموذج تسجيل الجهة وملفها ·
                لكل قائمة منسدلة في النموذج مجموعة هنا
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
                meta={<span className="sub"><Num>{REGIONS.length}</Num> {nounAfter(REGIONS.length, NOUN.region)}</span>}
              />
              {/* Note: region here is a selection, not a filter - cities belong to it, so one has
                  to always be active and there's no "all". */}
              <ul className="cfgchips">
                {REGIONS.map((r) => (
                  <li key={r}>
                    <button
                      className={`cfgchip${r === region ? ' on' : ''}`}
                      title={`${countOf(regionUsed(r), NOUN.entity)} في ${r}`}
                      onClick={() => set({ region: r === REGIONS[0] ? undefined : r })}
                    >
                      {r}
                      <b className="num"><Num>{regionUsed(r)}</Num></b>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="sub cnote">
                الرقم بجانب المنطقة هو عدد الجهات المسجَّلة فيها ·
                ولا تُحذف منطقة مرتبطة بجهات.
              </p>
            </Glass>
          )}

          {tab === 'rules' && <EntityRulesTab />}

          {tab !== 'rules' && <Glass className="tblcard">
            <Head
              title={tab === 'places' ? `مدن ${region}` : TABS.find((t) => t.slug === tab)!.label}
              meta={<span className="sub"><Num>{rows.length}</Num> {unitAfter(rows.length, unit)}</span>}
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
                    ? 'هذه القيمة موجودة مسبقًا'
                    : `أضف ${addLabel}`
                }
                onClick={clear}
              >
                <Icon name={icons.plus} size="sm" />
                أضف
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
                      ? <Tag tone="mute"><Num>{r.used}</Num> {nounAfter(r.used, NOUN.entity)} مرتبطة</Tag>
                      : <Tag tone="ok">بلا جهات مرتبطة</Tag>
                  )}
                </li>
              ))}
            </ul>

            <p className="sub cnote">
              {tab === 'types'
                ? 'التصنيف ليس وسمًا · فهو يحدّد المستندات الإلزامية في نموذج التسجيل، وتغييره يغيّر شرط قبول.'
                /* "With the count next to it" only when a real count exists - categories have no
                   counter. */
                : rows.some((r) => r.used !== null)
                  ? 'لا تُحذف قيمة مرتبطة بسجلات · والرقم بجانبها يوضّح السبب قبل المحاولة.'
                  : 'لا تُحذف قيمة مرتبطة بسجلات.'}
            </p>
          </Glass>}
        </div>
      </div>
      <div className="dockslot" ref={dock.setEl} />
      </DockSlotProvider>
    </AppLayout>
  )
}

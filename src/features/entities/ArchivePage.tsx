import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DateText, Empty, EntityMark, Glass, Head, Icon, Mono, SearchBox, Tag, icons } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { Crumbs } from '@/components/shell'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { query } from '@/data/repository'
import { entityCode } from '@/lib/format'
import { meOf, readRole } from '@/data/roles'
import { archiveEntity, overlayOf, useEntityFlow } from '@/data/entities/store'
import { useQueryParams } from '@/hooks/useQueryParams'

/* Archived entities · the system administrator's own search (2.4.28 · 2.4.29).

   An entity is never deleted: archiving takes it out of every list, every filter and every picker,
   and this is the one place it can still be found — by name, code or license — with the reason it
   was archived and, for whoever holds the permission, a way back. */

export default function ArchivePage() {
  useEntityFlow()
  const { values: v, set } = useQueryParams(['q'])
  const role = readRole()
  /* Re-audit 7 Oct · searching the archive and restoring from it is the system admin's (rule 29) */
  const admin = role === 'admin'
  const may = admin
  const me = meOf(role)
  const rows = query.entities({ archived: true, search: v.q, page: 1, pageSize: 9999, sort: 'name' }).rows
  const [why, setWhy] = useState<Record<string, string>>({})

  return (
    <AppLayout assistantContext={assistFor.page('أرشيف الجهات')}>
      <div className="viewstack">
        <div className="screen col">
          <Crumbs items={[{ label: 'الجهات', to: ROUTES.entities }, { label: 'الأرشيف' }]} />
          <header>
            <div>
              <h1 className="ptitle">أرشيف الجهات</h1>
              <p className="sub mt-1">لا تُحذف جهة أبدًا (القاعدة 28) · المؤرشفة تخرج من القوائم والفلاتر، وتُبحث هنا وحدها (القاعدة 29)</p>
            </div>
          </header>
          {!admin ? (
            <Glass><Empty title="الأرشيف لمدير النظام وحده" note="الجهات المؤرشفة تخرج من القوائم والفلاتر · ويبحث فيها ويستعيدها مدير النظام (القاعدة 29)." /></Glass>
          ) : <>

          <Glass className="ftoolbar">
            <div className="ftool-r"><div className="ftool-f">
              <SearchBox value={v.q ?? ''} onChange={(x) => set({ q: x || undefined })} placeholder="ابحث بالاسم أو الكود أو رقم الترخيص…" />
            </div></div>
          </Glass>

          {rows.length === 0 ? (
            <Glass>
              <Empty
                title={v.q ? 'لا جهة مؤرشفة بهذا البحث.' : 'لا توجد جهات مؤرشفة.'}
                note="تُؤرشف الجهة من ملفها بقرار مسبَّب، فتظهر هنا."
              />
            </Glass>
          ) : rows.map((e) => {
            const ev = overlayOf(e.id).events.find((x) => x.action === 'أرشفة الجهة')
            return (
              <Glass key={e.id}>
                <Head
                  title={<span className="rowf gp-2"><EntityMark logo={e.logo} size="md" />{e.name}</span>}
                  meta={<Tag tone="mute">مؤرشفة</Tag>}
                />
                <p className="sub cnote">
                  <Mono>{entityCode(e.id, e.registeredAt)}</Mono> · الترخيص <Mono>{e.licenseNo}</Mono> · {e.type}
                  {ev && <> · أُرشفت <DateText>{ev.at}</DateText> بقرار {ev.by}</>}
                </p>
                {ev?.note && <p className="cnote">{ev.note}</p>}
                <div className="rowf gp-2">
                  <Link className="btn btn-2 btn-sm" to={ROUTES.entity(e.id)}><Icon name={icons.entity} size="sm" /> افتح الملف</Link>
                  {may && (
                    <>
                      <label className="payact-n">
                        <span className="vis-h">سبب الاستعادة</span>
                        <input value={why[e.id] ?? ''} onChange={(x) => setWhy((s) => ({ ...s, [e.id]: x.target.value }))} placeholder="سبب الاستعادة · إلزامي" />
                      </label>
                      <button className="btn btn-p btn-sm" disabled={!why[e.id]?.trim()} onClick={() => archiveEntity(e.id, false, why[e.id].trim(), me)}>
                        استعد الجهة
                      </button>
                    </>
                  )}
                </div>
              </Glass>
            )
          })}
          </>}
        </div>
      </div>
    </AppLayout>
  )
}

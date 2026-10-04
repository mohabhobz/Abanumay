import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DateText, Empty, Glass, Mono, Num, SearchBox, Segments, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { Crumbs } from '@/components/shell'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { useQueryParams } from '@/hooks/useQueryParams'
import { DataTable, nextSort, readSort, sortRows, writeSort, type Col } from '@/components/table'
import { countOf, NOUN } from '@/lib/format'
import { UPD_ROWS, UPD_STATE_SAY, useEntityFlow, type UpdState, type UpdateRequest } from '@/data/entities/store'

/* Update requests inbox (2.3.upd · 2.4.1).

   An entity's request to change its own file, kept apart from registration: a registration creates
   an entity, an update changes one that exists. Contact details apply the moment they're sent; only
   the rows that touch identity, license or bank accounts wait here for a decision. */

const STATES: UpdState[] = ['review', 'completion', 'approved', 'rejected', 'draft']
const TONE: Record<UpdState, 'ok' | 'no' | 'warn' | 'ret' | 'mute'> = {
  draft: 'mute', review: 'warn', completion: 'ret', approved: 'ok', rejected: 'no',
}

const COLS: Col<UpdateRequest>[] = [
  { key: 'id', label: 'رقم الطلب', fixed: true, def: true, cell: (u) => <Mono>{u.id}</Mono>, text: (u) => u.id },
  { key: 'entity', label: 'الجهة', fixed: true, def: true, cell: (u) => <b>{u.entityName}</b>, text: (u) => u.entityName },
  { key: 'state', label: 'الحالة', def: true, cell: (u) => <Tag tone={TONE[u.state]}>{UPD_STATE_SAY[u.state]}</Tag>, text: (u) => UPD_STATE_SAY[u.state] },
  {
    key: 'wait', label: 'بانتظار الاعتماد', n: true, def: true,
    cell: (u) => <Num>{u.changes.filter((c) => !c.direct).length + u.banks.length + u.docs.length}</Num>,
    text: (u) => String(u.changes.filter((c) => !c.direct).length + u.banks.length + u.docs.length),
    value: (u) => u.changes.filter((c) => !c.direct).length + u.banks.length + u.docs.length,
  },
  {
    key: 'direct', label: 'طُبّق مباشرة', n: true, def: true,
    cell: (u) => <Num>{u.changes.filter((c) => c.direct).length}</Num>,
    text: (u) => String(u.changes.filter((c) => c.direct).length),
    value: (u) => u.changes.filter((c) => c.direct).length,
  },
  {
    key: 'what', label: 'ما يغيّره', def: true,
    cell: (u) => <span className="sub">{[...u.changes.map((c) => c.label), ...u.banks.map(() => 'حساب بنكي'), ...u.docs.map((d) => d.label)].join('، ')}</span>,
    text: (u) => [...u.changes.map((c) => c.label), ...u.banks.map(() => 'حساب بنكي'), ...u.docs.map((d) => d.label)].join('، '),
  },
  {
    key: 'at', label: 'أُرسل', def: true,
    cell: (u) => (u.submittedAt ? <DateText>{u.submittedAt.slice(0, 10)}</DateText> : '—'),
    text: (u) => u.submittedAt?.slice(0, 10) ?? '',
  },
]

export default function UpdatesPage() {
  const ver = useEntityFlow()
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams(['state', 'q', 'ord'])
  const [cols, setCols] = useState(COLS.map((c) => c.key))
  const ord = readSort(v.ord)

  const rows = useMemo(() => {
    void ver
    const q = v.q?.trim()
    return UPD_ROWS.filter((u) => (!v.state || u.state === v.state) && (!q || `${u.id} ${u.entityName}`.includes(q)))
  }, [v.state, v.q, ver])

  return (
    <AppLayout assistantContext={assistFor.page('طلبات تحديث بيانات الجهات')}>
      <div className="viewstack">
        <div className="screen col">
          <Crumbs items={[{ label: 'الجهات', to: ROUTES.entities }, { label: 'طلبات التحديث' }]} />
          <header>
            <div>
              <h1 className="ptitle">طلبات تحديث بيانات الجهات</h1>
              <p className="sub mt-1">
                تُطبَّق بيانات الاتصال فور إرسالها · وتنتظر هنا الهوية والترخيص والحسابات البنكية
                والوثائق المجدَّدة، ويُعلَّق نشاط الجهة حتى يُبتّ فيها
              </p>
            </div>
          </header>

          <Segments
            active={v.state ?? ''}
            onChange={(x) => set({ state: x || undefined })}
            items={[
              { key: '', label: 'كل الطلبات', count: UPD_ROWS.length },
              ...STATES.map((s) => ({ key: s, label: UPD_STATE_SAY[s], count: UPD_ROWS.filter((u) => u.state === s).length })),
            ]}
          />

          <Glass className="ftoolbar">
            <div className="ftool-r">
              <div className="ftool-f">
                <SearchBox value={v.q ?? ''} onChange={(x) => set({ q: x || undefined })} placeholder="ابحث برقم الطلب أو اسم الجهة…" />
              </div>
            </div>
          </Glass>

          {rows.length === 0 ? (
            <Glass><Empty title="لا توجد طلبات تحديث بهذه الفلاتر." note="تُرسل الجهة طلب التحديث من بوابتها، فيظهر هنا." /></Glass>
          ) : (
            <Glass className="tblcard">
              <DataTable
                rows={sortRows(rows, COLS, ord)}
                sort={ord}
                onSort={(k) => set({ ord: writeSort(nextSort(ord, k)) })}
                all={COLS}
                table="entity-updates"
                cols={cols}
                onCols={setCols}
                id={(u) => u.id}
                onOpen={(u) => navigate(ROUTES.entityUpdateReview(u.id))}
                count={(n) => countOf(n, NOUN.request)}
              />
            </Glass>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

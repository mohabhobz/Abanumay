import { Fragment, useState } from 'react'
import { Glass, Head, Num } from '@/components/ui'
import { SaveBar } from '@/components/shell'
import { useRole } from '@/hooks/useRole'
import { ENTITY_REASONS, REASON_KINDS, saveReasons, type ReasonKind } from '@/data/entities/reasons'

/* Client meeting 23 Oct · the entity module's reason lists, edited in one place.

   Each decision that turns something down (a registration or update request rejected or returned, a
   bank account disabled or deleted) picks its reason from one of these lists in a popup, or «أخرى»
   with a written reason. One draft for all six lists and one save bar · a page with six bars would
   leave the user guessing which one saves what. */

const GROUPS: { title: string; kinds: ReasonKind[] }[] = [
  { title: 'طلبات التسجيل', kinds: ['regReject', 'regReturn'] },
  { title: 'طلبات التحديث', kinds: ['updReject', 'updReturn'] },
  { title: 'الحسابات البنكية', kinds: ['bankDisable', 'bankDelete'] },
]

type Lists = Record<ReasonKind, string[]>
const snapshot = (): Lists => Object.fromEntries(REASON_KINDS.map(({ kind }) => [kind, [...ENTITY_REASONS[kind]]])) as Lists

export function EntityReasonsTab() {
  const { user } = useRole()
  const [saved, setSaved] = useState<Lists>(snapshot)
  const [d, setD] = useState<Lists>(saved)
  const [add, setAdd] = useState<Partial<Record<ReasonKind, string>>>({})
  const [bad, setBad] = useState<string[]>([])
  const changed = REASON_KINDS.filter(({ kind }) => d[kind].join('|') !== saved[kind].join('|'))
  const edit = (kind: ReasonKind, f: (x: string[]) => string[]) => setD((m) => ({ ...m, [kind]: f(m[kind]) }))
  const save = () => {
    const out = changed.flatMap(({ kind, label }) => saveReasons(kind, d[kind], user.name).map((e) => `${label}: ${e}`))
    setBad(out)
    if (!out.length) { const now = snapshot(); setSaved(now); setD(now) }
  }
  return (
    <>
      {GROUPS.map((g) => (
        <Fragment key={g.title}>
          <h2 className="rsn-h">{g.title}</h2>
          {g.kinds.map((kind) => {
            const k = REASON_KINDS.find((x) => x.kind === kind)!
            const list = d[kind]
            return (
              <Glass className="tblcard" key={kind}>
                <Head title={`أسباب ${k.label}`} meta={<span className="sub"><Num>{list.length}</Num> سببًا · ومعها «أخرى» بنص</span>} />
                <ul className="cfglist cfglist-w">
                  {list.map((r, i) => (
                    <li key={i}>
                      <span className="fld"><input value={r} aria-label={`${k.label} · السبب ${i + 1}`} onChange={(e) => edit(kind, (x) => x.map((y, j) => (j === i ? e.target.value : y)))} /></span>
                      <span className="pc-sp" />
                      <button type="button" className="btn btn-2 btn-sm" onClick={() => edit(kind, (x) => x.filter((_, j) => j !== i))}>احذف</button>
                    </li>
                  ))}
                  <li>
                    <span className="fld"><input value={add[kind] ?? ''} aria-label={`${k.label} · سبب جديد`} placeholder="سبب جديد" onChange={(e) => setAdd((m) => ({ ...m, [kind]: e.target.value }))} /></span>
                    <span className="pc-sp" />
                    <button
                      type="button"
                      className="btn btn-2 btn-sm"
                      disabled={!add[kind]?.trim()}
                      onClick={() => { const v = add[kind]!.trim(); edit(kind, (x) => [...x, v]); setAdd((m) => ({ ...m, [kind]: '' })) }}
                    >
                      أضف
                    </button>
                  </li>
                </ul>
                <p className="sub cnote">{k.hint} · يظهر في نافذة القرار ويُسجَّل في سجل الطلب أو الحساب.</p>
              </Glass>
            )
          })}
        </Fragment>
      ))}
      {bad.map((b) => <p key={b} className="bad cnote">{b}</p>)}
      {changed.length > 0 && (
        <SaveBar
          count={changed.length}
          sentence={<>قوائم الأسباب معدّلة<span className="decsep" /><span className="sub">{changed.map((x) => x.label).join('، ')}</span></>}
          onSave={save}
          onDiscard={() => setD(saved)}
        />
      )}
    </>
  )
}

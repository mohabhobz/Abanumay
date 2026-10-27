import { useState } from 'react'
import { Glass, Head, Icon, icons, Num, Tag } from '@/components/ui'
import { FIELDS_BY_TRACK, GOALS_BY_FIELD, TRACKS } from '@/data/mock/taxonomy'
import { addTaxon, isAdded, taxonIssue, taxonUse, useTaxonomy, type TaxonLevel } from '@/data/budget/taxonomy'
import { NOUN, nounAfter } from '@/lib/format'

/* Client sheet 26 Oct (#112) · «المسارات والمجالات والأهداف» · the classification in three
   columns · picking a track lists its fields, picking a field lists its goals · each column adds
   its own value under the one picked before it */

const COL: Record<TaxonLevel, { title: string; add: string; ph: string }> = {
  track: { title: 'المسارات', add: 'أضف المسار', ph: 'اسم المسار' },
  field: { title: 'المجالات', add: 'أضف المجال', ph: 'اسم المجال' },
  goal: { title: 'الأهداف', add: 'أضف الهدف', ph: 'اسم الهدف' },
}

function Column({ level, items, picked, onPick, parent, parentSay }: {
  level: TaxonLevel
  items: readonly string[]
  picked?: string
  onPick?: (x: string) => void
  parent?: string
  parentSay?: string
}) {
  const [name, setName] = useState('')
  const [bad, setBad] = useState('')
  const c = COL[level]
  const issue = name.trim() ? taxonIssue(level, name, parent) : ''
  const go = () => { const out = addTaxon(level, name, parent); setBad(out); if (!out) setName('') }
  return (
    <Glass className="taxcol">
      <Head title={c.title} meta={parentSay ? <span className="sub trim1">{parentSay}</span> : <span className="sub"><Num>{items.length}</Num></span>} />
      <div className="taxadd">
        <span className="fld">
          <input value={name} disabled={level !== 'track' && !parent} onChange={(e) => { setName(e.target.value); setBad('') }}
            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim() && !issue) go() }} placeholder={c.ph} aria-label={c.ph} />
        </span>
        <button type="button" className="btn btn-2" disabled={!name.trim() || Boolean(issue)} title={issue || c.add} onClick={go}>
          <Icon name={icons.plus} size="sm" />
          {c.add}
        </button>
      </div>
      {(bad || issue) && <p className="bad cnote">{bad || issue}</p>}
      {items.length ? (
        <ul className="cfglist taxlist">
          {items.map((x) => {
            const n = taxonUse(level, x)
            return (
              <li key={x} className={picked === x ? 'on' : ''}>
                {onPick
                  ? <button type="button" className="taxpick" aria-pressed={picked === x} onClick={() => onPick(x)}><b>{x}</b></button>
                  : <b>{x}</b>}
                <span className="pc-sp" />
                {isAdded(level, x) && <Tag tone="teal">مضاف</Tag>}
                {n > 0 ? <Tag tone="mute"><Num>{n}</Num> {nounAfter(n, NOUN.project)}</Tag> : null}
                {onPick && <Icon name={icons.chevron} size="sm" />}
              </li>
            )
          })}
        </ul>
      ) : <p className="sub cnote">{level === 'track' ? '' : parent ? 'لا قيم بعد.' : `اختر ${level === 'field' ? 'مسارًا' : 'مجالًا'}.`}</p>}
    </Glass>
  )
}

export function TaxonomyTab() {
  useTaxonomy()
  const [track, setTrack] = useState<string>(TRACKS[0])
  const fields = FIELDS_BY_TRACK[track] ?? []
  const [field, setField] = useState<string | undefined>(fields[0])
  const f = field && fields.includes(field) ? field : fields[0]
  return (
    <div className="taxgrid">
      <Column level="track" items={TRACKS} picked={track} onPick={(x) => { setTrack(x); setField((FIELDS_BY_TRACK[x] ?? [])[0]) }} />
      <Column level="field" items={fields} picked={f} onPick={setField} parent={track} parentSay={track} />
      <Column level="goal" items={f ? GOALS_BY_FIELD[f] ?? [] : []} parent={f} parentSay={f} />
    </div>
  )
}

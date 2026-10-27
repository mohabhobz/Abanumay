import { useState } from 'react'
import { FormField, FieldBox, FieldSelect, Button, Glass, Head, Icon, icons, Mono, Num, Tag } from '@/components/ui'
import { FIELDS_BY_TRACK, GOALS_BY_FIELD, TRACKS } from '@/data/mock/taxonomy'
import {
  addTaxon, codeIssue, isAdded, renameTaxon, taxonBudgets, taxonCode, taxonIssue, taxonUse, useTaxonomy, type TaxonLevel,
} from '@/data/budget/taxonomy'
import { NOUN, nounAfter } from '@/lib/format'

/* Client sheet 26 Oct (#112) · client 27 Oct · the classification every project and budget line reads ·
   track › field › goal · one tab per level, in the funding sources' shape: a card that adds a value
   (its code and name, under the value above it) and the list of the values defined, each with its
   code, the value above it, what is classified under it, and a rename while nothing is. */

const SAY: Record<TaxonLevel, { one: string; many: string; add: string; codePh: string; namePh: string }> = {
  track: { one: 'المسار', many: 'المسارات المعرَّفة', add: 'أضف المسار', codePh: 'مثال: TR-07', namePh: 'مثال: مسار التمكين' },
  field: { one: 'المجال', many: 'المجالات المعرَّفة', add: 'أضف المجال', codePh: 'مثال: FD-30', namePh: 'مثال: البيئة' },
  goal: { one: 'الهدف', many: 'الأهداف المعرَّفة', add: 'أضف الهدف', codePh: 'مثال: GL-120', namePh: 'مثال: تشجير الأحياء' },
}

const NEW: Record<TaxonLevel, string> = { track: 'مسار جديد', field: 'مجال جديد', goal: 'هدف جديد' }

interface Row { name: string; parent?: string; path?: string }

const trackOf = (field: string) => TRACKS.find((t) => (FIELDS_BY_TRACK[t] ?? []).includes(field))

function rowsOf(level: TaxonLevel): Row[] {
  if (level === 'track') return TRACKS.map((name) => ({ name }))
  if (level === 'field') return TRACKS.flatMap((t) => (FIELDS_BY_TRACK[t] ?? []).map((name) => ({ name, parent: t, path: t })))
  return TRACKS.flatMap((t) => (FIELDS_BY_TRACK[t] ?? []).flatMap((f) => (GOALS_BY_FIELD[f] ?? []).map((name) => ({ name, parent: f, path: `${t} · ${f}` }))))
}

function LevelTab({ level }: { level: TaxonLevel }) {
  useTaxonomy()
  const say = SAY[level]
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [track, setTrack] = useState<string>('')
  const [field, setField] = useState<string>('')
  const [bad, setBad] = useState('')
  const [edit, setEdit] = useState<{ name: string; to: string; parent?: string } | null>(null)
  const [editBad, setEditBad] = useState('')

  const parent = level === 'field' ? track : level === 'goal' ? field : undefined
  const fields = track ? FIELDS_BY_TRACK[track] ?? [] : []
  const cIssue = code.trim() ? codeIssue(level, code) : ''
  const nIssue = name.trim() ? taxonIssue(level, name, parent || undefined) : ''
  const ready = Boolean(code.trim()) && Boolean(name.trim()) && !cIssue && !nIssue && (level === 'track' || Boolean(parent))
  const add = () => {
    const out = addTaxon(level, name, parent || undefined, code)
    setBad(out)
    if (!out) { setCode(''); setName('') }
  }

  const rows = rowsOf(level)

  return (
    <>
      <Glass>
        <Head title={NEW[level]} />
        <div className="cfgrow">
          {level !== 'track' && (
            <FormField label="المسار" required as="div">
              <FieldSelect value={track} label="المسار" placeholder="اختر المسار"
                options={TRACKS.map((t) => ({ value: t, label: t }))} onChange={(v) => { setTrack(v); setField(''); setBad('') }} />
            </FormField>
          )}
          {level === 'goal' && (
            <FormField label="المجال" required as="div">
              <FieldSelect value={field} label="المجال" placeholder={track ? 'اختر المجال' : 'اختر المسار أولًا'} disabled={!track}
                options={fields.map((f) => ({ value: f, label: f }))} onChange={(v) => { setField(v); setBad('') }} />
            </FormField>
          )}
          <FormField label={`رمز ${say.one}`} required>
            <FieldBox>
              <input value={code} onChange={(e) => { setCode(e.target.value); setBad('') }} placeholder={say.codePh} aria-label={`رمز ${say.one}`} dir="ltr" />
            </FieldBox>
          </FormField>
          <FormField label={`اسم ${say.one}`} required className="cfgwide">
            <FieldBox>
              <input value={name} onChange={(e) => { setName(e.target.value); setBad('') }} placeholder={say.namePh} aria-label={`اسم ${say.one}`}
                onKeyDown={(e) => { if (e.key === 'Enter' && ready) add() }} />
            </FieldBox>
          </FormField>
          <Button variant="p" className="cfgadd" disabled={!ready} title={cIssue || nIssue || say.add} onClick={add}>
            <Icon name={icons.plus} size="sm" />
            {say.add}
          </Button>
        </div>
        {(bad || cIssue || nIssue) && <p className="bad cnote">{bad || cIssue || nIssue}</p>}
      </Glass>

      <Glass className="tblcard">
        <Head title={say.many} meta={<span className="sub"><Num>{rows.length}</Num></span>} />
        <ul className="cfglist">
          {rows.map((r) => {
            const projects = taxonUse(level, r.name)
            const budgets = taxonBudgets(r.name)
            const editing = edit?.name === r.name && edit.parent === r.parent
            return (
              <li key={`${r.parent ?? ''}/${r.name}`}>
                <b><Mono>{taxonCode(level, r.name, r.parent)}</Mono></b>
                {editing ? (
                  <FieldBox className="bgs-ren">
                    <input autoFocus value={edit.to} onChange={(e) => { setEdit({ ...edit, to: e.target.value }); setEditBad('') }} aria-label={`اسم ${r.name}`} />
                  </FieldBox>
                ) : (
                  <span className="apv-t">
                    <span>{r.name}</span>
                    {r.path && <span className="sub">{r.path}</span>}
                  </span>
                )}
                <span className="pc-sp" />
                {isAdded(level, r.name) && <Tag tone="teal">مضاف</Tag>}
                {projects > 0 && <Tag tone="mute"><Num>{projects}</Num> {nounAfter(projects, NOUN.project)}</Tag>}
                {budgets > 0 && <Tag tone="mute"><Num>{budgets}</Num> {nounAfter(budgets, NOUN.budget)}</Tag>}
                {!projects && !budgets && <Tag tone="ok">بلا متعلقات</Tag>}
                {editing ? (
                  <>
                    <Button variant="p" size="sm" disabled={!edit.to.trim()}
                      onClick={() => { const out = renameTaxon(level, r.name, edit.to, level === 'goal' ? r.parent : level === 'field' ? trackOf(r.name) : undefined); setEditBad(out); if (!out) setEdit(null) }}>احفظ</Button>
                    <Button variant="2" size="sm" onClick={() => { setEdit(null); setEditBad('') }}>تراجع</Button>
                  </>
                ) : !projects && !budgets ? (
                  <Button variant="ghost" size="sm" aria-label={`عدّل اسم ${r.name}`} title="عدّل الاسم" onClick={() => { setEdit({ name: r.name, to: r.name, parent: r.parent }); setEditBad('') }}>
                    <Icon name={icons.edit} size="sm" />
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
        {editBad && <p className="bad cnote">{editBad}</p>}
      </Glass>
    </>
  )
}

export const TracksTab = () => <LevelTab level="track" />
export const FieldsTab = () => <LevelTab level="field" />
export const GoalsTab = () => <LevelTab level="goal" />

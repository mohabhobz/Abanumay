import { useState } from 'react'
import { FormField, FieldBox, Modal, ModalHead, Button, FieldMultiSelect, FieldSelect, Num, Riyal, icons } from '@/components/ui'
import { NOUN, nf, nounAfter } from '@/lib/format'
import {
  KIND_SAY, KIND_UNDER, childrenOf, docSources, kindFits, kindUnder, pathOf, sumChildren,
  type BudgetDoc, type BudgetNode, type LineKind, type SourceShare } from '@/data/mock/budgetTree'
import { CYCLE } from '@/data/intake/cycle'
import { DIRECTIONS, sourceName } from '@/data/budget/store'
import { FIELDS_BY_TRACK, GOALS_BY_FIELD, TRACKS } from '@/data/mock/taxonomy'
import { addTaxon, useTaxonomy, type TaxonLevel } from '@/data/budget/taxonomy'

/* Client 27 Oct · «فئة البند» · a line that stands for a track, a field or a goal takes its name
   from the budget settings' list · under a track the fields are that track's, under a field the
   goals are that field's · «أضف اسمًا جديدًا» writes a name the list doesn't have, and saving adds it
   to the settings under the value above it */
const CATEGORY_SAY: Record<TaxonLevel, string> = { track: 'مسار', field: 'مجال', goal: 'هدف' }
const NEW_NAME = '__new'
const allFields = () => [...new Set(Object.values(FIELDS_BY_TRACK).flat())]
const allGoals = () => [...new Set(Object.values(GOALS_BY_FIELD).flat())]
const categoryOf = (label: string): TaxonLevel | '' =>
  TRACKS.includes(label as (typeof TRACKS)[number]) ? 'track' : allFields().includes(label) ? 'field' : allGoals().includes(label) ? 'goal' : ''

/* Add or edit a line · one modal for both, same fields, same rules, same messages.

   Note: a modal, not an empty row in the table. An empty row lets the tree shift under the user's
   hand while typing, and an item with no name yet takes up a numbering slot. The modal lets the
   item enter the tree complete.

   The rules are shown before saving, not after (the reasoning sits in BudgetDocPage's header). What
   this modal adds to the tree's own rules (1.2.4 · 1.2.5 · 1.4.21 · 1.1.input-7 · 1.1.input-1):
     the amount is required on an active line · the line's split across the budget's sources when
       the budget has more than one, summing to its amount
     the grants supervisors of a domain · they are whom intake distributes the domain's projects to
     the strategic direction the line serves, among the budget's own */

const digits = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0

export function NodeModal({ doc, editId, under, onClose, onSave }: {
  doc: BudgetDoc
  editId: string | null
  under: string | null
  onClose: () => void
  onSave: (node: BudgetNode) => void
}) {
  const nodes = doc.nodes
  const x = editId ? nodes.find((k) => k.id === editId) : undefined
  const up0 = under ? nodes.find((k) => k.id === under) : undefined
  const many = docSources(doc).length > 1

  useTaxonomy()
  const [nCat, setNCat] = useState<TaxonLevel | ''>(x?.category ?? (x ? categoryOf(x.label) : ''))
  const [nLabel, setNLabel] = useState(x?.label ?? '')
  const [typed, setTyped] = useState(false)
  const [nKind, setNKind] = useState<LineKind>(x?.kind ?? (nodes.length === 0 ? 'base' : kindUnder(up0?.kind)))
  const [nAmount, setNAmount] = useState(x ? String(x.allocated) : '')
  const [nParent, setNParent] = useState(x?.parentId ?? under ?? '')
  const [nAlias, setNAlias] = useState(x?.alias ?? '')
  const [nShow, setNShow] = useState(x?.showLabel ?? true)
  const [nActive, setNActive] = useState(x?.active ?? true)
  const [nOwners, setNOwners] = useState<string[]>(x?.owners ?? [])
  const [nDir, setNDir] = useState(x?.directionId ?? '')
  const [nSplit, setNSplit] = useState<SourceShare[]>(() =>
    x?.sources?.length ? x.sources.map((s) => ({ ...s })) : docSources(doc).map((s) => ({ code: s.code, amount: 0 })))
  const [useSplit, setUseSplit] = useState(Boolean(x?.sources?.length))

  /**
   * The rule is shown before saving, not after.
   *
   * Note: it applies across the whole hierarchy, not sub-items alone. The order top -> main -> sub
   * means each type has exactly one valid position, and the rule is measured from rank rather than
   * a list of hand-written cases.
   */
  const shapeRule = (kind: LineKind, parentId: string | null, show: boolean, alias: string): string => {
    if (!show && !alias.trim()) return 'اسم البند مخفي عن الخارج · أدخل الاسم الظاهر للمستخدم حتى لا يظهر البند بلا اسم.'
    const others = nodes.filter((k) => k.id !== editId)
    const up = parentId ? nodes.find((k) => k.id === parentId) : undefined
    if (kind === 'base') {
      if (parentId) return 'البند الأساسي هو الميزانية نفسها · لا يتبع أي بند.'
      const otherBase = others.find((k) => k.kind === 'base')
      if (otherBase) return `يوجد بند أساسي بالفعل («${otherBase.label}») · للميزانية بند أساسي واحد فقط.`
      return ''
    }
    if (!parentId) return `يلزم أن يتبع البند من نوع «${KIND_SAY[kind]}» بندًا آخر · البند الذي لا يتبع أي بند نوعه أساسي.`
    if (!up) return 'اختر البند الذي يتبعه.'
    if (!kindFits(kind, up.kind)) {
      return `لا يمكن وضع «${KIND_SAY[kind]}» تحت «${KIND_SAY[up.kind]}» · مكانه تحت ${KIND_UNDER[kind].map((k) => KIND_SAY[k]).join(' أو ')}.`
    }
    /* An item can't be its own parent or its own grandparent - possible during editing alone, and
       it would produce a tree with a closed loop. */
    if (editId) {
      if (parentId === editId) return 'لا يمكن أن يتبع البند نفسه.'
      let cur: string | null = parentId
      while (cur) {
        if (cur === editId) return 'لا يمكن أن يتبع البند أحد أبنائه.'
        cur = nodes.find((k) => k.id === cur)?.parentId ?? null
      }
    }
    return ''
  }

  const base = nKind === 'base'
  const amount = base ? doc.total : digits(nAmount)
  const splitSum = nSplit.reduce((a, s) => a + s.amount, 0)
  /* 1.4.21 · an active line carries an amount · an inactive one may sit at zero */
  const amountRule = !base && nActive && !(amount > 0) ? 'المبلغ المخصص إلزامي للبند النشط.' : ''
  const splitRule = many && useSplit && !base && splitSum !== amount
    ? `مجموع التوزيع على المصادر ${nf.format(splitSum)} ومخصص البند ${nf.format(amount)}.`
    : ''
  const blocked = shapeRule(nKind, nParent || null, nShow, nAlias) || amountRule || splitRule

  const parents = nodes.filter((k) => k.id !== editId && kindFits(nKind, k.kind))
  const dirs = DIRECTIONS.filter((d) => doc.directionIds?.includes(d.id))
  const domain = nKind === 'main' && nParent !== '' && nodes.find((k) => k.id === nParent)?.kind === 'main'

  /* the classification value above the line · a field's track, a goal's field */
  const upLabel = nParent ? nodes.find((k) => k.id === nParent)?.label ?? '' : ''
  const parentValue = nCat === 'field' && TRACKS.includes(upLabel as (typeof TRACKS)[number]) ? upLabel
    : nCat === 'goal' && allFields().includes(upLabel) ? upLabel : ''
  const names: string[] = nCat === 'track' ? [...TRACKS]
    : nCat === 'field' ? (parentValue ? FIELDS_BY_TRACK[parentValue] ?? [] : allFields())
      : nCat === 'goal' ? (parentValue ? GOALS_BY_FIELD[parentValue] ?? [] : allGoals()) : []
  const fresh = Boolean(nCat) && Boolean(nLabel.trim()) && !names.includes(nLabel.trim())
  /* a new field or goal joins the settings under the value above it · without one it stays this line's name only */
  const joins = fresh && (nCat === 'track' || Boolean(parentValue))

  const save = () => {
    if (blocked || !nLabel.trim()) return
    if (joins) addTaxon(nCat as TaxonLevel, nLabel.trim(), nCat === 'track' ? undefined : parentValue)
    const parentId = nParent || null
    const alias = nAlias.trim() || undefined
    const prev = x
    onSave({
      ...(prev ?? { id: `n-${Date.now()}`, available: amount }),
      label: nLabel.trim(),
      category: nCat || undefined,
      alias,
      showLabel: nShow,
      active: nActive,
      kind: nKind,
      parentId,
      allocated: amount,
      /* Note: available can't exceed the new allocation - if the user lowers the allocation, an
         available figure larger than it would claim money that doesn't exist. */
      available: prev ? Math.min(prev.available, amount) : amount,
      sources: many && useSplit && !base ? nSplit.filter((s) => s.amount > 0) : undefined,
      owners: nOwners.length ? nOwners : undefined,
      directionId: nDir || undefined,
    })
    onClose()
  }

  return (
    <Modal label={editId ? 'تعديل بند' : 'إضافة بند'} onClose={onClose}>
        <ModalHead icon={editId ? icons.edit : icons.plus} title={editId ? 'تعديل بند' : 'إضافة بند'}>
          <span className="pc-sp" />
          {under && <span className="sub trim1">تحت {pathOf(nodes, under)}</span>}
        </ModalHead>

        <div className="mb col">
          <FormField label="فئة البند" as="div">
            <FieldSelect
              value={nCat}
              label="فئة البند"
              placeholder="بلا فئة"
              options={(Object.keys(CATEGORY_SAY) as TaxonLevel[]).map((k) => ({ value: k, label: CATEGORY_SAY[k] }))}
              onChange={(v) => { setNCat(v as TaxonLevel | ''); setTyped(false); if (!x) setNLabel('') }}
            />
          </FormField>

          {nCat && !typed && !fresh ? (
            <FormField label="اسم البند" required as="div">
              <FieldSelect
                value={nLabel}
                label="اسم البند"
                placeholder={`اختر ${CATEGORY_SAY[nCat]} من الإعدادات`}
                options={[...names.map((n) => ({ value: n, label: n })), { value: NEW_NAME, label: `أضف ${CATEGORY_SAY[nCat]} جديدًا` }]}
                onChange={(v) => { if (v === NEW_NAME) { setTyped(true); setNLabel('') } else setNLabel(v) }}
              />
            </FormField>
          ) : (
            <FormField label="اسم البند" required>
              <FieldBox>
                <input value={nLabel} onChange={(e) => setNLabel(e.target.value)} placeholder={nCat ? `اسم ${CATEGORY_SAY[nCat]} جديد` : 'مثال: مسار التعليم'} aria-label="اسم البند" />
              </FieldBox>
              {nCat && (
                <span className="sub regf-h">
                  {joins ? `يُضاف إلى ${CATEGORY_SAY[nCat] === 'مسار' ? 'المسارات' : CATEGORY_SAY[nCat] === 'مجال' ? 'المجالات' : 'الأهداف'} في إعدادات الميزانية${parentValue ? ` تحت «${parentValue}»` : ''} عند الحفظ · `
                    : fresh ? `لا يُضاف إلى الإعدادات · البند الذي يتبعه ليس ${nCat === 'field' ? 'مسارًا' : 'مجالًا'} من القائمة · ` : ''}
                  <Button plain type="button" className="lnk" onClick={() => { setTyped(false); setNLabel('') }}>اختر من القائمة</Button>
                </span>
              )}
            </FormField>
          )}

          {/* Public-facing name · not a translation of the name, a different name for a different
              purpose: the internal one is written for accounting, the entity reads this one. */}
          <FormField label="الاسم الظاهر للمستخدم" required={!nShow}>
            <FieldBox>
              <input value={nAlias} onChange={(e) => setNAlias(e.target.value)} placeholder="مثال: المنح التعليمية" aria-label="الاسم الظاهر للمستخدم" />
            </FieldBox>

          </FormField>

          <div className="bchk">
            <label className="bchk-i">
              <input type="checkbox" checked={nShow} onChange={(e) => setNShow(e.target.checked)} />
              <span>
                <b>أظهر اسم البند للخارج</b>
              </span>
            </label>
            <label className="bchk-i">
              <input type="checkbox" checked={nActive} onChange={(e) => setNActive(e.target.checked)} />
              <span>
                <b>البند نشط</b>
              </span>
            </label>
          </div>

          <FormField label="نوع البند">
            {/* The order in the dropdown matches the order in the hierarchy. */}
            <FieldSelect
              value={nKind}
              label="نوع البند"
              options={[
                { value: 'base', label: 'أساسي' },
                { value: 'main', label: 'رئيسي' },
                { value: 'sub', label: 'فرعي' },
              ]}
              onChange={(v) => setNKind(v as LineKind)}
            />

          </FormField>

          {/* The parent shown with its full path - "education track" alone isn't a unique label. */}
          <FormField label="تابع لبند">
            <FieldSelect
              value={nParent}
              label="تابع لبند"
              placeholder="لا يتبع بندًا · بند أساسي"
              options={parents.map((p) => ({ value: p.id, label: pathOf(nodes, p.id) }))}
              onChange={setNParent}
            />
          </FormField>

          <FormField label="المبلغ المخصص" required={!base && nActive}>
            <FieldBox>
              <input
                type="text"
                inputMode="numeric"
                disabled={base}
                value={base ? nf.format(doc.total) : nAmount ? nf.format(Number(nAmount)) : ''}
                onChange={(e) => setNAmount(String(digits(e.target.value) || ''))}
                aria-label="المبلغ المخصص"
              />
              <Riyal />
            </FieldBox>
            {!base && nParent ? (
              <span className="sub regf-h">
                المتبقّي في «{nodes.find((k) => k.id === nParent)?.label}»{' '}
                <span className="num">
                  {nf.format((nodes.find((k) => k.id === nParent)?.allocated ?? 0) - sumChildren(nodes, nParent) + (x && x.parentId === nParent ? x.allocated : 0))}
                </span>
              </span>
            ) : null}
          </FormField>

          {many && !base && (
            <div className="bgsplit">
              <label className="bchk-i">
                <input type="checkbox" checked={useSplit} onChange={(e) => setUseSplit(e.target.checked)} />
                <span>
                  <b>وزّع مبلغ البند على مصادر التمويل</b>
                </span>
              </label>
              {useSplit && (
                <div className="regfields">
                  {nSplit.map((s, i) => (
                    <FormField key={s.code} label={sourceName(s.code)}>
                      <FieldBox>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={s.amount ? nf.format(s.amount) : ''}
                          onChange={(e) => setNSplit((arr) => arr.map((y, j) => (j === i ? { ...y, amount: digits(e.target.value) } : y)))}
                          aria-label={`مبلغ ${sourceName(s.code)}`}
                        />
                        <Riyal />
                      </FieldBox>
                    </FormField>
                  ))}
                </div>
              )}
            </div>
          )}

          {domain && (
            <FormField label="مشرف المنح المسؤول">
              <FieldMultiSelect
                label="مشرف المنح المسؤول"
                placeholder="من دورة الاستقبال"
                people
                values={nOwners}
                options={CYCLE.supervisors.map((s) => ({ value: s, label: s }))}
                onChange={setNOwners}
              />

            </FormField>
          )}

          {dirs.length > 0 && !base && (
            <FormField label="التوجه الاستراتيجي">
              <FieldSelect
                value={nDir}
                label="التوجه الاستراتيجي"
                placeholder="يرث توجه البند الذي فوقه"
                options={dirs.map((d) => ({ value: d.id, label: d.name }))}
                onChange={setNDir}
              />
            </FormField>
          )}

          {/* The rule is shown where the decision happens, not as a toast after clicking. */}
          {blocked && <p className="bad cnote">{blocked}</p>}
        </div>

        <div className="mf">
          <Button
            variant="p"
            disabled={!nLabel.trim() || Boolean(blocked)}
            title={blocked || (nLabel.trim() ? (editId ? 'احفظ التعديل' : 'أضف البند') : 'أدخل اسم البند')}
            onClick={save}
          >
            {editId ? 'احفظ التعديل' : 'أضف البند'}
          </Button>
          <Button variant="2" onClick={onClose}>إلغاء</Button>
          <span className="pc-sp" />
          <span className="sub">
            {childrenOf(nodes, nParent || null).length > 0 && (
              <>تحته <Num>{childrenOf(nodes, nParent || null).length}</Num> {nounAfter(childrenOf(nodes, nParent || null).length, NOUN.line)}</>
            )}
          </span>
        </div>
      </Modal>
  )
}

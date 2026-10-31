import type { ReactNode } from 'react'
import { Button, FieldBox, FieldSelect, FormField, Glass, Head, Icon, Num, Tag, icons } from '@/components/ui'
import { pct } from '@/lib/format'
import type { ProjectRow } from '@/types/domain'
import {
  CLASS_TONE, MAQASID_CRIT, MAQSAD_MAJOR, MAQSAD_METHOD, MAQSAD_NATURE, MAQSAD_RANK, SCALE_0_5, WAQF_CRIT, WAQF_FIT,
  maqasidResult, pctOf, suggestMaqasid, suggestWaqf, waqfResult,
  type AlignResult, type Crit, type CritScore, type MaqasidEval, type WaqfEval,
} from '@/data/intake/alignment'
import { WAQF_CATS, WAQF_ITEMS, WAQF_RULES } from '@/data/intake/waqfDeed'

/* Client 30 Oct · the study's fifth and sixth sections · «الارتباط بمقاصد الشريعة» and «الارتباط بصك
   الوقفية», each laid out as its sheet: the link's classification, the weighted criteria (0–5, the
   weight, the product, the evaluator's note) and the result. The assistant drafts both from the
   request · a draft says so until the supervisor saves the study. */

const opts = (list: readonly string[]) => list.map((x) => ({ value: x, label: x }))

function Result({ r }: { r: AlignResult }) {
  return (
    <div className="algn-res">
      <span><span className="sub">درجة المشروع الخام</span><b><Num>{r.raw.toFixed(2)}</Num></b><span className="sub">من 5</span></span>
      <span><span className="sub">نسبة المشروع الخام</span><b>{pct(pctOf(r.rawRatio))}</b></span>
      <span><span className="sub">النسبة النهائية</span><b className="algn-final">{pct(pctOf(r.final))}</b></span>
      <span><span className="sub">التصنيف</span><Tag tone={CLASS_TONE[r.cls]}>{r.cls}</Tag></span>
      <span><span className="sub">حالة المراجعة</span><span className={r.review.startsWith('تحتاج') ? 'bad-ink' : undefined}>{r.review}</span></span>
      <span><span className="sub">التوصية الأولية</span><b>{r.advice}</b></span>
    </div>
  )
}

/** The weighted criteria as the sheet's table · `fixed` gives a row's value from above (the objective's rank) */
function CritTable({ crit, scores, editable, fixed, onChange }: {
  crit: Crit[]
  scores: CritScore[]
  editable: boolean
  fixed?: Record<number, { v: number; say: string }>
  onChange: (i: number, s: CritScore) => void
}) {
  return (
    <div className="tblwrap">
      <table className="tbl algn-tbl">
        <colgroup><col className="c-n" /><col className="c-crit" /><col className="c-pick" /><col className="c-w" /><col className="c-w" /><col className="c-note" /></colgroup>
        <thead>
          <tr>
            <th><span className="th-t">م</span></th>
            <th><span className="th-t">معيار التقييم</span></th>
            <th><span className="th-t">الخيار / الدرجة</span></th>
            <th className="n"><span className="th-t">الوزن</span></th>
            <th className="n"><span className="th-t">الناتج</span></th>
            <th><span className="th-t">ملاحظات المقيِّم</span></th>
          </tr>
        </thead>
        <tbody>
          {crit.map((c, i) => {
            const f = fixed?.[i]
            const v = f ? f.v : scores[i]?.v ?? null
            return (
              <tr key={c.key}>
                <td><Num>{i + 1}</Num></td>
                <td className="acttbl-2"><b>{c.label}</b><span className="sub">{c.how}</span></td>
                <td>
                  {f ? <span>{f.say} <span className="sub">· <Num>{f.v}</Num></span></span> : (
                    <FieldSelect value={v === null ? '' : String(v)} label={c.label} placeholder="اختر من 5" disabled={!editable}
                      options={SCALE_0_5.map((x) => ({ value: String(x.value), label: x.label }))}
                      onChange={(x) => onChange(i, { ...scores[i], v: x === '' ? null : Number(x) })} />
                  )}
                </td>
                <td className="n"><Num>{c.weight}</Num></td>
                <td className="n">{v === null ? <span className="sub">—</span> : <Num>{v * c.weight}</Num>}</td>
                <td>
                  {editable && !f
                    ? <FieldBox><input value={scores[i]?.note ?? ''} aria-label={`ملاحظة · ${c.label}`} onChange={(e) => onChange(i, { ...scores[i], v: scores[i]?.v ?? null, note: e.target.value })} /></FieldBox>
                    : <span className="sub">{scores[i]?.note || '—'}</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Frame({ title, final, drafted, editable, onDraft, children }: {
  title: string
  final: AlignResult
  drafted?: boolean
  editable: boolean
  onDraft: () => void
  children: ReactNode
}) {
  return (
    <Glass className="algn">
      <Head title={title} meta={<span className="rowf gp-2">
        {drafted && <Tag tone="teal">مسودة المساعد · راجعها</Tag>}
        <Tag tone={CLASS_TONE[final.cls]}>{pct(pctOf(final.final))} · {final.cls}</Tag>
        {editable && (
          <Button type="button" variant="ghost" size="sm" onClick={onDraft} title="يعيد المساعد ملء التقييم من طلب المشروع">
            <Icon name={icons.spark} size="sm" />
            اقترح بالمساعد
          </Button>
        )}
      </span>} />
      {children}
    </Glass>
  )
}

export function MaqasidCard({ row, value, editable, onChange }: { row: ProjectRow; value: MaqasidEval; editable: boolean; onChange: (m: MaqasidEval) => void }) {
  const r = maqasidResult(value)
  const set = <K extends keyof MaqasidEval>(k: K, v: MaqasidEval[K]) => onChange({ ...value, [k]: v, drafted: false })
  const rank = MAQSAD_RANK.find((x) => x.value === value.rank)
  return (
    <Frame title="الارتباط بمقاصد الشريعة" final={r} drafted={value.drafted} editable={editable} onDraft={() => onChange(suggestMaqasid(row))}>
      <h3 className="stdy-h">تصنيف ارتباط المشروع بالمقاصد</h3>
      <div className="regfields">
        <FormField label="المقصد الأكبر"><FieldSelect value={value.major} label="المقصد الأكبر" disabled={!editable} options={opts(MAQSAD_MAJOR)} onChange={(v) => set('major', v)} /></FormField>
        <FormField label="المقصد العام"><FieldBox><input value={value.general} disabled={!editable} aria-label="المقصد العام" onChange={(e) => set('general', e.target.value)} /></FieldBox></FormField>
        <FormField label="مرتبة المقصد في المشروع"><FieldSelect value={value.rank} label="مرتبة المقصد" disabled={!editable} options={MAQSAD_RANK.map((x) => ({ value: x.value, label: x.value }))} onChange={(v) => set('rank', v)} />
          {rank && <span className="sub regf-h">{rank.say}</span>}</FormField>
        <FormField label="طريقة حفظ المقصد"><FieldSelect value={value.method} label="طريقة حفظ المقصد" disabled={!editable} options={opts(MAQSAD_METHOD.map((x) => x.value))} onChange={(v) => set('method', v)} /></FormField>
        <FormField label="طبيعة ارتباط المشروع بالمقصد"><FieldSelect value={value.nature} label="طبيعة الارتباط" disabled={!editable} options={opts(MAQSAD_NATURE.map((x) => x.value))} onChange={(v) => set('nature', v)} /></FormField>
        <FormField label="وجه ارتباط المشروع بالمقصد" wide><FieldBox area><textarea rows={2} value={value.how} disabled={!editable} aria-label="وجه ارتباط المشروع بالمقصد" onChange={(e) => set('how', e.target.value)} /></FieldBox></FormField>
        <FormField label="الشواهد والمبررات من واقع المشروع" wide><FieldBox area><textarea rows={2} value={value.evidence} disabled={!editable} aria-label="الشواهد والمبررات" onChange={(e) => set('evidence', e.target.value)} /></FieldBox></FormField>
      </div>
      <h3 className="stdy-h">التقييم المرجّح</h3>
      <CritTable crit={MAQASID_CRIT} scores={value.scores} editable={editable}
        fixed={{ 0: { v: rank?.score ?? 0, say: value.rank || '—' } }}
        onChange={(i, s) => set('scores', MAQASID_CRIT.map((_, j) => (j === i ? s : value.scores[j] ?? { v: null })))} />
      <h3 className="stdy-h">النتيجة والتوصية الأولية</h3>
      <Result r={r} />
      <FormField label="ملاحظات عامة" wide><FieldBox area><textarea rows={2} value={value.notes} disabled={!editable} aria-label="ملاحظات عامة · المقاصد" onChange={(e) => set('notes', e.target.value)} /></FieldBox></FormField>
    </Frame>
  )
}

export function WaqfCard({ row, value, editable, onChange }: { row: ProjectRow; value: WaqfEval; editable: boolean; onChange: (w: WaqfEval) => void }) {
  const r = waqfResult(value)
  const set = <K extends keyof WaqfEval>(k: K, v: WaqfEval[K]) => onChange({ ...value, [k]: v, drafted: false })
  const items = WAQF_ITEMS.filter((x) => x.cat === value.cat)
  const item = WAQF_ITEMS.find((x) => x.item === value.item)
  return (
    <Frame title="الارتباط بصك الوقفية" final={r} drafted={value.drafted} editable={editable} onDraft={() => onChange(suggestWaqf(row))}>
      <h3 className="stdy-h">تصنيف ارتباط المشروع بصك الوقفية</h3>
      <div className="regfields">
        <FormField label="تصنيف المصرف"><FieldSelect value={value.cat} label="تصنيف المصرف" disabled={!editable} options={opts(WAQF_CATS)}
          onChange={(v) => onChange({ ...value, cat: v, item: WAQF_ITEMS.find((x) => x.cat === v)?.item ?? '', drafted: false })} /></FormField>
        <FormField label="المصرف / البند التفصيلي من الصك" wide><FieldSelect value={value.item} label="البند التفصيلي" disabled={!editable} options={opts(items.map((x) => x.item))} onChange={(v) => set('item', v)} /></FormField>
        <FormField label="مستوى انطباق البند"><FieldSelect value={value.fit} label="مستوى انطباق البند" disabled={!editable} options={opts(WAQF_FIT.map((x) => x.value))} onChange={(v) => set('fit', v)} /></FormField>
        <FormField label="هل يوجد تعارض مع الصك؟"><FieldSelect value={value.conflict} label="هل يوجد تعارض مع الصك" disabled={!editable} options={opts(['لا', 'نعم'])} onChange={(v) => set('conflict', v as WaqfEval['conflict'])} /></FormField>
        <FormField label="الضابط الخاص / المبلغ" wide as="div">
          <span>{item?.amount || item?.rule ? [item.amount, item.rule].filter(Boolean).join(' · ') : <span className="sub">لا ضابط خاص لهذا البند</span>}</span>
        </FormField>
        <FormField label="وجه ارتباط المشروع بالصك" wide><FieldBox area><textarea rows={2} value={value.how} disabled={!editable} aria-label="وجه ارتباط المشروع بالصك" onChange={(e) => set('how', e.target.value)} /></FieldBox></FormField>
        <FormField label="الشواهد والمستندات الداعمة" wide><FieldBox area><textarea rows={2} value={value.evidence} disabled={!editable} aria-label="الشواهد والمستندات الداعمة" onChange={(e) => set('evidence', e.target.value)} /></FieldBox></FormField>
      </div>
      <h3 className="stdy-h">التقييم المرجّح</h3>
      <CritTable crit={WAQF_CRIT} scores={value.scores} editable={editable}
        onChange={(i, s) => set('scores', WAQF_CRIT.map((_, j) => (j === i ? s : value.scores[j] ?? { v: null })))} />
      <h3 className="stdy-h">النتيجة والتوصية الأولية</h3>
      <Result r={r} />
      <FormField label="ملاحظات عامة" wide><FieldBox area><textarea rows={2} value={value.notes} disabled={!editable} aria-label="ملاحظات عامة · الصك" onChange={(e) => set('notes', e.target.value)} /></FieldBox></FormField>
      <details className="mt-2">
        <summary className="lnk">الضوابط العامة في الصك</summary>
        <ul className="outs-ro mt-1">{WAQF_RULES.map((x) => <li key={x} className="sub">{x}</li>)}</ul>
      </details>
    </Frame>
  )
}

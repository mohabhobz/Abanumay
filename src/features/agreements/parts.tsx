import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DateText, Glass, Head, Icon, Money, Mono, Num, Person, Tag, icons } from '@/components/ui'
import { DocFile } from '@/components/docs'
import { ROUTES } from '@/app/routes'
import { isolate, nf, readDate } from '@/lib/format'
import type { AgreementRow, PayDoc } from '@/types/domain'
import {
  CLAUSE_SAY, HOLDER_SAY, REQUIRED_ANNEXES, agrFlowOf, agrHolder, agrStageSay, type AgrHint, type AgrIssue,
  type AgrVersion, type Clause, type ClauseKind, type TextPart,
} from '@/data/agreements/store'

/* Agreement pieces shared by the draft builder and the agreement page · the clauses, the annexes,
   the generated text, the assistant's review, the completeness check, the versions and the
   signatures. One component each, so the builder and the saved agreement read the same. */

const KINDS: ClauseKind[] = ['clause', 'condition', 'obligation', 'followup']
const SOURCE_SAY: Record<Clause['source'], string> = { template: 'من النموذج', approval: 'من قرار الاعتماد', ai: 'مقترح المساعد', staff: 'أضافه المشرف' }
const stamp = () => Math.random().toString(36).slice(2, 8)

/** Terms, conditions, obligations and follow-up (8.2.10) · read, or edited on a draft */
export function ClausesCard({ clauses, onChange }: { clauses: Clause[]; onChange?: (c: Clause[]) => void }) {
  const [kind, setKind] = useState<ClauseKind>('clause')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const put = (i: number, p: Partial<Clause>) => onChange?.(clauses.map((c, j) => (j === i ? { ...c, ...p } : c)))
  return (
    <Glass>
      <Head title="البنود والشروط والالتزامات" meta={<span className="sub"><Num>{clauses.length}</Num> بندًا · <bdi>{/* doc 8.2.10 */}</bdi></span>} />
      <ol className="agx-cl">
        {clauses.map((c, i) => (
          <li key={c.id}>
            <span className="agx-cl-h">
              <Tag tone={c.kind === 'condition' ? 'warn' : c.kind === 'obligation' ? 'teal' : 'mute'}>{CLAUSE_SAY[c.kind]}</Tag>
              {onChange
                ? <span className="fld agx-cl-t"><input value={c.title} onChange={(e) => put(i, { title: e.target.value })} aria-label={`عنوان البند ${i + 1}`} /></span>
                : <b>{c.title}</b>}
              <span className="pc-sp" />
              <span className="sub">{SOURCE_SAY[c.source]}</span>
              {onChange && (
                <button type="button" className="btn btn-ghost btn-sm" aria-label={`احذف البند ${i + 1}`} onClick={() => onChange(clauses.filter((_, j) => j !== i))}>
                  <Icon name={icons.close} size="sm" />
                </button>
              )}
            </span>
            {onChange
              ? <span className="fld"><textarea rows={2} value={c.body} onChange={(e) => put(i, { body: e.target.value })} aria-label={`نص البند ${i + 1}`} /></span>
              : <p className="prose">{isolate(c.body)}</p>}
          </li>
        ))}
      </ol>
      {onChange && (
        <div className="agx-add">
          <div className="cfgchips" role="radiogroup" aria-label="نوع البند">
            {KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} className={`cfgchip${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>{CLAUSE_SAY[k]}</button>
            ))}
          </div>
          <span className="fld"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان البند" aria-label="عنوان البند الجديد" /></span>
          <span className="fld"><textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="نص البند" aria-label="نص البند الجديد" /></span>
          <button type="button" className="btn btn-2 btn-sm" disabled={!title.trim() || !body.trim()} onClick={() => { onChange([...clauses, { id: `cl-${stamp()}`, kind, title: title.trim(), body: body.trim(), source: 'staff' }]); setTitle(''); setBody('') }}>
            <Icon name={icons.plus} size="sm" />أضف البند
          </button>
        </div>
      )}
    </Glass>
  )
}

const ANNEX_KINDS = [...REQUIRED_ANNEXES, 'خطة التنفيذ', 'جدول الدفعات', 'ملحق آخر']

/** The agreement's annexes (8.2.10 · 8.2.28) · uploaded on a draft, archived with the final copy */
export function AnnexesCard({ docs, onChange, title = 'الاتفاقية وملاحقها' }: { docs: PayDoc[]; onChange?: (d: PayDoc[]) => void; title?: string }) {
  const [kind, setKind] = useState(ANNEX_KINDS[0])
  const missing = REQUIRED_ANNEXES.filter((n) => !docs.some((d) => d.kind === n))
  return (
    <Glass>
      <Head title={title} meta={<span className="sub"><Num>{docs.length}</Num> مرفقًا</span>} />
      {docs.length > 0 && (
        <div className="docgrid">
          {docs.map((d, i) => (
            <span key={`${d.name}-${i}`} className="agx-doc">
              <DocFile name={d.name} meta={`${d.kind} · ${readDate(d.at)}`} />
              {onChange && (
                <button type="button" className="btn btn-ghost btn-sm" aria-label={`احذف ${d.name}`} onClick={() => onChange(docs.filter((_, j) => j !== i))}>
                  <Icon name={icons.close} size="sm" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {missing.length > 0 && <p className="bad cnote">ملحق إلزامي غير مرفوع: {missing.join('، ')}</p>}
      {onChange && (
        <div className="apv-row mt-3">
          <div className="cfgchips" role="radiogroup" aria-label="نوع الملحق">
            {ANNEX_KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} className={`cfgchip${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>{k}</button>
            ))}
          </div>
          <label className="btn btn-2 btn-sm">
            <Icon name={icons.upload} size="sm" />ارفع الملحق
            <input className="vis-h" type="file" aria-label="ارفع الملحق" onChange={(e) => {
              const x = e.target.files?.[0]
              if (x) onChange([...docs, { name: x.name, kind, at: new Date().toISOString().slice(0, 10), size: `${nf.format(Math.max(1, Math.round(x.size / 1024)))} ك.ب` }])
              e.target.value = ''
            }} />
          </label>
        </div>
      )}
    </Glass>
  )
}

/** The agreement's text · the template with the project's data in it (8.2.6) */
export function AgreementTextCard({ parts, note }: { parts: TextPart[]; note?: string }) {
  return (
    <Glass>
      <Head title="نص الاتفاقية" meta={<span className="rowf gp-2"><Tag tone="mute">مولَّد من النموذج وبيانات المشروع</Tag><button type="button" className="btn btn-2 btn-sm" onClick={() => window.print()}><Icon name={icons.doc} size="sm" />اطبع</button></span>} />
      <div className="agr-body">
        {parts.map((s) => (
          <section key={s.h}>
            <h3>{s.h}</h3>
            <ul>{s.body.map((b, i) => <li key={i}>{isolate(b)}</li>)}</ul>
          </section>
        ))}
      </div>
      {note && <p className="sub cnote">{note}</p>}
    </Glass>
  )
}

/** The assistant's review · advisory, never applied without the supervisor (8.2.7 · 8.4.22) */
export function ReviewCard({ hints, onAdd, onTemplate }: { hints: AgrHint[]; onAdd?: (c: Clause) => void; onTemplate?: (t: string) => void }) {
  return (
    <Glass>
      <Head title="مراجعة المساعد" meta={<Tag tone="mute">استرشادي</Tag>} />
      <ul className="apv-sig">
        {hints.map((h) => (
          <li key={h.id} className={h.tone === 'ok' ? 'ok' : 'no'}>
            <Icon name={h.tone === 'ok' ? icons.spark : icons.alert} size="sm" />
            <span className="agx-hint">
              <span>{isolate(h.text)}</span>
              {h.add && onAdd && <button type="button" className="btn btn-2 btn-sm" onClick={() => onAdd({ ...h.add!, id: `cl-${stamp()}` })}>أضف البند</button>}
              {h.template && onTemplate && <button type="button" className="btn btn-2 btn-sm" onClick={() => onTemplate(h.template!)}>اعتمد النموذج</button>}
            </span>
          </li>
        ))}
      </ul>
      <p className="sub cnote">يكشف المساعد النقص والتعارض ويقترح البنود وفق طبيعة المشروع ومجاله · ولا تُعتمد الاتفاقية بناءً عليه وحده.</p>
    </Glass>
  )
}

/** What stops sending or approving (8.2.13 · 8.4.9) */
export function IssuesCard({ issues, ready }: { issues: AgrIssue[]; ready: string }) {
  return (
    <Glass>
      <Head title="فحص الاكتمال" meta={issues.length ? <Tag tone="warn"><Num>{issues.length}</Num> نقصًا</Tag> : <Tag tone="ok">مكتملة</Tag>} />
      <ul className="apv-sig">
        {issues.length === 0 && <li className="ok"><Icon name={icons.check} size="sm" /><span>{ready}</span></li>}
        {issues.map((i) => <li key={i.key} className="no"><Icon name={icons.alert} size="sm" /><span>{isolate(i.say)}</span></li>)}
      </ul>
    </Glass>
  )
}

/** The versions archive (8.4.6 · 8.2.28) · each version's terms as they were */
export function VersionsCard({ a, versions, children }: { a: AgreementRow; versions: AgrVersion[]; children?: ReactNode }) {
  const [open, setOpen] = useState<number | null>(null)
  const f = agrFlowOf(a.id)
  return (
    <Glass>
      <Head title="الإصدارات" meta={<span className="sub">الحالي <Num>{a.version}</Num>{f.inForce !== undefined && <> · النافذ <Num>{f.inForce}</Num></>}</span>} />
      {versions.length === 0 ? (
        <p className="sub cnote">لا إصدارات مؤرشفة بعد · تُؤرشف النسخة النهائية عند اعتمادها وتفعيلها.</p>
      ) : (
        <ul className="apv-list">
          {[...versions].reverse().map((v) => (
            <li key={v.version}>
              <span className="apv-t">
                <b>الإصدار {nf.format(v.version)} · {v.reason}</b>
                <span className="sub">{v.kind} · {v.template} · <Money sm>{v.amount}</Money> · <Num>{v.payments.length}</Num> دفعات · <Num>{v.clauses.length}</Num> بندًا</span>
              </span>
              <span className="pc-sp" />
              {v.version === f.inForce && <Tag tone="ok">نافذ</Tag>}
              <Person name={v.by} />
              <span className="sub"><DateText>{v.at}</DateText></span>
              <button type="button" className="btn btn-2 btn-sm" onClick={() => setOpen(open === v.version ? null : v.version)}>{open === v.version ? 'أخفِ' : 'اعرض'}</button>
              {open === v.version && (
                <div className="agx-ver">
                  {v.payments.map((p) => <span key={p.no} className="sub">الدفعة {nf.format(p.no)} · {nf.format(p.amount)} · {p.dueAt} · {p.requirement}</span>)}
                  {v.clauses.map((c) => <span key={c.id} className="sub">{CLAUSE_SAY[c.kind]} · {c.title}</span>)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {children}
    </Glass>
  )
}

/** The signatures · the entity's (electronic or the signed paper copy), then the foundation's (8.4.15 · 8.4.16) */
export function SignaturesCard({ a }: { a: AgreementRow }) {
  const f = agrFlowOf(a.id)
  return (
    <Glass>
      <Head title="التوقيعات" meta={<span className="sub"><bdi>{/* doc 8.4.14 – 8.4.16 */}</bdi></span>} />
      <ul className="payq-ck">
        <li className={f.entitySign ? 'ok' : 'no'}>
          <Icon name={f.entitySign ? icons.check : icons.alert} size="sm" />
          <span>{f.entitySign
            ? <>وقّعتها الجهة {f.entitySign.method === 'e' ? 'إلكترونيًّا' : <>ورقيًّا · {f.entitySign.file}</>} · {a.signer.name} · <DateText>{f.entitySign.at}</DateText>
              {f.entitySign.sig && <><br /><span className="sub">برمز تحقق على الجوال · بصمة النص <bdi className="num">{f.entitySign.sig.hash.slice(0, 16)}…</bdi></span></>}</>
            : <>توقيع الجهة · {a.kind === 'إلكترونية' ? 'إلكترونيًّا من بوابة المنح' : 'نسخة ورقية موقّعة يرفعها المشرف'}</>}</span>
        </li>
        <li className={f.foundationSign ? 'ok' : 'no'}>
          <Icon name={f.foundationSign ? icons.check : icons.alert} size="sm" />
          <span>{f.foundationSign ? <>اعتمدها ممثل المؤسسة · {f.foundationSign.by} · <DateText>{f.foundationSign.at}</DateText></> : 'اعتماد ممثل المؤسسة للنسخة النهائية بعد توقيع الجهة'}</span>
        </li>
      </ul>
    </Glass>
  )
}

/** The project tab's view · every agreement of the project, one in force at most (8.4.24 · 8.4.25) */
export function ProjectAgreements({ list, onAdditional, additionalBlock }: { list: AgreementRow[]; onAdditional?: () => void; additionalBlock?: string }) {
  return (
    <Glass>
      <Head title="اتفاقيات المشروع" meta={<span className="sub"><Num>{list.length}</Num> اتفاقية · سارية واحدة على الأكثر</span>} />
      <ul className="apv-list">
        {list.map((a) => {
          const h = agrHolder(a)
          const f = agrFlowOf(a.id)
          return (
            <li key={a.id}>
              <span className="apv-t">
                <b><Link className="tlink" to={ROUTES.agreement(a.id)}><Mono>{a.id}</Mono></Link> · {agrStageSay(a)}</b>
                <span className="sub">{a.kind} · {a.template} · الإصدار <Num>{a.version}</Num>{f.inForce !== undefined && <> · النافذ <Num>{f.inForce}</Num></>} · <Money sm>{a.amount}</Money></span>
              </span>
              <span className="pc-sp" />
              {h && <span className="sub">عند {HOLDER_SAY[h]}</span>}
              <Tag tone={a.stage === 'active' ? 'ok' : a.stage === 'cancelled' ? 'no' : a.stage === 'returned' ? 'warn' : 'teal'}>{agrStageSay(a)}</Tag>
            </li>
          )
        })}
      </ul>
      {onAdditional && (
        <div className="apv-row mt-3">
          <button type="button" className="btn btn-2 btn-sm" disabled={Boolean(additionalBlock)} title={additionalBlock || 'اتفاقية إضافية تحلّ محل السارية عند سريانها'} onClick={onAdditional}>
            <Icon name={icons.plus} size="sm" />اتفاقية إضافية
          </button>
          <span className="sub">تحلّ محل السارية عند اعتمادها · فتبقى اتفاقية سارية واحدة{/* doc 8.4.25 */}</span>
        </div>
      )}
      <p className="sub cnote">مراحل الاتفاقية لا تغيّر حالة المشروع · يبقى في «اعتماد الإتفاقية» حتى سريانها، ولا ينتقل للتنفيذ عند إلغائها.{/* doc 8.4.26 · 8.4.27 */}</p>
    </Glass>
  )
}

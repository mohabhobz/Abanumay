import { requirementOf } from '@/data/agreements/conds'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ButtonLabel, FieldBox, Button, DateText, Glass, Head, Icon, Money, Mono, Num, Person, Tag, icons } from '@/components/ui'
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
      <Head title="البنود والشروط والالتزامات" meta={<span className="sub"><Num>{clauses.length}</Num> بندًا{/* doc 8.2.10 */}</span>} />
      <ol className="agx-cl">
        {clauses.map((c, i) => (
          <li key={c.id}>
            <span className="agx-cl-h">
              {onChange
                ? <FieldBox className="agx-cl-t"><input value={c.title} onChange={(e) => put(i, { title: e.target.value })} aria-label={`عنوان البند ${i + 1}`} /></FieldBox>
                : <b>{c.title}</b>}
              <span className="pc-sp" />
              {/* Client 27 Oct · the clause's kind on the end side, after its title */}
              <Tag tone={c.kind === 'condition' ? 'warn' : c.kind === 'obligation' ? 'teal' : 'mute'}>{CLAUSE_SAY[c.kind]}</Tag>
              <span className="sub">{SOURCE_SAY[c.source]}</span>
              {onChange && (
                <Button type="button" variant="ghost" size="sm" aria-label={`احذف البند ${i + 1}`} onClick={() => onChange(clauses.filter((_, j) => j !== i))}>
                  <Icon name={icons.close} size="sm" />
                </Button>
              )}
            </span>
            {onChange
              ? <FieldBox><textarea rows={2} value={c.body} onChange={(e) => put(i, { body: e.target.value })} aria-label={`نص البند ${i + 1}`} /></FieldBox>
              : <p className="prose">{isolate(c.body)}</p>}
          </li>
        ))}
      </ol>
      {onChange && (
        <div className="agx-add">
          <div className="cfgchips" role="radiogroup" aria-label="نوع البند">
            {KINDS.map((k) => (
              <Button plain key={k} type="button" role="radio" aria-checked={kind === k} className={`cfgchip${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>{CLAUSE_SAY[k]}</Button>
            ))}
          </div>
          <FieldBox><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان البند" aria-label="عنوان البند الجديد" /></FieldBox>
          <FieldBox><textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="نص البند" aria-label="نص البند الجديد" /></FieldBox>
          <Button type="button" variant="2" size="sm" disabled={!title.trim() || !body.trim()} onClick={() => { onChange([...clauses, { id: `cl-${stamp()}`, kind, title: title.trim(), body: body.trim(), source: 'staff' }]); setTitle(''); setBody('') }}>
            <Icon name={icons.plus} size="sm" />أضف البند
          </Button>
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
                <Button type="button" variant="ghost" size="sm" aria-label={`احذف ${d.name}`} onClick={() => onChange(docs.filter((_, j) => j !== i))}>
                  <Icon name={icons.close} size="sm" />
                </Button>
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
              <Button plain key={k} type="button" role="radio" aria-checked={kind === k} className={`cfgchip${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>{k}</Button>
            ))}
          </div>
          <ButtonLabel variant="2" size="sm">
            <Icon name={icons.upload} size="sm" />ارفع الملحق
            <input className="vis-h" type="file" aria-label="ارفع الملحق" onChange={(e) => {
              const x = e.target.files?.[0]
              if (x) onChange([...docs, { name: x.name, kind, at: new Date().toISOString().slice(0, 10), size: `${nf.format(Math.max(1, Math.round(x.size / 1024)))} ك.ب` }])
              e.target.value = ''
            }} />
          </ButtonLabel>
        </div>
      )}
    </Glass>
  )
}

/** The agreement's text · the template with the project's data in it (8.2.6) */
export function AgreementTextCard({ parts }: { parts: TextPart[] }) {
  return (
    <Glass>
      <Head title="نص الاتفاقية" meta={<span className="rowf gp-2"><Button type="button" variant="2" size="sm" onClick={() => window.print()}><Icon name={icons.doc} size="sm" />اطبع</Button></span>} />
      <div className="agr-body">
        {parts.map((s) => (
          <section key={s.h}>
            <h3>{s.h}</h3>
            <ul>{s.body.map((b, i) => <li key={i}>{isolate(b)}</li>)}</ul>
          </section>
        ))}
      </div>
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
              {h.add && onAdd && <Button type="button" variant="2" size="sm" onClick={() => onAdd({ ...h.add!, id: `cl-${stamp()}` })}>أضف البند</Button>}
              {h.template && onTemplate && <Button type="button" variant="2" size="sm" onClick={() => onTemplate(h.template!)}>اعتمد النموذج</Button>}
            </span>
          </li>
        ))}
      </ul>

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
  const finals = versions.filter((v) => v.final)
  const live = f.annexes.filter((x) => !x.superseded)
  const base = live.length ? [...finals].reverse().find((v) => !/ملحق/.test(v.reason)) : undefined
  return (
    <Glass>
      <Head title="الإصدارات والملاحق" meta={<span className="sub">الحالي <Num>{a.version}</Num>{f.inForce !== undefined && <> · النافذ {base ? <>الإصدار <Num>{base.version}</Num> مع <Num>{live.length}</Num> ملحق</> : <Num>{f.inForce}</Num>}</>}</span>} />
      {/* v3 · 8.3.29 · the original with its annexes is the reference in force */}
      {f.annexes.length > 0 && (
        <ul className="apv-list">
          {f.annexes.map((x) => (
            <li key={x.no}>
              <Tag tone={x.superseded ? 'mute' : 'ok'}>ملحق {nf.format(x.no)} · {x.kind === 'value' ? 'قيمة' : 'بنود'}{x.superseded ? ' · حلّ محله إصدار بديل' : ''}</Tag>
              <span className="apv-t">
                <b>{x.summary}</b>
                <span className="sub">{x.reason}{x.ref ? ` · ${x.ref}` : ''}{x.file ? ` · ${x.file}` : ''}</span>
              </span>
              <span className="pc-sp" />
              <Person name={x.by} />
              <span className="sub"><DateText>{x.at}</DateText></span>
            </li>
          ))}
        </ul>
      )}
      {versions.length === 0 ? (
        <p className="sub cnote">لا إصدارات مؤرشفة بعد.</p>
      ) : (
        <ul className="apv-list">
          {[...versions].map((v, i) => ({ v, i })).reverse().map(({ v, i }) => (
            <li key={`${v.version}-${i}`}>
              <span className="apv-t">
                <b>الإصدار {nf.format(v.version)} · {v.reason}</b>
                <span className="sub">{v.kind} · {v.template} · <Money sm>{v.amount}</Money> · <Num>{v.payments.length}</Num> دفعات · <Num>{v.clauses.length}</Num> بندًا</span>
              </span>
              <span className="pc-sp" />
              {v.returned ? <Tag tone="warn">نسخة عند الإعادة</Tag> : v.final && v.version === f.inForce ? <Tag tone="ok">نافذ</Tag> : null}
              <Person name={v.by} />
              <span className="sub"><DateText>{v.at}</DateText></span>
              <Button type="button" variant="2" size="sm" onClick={() => setOpen(open === i ? null : i)}>{open === i ? 'أخفِ' : 'اعرض'}</Button>
              {open === i && (
                <div className="agx-ver">
                  {v.payments.map((p) => <span key={p.no} className="sub">الدفعة {nf.format(p.no)} · {nf.format(p.amount)} · {p.dueAt} · {requirementOf(p)}</span>)}
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
          <span>{f.foundationSign ? <>اعتمدها ممثل المؤسسة · {f.foundationSign.by} · <DateText>{f.foundationSign.at}</DateText></> : 'اعتماد ممثل المؤسسة'}</span>
        </li>
      </ul>
    </Glass>
  )
}

/** The project tab's view · every agreement of the project, one in force at most (8.4.24 · 8.4.25) */
export function ProjectAgreements({ list, onAdditional, additionalBlock }: { list: AgreementRow[]; onAdditional?: () => void; additionalBlock?: string }) {
  return (
    <Glass>
      <Head title="اتفاقيات المشروع" meta={<span className="sub"><Num>{list.length}</Num> اتفاقية</span>} />
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
          <Button type="button" variant="2" size="sm" disabled={Boolean(additionalBlock)} title={additionalBlock || 'اتفاقية إضافية تحلّ محل السارية عند سريانها'} onClick={onAdditional}>
            <Icon name={icons.plus} size="sm" />اتفاقية إضافية
          </Button>

        </div>
      )}

    </Glass>
  )
}

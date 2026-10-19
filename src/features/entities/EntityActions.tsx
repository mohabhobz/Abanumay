import { accountLine, accountSay } from '@/data/shared/decisions'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DateField, DateText, Empty, FieldSelect, Glass, Head, Icon, KV, Mono, Num, Switch, Tag, icons } from '@/components/ui'
import { isTest, markTest, sysEnv } from '@/data/shared/testData'
import {
  ACT_SAY, REQ_SAY, accountOf, actState, archiveBlocks, bankLinks, forWho, impactOf, lastRequestOf, reasonOf, reasonText, type ActKey,
} from '@/data/entities/actions'
import { Modal, ReasonField } from './SelectionActions'
import { units } from '@/lib/format'
import { ROUTES } from '@/app/routes'
import { activationTone } from '@/lib/tone'
import type { EntityRow } from '@/types/domain'
import { BANK_REJECT_REASONS, entityDetail, type BankAccount } from '@/data/mock/entityDetail'
import { entityById } from '@/data/mock/entities'
import { REG_STATE_SAY } from '@/data/mock/registration'
import { meOf, readRole } from '@/data/roles'
import {
  ADMIN_EDIT_FIELDS, UPD_STATE_SAY, adminEditEntity, archiveEntity, canAdminEdit, deleteBank, expiredMandatory, isRegState, openUpdateOf, overlayOf,
  requestsOfEntity, setBankStatus, setEntityStatus, type UpdState,
} from '@/data/entities/store'

/* What can be done to an entity from its file · LOCTech «الإجراءات عند التحديد» §1 · §3 · §4.

   The eligibility decisions live here, never in the list: suspending, lifting, revoking and
   archiving sit in their own «إجراءات حساسة» card, because the one deciding has to see the entity's
   documents, projects and payments first · a slip in a dense list is the commonest wrong status
   change. Each one opens the impact panel, then asks for the license number typed back (§4
   «التأكيد المزدوج»), with a reason from its template and, where the template says so, the proof.
   Who may decide comes from settings (`data/entities/actions`); anyone else sees who does. */

type Sens = 'suspend' | 'lift' | 'revoke' | 'archive' | 'restore'
const SENS_TONE: Record<Sens, 'btn-p' | 'btn-2' | 'btn-d'> = { suspend: 'btn-2', lift: 'btn-p', revoke: 'btn-d', archive: 'btn-2', restore: 'btn-p' }
const SENS_SAY: Record<Sens, string> = { ...ACT_SAY, restore: 'استعد من الأرشيف' } as Record<Sens, string>

function ImpactPanel({ e, sens }: { e: EntityRow; sens: Sens }) {
  const i = impactOf(e)
  const req = lastRequestOf(e)
  const openReq = req && ['draft', 'review', 'completion'].includes(req.state) ? req : null
  const group = (label: string, rows: { id: string; name: string; stage: string }[]) => rows.length > 0 && (
    <details className="selres-g">
      <summary>{label} · <span className="num">{rows.length}</span></summary>
      <ul className="sub">{rows.map((p) => <li key={p.id}><Link className="lnk" to={ROUTES.project(p.id)}>{p.name}</Link> · {p.stage}</li>)}</ul>
    </details>
  )
  const none = !i.stopped.length && !i.study.length && !i.payments.length && !openReq
  return (
    <div className="selscope">
      <b>لوحة الأثر</b>
      {none && <span className="sub">لا مشاريع قائمة ولا دفعات معلّقة ولا طلبات مفتوحة.</span>}
      {group('استكمال متطلبات ما قبل التنفيذ', i.pre)}
      {group('تحت التنفيذ', i.running)}
      {group('قيد الإغلاق', i.closing)}
      {group('قيد الدراسة', i.study)}
      {i.payments.length > 0 && (
        <details className="selres-g">
          <summary>دفعات معلّقة{sens === 'archive' || sens === 'lift' ? '' : ' ستُوقف'} · <span className="num">{i.payments.length}</span></summary>
          <ul className="sub">{i.payments.map((x) => <li key={x.id}><Link className="lnk" to={ROUTES.payment(x.id)}><Mono>{x.id}</Mono></Link> · {x.project}</li>)}</ul>
        </details>
      )}
      {openReq && <span className="sub">طلب مفتوح <Link className="lnk" to={openReq.href}><Mono>{openReq.id}</Mono></Link> · {REQ_SAY[openReq.state]}</span>}
      {(sens === 'suspend' || sens === 'revoke') && i.owners.length > 0 && <span className="sub">يُشعَر المسؤولون عن المشاريع: {i.owners.join('، ')}</span>}
    </div>
  )
}

function SensModal({ e, sens, me, onClose }: { e: EntityRow; sens: Sens; me: string; onClose: () => void }) {
  const kind = sens === 'restore' ? 'archive' : sens
  const [step, setStep] = useState<1 | 2>(1)
  const [code, setCode] = useState('')
  const [text, setText] = useState('')
  const [decision, setDecision] = useState('')
  const [proof, setProof] = useState('')
  const [aware, setAware] = useState(false)
  const [typed, setTyped] = useState('')
  const i = impactOf(e)
  const tpl = reasonOf(kind, code)
  const reason = reasonText(kind, code, text)
  const needsProof = sens === 'suspend' || sens === 'revoke' || Boolean(tpl?.attach)
  const needsDecision = sens === 'suspend' || sens === 'revoke'
  const double = sens !== 'lift' && sens !== 'restore'
  const stops = sens === 'suspend' || sens === 'revoke' ? i.stopped.length : 0
  const step1 = Boolean(reason) && (!needsProof || proof) && (!needsDecision || decision.trim()) && (!stops || aware)
  const residual = sens === 'lift' ? [...new Set([...expiredMandatory(e), ...(entityDetail(e).licenseExpired ? ['الترخيص'] : [])])] : []
  const run = () => {
    const shown = tpl?.shown === false ? `${SENS_SAY[sens]} · السبب داخلي` : reason
    if (sens === 'archive') archiveEntity(e.id, true, reason, me, code)
    else if (sens === 'restore') archiveEntity(e.id, false, reason, me, code)
    else {
      const to = sens === 'lift' ? 'lift' : sens === 'revoke' ? 'revoked' : 'suspension'
      setEntityStatus(e.id, to, shown, me, {
        code, decision: decision.trim() || undefined, proof: proof || undefined,
        projects: sens === 'lift' ? undefined : i.stopped.map((p) => p.id),
        payments: sens === 'lift' ? undefined : i.payments.map((x) => x.id),
      })
    }
    onClose()
  }
  return (
    <Modal wide title={`${SENS_SAY[sens]} · ${e.name}`} onClose={onClose}
      foot={step === 1 ? (
        <>
          <button className={`btn ${SENS_TONE[sens]}`} disabled={!step1} onClick={() => (double ? setStep(2) : run())}>{double ? 'التالي · التأكيد' : SENS_SAY[sens]}</button>
          <button className="btn btn-2" onClick={onClose}>تراجع</button>
        </>
      ) : (
        <>
          <button className={`btn ${SENS_TONE[sens]}`} disabled={typed.trim() !== e.licenseNo} onClick={run}>{SENS_SAY[sens]}</button>
          <button className="btn btn-2" onClick={() => setStep(1)}>رجوع</button>
        </>
      )}>
      {step === 1 ? (
        <>
          {sens !== 'restore' && <ImpactPanel e={e} sens={sens} />}
          {sens === 'lift' && (
            <p className="sub cnote">{residual.length
              ? <>يبقى الحساب «غير نشط» بعد الرفع لمانع آخر: انتهاء {residual.join(' و')}.</>
              : <>يعود الحساب «نشطًا» بعد الرفع.</>}
              {overlayOf(e.id).statusReason ? <> · قرار التعليق الأصلي: {overlayOf(e.id).statusReason}</> : null}</p>
          )}
          <ReasonField kind={kind} code={code} text={text} onCode={setCode} onText={setText} />
          {needsDecision && (
            <label className="regf">
              <span className="lb">رقم القرار<b className="regf-r" aria-label="إلزامي">*</b></span>
              <span className="fld"><input value={decision} onChange={(x) => setDecision(x.target.value)} aria-label="رقم القرار" /></span>
            </label>
          )}
          <div className="regf">
            <span className="lb">{needsProof ? 'الإثبات' : 'مرفق'}{needsProof && <b className="regf-r" aria-label="إلزامي">*</b>}</span>
            <span className="apv-row">
              <label className="btn btn-2 btn-sm">
                <Icon name={icons.upload} size="sm" />{proof ? 'استبدل الملف' : 'ارفع الملف'}
                <input className="vis-h" type="file" aria-label="الإثبات" onChange={(x) => { const f = x.target.files?.[0]; if (f) setProof(f.name); x.target.value = '' }} />
              </label>
              {proof ? <Tag tone="ok">{proof}</Tag> : <span className="sub">لا ملف بعد</span>}
            </span>
          </div>
          {stops > 0 && (
            <label className="rowf gp-2">
              <input type="checkbox" checked={aware} onChange={(x) => setAware(x.target.checked)} />
              <span>أدرك أن دفعات {stops === 1 ? 'مشروع واحد' : units.project(stops, true)} ستُوقف</span>
            </label>
          )}
          {tpl && <p className="sub cnote">{tpl.shown ? 'يظهر السبب للجهة في بوابتها.' : 'سبب داخلي · لا يخرج من النظام.'}</p>}
        </>
      ) : (
        <>
          <p className="cnote">للتأكيد اكتب رقم ترخيص الجهة <Mono>{e.licenseNo}</Mono></p>
          <label className="regf">
            <span className="lb">رقم الترخيص</span>
            <span className="fld"><input autoFocus dir="ltr" inputMode="numeric" value={typed} onChange={(x) => setTyped(x.target.value)} aria-label="رقم الترخيص للتأكيد" /></span>
          </label>
          <p className="sub cnote">{sens === 'revoke' || sens === 'archive' ? 'يُعامَل هذا الإجراء كإجراء لا رجعة فيه حتى تحدّد المؤسسة آلية التراجع عنه.' : 'يُوقف التقديم والصرف حتى رفع التعليق.'}</p>
        </>
      )}
    </Modal>
  )
}

/** The entity's standing · its status, why, and the sensitive decisions that change it */
export function EntityStatusCard({ e }: { e: EntityRow }) {
  const role = readRole()
  const me = meOf(role)
  const [act, setAct] = useState<Sens | null>(null)
  const o = overlayOf(e.id)
  /* The file's own reading of its dates · the license on the row and the board mandate on the file */
  const det = entityDetail(e)
  const lapsed = [...new Set([...expiredMandatory(e), ...(det.licenseExpired ? ['الترخيص'] : []), ...(det.boardExpired ? ['قرار تكليف المجلس'] : [])])]
  const open = openUpdateOf(e.id)
  const acc = accountOf(e)
  const sens = (['suspend', 'lift', 'revoke', 'archive'] as Sens[]).map((k) => ({ k, s: actState(k as ActKey, e, role) })).filter((x) => x.s.show)
  const doable = sens.filter((x) => x.s.grant === 'do')
  const blocks = archiveBlocks(e)
  const restore = e.archived && role === 'admin'
  const [testOn, setTestOn] = useState(() => isTest('entity', e.id))

  return (
    <Glass>
      <Head title="حالة الجهة" meta={<Tag tone={activationTone(accountSay(e))}>{accountSay(e)}</Tag>} />
      <KV rows={[
        { k: 'حالة الحساب', v: accountLine(e) },
        { k: 'صلاحية التقديم', v: e.canApply ? <Tag tone="ok">مفعّلة</Tag> : <Tag tone="mute">موقوفة</Tag> },
        ...(lapsed.length ? [{ k: 'وثائق منتهية', v: <span className="bad">{lapsed.join('، ')} · الحساب «غير نشط» تلقائيًا حتى التحديث</span> }] : []),
        ...(open ? [{ k: 'طلب تحديث', v: <Link className="lnk" to={ROUTES.entityUpdateReview(open.id)}><Mono>{open.id}</Mono> · {UPD_STATE_SAY[open.state]}</Link> }] : []),
        ...(o.statusReason ? [{ k: 'سبب آخر قرار', v: o.statusReason }] : []),
      ]} />

      {(sens.length > 0 || restore) && (
        <div className="sensbox mt-3">
          <b className="sensbox-t">إجراءات حساسة</b>
          {doable.length > 0 || restore ? (
            <div className="rowf gp-2">
              {doable.map(({ k, s }) => (
                <button key={k} className={`btn btn-sm ${SENS_TONE[k]}`} disabled={!s.on} title={s.why} onClick={() => setAct(k)}>{SENS_SAY[k]}</button>
              ))}
              {restore && <button className="btn btn-sm btn-p" onClick={() => setAct('restore')}>{SENS_SAY.restore}</button>}
            </div>
          ) : null}
          {sens.filter((x) => x.s.grant === 'see').map(({ k }) => (
            <p key={k} className="sub cnote">{SENS_SAY[k]} {forWho(k as ActKey)}.</p>
          ))}
          {doable.some((x) => x.k === 'archive' && !x.s.on) && blocks.length > 0 && (
            <details className="selres-g">
              <summary>ما يمنع الأرشفة · <span className="num">{blocks.length}</span></summary>
              <ul className="sub">{blocks.map((b) => <li key={b.label}><Link className="lnk" to={b.href}>{b.label}</Link></li>)}</ul>
            </details>
          )}
          {acc.block === 'revoked' && <p className="sub cnote">إعادة جهة أُلغي اعتمادها بانتظار قرار المؤسسة · أم يلزمها طلب تسجيل جديد؟</p>}
        </div>
      )}
      {role === 'admin' && (
        /* v3 · 2.4.35 · the admin flags a record as test data · logged · in production it leaves the
           reports, the KPIs, the impact board and the exports */
        <div className="mt-3">
          <Switch
            label="بيانات تجريبية"
            note={sysEnv() === 'prod' ? 'مفعّل: الجهة ومشاريعها خارج التقارير والمؤشرات ولوحة الأثر والتصدير، وتُعلَّم «تجريبي» في القوائم · ويمكن أرشفتها بلا قيود' : 'النظام في بيئة «اختبار» · تظهر البيانات التجريبية كغيرها'}
            on={testOn}
            onChange={(v) => { markTest('entity', e.id, v, me, role); setTestOn(isTest('entity', e.id)) }}
          />
        </div>
      )}
      {act && <SensModal e={e} sens={act} me={me} onClose={() => setAct(null)} />}
    </Glass>
  )
}

const TONE_OF = (s: string): 'ok' | 'no' | 'warn' | 'ret' | 'mute' =>
  s === 'approved' ? 'ok' : s === 'rejected' ? 'no' : s === 'review' ? 'warn' : s === 'completion' ? 'ret' : 'mute'

/** 2.4.1 · the entity and its requests are separate records · each request has its own history */
export function EntityRequestsTab({ e }: { e: EntityRow }) {
  const rows = requestsOfEntity(e.id).sort((a, b) => b.at.localeCompare(a.at))
  if (rows.length === 0) {
    return (
      <Glass>
        <Empty title="لا طلبات مسجّلة لهذه الجهة." note="سُجّلت الجهة قبل بوابة التسجيل · وتظهر هنا طلبات التحديث التي ترسلها من بوابتها." />
      </Glass>
    )
  }
  return (
    <Glass>
      <Head title="طلبات الجهة" meta={<span className="sub"><Num>{rows.length}</Num> طلب</span>} />
      <ul className="eprq">
        {rows.map((r) => (
          <li key={r.id}>
            <Link className="eprq-r well" to={r.kind === 'reg' ? ROUTES.entityRequest(r.id) : ROUTES.entityUpdateReview(r.id)}>
              <Icon name={r.kind === 'reg' ? icons.doc : icons.edit} size="sm" />
              <span className="eprq-b">
                <b>{r.title}</b>
                <span className="sub"><Mono>{r.id}</Mono> · <DateText>{r.at}</DateText></span>
              </span>
              <span className="pc-sp" />
              <Tag tone={TONE_OF(r.state)}>{isRegState(r.state) && r.kind === 'reg' ? REG_STATE_SAY[r.state] : UPD_STATE_SAY[r.state as UpdState]}</Tag>
            </Link>
          </li>
        ))}
      </ul>
    </Glass>
  )
}

/** One account's decision · disable with a coded reason, activate (2.4.27) · or delete one with no
    financial history, behind the same double confirmation (rule 28 · LOCTech §4) */
export function BankActions({ entityId, b }: { entityId: string; b: BankAccount }) {
  const role = readRole()
  const me = meOf(role)
  const [why, setWhy] = useState('')
  const [del, setDel] = useState(false)
  const e = entityById(entityId)
  if (!e) return null
  const st = actState('banks', e, role)
  if (st.grant !== 'do') return null
  if (!st.on) return <p className="sub cnote mt-3">{st.why}</p>
  const links = bankLinks(e, b.id)
  const linked = links.length > 0
  const delBtn = (
    <button className="btn btn-2 btn-sm" disabled={linked} title={linked ? `له تاريخ مالي · ${links.length} طلب صرف (${links.slice(0, 3).join('، ')}) · عطّل الحساب بدلًا من حذفه` : 'لا تاريخ مالي على هذا الحساب'} onClick={() => setDel(true)}>
      <Icon name={icons.trash} size="sm" /> احذف
    </button>
  )
  return (
    <>
      {b.status === 'مفعل' ? (
        <div className="rowf gp-2 mt-3">
          <FieldSelect value={why} options={BANK_REJECT_REASONS} onChange={setWhy} label={`سبب تعطيل ${b.bank}`} placeholder="سبب التعطيل" />
          <button className="btn btn-2 btn-sm" disabled={!why} onClick={() => setBankStatus(entityId, b.id, 'غير مفعل', me, why)}>عطّل الحساب</button>
          {delBtn}
        </div>
      ) : (
        <div className="rowf gp-2 mt-3">
          <button className="btn btn-p btn-sm" onClick={() => setBankStatus(entityId, b.id, 'مفعل', me)}>
            <Icon name={icons.check} size="sm" /> فعّل الحساب
          </button>
          {delBtn}
        </div>
      )}
      {del && <BankDelete e={e} b={b} me={me} onClose={() => setDel(false)} />}
    </>
  )
}

function BankDelete({ e, b, me, onClose }: { e: EntityRow; b: BankAccount; me: string; onClose: () => void }) {
  const [code, setCode] = useState('')
  const [text, setText] = useState('')
  const [typed, setTyped] = useState('')
  const reason = reasonText('bank', code, text)
  return (
    <Modal title={`حذف الحساب · ${b.bank}`} onClose={onClose}
      foot={<>
        <button className="btn btn-d" disabled={!reason || typed.trim() !== e.licenseNo} onClick={() => { deleteBank(e.id, b.id, reason, me); onClose() }}>احذف نهائيًا</button>
        <button className="btn btn-2" onClick={onClose}>تراجع</button>
      </>}>
      <p className="sub cnote">الحساب <Mono>{b.iban.slice(0, 4)}…{b.iban.slice(-4)}</Mono> بلا أي ارتباط مالي · الحذف لا رجعة فيه.</p>
      <ReasonField kind="bank" code={code} text={text} onCode={setCode} onText={setText} />
      <label className="regf">
        <span className="lb">اكتب رقم الترخيص <Mono>{e.licenseNo}</Mono> للتأكيد</span>
        <span className="fld"><input dir="ltr" inputMode="numeric" value={typed} onChange={(x) => setTyped(x.target.value)} aria-label="رقم الترخيص للتأكيد" /></span>
      </label>
    </Modal>
  )
}

/* Client 19 Oct · the system admin corrects the entity's file directly (name, classification, licence
   number, governance score, dates, contacts) · no request back to the entity and no «معلق» · logged on
   the file and in the audit log. The guard on a document close to its expiry belongs to the entity's
   own update request · here it's a note, never a refusal. */
export function AdminEditCard({ e }: { e: EntityRow }) {
  const role = readRole()
  const d = entityDetail(e)
  const current = (k: string): string => {
    const row = e as unknown as Record<string, unknown>
    const det = d as unknown as Record<string, unknown>
    const v = k === 'boardEndsAt' ? d.boardMandateEndsAt : row[k] ?? det[k]
    return v == null ? '' : String(v)
  }
  const [open, setOpen] = useState(false)
  const [vals, setVals] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  if (!canAdminEdit(role) || e.external) return null
  const today = new Date().toISOString().slice(0, 10)
  const left = (at: string) => Math.round((Date.parse(at) - Date.parse(today)) / 86_400_000)
  const near = [
    { name: 'الترخيص', at: e.licenseEndsAt },
    { name: 'قرار تكليف المجلس', at: d.boardMandateEndsAt },
  ].filter((x) => x.at && left(x.at) >= 0 && left(x.at) <= 30)
  const changes = ADMIN_EDIT_FIELDS.filter((f) => vals[f.key] !== undefined && vals[f.key] !== current(f.key))
    .map((f) => ({ key: f.key, from: current(f.key), to: vals[f.key]! }))
  const save = () => {
    const out = adminEditEntity(e.id, changes, reason, meOf(role), role)
    if (out.length) { setSaid({ bad: out }); return }
    setSaid({ ok: `حُفظ التعديل · ${changes.length} حقول` })
    setVals({}); setReason(''); setOpen(false)
  }
  return (
    <Glass>
      <Head title="تعديل مباشر لبيانات الجهة" meta={<Tag tone="teal">مدير النظام</Tag>} />
      <p className="sub cnote">يُطبَّق التعديل فورًا دون إعادة الطلب للجهة · يُسجَّل في سجل الجهة وسجل التدقيق وتُبلَّغ الجهة.</p>
      {near.length > 0 && <p className="sub cnote">{near.map((x) => `باقي على انتهاء ${x.name} ${left(x.at)} يومًا`).join(' · ')} · لا يمنع ذلك التعديل المباشر</p>}
      {!open ? (
        <div className="apv-row mt-2"><button type="button" className="btn btn-2" onClick={() => { setOpen(true); setSaid({}) }}>عدّل البيانات</button></div>
      ) : (
        <>
          <div className="regfields mt-3">
            {ADMIN_EDIT_FIELDS.map((f) => (
              <label key={f.key} className="regf">
                <span className="lb">{f.label}</span>
                {f.kind === 'date'
                  ? <DateField label={f.label} value={vals[f.key] ?? current(f.key)} onChange={(v) => setVals((x) => ({ ...x, [f.key]: v }))} />
                  : <span className="fld"><input value={vals[f.key] ?? current(f.key)} aria-label={f.label} dir={['email', 'url', 'tel', 'digits'].includes(f.kind) ? 'ltr' : undefined}
                      onChange={(ev) => setVals((x) => ({ ...x, [f.key]: ev.target.value }))} /></span>}
              </label>
            ))}
          </div>
          <div className="apv-row mt-3">
            <span className="fld"><input value={reason} onChange={(ev) => setReason(ev.target.value)} aria-label="سبب التعديل" placeholder="سبب التعديل (اختياري)" /></span>
            <button type="button" className="btn btn-p" disabled={!changes.length} onClick={save}>احفظ التعديل{changes.length ? <> · <Num>{changes.length}</Num></> : null}</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setOpen(false); setVals({}) }}>إلغاء</button>
          </div>
        </>
      )}
      {said.ok && <p className="sub cnote">{said.ok}</p>}
      {said.bad && <p className="bad cnote">{said.bad.join(' · ')}</p>}
    </Glass>
  )
}

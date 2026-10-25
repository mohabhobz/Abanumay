import { accountWhy } from '@/data/shared/decisions'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { DateText, Empty, FieldSelect, Glass, Head, Icon, KV, Mono, Num, Person, Switch, Tag, icons } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'
import { ibanValid } from '@/lib/iban'
import { ibanOwner } from '@/data/entities/validate'
import { BANKS } from '@/data/mock/taxonomy'
import { pickedSay } from '@/data/entities/reasons'
import { ReasonDialog } from './ReasonDialog'
import { isTest, markTest, sysEnv } from '@/data/shared/testData'
import {
  ACT_SAY, REQ_SAY, accountOf, actState, archiveBlocks, bankLinks, forWho, impactOf, lastRequestOf, reasonOf, reasonText, type ActKey,
} from '@/data/entities/actions'
import { Modal, ReasonField } from './SelectionActions'
import { units } from '@/lib/format'
import { ROUTES } from '@/app/routes'
import type { EntityRow } from '@/types/domain'
import { entityDetail, type BankAccount } from '@/data/mock/entityDetail'
import { entityById } from '@/data/mock/entities'
import { REG_STATE_SAY } from '@/data/mock/registration'
import { meOf, readRole } from '@/data/roles'
import {
  UPD_STATE_SAY, addBank, archiveEntity, deleteBank, expiredMandatory, isRegState, openUpdateOf, overlayOf,
  requestsOfEntity, setBankStatus, setEntityStatus, useEntityFlow, type UpdState,
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

/** The entity's standing · why it stands where it does · its status tag sits beside the name in the
    page header (client 23 Oct), and the decisions that change it sit in the page's action bar */
export function EntityStatusCard({ e }: { e: EntityRow }) {
  const role = readRole()
  const me = meOf(role)
  const o = overlayOf(e.id)
  /* The file's own reading of its dates · the license on the row and the board mandate on the file */
  const det = entityDetail(e)
  const lapsed = [...new Set([...expiredMandatory(e), ...(det.licenseExpired ? ['الترخيص'] : []), ...(det.boardExpired ? ['قرار تكليف المجلس'] : [])])]
  const open = openUpdateOf(e.id)
  const acc = accountOf(e)
  const why = accountWhy(e)
  const [testOn, setTestOn] = useState(() => isTest('entity', e.id))

  return (
    <Glass>
      <Head title="حالة الجهة" />
      <KV rows={[
        ...(why ? [{ k: 'سبب الحالة', v: why }] : []),
        { k: 'صلاحية التقديم', v: e.canApply ? <Tag tone="ok">مفعّلة</Tag> : <Tag tone="mute">موقوفة</Tag> },
        ...(lapsed.length ? [{ k: 'وثائق منتهية', v: <span className="bad">{lapsed.join('، ')} · الحساب «غير نشط» تلقائيًا حتى التحديث</span> }] : []),
        ...(open ? [{ k: 'طلب تحديث', v: <Link className="lnk" to={ROUTES.entityUpdateReview(open.id)}><Mono>{open.id}</Mono> · {UPD_STATE_SAY[open.state]}</Link> }] : []),
        ...(o.statusReason ? [{ k: 'سبب آخر قرار', v: o.statusReason }] : []),
      ]} />
      {/* Whoever may not decide sees who does · the decisions themselves sit in the action bar */}
      {(['suspend', 'lift', 'revoke', 'archive', 'deactivate', 'activate'] as ActKey[]).filter((k) => { const x = actState(k, e, role); return x.show && x.grant === 'see' }).map((k) => (
        <p key={k} className="sub cnote">{ACT_SAY[k]} {forWho(k)}.</p>
      ))}
      {acc.block === 'revoked' && <p className="sub cnote">إعادة جهة أُلغي اعتمادها بانتظار قرار المؤسسة · أم يلزمها طلب تسجيل جديد؟</p>}
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
    </Glass>
  )
}

/* Client 23 Oct · the eligibility decisions in the page's action bar, the same bar every detail page
   decides from · each one still opens the impact panel and the double confirmation (`SensModal`).
   Archiving with something still holding the entity (an open project, a pending payment) doesn't
   run · it opens the list of what prevents it. Who may decide comes from settings; anyone else
   sees none of the buttons. */
export function EntityActionDock({ e }: { e: EntityRow }) {
  useEntityFlow()
  const role = readRole()
  const me = meOf(role)
  const bar = useRef<HTMLDivElement>(null)
  useProximity(bar)
  const [act, setAct] = useState<Sens | null>(null)
  const [blocked, setBlocked] = useState(false)
  const doable = (['suspend', 'lift', 'revoke', 'archive'] as Sens[]).map((k) => ({ k, s: actState(k as ActKey, e, role) })).filter((x) => x.s.show && x.s.grant === 'do')
  const blocks = archiveBlocks(e)
  const restore = Boolean(e.archived) && role === 'admin'
  /* Client sheet 24 Oct (#102) · the account's status by hand · whoever holds «تعديل حالة الجهة» */
  const [flip, setFlip] = useState<'deactivate' | 'activate' | null>(null)
  const status = (['deactivate', 'activate'] as const).map((k) => ({ k, s: actState(k, e, role) })).filter((x) => x.s.show && x.s.grant === 'do')
  if (!doable.length && !restore && !status.length) return null
  const pick = (k: Sens, on: boolean) => {
    if (k === 'archive' && !on && blocks.length) { setBlocked(true); return }
    setAct(k)
  }
  return (
    <div className="decdock">
      <div className="chrome decbar payact" ref={bar}>
        <div className="rowf gp-3 payact-w">
          <Person name={me} size="lg" quiet={false} />
          <span className="decsent">
            قرارات الأهلية والأرشفة · <b>{e.name}</b>
          </span>
        </div>
        <div className="payact-g">
          <div className="rowf gp-2">
            {doable.map(({ k, s }) => (
              <button key={k} type="button" className={`btn ${SENS_TONE[k]}`}
                disabled={!s.on && !(k === 'archive' && blocks.length > 0)}
                title={k === 'archive' && !s.on && blocks.length ? 'ما يمنع الأرشفة' : s.why}
                onClick={() => pick(k, s.on)}>
                {SENS_SAY[k]}
              </button>
            ))}
            {status.map(({ k, s }) => (
              <button key={k} type="button" className={`btn ${k === 'activate' ? 'btn-p' : 'btn-2'}`} disabled={!s.on} title={s.why} onClick={() => setFlip(k)}>
                {ACT_SAY[k]}
              </button>
            ))}
            {restore && <button type="button" className="btn btn-p" onClick={() => setAct('restore')}>{SENS_SAY.restore}</button>}
          </div>
        </div>
      </div>
      {act && <SensModal e={e} sens={act} me={me} onClose={() => setAct(null)} />}
      {flip && (() => {
        const i = impactOf(e)
        const off = flip === 'deactivate'
        const lapsed = off ? [] : expiredMandatory(e)
        return (
          <ReasonDialog kind={off ? 'statusOff' : 'statusOn'} tone={off ? 'btn-d' : 'btn-p'}
            title={`${ACT_SAY[flip]} · ${e.name}`}
            subject={off
              ? `يتوقف التقديم والصرف ما دامت الجهة «غير نشط» · ${i.stopped.length ? `دفعات ${units.project(i.stopped.length, true)} تتوقف` : 'لا مشاريع قائمة تتأثر'} · وتُبلَّغ الجهة`
              : lapsed.length ? `يبقى الحساب «غير نشط» بعد الإعادة لانتهاء ${lapsed.join(' و')}` : 'يعود الحساب «نشطًا» ويُستأنف التقديم والصرف · وتُبلَّغ الجهة'}
            confirm={ACT_SAY[flip]} onClose={() => setFlip(null)}
            onConfirm={(p) => {
              setEntityStatus(e.id, off ? 'inactive' : 'lift', pickedSay(p), me, off
                ? { code: 'تعديل الحالة', projects: i.stopped.map((x) => x.id), payments: i.payments.map((x) => x.id) }
                : { code: 'تعديل الحالة' })
              setFlip(null)
            }} />
        )
      })()}
      {blocked && (
        <Modal title={`ما يمنع أرشفة ${e.name}`} icon={icons.folder} onClose={() => setBlocked(false)}
          foot={<button type="button" className="btn btn-2" onClick={() => setBlocked(false)}>حسنًا</button>}>
          <p className="sub cnote">لا تُؤرشف الجهة وعليها ارتباط قائم · أنهِ ما يلي أولًا ثم أعد المحاولة.</p>
          <ul className="payq-ck">
            {blocks.map((b) => (
              <li key={b.label}>
                <Icon name={icons.lock} size="sm" />
                <Link className="lnk" to={b.href} onClick={() => setBlocked(false)}>{b.label}</Link>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
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

/** One account's decision · disable or delete with a reason from the entity settings (client 23 Oct ·
    the same dialog as a rejected request), activate (2.4.27) · deleting needs no financial history
    (rule 28) */
export function BankActions({ entityId, b }: { entityId: string; b: BankAccount }) {
  const role = readRole()
  const me = meOf(role)
  const [ask, setAsk] = useState<'disable' | 'delete' | null>(null)
  const e = entityById(entityId)
  if (!e) return null
  const st = actState('banks', e, role)
  if (st.grant !== 'do') return null
  if (!st.on) return <p className="sub cnote mt-3">{st.why}</p>
  const links = bankLinks(e, b.id)
  const taken = b.status !== 'مفعل' ? ibanOwner(b.iban, entityId) : undefined
  const linked = links.length > 0
  const tail = `${b.iban.replace(/\s/g, '').slice(0, 4)}…${b.iban.replace(/\s/g, '').slice(-4)}`
  return (
    <>
      <div className="rowf gp-2 mt-3">
        {b.status === 'مفعل' ? (
          <button type="button" className="btn btn-2 btn-sm" onClick={() => setAsk('disable')}>عطّل الحساب</button>
        ) : (
          <button type="button" className="btn btn-p btn-sm" disabled={Boolean(taken)} title={taken ? `الآيبان مفعّل لجهة أخرى · ${taken} · لا يُفعَّل لجهتين` : undefined} onClick={() => setBankStatus(entityId, b.id, 'مفعل', me)}>
            <Icon name={icons.check} size="sm" /> فعّل الحساب
          </button>
        )}
        <button type="button" className="btn btn-2 btn-sm" disabled={linked} title={linked ? `مسجَّل في مشروع أو له تاريخ مالي · ${links.slice(0, 3).join('، ')}${links.length > 3 ? ` +${links.length - 3}` : ''} · عطّل الحساب بدلًا من حذفه` : 'غير مسجَّل في أي مشروع ولا تاريخ مالي عليه'} onClick={() => setAsk('delete')}>
          <Icon name={icons.trash} size="sm" /> احذف
        </button>
      </div>
      {ask === 'disable' && (
        <ReasonDialog kind="bankDisable" title={`تعطيل الحساب · ${b.bank}`} subject={`${b.accountName} · ${tail} · لا يُصرف عليه حتى يُفعَّل من جديد.`}
          confirm="عطّل الحساب" onClose={() => setAsk(null)}
          onConfirm={(p) => { setBankStatus(entityId, b.id, 'غير مفعل', me, pickedSay(p)); setAsk(null) }} />
      )}
      {ask === 'delete' && (
        <ReasonDialog kind="bankDelete" title={`حذف الحساب · ${b.bank}`} subject={`${b.accountName} · ${tail} · غير مسجَّل في مشروع ولا ارتباط مالي عليه · الحذف لا رجعة فيه.`}
          confirm="احذف نهائيًا" onClose={() => setAsk(null)}
          onConfirm={(p) => { deleteBank(entityId, b.id, pickedSay(p), me); setAsk(null) }} />
      )}
    </>
  )
}

/** Client 23 Oct · the staff add an account from inside the system · bank, account name, IBAN and its
    certificate · active the moment it's saved, and logged on the entity's file */
export function AddBank({ entityId }: { entityId: string }) {
  const role = readRole()
  const me = meOf(role)
  const [open, setOpen] = useState(false)
  const [bank, setBank] = useState('')
  const [name, setName] = useState('')
  const [iban, setIban] = useState('')
  const [file, setFile] = useState('')
  const [tried, setTried] = useState(false)
  const e = entityById(entityId)
  if (!e) return null
  /* Client 24 Oct · open to every staff role for now · the client sets who may add from the
     permissions matrix later («إدارة الحسابات البنكية») */
  const clean = iban.replace(/\s/g, '').toUpperCase()
  const dup = entityDetail(e).banks.some((x) => x.iban.replace(/\s/g, '').toUpperCase() === clean)
  const other = ibanValid(clean) ? ibanOwner(clean, entityId) : undefined
  const issues = [
    ...(!bank ? ['اختر البنك'] : []),
    ...(!name.trim() ? ['اكتب اسم الحساب'] : []),
    ...(!ibanValid(clean) ? ['الآيبان غير صحيح · SA ثم 22 رقمًا'] : []),
    ...(dup ? ['الآيبان مسجّل لهذه الجهة'] : []),
    /* #101 · an IBAN active on another entity isn't added a second time */
    ...(!dup && other ? [`الآيبان مفعّل لجهة أخرى · ${other}`] : []),
    ...(!file ? ['أرفق شهادة الآيبان'] : []),
  ]
  const close = () => { setOpen(false); setBank(''); setName(''); setIban(''); setFile(''); setTried(false) }
  const save = () => {
    setTried(true)
    if (issues.length) return
    addBank(entityId, {
      id: `${entityId}-s${Date.now().toString(36)}`, bank, shortName: bank, accountName: name.trim(),
      iban: clean.replace(/(.{4})/g, '$1 ').trim(), status: 'مفعل', certificate: file,
    }, me)
    close()
  }
  return (
    <>
      <div className="act-a"><button type="button" className="btn btn-p" onClick={() => setOpen(true)}><Icon name={icons.plus} size="sm" /> إضافة حساب بنكي</button></div>
      {open && (
        <Modal title={`إضافة حساب بنكي · ${e.name}`} icon={icons.pay} onClose={close}
          foot={<>
            <button type="button" className="btn btn-p" onClick={save}>احفظ الحساب</button>
            <button type="button" className="btn btn-2" onClick={close}>تراجع</button>
          </>}>
          <div className="regf">
            <span className="lb">اسم البنك<b className="regf-r" aria-label="إلزامي">*</b></span>
            <FieldSelect value={bank} options={BANKS} onChange={setBank} label="اسم البنك" placeholder="اختر البنك" />
          </div>
          <label className="regf">
            <span className="lb">اسم الحساب<b className="regf-r" aria-label="إلزامي">*</b></span>
            <span className="fld"><input value={name} onChange={(x) => setName(x.target.value)} aria-label="اسم الحساب" placeholder="كما في شهادة الآيبان" /></span>
          </label>
          <label className="regf">
            <span className="lb">الآيبان<b className="regf-r" aria-label="إلزامي">*</b></span>
            <span className="fld"><input dir="ltr" value={iban} onChange={(x) => setIban(x.target.value)} aria-label="الآيبان" placeholder="SA00 0000 0000 0000 0000 0000" /></span>
          </label>
          <div className="regf">
            <span className="lb">شهادة الآيبان<b className="regf-r" aria-label="إلزامي">*</b></span>
            <span className="apv-row">
              <label className="btn btn-2 btn-sm">
                <Icon name={icons.upload} size="sm" />{file ? 'استبدل الملف' : 'ارفع الملف'}
                <input className="vis-h" type="file" accept=".pdf,.jpg,.png" aria-label="شهادة الآيبان" onChange={(x) => { const f = x.target.files?.[0]; if (f) setFile(f.name); x.target.value = '' }} />
              </label>
              {file ? <Tag tone="ok">{file}</Tag> : <span className="sub">لا ملف بعد</span>}
            </span>
          </div>
          {tried && issues.length > 0 && <p className="bad cnote">{issues.join(' · ')}</p>}
          <p className="sub cnote">يُفعَّل الحساب فور الحفظ ويُسجَّل في سجل الجهة باسمك.</p>
        </Modal>
      )}
    </>
  )
}


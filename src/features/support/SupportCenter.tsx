/* 27 Nov · مركز الدعم · one popup, opened from the rail («الدعم والبلاغات»), the account menu, or
   an error's own message («أبلغ عن هذه المشكلة»).

   Built from Abanumay's own pieces only, the same as every other popup in the system:
   · the system's `Modal` (`modal-w`) · `ModalHead`, the `.mb` body, the `.mf` footer
   · `Tabs` for «بلاغ جديد» / «بلاغاتي»
   · `FormField` + `FieldBox` for every field, `cfgchip` radio chips for every single choice,
     `FieldSelect` for the page picked from the recent ones, `UploadButton` for pictures, the
     thread's file chips for what is attached
   · `KV` for what is sent with the report, `CopyId` for its number, `Empty` for the empty list
   · `fchip` filters and the `apv-list` rows for «بلاغاتي», `Tag` for the state, `Steps` (stepper)
     for the path, the record thread's `.msg` bubbles and the system `Composer` for the reply

   The flow: kind → where → the kind's questions → pictures → send · every missing field said under
   it at once, a summary toast · a draft kept when the popup closes · «إلغاء» on a filled form asks. */

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Composer } from '@/components/assistant'
import { UploadButton } from '@/components/docs/UploadButton'
import {
  BackTo, Button, CopyId, Empty, Face, FieldBox, FieldSelect, FormField, Icon, icons, KV, Modal, ModalHead, Steps, Tabs, Tag, type StepItem,
} from '@/components/ui'
import { toast } from '@/data/feedback'
import { roleByKey, readRole } from '@/data/roles'
import { isEntitySession } from '@/data/session'
import { useRole } from '@/hooks/useRole'
import {
  canReopen, closed, confirmFixed, IMPACT_SAY, KIND_LONG, KIND_SAY, markRead, notFixed, onSupport, pageHere, PATH,
  recentPages, reopen, replyTo, stateOf, submitReport, useReports, WHO_SAY,
  type Approval, type Audience, type Impact, type Report, type ReportImage, type ReportKind, type ReportPage, type SupportOpen,
} from '@/data/support'

type Where = 'here' | 'other' | 'none'
interface Draft {
  kind: ReportKind
  where: Where
  otherPath: string
  what: string; expect: string; impact?: Impact
  want: string; need: string; who?: Audience; approval?: Approval; approvedBy: string
  ask: string; details: string
  shot: boolean
  images: ReportImage[]
  code?: string
}
const EMPTY: Draft = { kind: 'bug', where: 'here', otherPath: '', what: '', expect: '', want: '', need: '', approvedBy: '', ask: '', details: '', shot: true, images: [] }
/* The draft outlives the popup · closing it never loses what was typed */
let kept: Draft = EMPTY
let keptPage: ReportPage | null = null
const dirty = (d: Draft) => Boolean(d.what || d.expect || d.want || d.need || d.ask || d.details || d.images.length || d.approvedBy)

const fmtAgo = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (m < 1) return 'الآن'
  if (m < 60) return m === 1 ? 'قبل دقيقة' : m === 2 ? 'قبل دقيقتين' : m <= 10 ? `قبل ${m} دقائق` : `قبل ${m} دقيقة`
  const h = Math.round(m / 60)
  if (h < 24) return h === 1 ? 'قبل ساعة' : h === 2 ? 'قبل ساعتين' : h <= 10 ? `قبل ${h} ساعات` : `قبل ${h} ساعة`
  if (Math.round(h / 24) === 1) return 'أمس'
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long' }).format(new Date(iso))
}
const fmtAt = (iso: string) => new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))

/** A row of single-choice chips · the system's `cfgchip`, as the transfer and decision popups use */
function Choice<T extends string>({ value, options, onPick, label }: { value?: T; options: { key: T; label: string }[]; onPick: (k: T) => void; label: string }) {
  return (
    <div className="cfgchips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <Button plain key={o.key} type="button" role="radio" aria-checked={value === o.key} className={`cfgchip${value === o.key ? ' on' : ''}`} onClick={() => onPick(o.key)}>
          {o.label}
        </Button>
      ))}
    </div>
  )
}

/** The report's kind · three of the system's choice chips grown into cards: the system's radio at
    the corner, the kind's icon, its name */
function KindCards({ value, onPick }: { value: ReportKind; onPick: (k: ReportKind) => void }) {
  const opts: { key: ReportKind; icon: keyof typeof icons }[] = [{ key: 'bug', icon: 'alert' }, { key: 'change', icon: 'edit' }, { key: 'question', icon: 'question' }]
  return (
    <div className="sup-kinds" role="radiogroup" aria-label="نوع البلاغ">
      {opts.map((o) => (
        <label key={o.key} className={`cfgchip sup-kind${value === o.key ? ' on' : ''}`}>
          <input type="radio" name="sup-kind" checked={value === o.key} onChange={() => onPick(o.key)} />
          <Icon name={icons[o.icon]} />
          <span>{KIND_LONG[o.key]}</span>
        </label>
      ))}
    </div>
  )
}

/** Where it happened · one list in the system's field frame, a row per place with the system's radio */
function WhereList({ name, value, options, onPick }: { name: string; value: string; options: { key: Where; label: string; note?: ReactNode; disabled?: boolean; extra?: ReactNode }[]; onPick: (k: Where) => void }) {
  return (
    <div className="sup-where" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <div key={o.key} className={`sup-where-r${value === o.key ? ' on' : ''}${o.disabled ? ' off' : ''}`}>
          <label>
            <input type="radio" name="sup-where" checked={value === o.key} disabled={o.disabled} onChange={() => onPick(o.key)} />
            <span><b>{o.label}</b>{o.note && <small className="sub">{o.note}</small>}</span>
          </label>
          {value === o.key && o.extra}
        </div>
      ))}
    </div>
  )
}

/* The popup's footer sits under the scrolling body, never inside it · each view sends its actions there */
const FootSlot = createContext<HTMLDivElement | null>(null)
function Foot({ children }: { children: ReactNode }) {
  const el = useContext(FootSlot)
  return el ? createPortal(children, el) : null
}

export function SupportCenter() {
  const [open, setOpen] = useState<(SupportOpen & { n: number }) | null>(null)
  useEffect(() => onSupport((o) => {
    /* Started from an error · a fault report on this page, its message and code already in */
    if (o.error) { kept = { ...EMPTY, kind: 'bug', what: `ظهرت رسالة «${o.error.text}».`, code: o.error.code }; keptPage = null }
    /* each opening starts on what it asked for, even over an open popup */
    setOpen((v) => ({ ...o, n: (v?.n ?? 0) + 1 }))
  }), [])
  if (!open) return null
  return <SupportModal key={open.n} start={open} onClose={() => setOpen(null)} />
}

function SupportModal({ start, onClose }: { start: SupportOpen; onClose: () => void }) {
  const { user } = useRole()
  const reports = useReports(user.name)
  const [tab, setTab] = useState<'new' | 'mine'>(start.report || start.mine ? 'mine' : 'new')
  const [openId, setOpenId] = useState<string | undefined>(start.report)
  const [sent, setSent] = useState<Report | null>(null)
  const unread = reports.filter((r) => r.unread).length
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)

  return (
    <FootSlot.Provider value={slot}>
    <Modal label="مركز الدعم" onClose={onClose} escape className="modal-w sup">
      <ModalHead icon={icons.support} title="مركز الدعم">
        <span className="sub sup-by">الدعم الفني مقدّم من LOCTech</span>
      </ModalHead>
      <div className="sup-tabs">
        <Tabs
          pin={false}
          items={[{ slug: 'new', label: 'بلاغ جديد' }, { slug: 'mine', label: unread ? `بلاغاتي · ${unread} ${unread === 1 ? 'رد جديد' : 'ردود جديدة'}` : 'بلاغاتي', count: reports.length }]}
          active={tab}
          onChange={(x) => { setSent(null); setOpenId(undefined); setTab(x as 'new' | 'mine') }}
        />
      </div>
      <div className="mb col sup-b">
        {tab === 'new'
          ? sent ? <Sent r={sent} /> : <NewReport onSent={setSent} onCancel={onClose} />
          : openId ? <ReportView id={openId} onBack={() => setOpenId(undefined)} onClose={onClose} />
            : <MyReports reports={reports} onOpen={setOpenId} onNew={() => setTab('new')} />}
      </div>
      {tab === 'new' && sent && (
        <Foot>
          <Button variant="p" onClick={() => { setTab('mine'); setOpenId(sent.id); setSent(null) }}>تابع البلاغ</Button>
          <Button variant="2" onClick={() => setSent(null)}>بلاغ جديد</Button>
          <Button variant="2" onClick={onClose}>إغلاق</Button>
        </Foot>
      )}
      <div className="mf sup-mf" ref={setSlot} />
    </Modal>
    </FootSlot.Provider>
  )
}

/* ---------------- a new report ---------------- */

const IMPACTS: Impact[] = ['blocked', 'major', 'workaround', 'none']

function NewReport({ onSent, onCancel }: { onSent: (r: Report) => void; onCancel: () => void }) {
  const { user } = useRole()
  const [d, setD] = useState<Draft>(kept)
  const [page] = useState<ReportPage>(() => keptPage ?? pageHere())
  const recent = useMemo(() => recentPages(), [])
  const [tried, setTried] = useState(false)
  const [asking, setAsking] = useState(false)
  const form = useRef<HTMLDivElement>(null)
  const set = (x: Partial<Draft>) => setD((v) => ({ ...v, ...x }))
  useEffect(() => { kept = d; keptPage = page }, [d, page])

  const errs: Record<string, string> = {}
  if (d.where === 'other' && !d.otherPath) errs.where = 'اختر الصفحة'
  if (d.kind === 'bug') {
    if (!d.what.trim()) errs.what = 'اكتب ما حدث'
    if (!d.impact) errs.impact = 'اختر أثر المشكلة على عملك'
  } else if (d.kind === 'change') {
    if (!d.want.trim()) errs.want = 'اكتب ما تريد تعديله أو إضافته'
    if (!d.need.trim()) errs.need = 'اذكر الحاجة إليه'
    if (!d.who) errs.who = 'اختر من يستفيد منه'
    if (!d.approval) errs.approval = 'اختر حالة الموافقة'
    else if (d.approval === 'yes' && !d.approvedBy.trim()) errs.approvedBy = 'اكتب من وافق عليه'
  } else if (!d.ask.trim()) errs.ask = 'اكتب سؤالك'
  const shown = tried ? errs : {}

  const where: ReportPage | undefined = d.where === 'here' ? page : d.where === 'other' ? recent.find((p) => p.path === d.otherPath) : undefined
  const role = roleByKey(readRole())
  const metaRows = [
    { k: 'الصفحة', v: where?.label ?? 'غير محددة' },
    { k: 'الرابط', v: <span className="mono">{where?.path ?? '—'}</span> },
    { k: 'المستخدم', v: `${user.name} · ${isEntitySession() ? 'جهة' : role.title}` },
    { k: 'الوقت', v: new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()) },
    { k: 'الشاشة والمتصفح', v: <span className="num">{window.innerWidth} × {window.innerHeight} · {/Edg\//.test(navigator.userAgent) ? 'Edge' : /Chrome\//.test(navigator.userAgent) ? 'Chrome' : /Safari\//.test(navigator.userAgent) ? 'Safari' : /Firefox\//.test(navigator.userAgent) ? 'Firefox' : '—'}</span> },
    ...(d.code ? [{ k: 'رمز الخطأ', v: <span className="mono">{d.code}</span> }] : []),
  ]

  const send = () => {
    setTried(true)
    const n = Object.keys(errs).length
    if (n) {
      toast(n === 1 ? 'أكمل حقلًا واحدًا قبل الإرسال' : `أكمل ${n} حقول قبل الإرسال`, 'warn')
      window.setTimeout(() => {
        const first = form.current?.querySelector<HTMLElement>('.has-err')
        first?.querySelector<HTMLElement>('input, textarea, button')?.focus({ preventScroll: true })
        const box = form.current?.closest<HTMLElement>('.mb')
        if (box && first) box.scrollTo({ top: box.scrollTop + first.getBoundingClientRect().top - box.getBoundingClientRect().top - 16, behavior: 'smooth' })
      }, 30)
      return
    }
    const text = d.kind === 'bug' ? d.what : d.kind === 'change' ? d.want : d.ask
    const title = d.code && d.kind === 'bug'
      ? `${d.what.replace(/^ظهرت رسالة «|»\.?$/g, '').slice(0, 50)}${where ? ` في ${where.label.split(' › ').pop()}` : ''}`
      : text.split(/[.،\n]/)[0].trim().slice(0, 60)
    const r = submitReport({
      kind: d.kind, title, page: where, code: d.code,
      what: d.kind === 'bug' ? d.what.trim() : undefined, expect: d.kind === 'bug' ? d.expect.trim() || undefined : undefined, impact: d.kind === 'bug' ? d.impact : undefined,
      want: d.kind === 'change' ? d.want.trim() : undefined, need: d.kind === 'change' ? d.need.trim() : undefined,
      who: d.kind === 'change' ? d.who : undefined, approval: d.kind === 'change' ? d.approval : undefined, approvedBy: d.approval === 'yes' ? d.approvedBy.trim() : undefined,
      ask: d.kind === 'question' ? [d.ask.trim(), d.details.trim()].filter(Boolean).join('\n') : undefined,
      images: d.images, shot: d.shot, meta: Object.fromEntries(metaRows.map((m) => [m.k, typeof m.v === 'string' ? m.v : ''])), by: user.name,
    })
    kept = EMPTY; keptPage = null
    onSent(r)
  }
  const cancel = () => {
    if (dirty(d)) { setAsking(true); return }
    kept = EMPTY; keptPage = null
    onCancel()
  }
  const addImages = (files: File[]) => {
    const room = 5 - d.images.length
    if (files.length > room) toast('خمس صور على الأكثر في البلاغ', 'warn')
    set({ images: [...d.images, ...files.slice(0, Math.max(0, room)).map((f) => ({ name: f.name, url: URL.createObjectURL(f) }))] })
  }
  const whereQ = d.kind === 'bug' ? 'أين حدثت المشكلة؟' : d.kind === 'change' ? 'بأي صفحة يتعلق طلبك؟' : 'بأي صفحة يتعلق سؤالك؟'

  return (
    <>
      <div className="col sup-form" ref={form}>
        {d.code && <p className="sub cnote"><Icon name={icons.alert} size="sm" /> بدأ البلاغ من رسالة خطأ · رمزها <span className="mono">{d.code}</span> يُرسل معه.</p>}
        <div className="regfields">
          <FormField label="نوع البلاغ" required as="div" wide>
            <KindCards value={d.kind} onPick={(k) => { setTried(false); set({ kind: k, where: d.where === 'none' && k === 'bug' ? 'here' : d.where }) }} />
          </FormField>

          <FormField label={whereQ} required as="div" wide error={shown.where}>
            <WhereList name={whereQ} value={d.where} onPick={(k) => set({ where: k, otherPath: k === 'other' ? d.otherPath || recent[0]?.path || '' : d.otherPath })}
              options={[
                { key: 'here', label: 'هذه الصفحة', note: <>{page.label}{page.trail && <> · <span className="num">{page.trail}</span></>}</> },
                { key: 'other', label: 'صفحة أخرى فتحتها قبل قليل', note: recent.length ? undefined : 'لم تفتح صفحة أخرى في هذه الجلسة', disabled: !recent.length,
                  extra: recent.length > 0 ? <div className="sup-where-x"><FieldSelect label="الصفحة" value={d.otherPath} onChange={(x) => set({ otherPath: x ?? '' })} options={recent.map((p) => ({ value: p.path, label: p.label }))} /></div> : undefined },
                { key: 'none', label: d.kind === 'bug' ? 'غير متأكد' : 'لا يتعلق بصفحة بعينها', note: d.kind === 'bug' ? 'اذكر في الوصف ما تتذكره عن المكان' : undefined },
              ]} />
          </FormField>

          {d.kind === 'bug' && (
            <>
              <FormField label="ماذا حدث؟" required wide error={shown.what}>
                <FieldBox area><textarea rows={3} value={d.what} onChange={(e) => set({ what: e.target.value })} aria-label="ماذا حدث؟" placeholder="ضغطت «حفظ التقييم» فظهرت رسالة «تعذّر الحفظ»، ولم تُحفظ الدرجات." /></FieldBox>
                <span className="sub regf-h">اذكر ما فعلته وما ظهر لك</span>
              </FormField>
              <FormField label="ما النتيجة التي توقعتها؟" wide>
                <FieldBox><input value={d.expect} onChange={(e) => set({ expect: e.target.value })} aria-label="النتيجة المتوقعة" placeholder="اختياري · أن تُحفظ الدرجات وأنتقل إلى التوصية" /></FieldBox>
              </FormField>
              <FormField label="ما أثر المشكلة على عملك؟" required as="div" wide error={shown.impact}>
                <Choice label="أثر المشكلة" value={d.impact} onPick={(k) => set({ impact: k })} options={IMPACTS.map((k) => ({ key: k, label: IMPACT_SAY[k] }))} />
              </FormField>
            </>
          )}

          {d.kind === 'change' && (
            <>
              <FormField label="ما الذي تريد تعديله أو إضافته؟" required wide error={shown.want}>
                <FieldBox area><textarea rows={3} value={d.want} onChange={(e) => set({ want: e.target.value })} aria-label="ما الذي تريد تعديله أو إضافته" placeholder="قائمة الجهات تعرض اسم الجهة ومنطقتها فقط. أحتاج فيها عمودًا للمدينة." /></FieldBox>
                <span className="sub regf-h">صف الوضع الحالي، ثم ما تريد أن يصير</span>
              </FormField>
              <FormField label="ما الحاجة إليه؟" required wide error={shown.need}>
                <FieldBox area><textarea rows={3} value={d.need} onChange={(e) => set({ need: e.target.value })} aria-label="ما الحاجة إليه" placeholder="أوزّع زيارات المشرفين بحسب المدينة كل أسبوع." /></FieldBox>
                <span className="sub regf-h">مثال من عملك يوضح ما يحلّه</span>
              </FormField>
              <FormField label="من يستفيد منه؟" required as="div" wide error={shown.who}>
                <Choice label="من يستفيد منه" value={d.who} onPick={(k) => set({ who: k })} options={(['me', 'team', 'all'] as Audience[]).map((k) => ({ key: k, label: WHO_SAY[k] }))} />
              </FormField>
              <FormField label="هل وافق عليه صاحب الصلاحية في المؤسسة؟" required as="div" wide error={shown.approval}>
                <Choice label="موافقة صاحب الصلاحية" value={d.approval} onPick={(k) => set({ approval: k })}
                  options={[{ key: 'yes', label: 'نعم، وافق عليه' }, { key: 'not-yet', label: 'لم يُعرض عليه بعد' }, { key: 'me', label: 'أنا صاحب الصلاحية' }]} />
              </FormField>
              {d.approval === 'yes' && (
                <FormField label="من وافق؟" required wide error={shown.approvedBy}>
                  <FieldBox><input value={d.approvedBy} onChange={(e) => set({ approvedBy: e.target.value })} aria-label="من وافق" placeholder="الاسم والوظيفة · عبدالله، مدير المنح" /></FieldBox>
                </FormField>
              )}
            </>
          )}

          {d.kind === 'question' && (
            <>
              <FormField label="سؤالك" required wide error={shown.ask}>
                <FieldBox area><textarea rows={3} value={d.ask} onChange={(e) => set({ ask: e.target.value })} aria-label="سؤالك" placeholder="كيف أعيد مشروعًا إلى المشرف ليستكمل الدراسة؟" /></FieldBox>
              </FormField>
              <FormField label="تفاصيل تساعدنا على الإجابة" wide>
                <FieldBox area><textarea rows={2} value={d.details} onChange={(e) => set({ details: e.target.value })} aria-label="تفاصيل" placeholder="اختياري · ما الذي جربته، وأين توقفت" /></FieldBox>
              </FormField>
            </>
          )}

          <FormField label="المرفقات" as="div" wide>
            <div className="sup-att">
            <div className="msg-files">
              {d.shot && (
                <span className="msg-file">
                  <Icon name={icons.image} size="sm" /><span className="msg-file-n">صورة الشاشة</span><span className="sub">تُرفق تلقائيًا</span>
                  <Button plain type="button" className="iact" aria-label="أزل صورة الشاشة" onClick={() => set({ shot: false })}><Icon name={icons.close} size="sm" /></Button>
                </span>
              )}
              {d.images.map((im, i) => (
                <span className="msg-file" key={im.url}>
                  <Icon name={icons.image} size="sm" /><span className="msg-file-n">{im.name}</span>
                  <Button plain type="button" className="iact" aria-label={`أزل ${im.name}`} onClick={() => set({ images: d.images.filter((_, j) => j !== i) })}><Icon name={icons.close} size="sm" /></Button>
                </span>
              ))}
            </div>
            <span className="rowf gp-2">
              {d.images.length < 5 && <UploadButton label="أضف صورة للبلاغ" text="أضف صورة" accept=".png,.jpg,.jpeg,.gif,.webp" maxMb={5} onPick={(f) => addImages([f])} onPickMany={addImages} />}
              {!d.shot && <Button variant="ghost" size="sm" onClick={() => set({ shot: true })}>أعد إرفاق صورة الشاشة</Button>}
            </span>
            <span className="sub regf-h">صور فقط · حتى خمس صور، 5 ميجابايت للصورة</span>
            </div>
          </FormField>
        </div>

        <details className="sup-meta">
          <summary className="sub"><Icon name={icons.shield} size="sm" /> معلومات تُرسل تلقائيًا مع بلاغك</summary>
          <KV rows={metaRows} />
        </details>
        {d.kind === 'change' && <p className="sub cnote">طلبات التعديل تُدرس قبل تنفيذها، ونعود إليك هنا بنتيجة الدراسة.</p>}
      </div>

      <Foot>
        {asking ? (
          <>
            <span className="sup-ask">تجاهل ما كتبته في البلاغ؟</span>
            <Button variant="d" onClick={() => { kept = EMPTY; keptPage = null; onCancel() }}>تجاهل البلاغ</Button>
            <Button variant="2" autoFocus onClick={() => setAsking(false)}>ابقَ في البلاغ</Button>
          </>
        ) : (
          <>
            <Button variant="p" onClick={send}>إرسال البلاغ</Button>
            <Button variant="2" onClick={cancel}>إلغاء</Button>
          </>
        )}
      </Foot>
    </>
  )
}

/* ---------------- sent ---------------- */

function Sent({ r }: { r: Report }) {
  const next = r.kind === 'question'
    ? ['نقرأ سؤالك ونرد عليك هنا، عادة خلال يوم عمل.', 'يظهر كل رد جديد على أيقونة الدعم في القائمة.']
    : r.kind === 'change'
      ? ['ندرس طلبك ونحدد إن كان سيُنفّذ ومتى.', 'نرد عليك هنا بنتيجة الدراسة، ويظهر كل رد جديد على أيقونة الدعم.', 'حين يُنفّذ نخبرك لتجربته.']
      : ['نراجع بلاغك ونحدد أولويته.', 'نرد عليك هنا، ويظهر كل رد جديد على أيقونة الدعم في القائمة.', 'حين يجهز الإصلاح نطلب منك تجربته وتأكيد الحل.']
  return (
    <div className="col">
      <Empty icon={icons.checks} title={`استلمنا ${r.kind === 'question' ? 'سؤالك' : r.kind === 'change' ? 'طلبك' : 'بلاغك'}`} note="تجده وحالته في «بلاغاتي» متى شئت." />
      <KV rows={[{ k: 'رقم البلاغ', v: <CopyId>{r.id}</CopyId> }, { k: 'النوع', v: KIND_LONG[r.kind] }, ...(r.page ? [{ k: 'الصفحة', v: r.page.label }] : [])]} />
      <Steps flow="ladder" items={next.map((t, i) => ({ label: t, state: i === 0 ? 'now' : 'todo' }))} />
    </div>
  )
}

/* ---------------- my reports ---------------- */

type Filter = 'all' | 'open' | 'waiting' | 'closed'
function MyReports({ reports, onOpen, onNew }: { reports: Report[]; onOpen: (id: string) => void; onNew: () => void }) {
  const [f, setF] = useState<Filter>('all')
  const pass = (r: Report) => f === 'all' || (f === 'closed' ? closed(r) : f === 'waiting' ? Boolean(r.waiting) && !closed(r) : !closed(r))
  const n = { all: reports.length, open: reports.filter((r) => !closed(r)).length, waiting: reports.filter((r) => r.waiting && !closed(r)).length, closed: reports.filter(closed).length }
  const rows = [...reports].sort((a, b) => (b.unread - a.unread) || b.at.localeCompare(a.at)).filter(pass)
  if (!reports.length) {
    return <Empty icon={icons.support} title="لا بلاغات بعد" note="حين تبلّغ عن خلل أو تطلب تعديلًا أو تسأل، تجده هنا وتتابع حالته والردود عليه." actions={<Button variant="p" onClick={onNew}>بلاغ جديد</Button>} />
  }
  return (
    <div className="col">
      <div className="rowf gp-2 wrap" role="group" aria-label="تصفية البلاغات">
        {([['all', 'الكل'], ['open', 'مفتوحة'], ['waiting', 'بانتظار ردك'], ['closed', 'منتهية']] as const).map(([k, l]) => (
          <Button plain key={k} type="button" className={`fchip${f === k ? ' on' : ''}`} aria-pressed={f === k} onClick={() => setF(k)}>{l} <b className="num">{n[k]}</b></Button>
        ))}
      </div>
      {rows.length === 0 ? (
        <Empty title="لا بلاغات في هذا التصنيف." actions={<Button variant="2" onClick={() => setF('all')}>اعرض الكل</Button>} />
      ) : (
        <ul className="apv-list sup-list">
          {rows.map((r) => {
            const s = stateOf(r)
            return (
              <li key={r.id}>
                <Button plain type="button" className="sup-row" onClick={() => onOpen(r.id)}>
                  <span className="apv-t">
                    <b>{r.unread > 0 && <span className="sup-dot" aria-label="رد جديد" />}{r.title}</b>
                    <span className="sub"><span className="mono">{r.id}</span> · {KIND_SAY[r.kind]}{r.page && <> · {r.page.label.split(' › ')[0]}</>} · {fmtAgo(r.msgs[r.msgs.length - 1]?.at ?? r.at)}</span>
                  </span>
                  <span className="pc-sp" />
                  <Tag tone={s.tone}>{s.label}</Tag>
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ---------------- one report ---------------- */

function ReportView({ id, onBack, onClose }: { id: string; onBack: () => void; onClose: () => void }) {
  const { user } = useRole()
  const navigate = useNavigate()
  const r = useReports(user.name).find((x) => x.id === id)
  const [reply, setReply] = useState('')
  const [mode, setMode] = useState<'reply' | 'notfixed' | 'reopen'>('reply')
  const [files, setFiles] = useState<string[]>([])
  useEffect(() => { markRead(id) }, [id, r?.unread])

  if (!r) return <><BackTo label="بلاغاتي" onClick={onBack} /><Empty icon={icons.support} title={`لم نجد البلاغ ${id}`} /></>
  const s = stateOf(r)
  const path = PATH[r.kind]
  const at = r.stage === 'declined' ? 2 : Math.max(0, path.findIndex((x) => x.key === r.stage))
  const steps: StepItem[] = path.map((x, i) => ({
    label: r.stage === 'declined' && i === 2 ? 'اعتُذر عنه' : x.label,
    state: r.stage === 'declined' && i === 2 ? 'no' : i < at || (i === at && closed(r)) ? 'done' : i === at ? 'now' : 'todo',
  }))
  const isClosed = closed(r)

  const send = (text: string) => {
    const t = text.trim()
    if (!t) { toast(mode === 'notfixed' ? 'اكتب ما الذي ما زال يحدث' : 'اكتب ردّك أولًا', 'warn'); return }
    if (mode === 'notfixed') { notFixed(r.id, t); toast('أُعيد البلاغ للإصلاح', 'ok') }
    else if (mode === 'reopen') { reopen(r.id, t); toast('أُعيد فتح البلاغ', 'ok') }
    else { replyTo(r.id, t, files); toast('أُرسل ردّك إلى فريق الدعم', 'ok') }
    setReply(''); setFiles([]); setMode('reply')
  }

  return (
    <div className="col">
      <BackTo label="بلاغاتي" onClick={onBack} />
      <header className="sup-oneh">
        <div>
          <h3 className="sup-onet">{r.title}</h3>
          <p className="sub"><span className="mono">{r.id}</span> · {KIND_LONG[r.kind]}{r.page && <> · {r.page.label}</>}{r.priority && <> · الأولوية {r.priority}</>}{r.code && <> · <span className="mono">{r.code}</span></>}</p>
        </div>
        <Tag tone={s.tone}>{s.label}</Tag>
      </header>

      <Steps items={steps} flow="stepper" />

      {r.waiting && !isClosed && <p className="bad cnote" role="alert"><b>نحتاج ردّك لنكمل:</b> {r.waiting}</p>}

      {r.stage === 'test' && (
        <div className="sup-fix col">
          <b className="sup-fixt">أصلحناه، جرّبه وأخبرنا</b>
          {r.fixNote && <p className="sub">ما تغيّر: {r.fixNote}</p>}
          {r.fixTo && <Button variant="ghost" size="sm" onClick={() => { onClose(); navigate(r.fixTo!) }}><Icon name={icons.link} size="sm" />افتح {r.page?.trail ?? 'الصفحة'} للتجربة</Button>}
          <span className="rowf gp-2">
            <Button variant="p" onClick={() => { confirmFixed(r.id); toast('شكرًا · أُغلق البلاغ', 'ok') }}>تم الحل</Button>
            <Button variant="2" onClick={() => setMode('notfixed')}>ما زالت المشكلة</Button>
          </span>
          <p className="sub">إن لم نرَ ردًّا خلال 5 أيام عمل نعدّ المشكلة محلولة ونخبرك، وتستطيع إعادة فتح البلاغ متى شئت.</p>
        </div>
      )}

      <div className="thread sup-thread">
        {r.msgs.map((m, i) => m.from === 'system' ? (
          <p key={i} className="sub tcen">{m.text} · {fmtAgo(m.at)}</p>
        ) : (
          <div key={i} className={`sup-mrow ${m.from === 'me' ? 'me' : 'them'}`}>
            {/* each side with its own picture · mine starts the line (the right), the team's ends it */}
            <Face name={m.from === 'me' ? user.name : 'فريق الدعم'} size="md" />
            <div className={`msg ${m.from === 'me' ? 'staff mine' : 'entity'}`}>
              <div className="msg-h">
                <span className="msg-by">{m.from === 'me' ? 'أنت' : 'فريق الدعم'}</span>
                {m.from !== 'me' && <span className="msg-role">LOCTech</span>}
                <span className="msg-at sub">{fmtAt(m.at)}</span>
              </div>
              <div className="msg-b">{m.text}</div>
              {m.images && m.images.length > 0 && (
                <div className="msg-files">{m.images.map((n) => <span key={n} className="msg-file"><Icon name={icons.image} size="sm" /><span className="msg-file-n">{n}</span></span>)}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {!isClosed || mode === 'reopen' ? (
        <div className="col">
          {mode !== 'reply' && (
            <p className="sub cnote">{mode === 'notfixed' ? 'اكتب ما الذي ما زال يحدث، ويعود البلاغ للإصلاح.' : 'اكتب لماذا تعيد فتح البلاغ.'} <Button plain className="lnk" onClick={() => setMode('reply')}>تراجع</Button></p>
          )}
          {files.length > 0 && (
            <div className="msg-files msg-pending">
              {files.map((n, j) => (
                <span className="msg-file" key={`${n}-${j}`}><Icon name={icons.image} size="sm" /><span className="msg-file-n">{n}</span>
                  <Button plain type="button" className="iact" aria-label={`أزل ${n}`} onClick={() => setFiles((xs) => xs.filter((_, k) => k !== j))}><Icon name={icons.close} size="sm" /></Button>
                </span>
              ))}
            </div>
          )}
          <Composer value={reply} onChange={setReply} onSend={send} onStop={() => {}} busy={false}
            placeholder={mode === 'notfixed' ? 'جرّبت مرة أخرى وما زال…' : mode === 'reopen' ? 'عادت المشكلة حين…' : 'اكتب ردّك على فريق الدعم'}
            onAttach={(f) => setFiles((xs) => [...xs, f.name])} canSend={files.length > 0} />
        </div>
      ) : (
        <p className="sub cnote">
          {r.stage === 'declined' ? 'اعتُذر عن هذا الطلب · أُغلق.' : r.stage === 'answered' ? 'أُجيب سؤالك · إن احتجت المزيد ابدأ بلاغًا جديدًا.' : canReopen(r) ? 'أُغلق البلاغ · تستطيع إعادة فتحه خلال 5 أيام.' : 'أُغلق البلاغ.'}
          {canReopen(r) && <> <Button plain className="lnk" onClick={() => setMode('reopen')}>أعد فتح البلاغ</Button></>}
        </p>
      )}
    </div>
  )
}

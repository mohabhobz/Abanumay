import type { Reading } from '@/components/assistant/reading'
import { PAY_LIMIT, payHeat, payStateWho } from '@/data/mock/disbursements'
import { grantLeft, payStops, type PayAct } from '@/data/payments/store'
import { CASE_KIND_SAY, recoveryLeft, stopPhase } from '@/data/closing/store'
import { nf } from '@/lib/format'
import { planOfProject } from '@/data/mock/plans'
import { projectRows } from '@/data/mock/projects'
import type { CaseRow, PayRequest } from '@/types/domain'

/* The assistant's readings on one record · the pages that didn't have an assistant column before
   (client, 5 Oct: every record page keeps the assistant alone in its end column).

   Same contract as every reading in the system: computed from the data the page shows, with its
   number, its source, and advisory only — the assistant names what blocks or what's off, it
   never approves. */

const FORWARD: Partial<Record<PayRequest['state'], PayAct>> = { supervisor: 'recommend', manager: 'approve', finance: 'order' }

/** A disbursement request · what stops the next exit, the grant left, the stage's clock, the reports' analysis */
export function readPayRequest(r: PayRequest): Reading[] {
  const out: Reading[] = []
  const act = r.state === 'finance' && r.order ? 'transfer' : FORWARD[r.state]
  const stops = act ? payStops(r, act) : []
  if (stops.length) {
    out.push({
      id: 'pr-stop', kind: 'flag', label: 'يمنع الإحالة',
      metric: { value: String(stops.length), unit: stops.length === 1 ? 'مانع' : 'موانع' },
      text: `${stops.slice(0, 2).join(' · ')}${stops.length > 2 ? ' وغيرها' : ''}.`,
      src: 'ضوابط الصرف · القواعد 3 و6 و9 و10 و11 و14',
    })
  }
  if (r.state !== 'paid' && r.state !== 'closed') {
    const left = grantLeft(r.projectId, r.id)
    out.push({
      id: 'pr-left', kind: r.asked > left ? 'flag' : 'note', label: 'المتبقي من المنحة',
      metric: { value: nf.format(Math.max(0, left)), unit: 'ريال' },
      text: r.asked > left ? `الطلب ${nf.format(r.asked)} يتجاوز المتبقي · تمنعه القاعدة 14.` : `بعد هذه الدفعة يبقى ${nf.format(left - r.asked)} من ${nf.format(r.granted)}.`,
      src: 'قيمة المنحة ناقص المصروف · قاعدة 14',
      bar: { value: r.granted - left + r.asked, limit: r.granted, valueLabel: 'بعد الصرف', limitLabel: 'المنحة', unit: 'ريال' },
    })
    /* Batch 7 · payments#13 · achievement against the plan, from the plan itself · the activities due
       by this payment's date and those accepted, and the beneficiaries the entity reported reached ·
       reading the reports' contents stays for the backend */
    const plan = planOfProject(r.projectId)
    if (plan) {
      const acts = plan.phases.flatMap((ph) => ph.activities)
      const due = acts.filter((a) => a.to && a.to <= r.dueAt)
      const okDue = due.filter((a) => a.state === 'accepted').length
      const reached = acts.reduce((n, a) => n + (a.actual?.reached ?? 0), 0)
      const target = projectRows.find((x) => x.id === r.projectId)?.beneficiaries ?? 0
      out.push({
        id: 'pr-plan', kind: due.length && okDue < due.length ? 'flag' : 'note', label: 'الإنجاز مقابل الخطة',
        metric: { value: `${okDue}/${due.length}`, unit: 'نشاطًا مستحقًا' },
        text: `${due.length ? `قُبل ${okDue} من ${due.length} نشاطًا مستحقًا حتى موعد الدفعة` : 'لا نشاط مستحق حتى موعد الدفعة'}${reached ? ` · المستفيدون المُبلَّغ عنهم ${nf.format(reached)}${target ? ` من ${nf.format(target)}` : ''}` : ''}.`,
        src: 'خطة المشروع · بيانات تنفيذ الأنشطة',
      })
    }
    const heat = payHeat(r)
    const lim = PAY_LIMIT[r.state]
    if (heat !== 'ok' && lim) {
      out.push({
        id: 'pr-late', kind: 'flag', label: heat === 'stuck' ? 'متعثّر في محطته' : 'متأخر عن حدّ محطته',
        metric: { value: String(Math.round(r.hoursInState / 24)), unit: 'يومًا' },
        text: `عند ${payStateWho(r.state)} · وحدّ المحطة ${Math.round(lim / 24)} أيام.`,
        src: 'آلية التصعيد 9.5 · حدود مؤقتة',
      })
    }
  }
  if (r.ai) out.push({ id: 'pr-ai', kind: 'note', label: 'تحليل التقارير', text: r.ai, src: 'خطوة 6 · استرشادي (قاعدة 20)' })
  if (r.exceptions?.length) out.push({ id: 'pr-ex', kind: 'note', label: 'استثناءات مسجّلة', metric: { value: String(r.exceptions.length), unit: 'قيد' }, text: r.exceptions.map((x) => x.text).join(' · '), src: '9.1.input-6' })
  return out
}

/** A distress case · where the stop lands, the settlement, what's left to recover */
export function readCase(c: CaseRow): Reading[] {
  const out: Reading[] = []
  if (c.kind === 'stop') {
    const ph = stopPhase(c.projectId)
    out.push({ id: 'cs-phase', kind: 'note', label: 'موضع الإيقاف', text: ph.say, src: '10.9.1 – 10.9.4' })
    if (c.settlement && c.settlement.actual == null) {
      const miss = [!c.settlement.report && 'تقرير التنفيذ', !c.settlement.invoices && 'الفواتير'].filter(Boolean)
      out.push({ id: 'cs-settle', kind: 'flag', label: 'التسوية', text: miss.length ? `بانتظار الجهة: ${miss.join(' و')}.` : 'وصل التقرير والفواتير · يعتمد المشرف المصروف الفعلي.', src: '10.9.3' })
    }
  }
  if (c.kind !== 'stop' && c.newAmount !== undefined) {
    const diff = c.newAmount - c.granted
    out.push({ id: 'cs-val', kind: 'note', label: CASE_KIND_SAY[c.kind], metric: { value: nf.format(Math.abs(diff)), unit: 'ريال' }, text: `من ${nf.format(c.granted)} إلى ${nf.format(c.newAmount)} · والمصروف ${nf.format(c.paid)}.`, src: c.kind === 'reduce' ? '10.9.5' : '10.9.6' })
  }
  if (c.recovery) {
    const left = recoveryLeft(c.recovery)
    out.push({ id: 'cs-rec', kind: left > 0 ? 'flag' : 'note', label: 'الاسترداد', metric: { value: nf.format(left), unit: 'ريال متبقٍّ' }, text: `من ${nf.format(c.recovery.due)} مطالَب بها · ${c.recovery.receipts.length} عملية استلام.`, src: '10.9.8', bar: { value: c.recovery.due - left, limit: c.recovery.due, valueLabel: 'المستلم', limitLabel: 'المطالَب', unit: 'ريال' } })
  }
  return out
}

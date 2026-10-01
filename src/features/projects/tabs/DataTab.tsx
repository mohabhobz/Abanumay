import { Link } from 'react-router-dom'
import { DateText, Glass, Head, KV, Money, Mono, Num, Riyal, Stat, Tag, Timeline } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { DocList } from '@/components/docs'
import { addDays, costPerBeneficiary, countOf, isolate, nf, NOUN, nounAfter, pct, readDate, units } from '@/lib/format'
import type { Project, ProjectType } from '@/types/domain'
import type { LogEvent } from '@/data/mock/log'
import { projectDeps } from '@/data/mock/settings'
import type { ChainLink } from '@/data/mock/chain'

export interface DataTabProps {
  project: Project
  /** Display code · the same `prj-YYYY-NNNNN` the projects list shows */
  code: string
  /** Regular, external, or portfolio */
  type: ProjectType
  entityName: string
  /** Entity ID — needed for a real link to its file. */
  entityId: string
  /** Most recent log entry — shown under the summary. */
  last?: LogEvent
  onOpenLog: () => void
  /**
   * Dependencies.
   *
   * This card isn't an error message, it's an inventory. The chain year →
   * budget → project → agreement and payments blocks deletion from the top
   * down, and that rule used to be enforced only on the first two links.
   * There's no delete button here at all, so the card states what's still
   * pending on this project — which surfaces the reason before anyone tries,
   * while also showing the chain.
   */
  deps?: { agreements: number; payments: number }
  /** Chain links — computed on the page and displayed here. */
  chain?: ChainLink[]
}

/** Project data — summary, concept, phases, scope, and attachments. */
export function DataTab({
  project: P, code, type, entityName, entityId, last, onOpenLog, deps, chain,
}: DataTabProps) {
  const dep = deps ? projectDeps(deps.agreements, deps.payments) : undefined
  const gaps = chain?.filter((l) => l.state === 'gap').length ?? 0
  const perBeneficiary = costPerBeneficiary(P.amountRequested, P.beneficiaries)
  const uploaded = P.attachments.filter((a) => a.uploaded).length

  return (
    <>
      <Glass>
        <Head title="التعريف" meta="10 حقول" />
        <KV
          rows={[
            /* Two mistakes in one line.

               1. It used to link to the "Entity" tab inside the project — which is a
               summary of the entity, not its full file. The full file was needed, and
               the entity's own tabs (documents, accounts, its log) don't exist in that
               summary at all.

               2. `<a onClick>` with no `href` isn't a link: it doesn't open in a new tab,
               can't be copied, and can't be reached by keyboard — it looks like a link
               but behaves like a button. */
            {
              k: 'الجهة',
              v: <Link className="tlink" to={ROUTES.entity(entityId)}>{entityName}</Link>,
            },
            { k: 'رقم المشروع', v: <Mono>{code}</Mono> },
            { k: 'نوع المشروع', v: type },
            { k: 'الحالة', v: <Tag tone={P.status.tone}>{P.status.label}</Tag> },
            { k: 'المسار', v: P.track },
            { k: 'المجال', v: P.field },
            { k: 'الهدف', v: P.goal },
            /* The two dates sit side by side: "330 days" alone doesn't say when it ends,
               and the end date is what determines whether the project crosses the
               fiscal year. The agreement's duration starts from the first payment
               disbursed. */
            { k: 'تاريخ البدء', v: readDate(P.startDate) },
            {
              k: 'الانتهاء المتوقع',
              v: (
                <>
                  {readDate(addDays(P.startDate, P.durationDays))}
                  <span className="sub"> · بعد <span className="num">{nf.format(P.durationDays)}</span> {nounAfter(P.durationDays, NOUN.day)}</span>
                </>
              ),
            },
            {
              k: 'الوسوم',
              v: P.tags.length ? P.tags.join('، ') : <span className="sub">لا يوجد</span>,
            },
          ]}
        />

        {/* Last action sits right under the summary — it used to be a card in the
            side column, which was far from the question it follows: "what is this
            project, and what last happened on it." Both now live in the same card. */}
        {last && (
          <div className="lastact">
            <div className="lastact-h">
              <span className="lb">آخر إجراء</span>
              <span className="pc-sp" />
              <button className="lnk" onClick={onOpenLog}>السجل كاملًا</button>
            </div>
            <div className="lastact-b">
              <b>{last.action}</b>
              <span className="lastact-d">{last.dept}</span>
            </div>
            <div className="sub mt-1">
              {last.by} · <DateText>{last.at}</DateText>
              {' · '}
              <span className={last.hours > last.limit ? 'bad' : undefined}>
                <Num>{last.days}</Num> {nounAfter(last.days, NOUN.day)} · <Num>{last.hours}</Num> من <Num>{last.limit}</Num> ساعة
              </span>
            </div>
          </div>
        )}
      </Glass>

      <div className="stats4">
        <Stat
          label="المبلغ المطلوب"
          value={<Num>{P.amountRequested}</Num>}
          unit={<Riyal />}
          bar={{ w: '100%', c: 'var(--teal)' }}
          note={`${pct(100)} من إجمالي المشروع`}
        />
        <Stat
          label="مدة التنفيذ"
          value={P.durationDays}
          unit="يومًا"
          note={`≈ ${units.month(Math.round(P.durationDays / 30))} · تبدأ من صرف الدفعة الأولى`}
        />
        <Stat
          label="المستفيدون"
          value={nf.format(P.beneficiaries)}
          note="تقدير الجهة، ولم يراجعه المشرف بعد"
        />
        <Stat
          label="تكلفة المستفيد"
          value={<Num>{perBeneficiary}</Num>}
          unit={<Riyal />}
          note="محسوبة، لمقارنة المشاريع"
        />
      </div>

      <Glass>
        <Head title="فكرة المشروع" meta="من نموذج التقديم" />
        <p className="prose">{isolate(P.idea)}</p>

        <div className="well" style={{ padding: 'var(--sp-5) 0 0', marginTop: 'var(--sp-5)' }}>
          <div className="lb">الهدف العام</div>
          <div className="prose mt-1">{isolate(P.mainGoal)}</div>
        </div>

        <BulletSection title="الأهداف التفصيلية" items={P.goals} />
        <BulletSection title="المخرجات" items={P.outputs} />
        <BulletSection title="المسوغات" items={P.rationale} />
      </Glass>

      <Glass>
        <Head title="مراحل التنفيذ" meta={`${countOf(P.phases.length, NOUN.phase)} · 11 شهرًا`} />
        <Timeline
          events={P.phases.map((ph) => ({
            tone: ph.tone,
            title: <><b>{ph.name}</b>، {ph.tasks}</>,
            by: isolate(ph.months),
          }))}
        />
        <div className="sub mt-4">
          في النظام الحالي هذه المراحل نصٌّ حر داخل حقل واحد. وهنا كيان له بنود وتواريخ، ويمكن
          ربط دفعات الصرف به.
        </div>
      </Glass>

      <Glass>
        <Head title="النطاق والأثر" meta="مطابقة لنموذج التقديم" />
        <KV
          rows={[
            { k: 'المنطقة والمدينة', v: `${P.region} · ${P.city}` },
            {
              k: 'عدد المستفيدين',
              v: (
                <>
                  <Num>{P.beneficiaries}</Num>{' '}
                  <span className="sub">
                    (الفعلي من المشرف: <Num>{P.beneficiariesVerified}</Num>)
                  </span>
                </>
              ),
            },
            {
              k: 'الفئة المستهدفة',
              v: (
                <div className="chips gp-1">
                  {P.audiences.map((a) => (
                    <span
                      className="chip"
                      key={a}
                      style={{ fontSize: 'var(--fs-1)', padding: 'var(--sp-2) var(--sp-4)' }}
                    >
                      {a}
                    </span>
                  ))}
                </div>
              ),
            },
          ]}
        />

        <div className="hd" style={{ marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-3)' }}>
          <h3 style={{ fontSize: 'var(--fs-3)' }}>الامتثال</h3>
          <span className="meta">3 إقرارات</span>
        </div>
        <div className="g3 gp-2">
          {P.compliance.map((c) => (
            <div className="well" key={c.k} style={{ padding: 'var(--sp-4) 0 0' }}>
              <div className="lb">{c.k}</div>
              <div
                style={{
                  fontSize: 'var(--fs-3)',
                  fontFamily: 'var(--fd)',
                  fontWeight: 600,
                  marginTop: 'var(--sp-2)',
                }}
              >
                {c.v}
              </div>
            </div>
          ))}
        </div>
      </Glass>

      <Glass>
        <Head title="المرفقات" meta={`${uploaded} من ${P.attachments.length} مرفوعة`} />
        <DocList
          label="مرفقات المشروع وحالتها"
          rows={P.attachments.map((a) => ({
            name: a.name, uploaded: a.uploaded, required: a.required,
          }))}
        />
        <div className="sub mt-3">
          الموازنة التفصيلية هي المطلوبة في طلب الاستكمال الحالي، لأن الملف المرفوع صورة لا تُقرأ آليًا.
        </div>
      </Glass>

      <Glass>
        <Head title="جهة الاتصال والحساب البنكي" meta="من نموذج التقديم" />
        <KV
          rows={[
            { k: 'مدير المشروع', v: P.manager.name },
            { k: 'الجوال', v: <Mono>{P.manager.phone}</Mono> },
            { k: 'البريد', v: <Mono>{P.manager.email}</Mono> },
            { k: 'المصرف', v: P.bank.name },
            { k: 'اسم الحساب', v: P.bank.account },
            { k: 'الآيبان', v: <Mono>{P.bank.iban}</Mono> },
            { k: 'حالة الحساب', v: <Tag tone="ok">{P.bank.status}</Tag> },
          ]}
        />
        <div className="sub mt-3">
          البيانات البنكية مصدرها ملف الجهة، معروضة هنا للمراجعة فقط ولا تُحرَّر من المشروع.
        </div>
      </Glass>

      {/* Chain.

          This card merges two things that would otherwise be two cards.
          "Dependencies" states what's still pending on the project so it can't be
          deleted, and "Chain" states where a number flows from and to — the same
          information from two angles. Two adjacent cards with near-identical names
          would have read as duplicates.

          Each link is also verified, not just displayed. The target allocation
          must cover the approved amount, the agreement value must equal the
          approved amount, and the schedule total must equal the agreement — and a
          broken link is called out. A chain that shows four numbers with no
          verification would be showing a connection that doesn't actually exist. */}
      {chain && (
        <Glass>
          <Head
            title="السلسلة"
            meta={
              gaps > 0
                ? <Tag tone="warn"><Num>{gaps}</Num> حلقة مكسورة</Tag>
                : <Tag tone="ok">متّصلة</Tag>
            }
          />
          <ol className="chain">
            {chain.map((l, i) => (
              <li key={l.key} className={`chain-${l.state}`}>
                <span className="chain-i num">{i + 1}</span>
                <span className="chain-b">
                  <span className="chain-h">
                    <b>{l.label}</b>
                    {/* `to` existed in the data but wasn't used on screen. The chain says
                        "Agreement · AG-2026-3107" and is meant to trace where the money goes:
                        anyone reading it would ask "show me that agreement." The link was naming
                        the destination without actually taking you there. A field declared in
                        the type that nobody reads is an intent that was never implemented — the
                        same family of bug as a rule written in a comment that nothing enforces. */}
                    {l.to
                      ? <Link className="tlink trim1" to={l.to}>· {l.name}</Link>
                      : <span className="sub trim1">· {l.name}</span>}
                    <span className="pc-sp" />
                    {l.value > 0 && <span className="num"><Money>{l.value}</Money></span>}
                  </span>
                  <span className="chain-s">{l.say}</span>
                </span>
              </li>
            ))}
          </ol>

          {dep && (
            <p className="sub cnote">
              {dep.count > 0
                ? <>ويرتبط بالمشروع <b>{dep.say}</b> · فلا يمكن حذفه، والسلسلة
                    تمنع الحذف من بدايتها: سنة ← ميزانية ← مشروع ← اتفاقية ودفعات.</>
                : <>لا توجد اتفاقيات ولا دفعات مرتبطة بهذا المشروع حتى الآن.</>}
            </p>
          )}
        </Glass>
      )}
    </>
  )
}

/**
 * A list of items with a title and counter — repeated three times in the
 * same card.
 */
function BulletSection({ title, items }: { title: string; items: string[] }) {
  return (
    <>
      <div className="hd" style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-4)' }}>
        <h3 style={{ fontSize: 'var(--fs-3)' }}>{title}</h3>
        <span className="meta">{items.length}</span>
      </div>
      {/* `flush`: rows are separated by a hairline, and the gap between them makes
          the space above a line half of the space below it, so it reads as
          attached to its own line. */}
      <div className="col-s flush">
        {items.map((item, i) => (
          <div className="data" key={i}>
            <div className="prose">{isolate(item)}</div>
          </div>
        ))}
      </div>
    </>
  )
}

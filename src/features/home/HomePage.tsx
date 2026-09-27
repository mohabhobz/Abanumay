import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Glass, Head, Icon, icons, Money, Mono, Empty, Riyal} from '@/components/ui'
import {
  Columns, Donut, Legend, SaudiMap, StackBar, CHART_COLORS, CHART_INKS,
  StageFlow, Lollipop, Waffle, Pareto, Meters, RankBars, MoneyRing, type Hue,
} from '@/components/charts'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { fixtures, query, stagePressure, ENTITY_DOCS_TOTAL } from '@/data/repository'
import { useRole } from '@/hooks/useRole'
import { budgetForYear } from '@/data/budget'
import {
  ageingBuckets, byRegion, byStage, byStatusGroup, declineReasons,
  entityHealth, grantedByTrack, median, ownerLoad, topEntities,
} from '@/data/analytics'
import { assistFor } from '@/data/mock/assistant'
import { countOf, df, nf, NOUN, nounAfter, pct, projectCode } from '@/lib/format'
import { days, TONE } from '@/lib/tone'
import { IdentityBanner } from '@/components/soul'

/* Today - a reading dashboard, not a numbers dashboard.

   Every chart here answers a question raised during the audit:
     Where is the money going?     - the budget and its distribution across tracks
     Where is work stalled?        - process stages and dwell times
     How is load distributed?      - supervisors and their median days
     Why do we get delays?         - delay justifications
     Are our partners ready?       - entity files and support concentration

   One color rule across the whole page: color describes status, not quantity. Numbers use normal
   text color; color sits on the bar or small badge, and red is reserved for actual breaches, in a
   small area. */

/* Request totals - color is category, and only the two genuinely status-based states use status
   color. */
const GROUP_HUE: Record<string, Hue> = {
  'في الدراسة': 'c2', 'في التشغيل': 'c1', 'معتذر عنه': 'c6', 'متعثر': 'cl', 'مكتمل': 'c4',
}

const GREET = () => (new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير')

export default function HomePage() {
  const { role, user } = useRole()
  const projects = fixtures.projects
  const entities = fixtures.entities
  const budget = useMemo(() => budgetForYear('2026-f'), [])

  const mine = projects.filter((p) => p.owner === user.name && p.statusGroup === 'في الدراسة')
  const late = projects.filter((p) => stagePressure(p) > 1)
  const orphan = projects.filter((p) => p.owner === null)
  const shortDocs = entities.filter((e) => e.docsUploaded < ENTITY_DOCS_TOTAL)
  const waiting = projects.filter(
    (p) =>
      p.statusGroup === 'في الدراسة' &&
      (role.financialAuthority === null || p.amountRequested > role.financialAuthority),
  )
  const liveDays = projects.filter((p) => p.stageLimit > 0).map((p) => days(p.hoursInStage))

  const queue = useMemo(
    () =>
      query.projects(
        role.lens === 'own'
          ? { owner: user.name, status: 'في الدراسة', sort: 'waiting', pageSize: 4 }
          : { status: 'في الدراسة', sort: 'amount', pageSize: 4 },
      ).rows,
    [user.name, role.lens],
  )


  /* -- Series -- */
  const groups = byStatusGroup(projects)
  const stages = byStage(projects)
  const tracks = grantedByTrack(projects)
  const ageing = ageingBuckets(projects)
  const owners = ownerLoad(projects)
  const reasons = declineReasons(projects)
  const regions = byRegion(projects)
  const partners = topEntities(projects)
  const health = entityHealth(entities)

  /* Track line - per department: how many projects, how many over the limit, and its median days
     plus the limit, for the tooltip. Same rows, so the number matches the one in the projects box. */
  const stageFlow = stages.map((b) => {
    const here = projects.filter((p) => p.stage === b.key && p.stageLimit > 0)
    const limit = here[0] ? days(here[0].stageLimit) : 0
    return {
      ...b,
      over: here.filter((p) => stagePressure(p) > 1).length,
      tip: `وسيط ${countOf(median(here.map((p) => days(p.hoursInStage))), NOUN.day)} · الحدّ ${countOf(limit, NOUN.day)}`,
    }
  })
  const ownerAvg = Math.round((owners.reduce((s, o) => s + o.value, 0) / Math.max(owners.length, 1)) * 10) / 10

  /* Color and its ink are taken together from the same index - the percentage is written on the
     arc, so there must be a measured ink value for every color. */
  const trackSlices = tracks.map((t, i) => ({
    ...t,
    color: CHART_COLORS[i % CHART_COLORS.length],
    ink: CHART_INKS[i % CHART_INKS.length],
  }))
  const grantedTotal = tracks.reduce((s, t) => s + t.value, 0)

  /* The riyal's journey across all entities, from their files: everything granted since each
     registered, split into what reached them and what is still in disbursement, with this cycle as
     a time slice of the same whole. Same figures as each entity page's leaf, summed. */
  const flowTotal = entities.reduce((a, e) => a + e.grantedTotal, 0)
  const flowPending = entities.reduce((a, e) => a + e.inDisbursement, 0)
  const flowCycle = entities.reduce((a, e) => a + e.grantedThisYear, 0)

  const budgetParts = [
    { key: 'spent', label: 'المصروف', value: budget.spent, color: 'var(--ch-1)' },
    { key: 'committed', label: 'ملتزم لم يُصرف', value: Math.max(0, budget.committed - budget.spent), color: 'var(--ch-2)' },
    { key: 'reserved', label: 'المحجوز', value: budget.reserved, color: 'var(--ch-3)' },
    { key: 'remaining', label: 'المتبقّي', value: budget.remaining, color: 'var(--ch-idle)' },
  ]
  const usedPct = Math.round(((budget.reserved + budget.committed) / budget.allocated) * 100)
  const doneBeneficiaries = projects
    .filter((p) => p.statusGroup === 'مكتمل')
    .reduce((s, p) => s + p.beneficiaries, 0)

  /* -- Indicators, by role -- */
  const kpis =
    role.lens === 'own'
      ? [
          { k: 'ينتظر قرارك', v: String(mine.length), note: `${mine.filter((p) => stagePressure(p) > 1).length} فوق الحدّ`, to: `${ROUTES.projects}?owner=${encodeURIComponent(user.name)}&status=في الدراسة`},
          { k: 'وسيط المكوث', v: String(median(liveDays)), note: 'يومًا في القسم', to: `${ROUTES.projects}?sort=waiting`},
          { k: 'تجاوز الحدّ', v: String(late.length), note: 'في النظام كله', to: `${ROUTES.projects}?overdue=1&sort=waiting`},
          { k: 'بلا مالك', v: String(orphan.length), note: 'تحتاج إلى إسناد', to: `${ROUTES.projects}?unowned=1`},
        ]
      : role.lens === 'team'
        ? [
            { k: 'ينتظر اعتمادك', v: String(waiting.length), note: 'فوق الحد المالي للمشرف', to: `${ROUTES.projects}?status=في الدراسة&sort=amount`},
            { k: 'وسيط المكوث', v: String(median(liveDays)), note: 'يومًا في القسم', to: `${ROUTES.projects}?sort=waiting`},
            { k: 'تجاوز الحدّ', v: String(late.length), note: 'في النظام كله', to: `${ROUTES.projects}?overdue=1&sort=waiting`},
            { k: 'بلا مالك', v: String(orphan.length), note: 'تحتاج إلى إسناد', to: `${ROUTES.projects}?unowned=1`},
          ]
        : [
            { k: 'الملتزم به', v: `${(budget.committed / 1_000_000).toFixed(1)} م`, note: `${pct(usedPct)} من المخصص`, to: ROUTES.budget},
            { k: 'تحت التشغيل', v: String(groups.find((g) => g.key === 'في التشغيل')?.value ?? 0), note: 'مشروعًا جاريًا', to: `${ROUTES.projects}?status=في التشغيل`},
            { k: 'المستفيدون', v: nf.format(doneBeneficiaries), note: 'من المشاريع المكتملة', to: `${ROUTES.projects}?status=مكتمل`},
            { k: 'جهات ملفها ناقص', v: String(shortDocs.length), note: 'تتوقف عندها الاتفاقيات', to: `${ROUTES.entities}?docs=1`},
          ]

  return (
    <AppLayout
      assistantContext={assistFor.home(
        user.name,
        role.lens === 'own' ? mine.length : waiting.length,
        late.length,
      )}
    >
      <div className="viewstack">
        <div className="screen col">
          {/* === First fold ===
              Everything here closes in one screen with no scrolling: header, indicators, map, money
              and time. Height is the constraint here, not width, so the grid takes the remainder
              and the map shrinks inside it proportionally. */}
          <section className="fold">
          {/* Note: the identity field (motion 1) - greeting and date only. The numbers below sit on
              their own surface unchanged, and the page behind it wasn't touched. */}
          <IdentityBanner
            title={<>{GREET()}، {user.name.split(' ')[0]}</>}
            sub={<>{df.format(new Date())} · {user.role}</>}
            action={
              /* A link, not a button - leads to the reports screen. */
              <Link className="btn btn-ghost btn-sm" to={ROUTES.reports}>
                <Icon name={icons.chart} size="sm" />
                التقارير الكاملة
              </Link>
            }
          />

          {/* === Indicators === */}
          <div className="kpis">
            {kpis.map((t) => (
              <Link key={t.k} to={t.to} className="kpi glass">
                <span className="kpi-h">
                  <span className="kpi-k">{t.k}</span>
                  <Icon name={icons.chevron} size="sm" className="kpi-go" />
                </span>
                <span className="kpi-v num">{t.v}</span>
                <span className="kpi-n">{t.note}</span>
              </Link>
            ))}
          </div>

          {/* === First row: what must be visible with no scroll ===
              Map, money, and time. The rest sits below, since it's read after the first question is
              answered, not before. */}
          <div className="dtop">
            <Glass className="d-map">
              <Head
                title="التوزيع الجغرافي"
                meta={<Link className="lnk" to={ROUTES.projects}>كل المشاريع</Link>}
              />
              <SaudiMap
                points={regions.map((r) => ({
                  key: r.key,
                  label: r.label,
                  value: r.value,
                  href: `${ROUTES.projects}?region=${encodeURIComponent(r.key)}`,
                }))}
              />
            </Glass>

            <Glass className="d-budget">
              <Head
                title="ميزانية 2026"
                meta={<Link className="lnk" to={ROUTES.budget}>الشجرة كاملة</Link>}
              />
              <div className="bighead">
                <b className="num">{nf.format(budget.allocated)}</b>
                <span><Riyal /> مخصص · <b className="num">{usedPct}%</b> محجوز أو ملتزم به</span>
              </div>
              <StackBar parts={budgetParts} total={budget.allocated} />
              <Legend items={budgetParts} />
            </Glass>

            {/* === Ring, percentages on the arcs ===
                The objection to a ring is that a reader can't estimate 51% from an angle, so they
                read it off the legend instead - meaning the chart is decoration and the number
                beside it does the work.

                So the percentage is placed on the arc itself: the number sits at the shape it
                represents, and the legend below becomes just labels and colors in a single row.

                Note: text on a color needs 4.5:1 (WCAG 1.4.3) - so every slice gets an `ink` value
                measured against its own color. */}
            <Glass className="d-track">
              <Head title="الملتزم به حسب المسار" />
              <Donut
                slices={trackSlices}
                centerValue={`${(grantedTotal / 1_000_000).toFixed(1)} م`}
                centerLabel="⃁ ملتزم به"
              />
              <Legend items={trackSlices} inline pctOf={trackSlices.reduce((a, x) => a + x.value, 0)} />
            </Glass>

            <Glass className="d-age">
              <Head
                title="مدة المكوث في القسم"
                meta={<span className="sub">وسيط {median(liveDays)} {nounAfter(median(liveDays), NOUN.day)} · بالأيام</span>}
              />
              {/* The unit sits in the header, not floating below - on a narrow card it used to
                  overlap the last column's label. */}
              <Columns
                cols={ageing.map((b) => ({
                  ...b,
                  color:
                    b.key === '+60'
                      ? 'var(--ch-late)'
                      : b.key === '31–60'
                        ? 'var(--ch-warn)'
                        : 'var(--ch-2)',
                }))}
              />
            </Glass>
          </div>
          </section>

          {/* === Below the fold ===
              Each card has its own shape (StageFlow, Lollipop, Waffle, Pareto, Meters, RankBars)
              instead of six identical bar lists. The grid fills completely: double rows have
              matching-height cards with the chart taking the remainder, and cards with wide content
              span the page width - so there's no empty slot at any size. */}
          <Glass className="hx-card">
            <Head
              title="أين تقف المشاريع"
              meta={<span className="sub">{stages.reduce((s, x) => s + x.value, 0)} جاريًا · {stageFlow.reduce((s, x) => s + x.over, 0)} فوق الحدّ</span>}
            />
            <StageFlow stages={stageFlow} />
            <p className="hx-key">
              <i className="hx-sw c2" aria-hidden="true" />مشروع ضمن حدّ القسم
              <i className="hx-sw cw" aria-hidden="true" />مشروع تجاوز الحدّ
            </p>
          </Glass>

          <div className="dgrid g11 hx-row">
            <Glass className="hx-card">
              <Head title="الحمل على المشرفين" meta={<span className="sub">تحت الدراسة</span>} />
              <Lollipop
                rows={owners.map((o) => ({
                  key: o.key,
                  label: o.label,
                  value: o.value,
                  hue: o.key === 'بلا مالك' ? 'c6' : 'c1',
                  note: `وسيط ${countOf(o.medianDays, NOUN.day)}`,
                  tip: `${o.value} تحت الدراسة · ${o.overdue} فوق الحدّ · وسيط ${countOf(o.medianDays, NOUN.day)}`,
                }))}
                refValue={ownerAvg}
                refLabel={`متوسط الحمل ${nf.format(ownerAvg)} لكل مشرف`}
              />
            </Glass>

            <Glass className="hx-card">
              <Head title="جاهزية الجهات" meta={<Link className="lnk" to={ROUTES.entities}>الجهات</Link>} />
              <Meters
                total={entities.length}
                unit="جهة"
                rows={[
                  { key: 'ready', label: 'مفعّلة وملفها كامل', value: health.ready, hue: 'c2', tip: 'تقدر توقّع اتفاقية اليوم' },
                  { key: 'incomplete', label: 'ملفها ناقص', value: health.incomplete, hue: 'cw', tip: 'تتوقف عندها الاتفاقيات' },
                  { key: 'held', label: 'معلّقة', value: health.held, hue: 'c6', tip: 'التفعيل معلّق بقرار' },
                  { key: 'stalled', label: 'لها مشروع متعثر', value: health.stalled, hue: 'cl', tip: 'مشروع واحد على الأقل تجاوز ضعف حدّه' },
                ]}
              />
              <p className="chnote">
                من {entities.length} {nounAfter(entities.length, NOUN.entity)} في هذا النموذج · 3,272 في النظام العامل.
              </p>
            </Glass>
          </div>

          <div className="dgrid g11 hx-row">
            <Glass className="hx-card">
              <Head title="حصيلة الطلبات" meta={<span className="sub">{projects.length} {nounAfter(projects.length, NOUN.request)}</span>} />
              <Waffle
                parts={groups.map((g) => ({ ...g, hue: GROUP_HUE[g.key] ?? 'c6' }))}
              />
            </Glass>

            <Glass className="hx-card">
              <Head
                title="مبررات الاعتذار"
                meta={<Link className="lnk" to={`${ROUTES.projects}?status=معتذر عنه`}>الكل</Link>}
              />
              {reasons.length ? (
                <Pareto rows={reasons} />
              ) : (
                <Empty title="لا توجد اعتذارات في العيّنة." />
              )}
            </Glass>
          </div>

          {/* Money pair: where the granted riyal stands (ring) beside who received the most (ranking). */}
          <div className="dgrid g11 hx-row">
            <Glass className="hx-card">
              <Head
                title="رحلة الريال عبر الجهات"
                meta={<Link className="lnk" to={ROUTES.payments}>الصرف</Link>}
              />
              <MoneyRing
                total={flowTotal}
                centerLabel="إجمالي الممنوح"
                parts={[
                  { key: 'paid', label: 'وصل فعلًا', value: Math.max(0, flowTotal - flowPending), hue: 'c1' },
                  { key: 'pending', label: 'تحت الصرف', value: flowPending, hue: 'c4' },
                ]}
                slice={{ key: 'cycle', label: 'دورة 2026', value: flowCycle, hue: 'c2' }}
              />
              <p className="chnote">
                من ملفات {entities.length} {nounAfter(entities.length, NOUN.entity)} منذ تسجيلها · والدورة جزء من الإجمالي لا قسم ثالث منه.
              </p>
            </Glass>

            <Glass className="hx-card">
              <Head
                title="أعلى الجهات دعمًا"
                meta={<Link className="lnk" to={`${ROUTES.entities}?sort=granted`}>الكل</Link>}
              />
              <RankBars rows={partners} total={grantedTotal} />
              <p className="chnote">
                أعلى جهتين معًا {pct(Math.round(((partners[0]?.value ?? 0) + (partners[1]?.value ?? 0)) / Math.max(grantedTotal, 1) * 100))} من الملتزم به كله · والنسبة جنب كل جهة نصيبها منه.
              </p>
            </Glass>
          </div>

          {/* === Rows ===
              Note: the "quick system read" card was removed from this page - the assistant is still
              available via "Ask Abanumay" and on other screens, and the rows now span the page
              width. */}
          <div className="dgrid">
            <div className="col">
              <Glass>
                <Head
                  title={role.lens === 'own' ? 'بانتظار قرارك' : 'ينتظر اعتمادك'}
                  meta={
                    <Link
                      className="lnk"
                      to={
                        role.lens === 'own'
                          ? `${ROUTES.projects}?owner=${encodeURIComponent(user.name)}&status=في الدراسة`
                          : `${ROUTES.projects}?status=في الدراسة&sort=amount`
                      }
                    >
                      الكل
                    </Link>
                  }
                />
                {queue.length === 0 ? (
                  <Empty title="لا يوجد مشروع بانتظار قرارك." note="تحرّكت كل المشاريع المسندة إليك." />
                ) : (
                  <div className="qrows">
                    {queue.map((p) => (
                      <Link key={p.id} to={ROUTES.project(p.id)} className="qrow well">
                        <div className="qrow-h">
                          <Mono>{projectCode(p.id, p.year)}</Mono>
                          <span className="sub">{p.stage}</span>
                          <span className="pc-sp" />
                          <Money>{p.amountRequested}</Money>
                        </div>
                        <div className="qrow-n">{p.name}</div>
                        <div className="sub qrow-f">
                          {p.entityName} · <span className="num">{days(p.hoursInStage)}</span> {nounAfter(days(p.hoursInStage), NOUN.day)} في القسم
                          {stagePressure(p) > 1 && <span className={`tag ${TONE.late}`}>متأخر</span>}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </Glass>

            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

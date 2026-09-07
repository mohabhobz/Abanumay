import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Glass, Head, Icon, icons, Mono, Riyal, Empty } from '@/components/ui'
import { BarList, Columns, Donut, Legend, SaudiMap, StackBar, CHART_COLORS } from '@/components/charts'
import { QuickRead } from '@/components/assistant'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { fixtures, query, stagePressure, ENTITY_DOCS_TOTAL } from '@/data/repository'
import { useRole } from '@/hooks/useRole'
import { readHome } from '@/data/readings'
import { budgetForYear } from '@/data/budget'
import {
  ageingBuckets, byRegion, byStage, byStatusGroup, declineReasons,
  entityHealth, grantedByTrack, median, ownerLoad, topEntities,
} from '@/data/analytics'
import { assistFor } from '@/data/mock/assistant'
import { df, nf } from '@/lib/format'
import { days } from '@/lib/tone'

/* ═══════════════════════════════════════════════════════════
   اليوم — لوحة قراءة، لا لوحة أرقام

   كل رسم هنا بيجاوب سؤالًا اتسأل في الأوديت:
     المال رايح فين؟        ← الميزانية وتوزيعها على المسارات
     الشغل واقف فين؟        ← الأقسام الإجرائية ومدد المكوث
     الحمل موزّع إزاي؟      ← المشرفون ووسيط أيامهم
     ليه بنعتذر؟            ← مبررات الاعتذار
     شركاؤنا جاهزين؟        ← ملفات الجهات وتركّز الدعم

   وقاعدة لونية واحدة في الصفحة كلها: **اللون يوصف الحالة مش الكمية.**
   الأرقام بلون النص العادي؛ اللون بيقع على الشريط أو الوسم الصغير،
   والأحمر مخصوص للتجاوز الفعلي وبمساحة صغيرة.
   ═══════════════════════════════════════════════════════════ */

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

  const readings = useMemo(
    () =>
      readHome({
        projects,
        entities,
        lens: role.lens,
        owner: user.name,
        ceiling: role.financialAuthority,
        budget,
      }),
    [projects, entities, role.lens, role.financialAuthority, user.name, budget],
  )

  const queue = useMemo(
    () =>
      query.projects(
        role.lens === 'own'
          ? { owner: user.name, status: 'في الدراسة', sort: 'waiting', pageSize: 4 }
          : { status: 'في الدراسة', sort: 'amount', pageSize: 4 },
      ).rows,
    [user.name, role.lens],
  )

  const attention = useMemo(
    () => query.projects({ overdue: true, sort: 'waiting', pageSize: 4 }).rows,
    [],
  )

  /* ── السلاسل ── */
  const groups = byStatusGroup(projects)
  const stages = byStage(projects)
  const tracks = grantedByTrack(projects)
  const ageing = ageingBuckets(projects)
  const owners = ownerLoad(projects)
  const reasons = declineReasons(projects)
  const regions = byRegion(projects)
  const partners = topEntities(projects)
  const health = entityHealth(entities)

  const trackSlices = tracks.map((t, i) => ({ ...t, color: CHART_COLORS[i % CHART_COLORS.length] }))
  const grantedTotal = tracks.reduce((s, t) => s + t.value, 0)

  const budgetParts = [
    { key: 'spent', label: 'المصروف', value: budget.spent, color: 'var(--ch-1)' },
    { key: 'committed', label: 'ملتزم لم يُصرف', value: Math.max(0, budget.committed - budget.spent), color: 'var(--ch-2)' },
    { key: 'reserved', label: 'المحجوز', value: budget.reserved, color: 'var(--ch-5)' },
    { key: 'remaining', label: 'المتبقّي', value: budget.remaining, color: 'var(--ch-idle)' },
  ]
  const usedPct = Math.round(((budget.reserved + budget.committed) / budget.allocated) * 100)
  const doneBeneficiaries = projects
    .filter((p) => p.statusGroup === 'مكتمل')
    .reduce((s, p) => s + p.beneficiaries, 0)

  /* ── المؤشرات، حسب الدور ── */
  const kpis =
    role.lens === 'own'
      ? [
          { k: 'ينتظر قرارك', v: String(mine.length), note: `${mine.filter((p) => stagePressure(p) > 1).length} فوق الحدّ`, to: `${ROUTES.projects}?owner=${encodeURIComponent(user.name)}&status=في الدراسة`, icon: icons.doc, alert: mine.some((p) => stagePressure(p) > 1) },
          { k: 'وسيط المكوث', v: String(median(liveDays)), note: 'يومًا في القسم', to: `${ROUTES.projects}?sort=waiting`, icon: icons.clock, alert: false },
          { k: 'تجاوز الحدّ', v: String(late.length), note: 'في السيستم كله', to: `${ROUTES.projects}?overdue=1&sort=waiting`, icon: icons.alert, alert: late.length > 0 },
          { k: 'بلا مالك', v: String(orphan.length), note: 'محتاجة إسناد', to: `${ROUTES.projects}?unowned=1`, icon: icons.users, alert: false },
        ]
      : role.lens === 'team'
        ? [
            { k: 'ينتظر اعتمادك', v: String(waiting.length), note: 'فوق سقف المشرف', to: `${ROUTES.projects}?status=في الدراسة&sort=amount`, icon: icons.check, alert: waiting.length > 0 },
            { k: 'وسيط المكوث', v: String(median(liveDays)), note: 'يومًا في القسم', to: `${ROUTES.projects}?sort=waiting`, icon: icons.clock, alert: false },
            { k: 'تجاوز الحدّ', v: String(late.length), note: 'في السيستم كله', to: `${ROUTES.projects}?overdue=1&sort=waiting`, icon: icons.alert, alert: late.length > 0 },
            { k: 'بلا مالك', v: String(orphan.length), note: 'محتاجة إسناد', to: `${ROUTES.projects}?unowned=1`, icon: icons.users, alert: false },
          ]
        : [
            { k: 'الملتزم به', v: `${(budget.committed / 1_000_000).toFixed(1)} م`, note: `${usedPct}% من المخصص`, to: ROUTES.budget, icon: icons.budget, alert: false },
            { k: 'تحت التشغيل', v: String(groups.find((g) => g.key === 'في التشغيل')?.value ?? 0), note: 'مشروعًا جاريًا', to: `${ROUTES.projects}?status=في التشغيل`, icon: icons.pay, alert: false },
            { k: 'المستفيدون', v: nf.format(doneBeneficiaries), note: 'من المشاريع المكتملة', to: `${ROUTES.projects}?status=مكتمل`, icon: icons.check, alert: false },
            { k: 'جهات ملفها ناقص', v: String(shortDocs.length), note: 'الاتفاقيات بتقف عندها', to: `${ROUTES.entities}?docs=1`, icon: icons.entity, alert: shortDocs.length > 0 },
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
          {/* ═══ الطيّة الأولى ═══
              كل ده بيتقفل في شاشة واحدة بلا تمرير: الترويسة والمؤشرات
              والخريطة والمال والزمن. الارتفاع هو القيد هنا لا العرض،
              فالشبكة بتاخد الباقي والخريطة بتتقلّص جوّاه بنسبتها. */}
          <section className="fold">
          <nav className="crumb" aria-label="مسار التنقّل">
            <span className="now">اليوم</span>
          </nav>

          <header className="hhead">
            <div className="hhead-t">
              <h1 className="htitle">{GREET()}، {user.name.split(' ')[0]}</h1>
              <p className="hdate">{df.format(new Date())} · {user.role}</p>
            </div>
            <Link className="btn btn-2 btn-sm" to={ROUTES.reports}>
              <Icon path={icons.chart} size={15} />
              التقارير الكاملة
            </Link>
          </header>

          {/* ═══ المؤشرات ═══ */}
          <div className="kpis">
            {kpis.map((t) => (
              <Link key={t.k} to={t.to} className="kpi glass">
                <span className="kpi-h">
                  <span className={`kpi-ic${t.alert ? ' on' : ''}`}>
                    <Icon path={t.icon} size={15} />
                  </span>
                  <span className="kpi-k">{t.k}</span>
                  <Icon path={icons.chevron} size={14} className="kpi-go" />
                </span>
                <span className="kpi-v num">{t.v}</span>
                <span className="kpi-n">{t.note}</span>
              </Link>
            ))}
          </div>

          {/* ═══ الصف الأول: اللي لازم يتشاف من غير تمرير ═══
              الخريطة والمال والزمن. الباقي تحت، لأنه بيتقري بعد ما
              السؤال الأول يتجاوب، مش قبله. */}
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
                <span>ريال مخصص · <b className="num">{usedPct}%</b> محجوز أو ملتزم به</span>
              </div>
              <StackBar parts={budgetParts} total={budget.allocated} />
              <Legend items={budgetParts} />
            </Glass>

            <Glass className="d-track">
              <Head title="الملتزم به حسب المسار" />
              <div className="dsplit">
                <Donut
                  slices={trackSlices}
                  centerValue={`${(grantedTotal / 1_000_000).toFixed(1)} م`}
                  centerLabel="ريال ملتزم به"
                  size={124}
                />
                <Legend
                  items={trackSlices}
                  format={(v) => `${Math.round((v / Math.max(1, grantedTotal)) * 100)}%`}
                />
              </div>
            </Glass>

            <Glass className="d-age">
              <Head
                title="مدة المكوث في القسم"
                meta={<span className="sub">وسيط {median(liveDays)} يومًا · بالأيام</span>}
              />
              {/* الوحدة في الترويسة لا عايمة تحت: على كارت ضيّق كانت
                  بتركب على تسمية آخر عمود */}
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

          {/* ═══ التشغيل ═══ */}
          <div className="dgrid g11">
            <Glass>
              <Head
                title="أين تقف المشاريع"
                meta={<span className="sub">{stages.reduce((s, x) => s + x.value, 0)} جاريًا</span>}
              />
              <BarList
                labelWidth="8.5rem"
                rows={stages.map((b) => ({ ...b, color: 'var(--ch-3)' }))}
                format={(v) => String(v)}
              />
            </Glass>

            <Glass>
              <Head title="الحمل على المشرفين" meta={<span className="sub">تحت الدراسة</span>} />
              <BarList
                labelWidth="7rem"
                rows={owners.map((o) => ({
                  key: o.key,
                  label: o.label,
                  value: o.value,
                  color: o.key === 'بلا مالك' ? 'var(--ch-idle)' : 'var(--ch-2)',
                  note: `${o.medianDays} يوم`,
                }))}
                format={(v) => String(v)}
              />
              <p className="chnote">
                الرقم الصغير وسيط أيام المكوث عند كل مشرف. والمخصص في الرسم فوق من
                النظام العامل، والباقي محسوب من العيّنة التجريبية.
              </p>
            </Glass>
          </div>

          {/* ═══ الحصيلة والشركاء ═══ */}
          <div className="dgrid g111">
            <Glass>
              <Head title="حصيلة الطلبات" meta={<span className="sub">{projects.length} طلبًا</span>} />
              <BarList
                labelWidth="6rem"
                rows={groups.map((g, i) => ({
                  ...g,
                  color: CHART_COLORS[i % CHART_COLORS.length],
                  note: `${Math.round((g.value / projects.length) * 100)}%`,
                }))}
                format={(v) => String(v)}
              />
            </Glass>

            <Glass>
              <Head
                title="مبررات الاعتذار"
                meta={<Link className="lnk" to={`${ROUTES.projects}?status=معتذر عنه`}>الكل</Link>}
              />
              {reasons.length ? (
                <BarList
                  labelWidth="10rem"
                  rows={reasons.map((r) => ({ ...r, color: 'var(--ch-6)' }))}
                  format={(v) => String(v)}
                />
              ) : (
                <Empty title="لا اعتذارات في العيّنة." />
              )}
            </Glass>

            <Glass>
              <Head title="جاهزية الشركاء" meta={<Link className="lnk" to={ROUTES.entities}>الجهات</Link>} />
              <BarList
                labelWidth="8.5rem"
                format={(v) => String(v)}
                rows={[
                  { key: 'ready', label: 'مفعّلة وملفها كامل', value: health.ready, color: 'var(--ch-2)' },
                  { key: 'incomplete', label: 'ملفها ناقص', value: health.incomplete, color: 'var(--ch-warn)' },
                  { key: 'held', label: 'معلّقة', value: health.held, color: 'var(--ch-6)' },
                  { key: 'stalled', label: 'لها مشروع متعثر', value: health.stalled, color: 'var(--ch-late)' },
                ]}
              />
              <p className="chnote">
                من {entities.length} جهة في هذا النموذج · 3,272 في النظام العامل.
              </p>
            </Glass>
          </div>

          {/* ═══ أعلى الشركاء ═══ */}
          <Glass>
            <Head
              title="أعلى الجهات دعمًا"
              meta={<Link className="lnk" to={`${ROUTES.entities}?sort=granted`}>الكل</Link>}
            />
            <BarList
              labelWidth="12rem"
              rows={partners.map((p) => ({ ...p, color: 'var(--ch-2)' }))}
            />
          </Glass>

          {/* ═══ القراءة والصفوف ═══ */}
          <div className="dgrid g11">
            <div className="col">
              <QuickRead
                readings={readings}
                title="قراءة سريعة للسيستم"
                onAsk={() =>
                  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
                }
              />
            </div>

            <div className="col">
              <Glass>
                <Head
                  title={role.lens === 'own' ? 'طابور قرارك' : 'ينتظر اعتمادك'}
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
                  <Empty title="مفيش مشروع منتظر قرارك." note="كل اللي عندك اتحرّك." />
                ) : (
                  <div className="qrows">
                    {queue.map((p) => (
                      <Link key={p.id} to={ROUTES.project(p.id)} className="qrow well">
                        <div className="qrow-h">
                          <Mono>{p.id}</Mono>
                          <span className="sub">{p.stage}</span>
                          <span className="pc-sp" />
                          <span className="num">{nf.format(p.amountRequested)} <Riyal /></span>
                        </div>
                        <div className="qrow-n">{p.name}</div>
                        <div className="sub qrow-f">
                          {p.entityName} · <span className="num">{days(p.hoursInStage)}</span> يومًا في القسم
                          {stagePressure(p) > 1 && <span className="tag no mini">متأخر</span>}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </Glass>

              <Glass>
                <Head
                  title="ما يحتاج انتباه"
                  meta={<Link className="lnk" to={`${ROUTES.projects}?overdue=1&sort=waiting`}>الكل</Link>}
                />
                {attention.length === 0 ? (
                  <Empty title="مفيش إجراء متجاوز حدّه." note="كل الأقسام داخل حدودها." />
                ) : (
                  <div className="qrows">
                    {attention.map((p) => (
                      <Link key={p.id} to={ROUTES.project(p.id)} className="qrow well">
                        <div className="qrow-h">
                          <Mono>{p.id}</Mono>
                          <span className="sub">{p.stage}</span>
                          <span className="pc-sp" />
                          <span className="tag no mini">
                            <span className="num">{days(p.hoursInStage - p.stageLimit)}</span> يومًا فوق الحدّ
                          </span>
                        </div>
                        <div className="qrow-n">{p.name}</div>
                        <div className="sub qrow-f">{p.entityName} · {p.owner ?? 'بلا مالك'}</div>
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

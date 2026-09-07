import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Glass, Head, Icon, icons, Mono, Riyal, Tag, Empty } from '@/components/ui'
import { QuickRead } from '@/components/assistant'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { fixtures, query, stagePressure, ENTITY_DOCS_TOTAL } from '@/data/repository'
import { readHome } from '@/data/readings'
import { budgetForYear } from '@/data/budget'
import { assistFor } from '@/data/mock/assistant'
import { nf, units } from '@/lib/format'
import { days, groupTone } from '@/lib/tone'
import { STATUS_GROUPS } from '@/data/mock/taxonomy'

/* ═══════════════════════════════════════════════════════════
   صندوقي

   مش لوحة مؤشرات. النظام العامل فيه ٤٬٩٢٩ مشروعًا و٣٬٢٧٢ جهة،
   والأوديت طلّع إن اللي محتاج قرارًا فعلًا **٢٩ مشروعًا**. فلو
   الصفحة دي فتحت على أرقام كبيرة تكون بتخفي الشغل بدل ما تعرضه.

   الترتيب بيتبع سؤال المستخدم الصبح، بالترتيب:
     ١ — إيه اللي عليّ؟          (شرائح القرار، أرقام قابلة للضغط)
     ٢ — فيه حاجة غلط؟           (القراءة السريعة، عرضية بين الموديولات)
     ٣ — أبدأ بإيه؟              (الصفوف نفسها، مرتّبة بالأطول انتظارًا)
     ٤ — إحنا واقفين فين؟        (المالي والتشغيلي على الجنب)
   ═══════════════════════════════════════════════════════════ */

const GREET = () => {
  const h = new Date().getHours()
  if (h < 12) return 'صباح الخير'
  if (h < 17) return 'مساء الخير'
  return 'مساء الخير'
}

const TODAY = () =>
  new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date())

export default function HomePage() {
  const user = fixtures.currentUser
  const projects = fixtures.projects
  const entities = fixtures.entities
  const budget = useMemo(() => budgetForYear('2026-f'), [])

  const mine = projects.filter((p) => p.owner === user.name && p.statusGroup === 'في الدراسة')
  const late = projects.filter((p) => stagePressure(p) > 1)
  const orphan = projects.filter((p) => p.owner === null)
  const shortDocs = entities.filter((e) => e.docsUploaded < ENTITY_DOCS_TOTAL)

  const readings = useMemo(
    () => readHome({ projects, entities, owner: user.name, budget }),
    [projects, entities, user.name, budget],
  )

  /* الطابور: مرتّب بالأطول انتظارًا، وده ترتيب مقصود — الأقدم
     مش الأهم، لكنه اللي بيكلّف الجهة وقتًا كل يوم بيعدّي. */
  const queue = useMemo(
    () => query.projects({ owner: user.name, status: 'في الدراسة', sort: 'waiting', pageSize: 5 }).rows,
    [user.name],
  )

  const attention = useMemo(
    () => query.projects({ overdue: true, sort: 'waiting', pageSize: 5 }).rows,
    [],
  )

  const byGroup = STATUS_GROUPS.map((g) => ({
    group: g,
    count: projects.filter((p) => p.statusGroup === g).length,
  }))
  const maxGroup = Math.max(...byGroup.map((g) => g.count), 1)

  const tiles = [
    {
      key: 'mine',
      label: 'ينتظر قرارك',
      value: mine.length,
      note: mine.length
        ? `${units.project(mine.filter((p) => stagePressure(p) > 1).length, true)} منها فوق الحدّ`
        : 'صندوقك فاضي',
      tone: mine.some((p) => stagePressure(p) > 1) ? 'no' : 'ok',
      to: `${ROUTES.projects}?owner=${encodeURIComponent(user.name)}&status=في الدراسة`,
      icon: icons.doc,
    },
    {
      key: 'late',
      label: 'تجاوز حدّ القسم',
      value: late.length,
      note: 'في السيستم كله',
      tone: late.length ? 'no' : 'ok',
      to: `${ROUTES.projects}?overdue=1&sort=waiting`,
      icon: icons.clock,
    },
    {
      key: 'orphan',
      label: 'بلا مالك',
      value: orphan.length,
      note: 'محتاجة إسناد',
      tone: orphan.length ? 'warn' : 'ok',
      to: `${ROUTES.projects}?unowned=1`,
      icon: icons.users,
    },
    {
      key: 'docs',
      label: 'جهات ملفها ناقص',
      value: shortDocs.length,
      note: 'الاتفاقيات بتقف عندها',
      tone: shortDocs.length ? 'warn' : 'ok',
      to: `${ROUTES.entities}?docs=1`,
      icon: icons.entity,
    },
  ] as const

  return (
    <AppLayout assistantContext={assistFor.home(user.name, mine.length, late.length)} autoAssistant>
      <div className="viewstack">
        <div className="screen col">
          <nav className="crumb" aria-label="مسار التنقّل">
            <span className="now">صندوقي</span>
          </nav>

          <header className="hhead">
            <div>
              <h1 className="ptitle">{GREET()}، {user.name.split(' ')[0]}</h1>
              <p className="sub" style={{ marginTop: '.3rem' }}>
                {TODAY()} · {user.role}
              </p>
            </div>
          </header>

          {/* ═══ ١ — إيه اللي عليّ؟ ═══ */}
          <div className="htiles">
            {tiles.map((t) => (
              <Link key={t.key} to={t.to} className={`htile glass t-${t.tone}`}>
                <Icon path={t.icon} size={18} />
                <span className="htile-v num">{t.value}</span>
                <span className="htile-l">{t.label}</span>
                <span className="htile-n sub">{t.note}</span>
              </Link>
            ))}
          </div>

          <div className="g2">
            <div className="col">
              {/* ═══ ٣ — أبدأ بإيه؟ ═══ */}
              <Glass>
                <Head
                  title="طابور قرارك"
                  meta={<Link className="lnk" to={`${ROUTES.projects}?owner=${encodeURIComponent(user.name)}&status=في الدراسة`}>الكل</Link>}
                />
                {queue.length === 0 ? (
                  <Empty title="مفيش مشروع منتظر قرارك." note="كل اللي مسند لك اتحرّك." />
                ) : (
                  <div className="qrows">
                    {queue.map((p) => {
                      const over = stagePressure(p) > 1
                      return (
                        <Link key={p.id} to={ROUTES.project(p.id)} className="qrow well">
                          <div className="qrow-h">
                            <Mono>{p.id}</Mono>
                            <Tag tone={groupTone(p.statusGroup)}>{p.stage}</Tag>
                            <span className="pc-sp" />
                            <span className="num">{nf.format(p.amountRequested)} <Riyal /></span>
                          </div>
                          <div className="qrow-n">{p.name}</div>
                          <div className="sub qrow-f">
                            {p.entityName} ·{' '}
                            <span className={over ? 'over' : ''}>
                              <span className="num">{days(p.hoursInStage)}</span> يومًا في القسم
                            </span>
                            {' · '}وزن <span className="num">{p.weight}</span>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </Glass>

              {/* ما يحتاج انتباه — على مستوى السيستم لا صندوقك */}
              <Glass className={attention.length ? 'alertcard' : undefined}>
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
                          <span className="over">
                            <span className="num">
                              +{days(p.hoursInStage - p.stageLimit)}
                            </span>{' '}
                            يومًا فوق الحدّ
                          </span>
                        </div>
                        <div className="qrow-n">{p.name}</div>
                        <div className="sub qrow-f">
                          {p.entityName} · {p.owner ?? 'بلا مالك'}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </Glass>
            </div>

            {/* ═══ ٢ و٤ — القراءة العرضية، وبعدها المالي والتشغيلي ═══ */}
            <div className="col">
              <QuickRead
                readings={readings}
                title="قراءة سريعة للسيستم"
                onAsk={() =>
                  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
                }
              />

              <Glass>
                <Head
                  title="ميزانية ٢٠٢٦"
                  meta={<Link className="lnk" to={ROUTES.budget}>التفاصيل</Link>}
                />
                <div className="bsplit">
                  <div
                    className="bsplit-r"
                    style={{ width: `${(budget.reserved / budget.allocated) * 100}%` }}
                    title="محجوز"
                  />
                  <div
                    className="bsplit-c"
                    style={{ width: `${(budget.committed / budget.allocated) * 100}%` }}
                    title="ملتزم به"
                  />
                  <div
                    className="bsplit-s"
                    style={{ width: `${(budget.spent / budget.allocated) * 100}%` }}
                    title="مصروف"
                  />
                </div>
                <dl className="blist">
                  {([
                    ['المخصص', budget.allocated, ''],
                    ['المحجوز', budget.reserved, 'r'],
                    ['الملتزم به', budget.committed, 'c'],
                    ['المصروف', budget.spent, 's'],
                    ['المتبقّي', budget.remaining, ''],
                  ] as [string, number, string][]).map(([k, val, cls]) => (
                    <div key={k}>
                      <dt>{cls && <i className={`bdot b-${cls}`} />}{k}</dt>
                      <dd className="num">{nf.format(val)} <Riyal /></dd>
                    </div>
                  ))}
                </dl>
                <p className="sub" style={{ marginTop: '.7rem' }}>
                  المخصص من النظام العامل. الأربعة الباقية محسوبة من العيّنة التجريبية،
                  فنسبة الاستهلاك أقل من الواقع.
                </p>
              </Glass>

              <Glass>
                <Head title="أين تقف المشاريع" meta={<span className="sub">{projects.length}</span>} />
                <div className="gbars">
                  {byGroup.map((g) => (
                    <Link
                      key={g.group}
                      className="gbar"
                      to={`${ROUTES.projects}?status=${encodeURIComponent(g.group)}`}
                    >
                      <span className="gbar-l">{g.group}</span>
                      <span className="gbar-t">
                        <i
                          style={{
                            width: `${(g.count / maxGroup) * 100}%`,
                            background: `var(--tone-${groupTone(g.group)})`,
                          }}
                        />
                      </span>
                      <span className="gbar-n num">{g.count}</span>
                    </Link>
                  ))}
                </div>
              </Glass>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

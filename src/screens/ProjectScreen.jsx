import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { project as P, entity as E, insights, followUpTypes, currentUser, authority } from '../data/project.js'
import { Rail, DecisionBar, Background, Assistant, MobileTop } from '../components/Shell.jsx'
import { Glass, Head, Tag, Num, Mono, KV, VSteps, CeilingLadder, GateArc, Riyal, Tabs, Timeline, Empty, Stat, Icon, icons, nf, useMediaQuery } from '../components/ui.jsx'

const TABS = ['بيانات المشروع', 'الجهة', 'المشاريع السابقة', 'الاتفاقية', 'الدفعات', 'المتابعات', 'سجل المشروع', 'المراسلات']

export default function ProjectScreen({ onOpenChat }) {
  const [tab, setTab] = useState(TABS[0])
  const costPerBeneficiary = Math.round(P.amountRequested / P.beneficiaries)
  const breach = P.log.find((l) => l.hours > l.limit)
  const [ai, setAi] = useState(false)
  const mobile = useMediaQuery('(max-width: 860px)')

  // المساعد متاح من أي شاشة بـ ⌘K، ويقفل بـ Esc
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setAi((v) => !v)
      }
      if (e.key === 'Escape') setAi(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <Background />
      <div className="app">
        {mobile && <MobileTop user={currentUser} />}
        <div className="shell">
          <Rail active="projects" user={currentUser} onAssistant={() => setAi((v) => !v)} assistantOpen={ai} />

          <div className="viewstack">
            <div className="screen col">
              {/* المسار جوّه البودي، مش في هيدر منفصل */}
              <nav className="crumb" aria-label="مسار التنقّل">
                <span className="lb">المشاريع</span>
                <Icon path={icons.chevron} size={16} style={{ color: 'var(--t3)' }} />
                <span className="lb">دورة ٢٠٢٦ · {P.track}</span>
                <Icon path={icons.chevron} size={16} style={{ color: 'var(--t3)' }} />
                <span className="now">مشروع <Mono>{P.id}</Mono></span>
              </nav>

              {/* ═══ الترويسة — بلا سطح، بتقعد على الخلفية مباشرة ═══ */}
              <header className="phead">
                <div className="pmain">
                  <h1 className="ptitle">{P.name}</h1>

                  <div className="pamt">
                    <div className="lb">المبلغ المطلوب للدعم</div>
                    <div className="v num">
                      {nf.format(P.amountRequested)}
                      <small><Riyal /></small>
                    </div>
                    <div className="sub">
                      إجمالي المشروع <Num>{P.amountTotal}</Num> · تمويل كامل
                    </div>
                  </div>
                </div>

                <div className="pgates">
                  <GateArc amount={P.amountRequested} authority={authority} compact={mobile} />
                </div>
              </header>

              <Tabs items={TABS} active={tab} onChange={setTab} />

              <div className="g2">
                {/* ═══════ العمود الرئيسي ═══════ */}
                <div className="col">
                  {tab === 'بيانات المشروع' && <TabData costPerBeneficiary={costPerBeneficiary} onEntity={() => setTab('الجهة')} />}
                  {tab === 'الجهة' && <TabEntity />}
                  {tab === 'المشاريع السابقة' && <TabPrevious />}
                  {tab === 'الاتفاقية' && <TabAgreement />}
                  {tab === 'الدفعات' && <TabPayments />}
                  {tab === 'المتابعات' && <TabFollowUps />}
                  {tab === 'سجل المشروع' && <TabLog />}
                  {tab === 'المراسلات' && <TabMessages />}
                </div>

                {/* ═══════ العمود الجانبي — سياق ثابت ═══════ */}
                <div className="col">
                  <SideAI breach={breach} onAsk={() => setAi(true)} />
                  <SideProjects onOpen={() => setTab('المشاريع السابقة')} />
                  <SideLog onOpen={() => setTab('سجل المشروع')} />
                </div>
              </div>

            </div>

            <DecisionBar user={currentUser} project={{ name: P.name, amount: P.amountRequested }} compact={mobile} />
          </div>

          <Assistant
            open={ai}
            onClose={() => setAi(false)}
            onFull={onOpenChat}
            context={{
              title: `مشروع ${P.id} · ${P.name}`,
              sub: <>{E.name} · {P.track} · <span className="num">{nf.format(P.amountRequested)}</span> <Riyal /></>,
            }}
          />
        </div>
      </div>
    </>
  )
}

/* ═══════════════ تابات العمود الرئيسي ═══════════════ */

function TabData({ costPerBeneficiary, onEntity }) {
  const [prev, setPrev] = useState(null)
  return (
    <>
      <Glass>
        <Head title="التعريف" meta="٧ حقول" />
        <KV
          rows={[
            { k: 'الجهة', v: <a onClick={onEntity}>{E.name}</a> },
            { k: 'رقم المشروع', v: <Mono>{P.id}</Mono> },
            { k: 'الحالة', v: <Tag tone={P.status.tone}>{P.status.label}</Tag> },
            { k: 'المسار', v: P.track },
            { k: 'المجال', v: P.field },
            { k: 'الهدف', v: P.goal },
            { k: 'الوسوم', v: P.tags.length ? P.tags.join('، ') : <span className="sub">لا يوجد</span> },
          ]}
        />
      </Glass>

      <div className="stats4">
        <Stat label="المبلغ المطلوب" value={nf.format(P.amountRequested)} unit={<Riyal />} bar={{ w: '100%', c: 'var(--teal)' }} note="١٠٠٪ من إجمالي المشروع" />
        <Stat label="مدة التنفيذ" value={P.durationDays} unit="يومًا" note={<>تبدأ <Mono>{P.startDate}</Mono></>} />
        <Stat label="المستفيدون" value={nf.format(P.beneficiaries)} note="تقدير الجهة، لم يُراجَع من المشرف" />
        <Stat label="تكلفة المستفيد" value={costPerBeneficiary} unit={<Riyal />} note="محسوبة، لمقارنة المشاريع" />
      </div>

      <Glass>
        <Head title="فكرة المشروع" meta="من نموذج التقديم" />
        <p style={{ fontSize: '.87rem', lineHeight: 1.9, margin: 0 }}>{P.idea}</p>
        <div className="well" style={{ padding: '.9rem 0 0', marginTop: '1rem' }}>
          <div className="lb">الهدف العام</div>
          <div style={{ fontSize: '.86rem', lineHeight: 1.8, marginTop: '.25rem' }}>{P.mainGoal}</div>
        </div>

        <div className="hd" style={{ marginTop: '1.4rem', marginBottom: '.7rem' }}>
          <h3 style={{ fontSize: '.9rem' }}>الأهداف التفصيلية</h3>
          <span className="meta">{P.goals.length}</span>
        </div>
        <div className="col-s">
          {P.goals.map((g, i) => (
            <div className="data" key={i} style={{ padding: '.7rem 0' }}>
              <div style={{ fontSize: '.85rem', lineHeight: 1.7 }}>{g}</div>
            </div>
          ))}
        </div>

        <div className="hd" style={{ marginTop: '1.4rem', marginBottom: '.7rem' }}>
          <h3 style={{ fontSize: '.9rem' }}>المخرجات</h3>
          <span className="meta">{P.outputs.length}</span>
        </div>
        <div className="col-s">
          {P.outputs.map((g, i) => (
            <div className="data" key={i} style={{ padding: '.7rem 0' }}>
              <div style={{ fontSize: '.85rem', lineHeight: 1.7 }}>{g}</div>
            </div>
          ))}
        </div>

        <div className="hd" style={{ marginTop: '1.4rem', marginBottom: '.7rem' }}>
          <h3 style={{ fontSize: '.9rem' }}>المسوغات</h3>
          <span className="meta">{P.rationale.length}</span>
        </div>
        <div className="col-s">
          {P.rationale.map((g, i) => (
            <div className="data" key={i} style={{ padding: '.7rem 0' }}>
              <div style={{ fontSize: '.85rem', lineHeight: 1.7 }}>{g}</div>
            </div>
          ))}
        </div>
      </Glass>

      <Glass>
        <Head title="مراحل التنفيذ" meta={`${P.phases.length} مراحل · ١١ شهرًا`} />
        <Timeline
          events={P.phases.map((ph) => ({
            tone: ph.tone,
            title: (<><b>{ph.name}</b> — {ph.tasks}</>),
            by: <Mono>{ph.months}</Mono>,
          }))}
        />
        <div className="sub" style={{ marginTop: '.9rem' }}>
          في النظام الحالي هذه المراحل نصٌّ حر داخل حقل واحد. هنا كيان له بنود وتواريخ، ويصلح لربط دفعات الصرف به.
        </div>
      </Glass>

      <Glass>
        <Head title="النطاق والأثر" meta="مطابقة لنموذج التقديم" />
        <KV
          rows={[
            { k: 'المنطقة والمدينة', v: `${P.region} · ${P.city}` },
            { k: 'عدد المستفيدين', v: (<><Num>{P.beneficiaries}</Num> <span className="sub">(الفعلي من المشرف: <Num>{P.beneficiariesVerified}</Num>)</span></>) },
            {
              k: 'الفئة المستهدفة',
              v: (
                <div className="chips" style={{ gap: '.35rem' }}>
                  {P.audiences.map((a) => (
                    <span className="chip" key={a} style={{ fontSize: '.72rem', padding: '.28rem .65rem' }}>{a}</span>
                  ))}
                </div>
              ),
            },
          ]}
        />
        <div className="hd" style={{ marginTop: '1.3rem', marginBottom: '.6rem' }}>
          <h3 style={{ fontSize: '.9rem' }}>الامتثال</h3>
          <span className="meta">٣ إقرارات</span>
        </div>
        <div className="g3" style={{ gap: '.6rem' }}>
          {P.compliance.map((c) => (
            <div className="well" key={c.k} style={{ padding: '.75rem 0 0' }}>
              <div className="lb">{c.k}</div>
              <div style={{ fontSize: '.9rem', fontFamily: 'var(--fd)', fontWeight: 600, marginTop: '.2rem' }}>{c.v}</div>
            </div>
          ))}
        </div>
      </Glass>

      <Glass>
        <Head title="المرفقات" meta={`${P.attachments.filter((a) => a.uploaded).length} من ${P.attachments.length} مرفوعة`} />
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr><th>المرفق</th><th>الحالة</th><th className="n">إجراء</th></tr>
            </thead>
            <tbody>
              {P.attachments.map((a) => (
                <tr key={a.name} className={a.uploaded ? '' : 'off'}>
                  <td>
                    <div className="nmc">
                      <Icon path={icons.file} size={16} style={{ color: 'var(--t3)' }} />
                      {a.name}
                    </div>
                  </td>
                  <td>{a.uploaded ? <Tag tone="ok">مرفوع</Tag> : <Tag>{a.required ? 'مطلوب، غير مرفوع' : 'اختياري، غير مرفوع'}</Tag>}</td>
                  <td className="n">
                    {a.uploaded ? (
                      <span className="rowf" style={{ gap: '.5rem', justifyContent: 'flex-end' }}>
                        <button className="lnk" onClick={() => setPrev(a)}>عرض</button>
                        <span className="dot" />
                        <a>تحميل</a>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sub" style={{ marginTop: '.8rem' }}>
          الموازنة التفصيلية هي المطلوبة في طلب الاستكمال الحالي — الملف المرفوع صورة لا تُقرأ آليًا.
        </div>
      </Glass>

      {prev && <FilePreview file={prev} onClose={() => setPrev(null)} />}

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
        <div className="sub" style={{ marginTop: '.8rem' }}>
          البيانات البنكية مصدرها ملف الجهة، معروضة هنا للمراجعة فقط ولا تُحرَّر من المشروع.
        </div>
      </Glass>
    </>
  )
}

function TabEntity() {
  return (
    <>
      <Glass>
        <Head title="ملف الجهة" meta={E.type} />
        <KV
          rows={[
            { k: 'اسم الجهة', v: E.name },
            { k: 'التصنيف', v: E.type },
            { k: 'الجهة المرخِّصة', v: E.licensor },
            { k: 'الإشراف الفني', v: E.supervisor },
            { k: 'المنطقة والمدينة', v: `${E.region} · ${E.city}` },
            { k: 'رقم الترخيص', v: <Mono>{E.licenseNo}</Mono> },
            { k: 'نهاية الترخيص', v: (<><Mono>{E.licenseEnd}</Mono> <span className="sub">{E.licenseEndH}</span></>) },
            { k: 'نهاية تكليف المجلس', v: <Mono>{E.boardEnd}</Mono> },
            { k: 'التأسيس', v: (<><Mono>{E.founded}</Mono> <span className="sub">{E.foundedH}</span></>) },
            { k: 'المدير التنفيذي', v: `${E.ceo} — ${E.ceoMobile}` },
            { k: 'مدخل البيانات', v: E.dataEntry },
            { k: 'جوال الجهة', v: <Mono>{E.mobile}</Mono> },
            { k: 'البريد', v: <Mono>{E.email}</Mono> },
            { k: 'نوع الحساب', v: E.accountType },
            { k: 'درجة الحوكمة', v: <Tag tone="warn">{E.governance}</Tag> },
          ]}
        />
      </Glass>

      <Glass>
        <Head title="مستندات الجهة" meta={`${E.docs.filter((d) => d.uploaded).length} من ${E.docs.length}`} />
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>المستند</th><th>الحالة</th></tr></thead>
            <tbody>
              {E.docs.map((d) => (
                <tr key={d.name} className={d.uploaded ? '' : 'off'}>
                  <td><div className="nmc"><Icon path={icons.file} size={16} style={{ color: 'var(--t3)' }} />{d.name}</div></td>
                  <td>{d.uploaded ? <Tag tone="ok">مرفوع</Tag> : <Tag tone="warn">ناقص</Tag>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sub" style={{ marginTop: '.8rem' }}>
          خمسة مستندات ناقصة، منها تقرير الحوكمة وتقرير المراجع القانوني — وهي المدخلات التي تُبنى عليها درجة الحوكمة.
        </div>
      </Glass>

      <Glass>
        <Head title="الحساب البنكي" meta="حساب واحد مفعّل" />
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>المصرف</th><th>اسم الحساب</th><th>الآيبان</th><th>الحالة</th></tr></thead>
            <tbody>
              <tr>
                <td>{P.bank.name}</td>
                <td>{P.bank.account}</td>
                <td><Mono>{P.bank.iban}</Mono></td>
                <td><Tag tone="ok">{P.bank.status}</Tag></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Glass>
    </>
  )
}

function TabPrevious() {
  return (
    <>
      <Glass>
        <Head title="مؤشرات الجهة" meta="تراكمي" />
        <div className="imp" style={{ '--n': E.stats.length }}>
          {E.stats.map((s) => (
            <div key={s.k}>
              <div className="v num">{nf.format(s.v)}</div>
              <div className="k">{s.k}</div>
            </div>
          ))}
        </div>
      </Glass>
      <Glass>
        <Head title="مشاريع الجهة" meta={`${E.projects.length} مشاريع`} />
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>الرقم</th><th>المشروع</th><th>المنطقة</th><th>الحالة</th><th className="n">الوزن</th></tr></thead>
            <tbody>
              {E.projects.map((p) => (
                <tr key={p.id} className={p.id === P.id ? 'lv0' : ''}>
                  <td><Mono>{p.id}</Mono></td>
                  <td>{p.name}</td>
                  <td>{p.region}</td>
                  <td><Tag tone={p.tone}>{p.status}</Tag></td>
                  <td className="n num">{p.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sub" style={{ marginTop: '.8rem' }}>
          مشروع واحد اعتُذر عنه بوزن <Num>96</Num> — وهو أعلى وزن سُجّل للجهة. سبب الاعتذار غير مسجّل في النظام الحالي.
        </div>
      </Glass>
    </>
  )
}

function TabAgreement() {
  return (
    <Glass>
      <Head title="اتفاقية المشروع" meta="تُفتح بعد الاعتماد النهائي" />
      <Empty
        title="لا توجد اتفاقية — المشروع لم يصل لمرحلة الاعتماد."
        note="عند التفعيل: اختيار القالب · استرجاع بيانات المشروع تلقائيًا · بنود الأحكام والشروط · جدول الدفعات · دورة التوقيع"
        actions={
          <>
            <button className="btn btn-off">طباعة الاتفاقية</button>
            <button className="btn btn-off">مسودة جديدة</button>
          </>
        }
      />
    </Glass>
  )
}

function TabPayments() {
  return (
    <Glass>
      <Head title="جدول الدفعات" meta="يُفتح بعد اعتماد الاتفاقية" />
      <Empty
        title="لا توجد دفعات — المشروع لم يصل لمرحلة الاتفاقية."
        note="الأعمدة عند التفعيل: الدفعة · المبلغ · تاريخ الدفعة · الحالة · إذن الصرف"
      />
    </Glass>
  )
}

function TabFollowUps() {
  return (
    <Glass>
      <Head title="المتابعات" meta={`${P.followUps.length} متابعة`} />
      <Empty title="لا توجد متابعات مسجّلة على هذا المشروع." />
      <div className="hd" style={{ marginTop: '1.2rem', marginBottom: '.6rem' }}>
        <h3 style={{ fontSize: '.9rem' }}>إضافة متابعة</h3>
        <span className="meta">النوع والوصف إلزاميان</span>
      </div>
      <div className="chips">
        {followUpTypes.map((t) => (
          <button className="chip" key={t}>{t}</button>
        ))}
      </div>
      <div className="sub" style={{ marginTop: '.8rem' }}>
        المرفق أقل من ٣٢ ميجابايت · pdf doc docx txt jpg jpeg gif png xls xlsx
      </div>
    </Glass>
  )
}

function TabLog() {
  return (
    <Glass>
      <Head title="سجل المشروع" meta={`${P.log.length} إجراءات`} />
      <Timeline
        events={P.log.map((l) => ({
          tone: l.tone,
          title: (<><b>{l.action}</b> — {l.body}</>),
          by: (
            <>
              <span className="av" style={{ width: 20, height: 20, fontSize: '.6rem' }}>{l.by[0]}</span>
              <span>{l.by} · {l.dept}</span>
              <Mono>{l.at}</Mono>
            </>
          ),
          foot: (<>{l.days} يومًا · <Num>{l.hours}</Num> من <Num>{l.limit}</Num> ساعة{l.extra ? ` · ${l.extra}` : ''}</>),
          footTone: l.hours > l.limit ? 'var(--no)' : undefined,
        }))}
      />
      <div className="sub" style={{ marginTop: '.9rem' }}>
        كل إجراء يحمل: القسم · المنفّذ · الوقت · المدة مقابل حدّ القسم · سبب التأخر إن وُجد.
      </div>
    </Glass>
  )
}

function TabMessages() {
  return (
    <Glass>
      <Head title="المراسلة مع الجهة" meta={`${P.messages.length} رسائل`} />
      <div className="sub" style={{ marginBottom: '.8rem' }}>
        القناة الرسمية داخل المشروع، مرتبطة بطلب الاستكمال الحالي.
      </div>
      <Empty title="لا توجد رسائل بعد." />
      <div className="ask free" style={{ marginTop: '1rem' }}>
        <span className="ph">اكتب رسالة لـ{E.name}…</span>
        <button className="attach"><Icon path={icons.clip} /></button>
        <button className="go"><Icon path={icons.send} /></button>
      </div>
    </Glass>
  )
}

/* ═══ معاينة المرفق ═══
   المراجع يقرأ الملف من مكانه، ما يحمّلش عشان يشوف.
   الموازنة هنا صورة مسحوبة، فبنقول له كده صراحة. */
function FilePreview({ file, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const scanned = file.name.includes('الموازنة')

  /* بورتال على الـbody: أي أب فيه backdrop-filter بيبقى الحاوية
     للـposition:fixed، فالمودال كان بيقع جنب الكارت مش في النص */
  return createPortal(
    <>
      <div className="ascrim on" onClick={onClose} aria-hidden="true" />
      <div className="fprev chrome" role="dialog" aria-label={`معاينة ${file.name}`}>
        <div className="fphead">
          <span className="badge badge-30"><Icon path={icons.file} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="atitle">{file.name}</div>
            <div className="sub">
              {scanned ? 'صورة ممسوحة · لا تُقرأ آليًا' : 'PDF · صفحة ١ من ١'}
            </div>
          </div>
          <button className="aclose" title="تحميل" aria-label="تحميل"><Icon path={icons.clip} size={16} /></button>
          <button className="aclose" onClick={onClose} aria-label="إغلاق"><Icon path={icons.close} size={16} /></button>
        </div>

        <div className="fpbody">
          <div className="fppage">
            <div className="fpph">
              <Icon path={icons.file} />
              <div>معاينة الملف تظهر هنا</div>
              <div className="sub">يُقرأ من مخزن المرفقات مباشرة، بلا تحميل</div>
            </div>
          </div>
        </div>

        {scanned && (
          <div className="fpfoot">
            <span className="tag warn">صورة</span>
            <span className="sub">
              الملف صورة، فبنود الموازنة ما تتقارنش آليًا بالمبلغ المطلوب. طلب الاستكمال الحالي يطلب نسخة قابلة للقراءة.
            </span>
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}

/* ═══════════════ العمود الجانبي ═══════════════ */

/* ═══════════════════════════════════════════════════════════
   تحليلات المشروع السريعة — أول حاجة في عمود السياق.
   تجاوز مدة الإجراء بقى قراءة جوّه التحليلات، مش كارت لوحده،
   عشان كل اللي المساعد شايفه عن حالة المشروع يبقى في مكان واحد.
   ═══════════════════════════════════════════════════════════ */
/* المساعد بيقرأ ويكتب قدّامك: أول ما الكارت يوصل للشاشة
   يفكّر لحظة، وبعدين يكتب كل قراءة سطرًا سطرًا. */
const THINK_MS = 900
const CHARS_PER_TICK = 3
const TICK_MS = 16
const BLOCK_PAUSE = 340

function useTypedBlocks(texts, active) {
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion:reduce)').matches
  const [b, setB] = useState(reduce ? texts.length : 0)
  const [c, setC] = useState(0)

  useEffect(() => {
    if (!active || reduce || b >= texts.length) return
    const txt = texts[b] || ''
    if (c < txt.length) {
      const id = setTimeout(() => setC((v) => Math.min(txt.length, v + CHARS_PER_TICK)), TICK_MS)
      return () => clearTimeout(id)
    }
    const id = setTimeout(() => { setB((v) => v + 1); setC(0) }, BLOCK_PAUSE)
    return () => clearTimeout(id)
  }, [active, reduce, b, c, texts])

  return { block: b, chars: c, done: b >= texts.length }
}

/* بيشغّل الكتابة أول ما الكارت يبان في الشاشة، وبعده يفضل شغّال */
function useOnScreen(ref, rootMargin = '-40px') {
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (typeof IntersectionObserver !== 'function') { setSeen(true); return }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } },
      { rootMargin, threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, seen, rootMargin])
  return seen
}

function SideAI({ breach, onAsk }) {
  const over = breach ? Math.round((breach.hours / breach.limit - 1) * 100) : 0
  const breachText = breach
    ? `الإجراء استهلك ${nf.format(breach.hours)} ساعة مقابل حدّ ${nf.format(breach.limit)} — أي ${over}٪ فوق الحدّ، ومفتوح من ٨٧ يومًا بلا سبب مسجَّل. المشروع واقف على الجهة منذ طلب الاستكمال.`
    : null

  const blocks = [
    ...(breach
      ? [{
          kind: 'breach',
          text: breachText,
          bold: [nf.format(breach.hours), nf.format(breach.limit), `${over}٪ فوق الحدّ`, '٨٧ يومًا'],
          danger: [`${over}٪ فوق الحدّ`],
        }]
      : []),
    ...insights.map((it) => ({ kind: 'ins', text: it.text, bold: it.bold, src: it.src })),
  ]

  const ref = useRef(null)
  const onScreen = useOnScreen(ref)
  const [thought, setThought] = useState(false)
  useEffect(() => {
    if (!onScreen || thought) return
    const id = setTimeout(() => setThought(true), THINK_MS)
    return () => clearTimeout(id)
  }, [onScreen, thought])

  const { block, chars, done } = useTypedBlocks(blocks.map((x) => x.text), thought)
  const thinking = onScreen && !thought

  return (
    <Glass className="aicard" ref={ref}>
      <div className="rowf" style={{ gap: '.6rem', marginBottom: '.9rem' }}>
        <span className={`badge badge-30${done ? '' : ' pulse'}`}><span className="aispark" /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: '.95rem' }}>تحليلات المشروع السريعة</div>
          <div className="sub">
            {done
              ? <>قراءة آلية · استرشادية غير مُلزِمة</>
              : <>مساعد أبانمي يقرأ الملف<span className="dots"><i /><i /><i /></span></>}
          </div>
        </div>
        <button className="btn btn-2 btn-sm" onClick={onAsk} disabled={!done}>اسأل</button>
      </div>

      {thinking && (
        <div className="skel" aria-hidden="true">
          <span style={{ width: '92%' }} /><span style={{ width: '78%' }} /><span style={{ width: '56%' }} />
        </div>
      )}

      <div className="ins">
        {blocks.map((bl, i) => {
          if (i > block) return null
          const typing = i === block
          const body = typing ? bl.text.slice(0, chars) : highlight(bl.text, bl.bold, bl.danger)

          if (bl.kind === 'breach') {
            return (
              <div className={`data i flag${typing ? ' typing' : ''}`} key="breach">
                <div className="rowf" style={{ justifyContent: 'space-between', gap: '.5rem', marginBottom: '.5rem' }}>
                  <span className="itag no">تجاوز مدة الإجراء</span>
                  <span className="sub">{breach.dept}</span>
                </div>
                <div className="tx">{body}{typing && <span className="caret" />}</div>
                {!typing && (
                  <div className="rise">
                    <div className="bar over" style={{ marginTop: '.6rem' }}>
                      <i style={{ width: '100%' }} />
                      <u style={{ insetInlineStart: `${Math.round((breach.limit / breach.hours) * 100)}%` }} />
                    </div>
                    <div className="rowf" style={{ justifyContent: 'space-between', marginTop: '.35rem' }}>
                      <span className="sub">الحدّ <span className="num">{nf.format(breach.limit)}</span> ساعة</span>
                      <span className="sub" style={{ color: 'var(--warn)' }}>
                        المستهلَك <span className="num">{nf.format(breach.hours)}</span>
                      </span>
                    </div>
                    <div className="src">المصدر: سجل الإجراءات · حدّ قسم {breach.dept}</div>
                    <div className="rowf" style={{ gap: '.5rem', marginTop: '.75rem' }}>
                      <button className="btn btn-1 btn-sm">تذكير الجهة</button>
                      <button className="btn btn-2 btn-sm">تسجيل سبب</button>
                    </div>
                  </div>
                )}
              </div>
            )
          }

          return (
            <div className={`data i${typing ? ' typing' : ''}`} key={i}>
              <div className="tx">{body}{typing && <span className="caret" />}</div>
              {!typing && <div className="src rise">{bl.src}</div>}
            </div>
          )
        })}
      </div>
    </Glass>
  )
}

function SideProjects({ onOpen }) {
  return (
    <Glass>
      <Head title="مشاريع الجهة" meta={E.projects.length} />
      <div className="col-s">
        {E.projects.map((p) => (
          <button className="data li" key={p.id} style={{ padding: '.75rem 0' }} onClick={onOpen}>
            <div>
              <div className="t">{p.name}</div>
              <div className="s">
                <Mono>{p.id}</Mono>
                <Tag tone={p.tone}>{p.status}</Tag>
              </div>
            </div>
            <span className="sub">وزن <Num>{p.weight}</Num></span>
          </button>
        ))}
      </div>
    </Glass>
  )
}

function SideLog({ onOpen }) {
  const l = P.log[0]
  return (
    <Glass>
      <Head title="آخر إجراء" meta={<a onClick={onOpen}>السجل كامل</a>} />
      <div className="well" style={{ padding: '.9rem 0 0' }}>
        <div style={{ fontSize: '.86rem', lineHeight: 1.7 }}>
          <b>{l.action}</b> — {l.body}
        </div>
        <div className="sub" style={{ marginTop: '.45rem' }}>
          {l.by} · <Mono>{l.at}</Mono>
        </div>
        <div className="sub" style={{ marginTop: '.25rem', color: 'var(--no)' }}>
          {l.days} يومًا · <Num>{l.hours}</Num> من <Num>{l.limit}</Num> ساعة
        </div>
      </div>
    </Glass>
  )
}

/* يبرز الكلمات المهمة داخل نص القراءة */
function highlight(text, words = [], danger = []) {
  if (!words.length) return text
  const parts = []
  let rest = text
  let key = 0
  while (rest.length) {
    let idx = -1
    let hit = null
    for (const w of words) {
      const i = rest.indexOf(w)
      if (i !== -1 && (idx === -1 || i < idx)) { idx = i; hit = w }
    }
    if (idx === -1) { parts.push(rest); break }
    parts.push(rest.slice(0, idx))
    parts.push(<b key={key++} className={danger.includes(hit) ? 'bad' : undefined}>{hit}</b>)
    rest = rest.slice(idx + hit.length)
  }
  return parts
}

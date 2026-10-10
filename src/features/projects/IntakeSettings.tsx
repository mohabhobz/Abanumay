import { meOf, readRole } from '@/data/roles'
import { DECISIONS } from '@/data/shared/decisions'
import { rederiveEnds } from '@/data/intake/flow'
import { useMemo, useState } from 'react'
import {
  DateField, FieldSelect, Glass, Head, Icon, icons, MultiSelect, Num, Person, Switch, Tag,
} from '@/components/ui'
import { SaveBar } from '@/components/shell'
import { CfgNum } from '@/features/settings/CfgEdit'
import { FIELDS_BY_TRACK, GOALS_BY_FIELD, OWNERS } from '@/data/mock/taxonomy'
import { projectRows } from '@/data/mock/projects'
import { MONEY_LIMITS } from '@/data/mock/settings'
import {
  ALL_FIELDS, CYCLE, DISTRIBUTION_LABEL, TODAY, WEEKDAYS, saveCycle, type CycleSetup, type Distribution,
} from '@/data/intake/cycle'
import { CRITERIA, saveCriteria, weightSum, type Criterion } from '@/data/intake/criteria'
import { CONSULTANTS, saveConsultants, type Consultant } from '@/data/intake/consultants'
import { PROSPECTS, saveProspects, type Prospect } from '@/data/intake/prospects'
import { resetIntake } from '@/data/intake/flow'

/* Intake settings · procedure 3, the part the authority sets before requests arrive.

   Four tabs on the projects settings page, each a draft saved through the system's action dock:
     «دورة الاستقبال»   period, cycle supervisors and their specialties, each domain's supervisors,
                        distribution rule and open switch, and the working-day calendar
     «معايير التقييم»    the weighted criteria of the supervisor's study
     «المستشارون»        consultants, their domains and access window, and the wait-for-opinion rule
     «الجهات المقترحة»   the outreach register for the grant year */

const DIST: Distribution[] = ['manual', 'even', 'load', 'specialty']
const inStudy = (field: string) => projectRows.filter((p) => p.field === field && p.statusGroup === 'في الدراسة').length

/* ═══ Cycle ═══ */

export function CycleTab() {
  const [saved, setSaved] = useState<CycleSetup>(() => structuredClone(CYCLE))
  const [d, setD] = useState<CycleSetup>(() => structuredClone(CYCLE))
  const dirty = JSON.stringify(d) !== JSON.stringify(saved)
  const patch = (fn: (x: CycleSetup) => void) => setD((x) => { const y = structuredClone(x); fn(y); return y })
  const [hDate, setHDate] = useState('')
  const [hName, setHName] = useState('')

  const badPeriod = d.to < d.from
  const open = ALL_FIELDS.filter((f) => d.domains[f]?.open).length
  const cap = MONEY_LIMITS.find((l) => l.key === 'projectsPerEntity')?.value ?? 0
  const live = TODAY >= d.from && TODAY <= d.to

  return (
    <>
      <Glass>
        <Head
          title="الدورة وفترة التقديم"
          meta={live ? <Tag tone="ok">البوابة مفتوحة الآن</Tag> : <Tag tone="mute">البوابة مغلقة</Tag>}
        />
        <div className="cfgrow">
          <label className="regf cfgwide">
            <span className="lb">اسم الدورة</span>
            <span className="fld"><input value={d.name} onChange={(e) => patch((x) => { x.name = e.target.value })} aria-label="اسم الدورة" /></span>
          </label>
          <label className="regf">
            <span className="lb">من</span>
            <DateField value={d.from} onChange={(v) => patch((x) => { x.from = v })} label="بداية فترة التقديم" />
          </label>
          <label className="regf">
            <span className="lb">إلى</span>
            <DateField value={d.to} onChange={(v) => patch((x) => { x.to = v })} label="نهاية فترة التقديم" />
          </label>
        </div>
        {badPeriod && <p className="sub cnote"><Tag tone="warn">فترة غير صحيحة</Tag> نهاية الفترة تسبق بدايتها.</p>}
        <p className="sub cnote">
          خلال الفترة تظهر للجهات <b className="num">{open}</b> مجالات مفتوحة فقط، وخارجها لا يُقبل طلب جديد ·
          وحدّ طلبات الجهة في الدورة <b className="num">{cap}</b> (يُعدَّل من «الحدود المالية والزمنية»).
        </p>
      </Glass>

      <Glass>
        <Head title="مشرفو الدورة" meta={<span className="sub"><Num>{d.supervisors.length}</Num> مشرفين</span>} />
        <div className="cfgrow">
          <MultiSelect
            label="المشرفون المحدَّدون لهذه الدورة"
            values={d.supervisors}
            options={[...OWNERS]}
            people
            wide
            onChange={(v) => patch((x) => {
              x.supervisors = v
              /* A supervisor removed from the cycle leaves every domain too */
              for (const dm of Object.values(x.domains)) dm.supervisors = dm.supervisors.filter((s) => v.includes(s))
            })}
          />
        </div>
        <ul className="cfglist">
          {d.supervisors.map((s) => {
            const goals = Object.values(GOALS_BY_FIELD).flat()
            const domains = ALL_FIELDS.filter((f) => d.domains[f]?.supervisors.includes(s))
            return (
              <li key={s} className="itk-sup">
                <Person name={s} />
                <span className="sub trim1">{domains.length ? domains.join('، ') : 'بلا مجال بعد'}</span>
                <span className="pc-sp" />
                <MultiSelect
                  all="التخصص في الأهداف"
                  values={d.specialties[s] ?? []}
                  options={goals}
                  onChange={(v) => patch((x) => { x.specialties[s] = v })}
                />
              </li>
            )
          })}
        </ul>
        <p className="sub cnote">التخصص يقرؤه توزيع «حسب تخصص المشرف»: يذهب الطلب لمن هدفه ضمن تخصصه، وإلا لأقلّهم عبئًا.</p>
      </Glass>

      <Glass className="tblcard">
        <Head title="المجالات" meta={<span className="sub"><Num>{open}</Num> مفتوحة من <Num>{ALL_FIELDS.length}</Num></span>} />
        <table className="tbl itk-dom">
          <thead>
            <tr>
              <th><span className="th-t">المجال</span></th>
              <th><span className="th-t">المشرفون</span></th>
              <th><span className="th-t">التوزيع</span></th>
              <th><span className="th-t">مفتوح للتقديم</span></th>
              <th className="n"><span className="th-t">في الدراسة الآن</span></th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(FIELDS_BY_TRACK).map(([track, fields]) => (
              <DomainGroup key={track} track={track} fields={fields} d={d} patch={patch} />
            ))}
          </tbody>
        </table>
        <p className="sub cnote">لا يُفتح مجال قبل ربطه بمشرف واحد على الأقل · وللمجال أكثر من مشرف، وللمشرف أكثر من مجال.</p>
      </Glass>

      <Glass>
        <Head title="تقويم المدد" meta={<span className="sub">أيام عمل · تُستبعد العطل</span>} />
        <p className="sub cnote">تُحسب نهاية التنفيذ بأيام العمل من تاريخ البداية: تُستبعد العطلة الأسبوعية والإجازات الرسمية أدناه.</p>
        <div className="cfgchips">
          {WEEKDAYS.map((w, i) => {
            const on = d.weekend.includes(i)
            return (
              <button
                key={w}
                type="button"
                className={`cfgchip${on ? ' on' : ''}`}
                aria-pressed={on}
                onClick={() => patch((x) => { x.weekend = on ? x.weekend.filter((n) => n !== i) : [...x.weekend, i].sort() })}
              >
                {w}{on && <b>عطلة</b>}
              </button>
            )
          })}
        </div>
        <ul className="cfglist">
          {[...d.holidays].sort((a, b) => a.date.localeCompare(b.date)).map((h) => (
            <li key={`${h.date}-${h.name}`}>
              <b className="num">{h.date}</b>
              <span>{h.name}</span>
              <span className="pc-sp" />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch((x) => { x.holidays = x.holidays.filter((z) => !(z.date === h.date && z.name === h.name)) })}>
                <Icon name={icons.close} size="sm" />
                احذف
              </button>
            </li>
          ))}
        </ul>
        <div className="cfgrow">
          <label className="regf">
            <span className="lb">تاريخ الإجازة</span>
            <DateField value={hDate} onChange={setHDate} label="تاريخ الإجازة" />
          </label>
          <label className="regf cfgwide">
            <span className="lb">اسمها</span>
            <span className="fld"><input value={hName} onChange={(e) => setHName(e.target.value)} aria-label="اسم الإجازة" placeholder="مثال: عيد الأضحى" /></span>
          </label>
          <button
            type="button"
            className="btn btn-2 cfgadd"
            disabled={!hDate || !hName.trim()}
            onClick={() => { patch((x) => { x.holidays.push({ date: hDate, name: hName.trim() }) }); setHDate(''); setHName('') }}
          >
            أضف الإجازة
          </button>
        </div>
      </Glass>

      <Glass>
        <Head title="بيانات العرض التجريبية" meta={<Tag tone="mute">النموذج الأولي</Tag>} />
        <p className="sub cnote">الطلبات والدراسات والإحالات التي تُجرَّب على النموذج تُحفظ في هذا المتصفح · أعدها لحالتها الأولى قبل أي عرض.</p>
        <button type="button" className="btn btn-2" onClick={resetIntake}>أعد بيانات الاستقبال لحالتها الأولى</button>
      </Glass>

      {dirty && (
        <SaveBar
          count={1}
          sentence={<>تعديلات على «{d.name}»<span className="decsep" /><span className="sub">تسري على البوابة والإسناد فور الحفظ</span></>}
          onSave={() => {
            const before = structuredClone(CYCLE.holidays)
            saveCycle(d)
            /* Batch 8 · intake#15 · when the foundation decided so, open projects' ends follow the new holidays */
            if (DECISIONS.holidayRederive && JSON.stringify(before) !== JSON.stringify(CYCLE.holidays)) rederiveEnds(before, 'تحديث الإجازات الرسمية في إعدادات الاستقبال', meOf(readRole()))
            setSaved(structuredClone(CYCLE)); setD(structuredClone(CYCLE))
          }}
          onDiscard={() => setD(structuredClone(saved))}
          disabled={badPeriod}
        />
      )}
    </>
  )
}

function DomainGroup({ track, fields, d, patch }: {
  track: string
  fields: string[]
  d: CycleSetup
  patch: (fn: (x: CycleSetup) => void) => void
}) {
  return (
    <>
      <tr className="itk-track"><td colSpan={5}><b>{track}</b></td></tr>
      {fields.map((f) => {
        const dm = d.domains[f] ?? { supervisors: [], distribution: 'manual' as Distribution, open: false }
        const none = dm.supervisors.length === 0
        return (
          <tr key={f}>
            <td>{f}</td>
            <td>
              <MultiSelect
                all="بلا مشرف"
                values={dm.supervisors}
                options={d.supervisors}
                people
                onChange={(v) => patch((x) => {
                  x.domains[f] = { ...x.domains[f]!, supervisors: v }
                  if (v.length === 0) x.domains[f]!.open = false
                })}
              />
            </td>
            <td>
              <FieldSelect
                value={dm.distribution}
                label={`توزيع ${f}`}
                options={DIST.map((k) => ({ value: k, label: DISTRIBUTION_LABEL[k] }))}
                onChange={(v) => patch((x) => { x.domains[f] = { ...x.domains[f]!, distribution: v as Distribution } })}
              />
            </td>
            <td>
              <Switch
                label={dm.open ? 'مفتوح' : 'مغلق'}
                on={dm.open}
                disabled={none}
                lockNote="اربطه بمشرف أولًا"
                onChange={(v) => patch((x) => { x.domains[f] = { ...x.domains[f]!, open: v } })}
              />
            </td>
            <td className="n"><span className="num">{inStudy(f)}</span></td>
          </tr>
        )
      })}
    </>
  )
}

/* ═══ Criteria ═══ */

export function CriteriaTab() {
  const [saved, setSaved] = useState<Criterion[]>(() => structuredClone(CRITERIA.list))
  const [d, setD] = useState<Criterion[]>(() => structuredClone(CRITERIA.list))
  const [name, setName] = useState('')
  const dirty = JSON.stringify(d) !== JSON.stringify(saved)
  const sum = weightSum(d)

  return (
    <>
      <Glass>
        <Head
          title="معايير الدراسة"
          meta={sum === 100 ? <Tag tone="ok">المجموع <Num>{100}</Num></Tag> : <Tag tone="warn">المجموع <Num>{sum}</Num> · يجب أن يكون <Num>{100}</Num></Tag>}
        />
        <p className="sub cnote">يقيّم المشرف كل معيار من <Num>{1}</Num> إلى <Num>{5}</Num>، وتُحسب الدرجة من <Num>{100}</Num> نقطة بالأوزان · والمعايير تُعدَّل هنا بلا تعديل برمجي.</p>
        <ul className="cfglist cfgedit">
          {d.map((c, i) => (
            <li key={c.key}>
              <b>{c.label}</b>
              <FieldSelect
                value={c.group}
                label={`مجموعة ${c.label}`}
                options={['فني', 'مالي', 'إداري']}
                onChange={(v) => setD((x) => x.map((y, j) => (j === i ? { ...y, group: v as Criterion['group'] } : y)))}
              />
              <span className="pc-sp" />
              <CfgNum value={c.weight} min={0} label={`وزن ${c.label}`} suffix="نقطة" onChange={(v) => setD((x) => x.map((y, j) => (j === i ? { ...y, weight: Math.min(100, v) } : y)))} />
              <button type="button" className="btn btn-ghost btn-sm" disabled={d.length <= 1} onClick={() => setD((x) => x.filter((_, j) => j !== i))}>
                <Icon name={icons.close} size="sm" />
                احذف
              </button>
            </li>
          ))}
        </ul>
        <div className="cfgrow">
          <label className="regf cfgwide">
            <span className="lb">معيار جديد</span>
            <span className="fld"><input value={name} onChange={(e) => setName(e.target.value)} aria-label="معيار جديد" placeholder="مثال: الشراكات مع جهات أخرى" /></span>
          </label>
          <button
            type="button"
            className="btn btn-2 cfgadd"
            disabled={!name.trim()}
            onClick={() => { setD((x) => [...x, { key: `c${Date.now()}`, label: name.trim(), group: 'فني', weight: 0 }]); setName('') }}
          >
            أضف المعيار
          </button>
        </div>
      </Glass>
      {dirty && (
        <SaveBar
          count={1}
          sentence={<>تعديل معايير الدراسة<span className="decsep" /><span className="sub">الدراسات المسجّلة تُعاد درجتها بالأوزان الجديدة</span></>}
          onSave={() => { saveCriteria(d); setSaved(structuredClone(d)) }}
          onDiscard={() => setD(structuredClone(saved))}
          disabled={sum !== 100}
        />
      )}
    </>
  )
}

/* ═══ Consultants ═══ */

export function ConsultantsTab() {
  const [saved, setSaved] = useState(() => structuredClone(CONSULTANTS))
  const [d, setD] = useState(() => structuredClone(CONSULTANTS))
  const [name, setName] = useState('')
  const dirty = JSON.stringify(d) !== JSON.stringify(saved)
  const setOne = (i: number, fn: (c: Consultant) => Consultant) => setD((x) => ({ ...x, list: x.list.map((c, j) => (j === i ? fn(c) : c)) }))

  return (
    <>
      <Glass>
        <Head title="المستشارون" meta={<span className="sub"><Num>{d.list.length}</Num> مستشارين</span>} />
        <p className="sub cnote">يُضاف المستشار من هنا مباشرةً بلا مسار اعتماد · ويُربط بمجال أو أكثر، ورأيه استشاري غير ملزم.</p>
        <ul className="cfglist">
          {d.list.map((c, i) => (
            <li key={c.key} className="itk-sup">
              <Person name={c.name} />
              <MultiSelect
                all="بلا مجال"
                values={c.domains}
                options={ALL_FIELDS}
                onChange={(v) => setOne(i, (x) => ({ ...x, domains: v }))}
              />
              <span className="pc-sp" />
              <CfgNum value={c.accessDays} min={1} label={`مدة وصول ${c.name}`} suffix="يومًا وصول" onChange={(v) => setOne(i, (x) => ({ ...x, accessDays: v }))} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setD((x) => ({ ...x, list: x.list.filter((_, j) => j !== i) }))}>
                <Icon name={icons.close} size="sm" />
                احذف
              </button>
            </li>
          ))}
        </ul>
        <div className="cfgrow">
          <label className="regf cfgwide">
            <span className="lb">مستشار جديد</span>
            <span className="fld"><input value={name} onChange={(e) => setName(e.target.value)} aria-label="اسم المستشار" placeholder="الاسم الكامل" /></span>
          </label>
          <button
            type="button"
            className="btn btn-2 cfgadd"
            disabled={!name.trim()}
            onClick={() => { setD((x) => ({ ...x, list: [...x.list, { key: `c${Date.now()}`, name: name.trim(), title: 'مستشار', domains: [], accessDays: 7 }] })); setName('') }}
          >
            أضف المستشار
          </button>
        </div>
      </Glass>
      <Glass>
        <Head title="انتظار الرأي" meta={<Tag tone="warn">تعارض في الوثيقة</Tag>} />
        <Switch
          label="لا يُحال المشروع لمدير المنح قبل وصول رأي المستشار"
          note={/* doc 3.4.23 · step 19 */ "قاعدة تشترطه وخطوة في الإجراء تحيل دون انتظار · الإعداد يحسم أيّهما يسري حتى تقرّر المؤسسة"}
          on={d.waitForOpinion}
          onChange={(v) => setD((x) => ({ ...x, waitForOpinion: v }))}
        />
      </Glass>
      {dirty && (
        <SaveBar
          count={1}
          sentence={<>تعديل المستشارين<span className="decsep" /><span className="sub">الإحالات القائمة تحتفظ بمدتها</span></>}
          onSave={() => { saveConsultants(d); setSaved(structuredClone(d)) }}
          onDiscard={() => setD(structuredClone(saved))}
          disabled={d.list.some((c) => !c.name.trim())}
        />
      )}
    </>
  )
}

/* ═══ Prospects ═══ */

const PSTATUS: Prospect['status'][] = ['مقترحة', 'تم التواصل', 'سجّلت']

export function ProspectsTab() {
  const [saved, setSaved] = useState<Prospect[]>(() => structuredClone(PROSPECTS.list))
  const [d, setD] = useState<Prospect[]>(() => structuredClone(PROSPECTS.list))
  const [year, setYear] = useState(CYCLE.year)
  const [n, setN] = useState({ name: '', field: '', owner: '', note: '' })
  const dirty = JSON.stringify(d) !== JSON.stringify(saved)
  const years = useMemo(() => [...new Set([CYCLE.year, String(Number(CYCLE.year) + 1), ...d.map((p) => p.year)])].sort(), [d])
  const shown = d.filter((p) => p.year === year)

  return (
    <>
      <Glass className="tblcard">
        <Head
          title="الجهات المقترح استقطابها"
          meta={<FieldSelect value={year} label="سنة المنح" options={years} onChange={setYear} />}
        />
        <p className="sub cnote">قائمة تواصل لا تسجيل · الجهة تسجّل من البوابة كالمعتاد، وهذه القائمة من نحرص على دعوته في سنة {year}.</p>
        <table className="tbl">
          <thead>
            <tr>
              <th><span className="th-t">الجهة</span></th>
              <th><span className="th-t">المجال</span></th>
              <th><span className="th-t">المتابِع</span></th>
              <th><span className="th-t">الحالة</span></th>
              <th><span className="th-t">ملاحظة</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.field}</td>
                <td><Person name={p.owner} /></td>
                <td>
                  <FieldSelect
                    value={p.status}
                    label={`حالة ${p.name}`}
                    options={PSTATUS}
                    onChange={(v) => setD((x) => x.map((y) => (y.id === p.id ? { ...y, status: v as Prospect['status'] } : y)))}
                  />
                </td>
                <td className="sub">{p.note}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={5} className="sub">لا جهات مقترحة لسنة {year} بعد.</td></tr>
            )}
          </tbody>
        </table>
        <div className="cfgrow">
          <label className="regf cfgwide">
            <span className="lb">الجهة</span>
            <span className="fld"><input value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} aria-label="اسم الجهة المقترحة" /></span>
          </label>
          <label className="regf">
            <span className="lb">المجال</span>
            <FieldSelect value={n.field} label="مجال الجهة المقترحة" options={ALL_FIELDS} onChange={(v) => setN({ ...n, field: v })} />
          </label>
          <label className="regf">
            <span className="lb">المتابِع</span>
            <FieldSelect value={n.owner} label="متابع الجهة المقترحة" options={[...OWNERS]} onChange={(v) => setN({ ...n, owner: v })} />
          </label>
          <label className="regf cfgwide">
            <span className="lb">ملاحظة</span>
            <span className="fld"><input value={n.note} onChange={(e) => setN({ ...n, note: e.target.value })} aria-label="ملاحظة" placeholder="لماذا نقترحها" /></span>
          </label>
          <button
            type="button"
            className="btn btn-2 cfgadd"
            disabled={!n.name.trim() || !n.field || !n.owner}
            onClick={() => {
              setD((x) => [...x, { id: `pr${Date.now()}`, ...n, name: n.name.trim(), year, status: 'مقترحة' }])
              setN({ name: '', field: '', owner: '', note: '' })
            }}
          >
            أضف لسنة {year}
          </button>
        </div>
      </Glass>
      {dirty && (
        <SaveBar
          count={1}
          sentence={<>تعديل قائمة الاستقطاب</>}
          onSave={() => { saveProspects(d); setSaved(structuredClone(d)) }}
          onDiscard={() => setD(structuredClone(saved))}
        />
      )}
    </>
  )
}

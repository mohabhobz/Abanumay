import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DateText, Empty, Glass, Head, Icon, Num, Person, icons } from '@/components/ui'
import { DocFile, UploadButton } from '@/components/docs'
import { isolate } from '@/lib/format'
import { ROUTES } from '@/app/routes'
import type { FollowUp, FollowUpType } from '@/types/domain'
import { ACTIVITY_FOLLOW_TYPES } from '../activities'

export interface FollowUpsTabProps {
  projectId: string
  followUps: FollowUp[]
  types: FollowUpType[]
  /** Current user · recorded as the one who entered the follow-up */
  me: string
  onAdd: (f: FollowUp) => void
}

/* Field visits and calls with the partner are activities: they are recorded once, from the
   activities tab, with their date, source and attachments. Offering them here too gave the same
   event two entry points and two shapes in the log. */
const IN_ACTIVITIES = ACTIVITY_FOLLOW_TYPES

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Follow-ups · notes that document the project's progress (an updated agreement, a project report
 * update, a knowledge product, media, letters). Picking a type opens the entry; once saved it shows
 * here and in the project log.
 */
export function FollowUpsTab({ projectId, followUps, types, me, onAdd }: FollowUpsTabProps) {
  const [type, setType] = useState<FollowUpType | null>(null)
  const [body, setBody] = useState('')
  const [file, setFile] = useState<string | null>(null)
  const [tried, setTried] = useState(false)
  const [added, setAdded] = useState<FollowUpType | null>(null)

  const close = () => { setType(null); setBody(''); setFile(null); setTried(false) }
  const save = () => {
    setTried(true)
    if (!type || !body.trim()) return
    onAdd({ type, body: body.trim(), at: today(), by: me, attachment: file ?? undefined })
    setAdded(type)
    close()
  }

  return (
    <Glass>
      <Head
        title="المتابعات"
        meta={followUps.length ? <><Num>{followUps.length}</Num> متابعة</> : undefined}
      />

      {followUps.length === 0 ? (
        <Empty
          title="لا توجد متابعات مسجّلة على هذا المشروع."
          note="المتابعة توثّق تحديثًا أو منتجًا معرفيًا أو مخاطبة، وتظهر في سجل المشروع بترتيبها الزمني."
        />
      ) : (
        <div className="col-s flush">
          {followUps.map((f, i) => (
            <div className="data fu-i" key={i}>
              <div className="rowf gp-3 fu-h">
                <span className="itag">{f.type}</span>
                <span className="pc-sp" />
                <span className="sub">{f.by}</span>
                <DateText>{f.at}</DateText>
              </div>
              <div className="prose">{isolate(f.body)}</div>
              {f.attachment && (
                <div className="mt-3">
                  <DocFile name={f.attachment} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {added && (
        <p className="sub cnote">
          أُضيفت متابعة «{added}» · تظهر في{' '}
          <Link className="lnk" to={ROUTES.projectTab(projectId, 'log')}>سجل المشروع</Link>
        </p>
      )}

      <div className="hd fu-add">
        <h3>إضافة متابعة</h3>
        <span className="meta">اختر النوع ثم اكتب الوصف</span>
      </div>
      <div className="chips">
        {types.filter((t) => !IN_ACTIVITIES.includes(t)).map((t) => (
          <button
            type="button"
            className={`chip${type === t ? ' on' : ''}`}
            aria-pressed={type === t}
            key={t}
            onClick={() => { setAdded(null); setType(type === t ? null : t) }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="sub mt-3">
        الزيارات الميدانية والتواصل مع الجهة تُسجَّل من تبويب{' '}
        <Link className="lnk" to={ROUTES.projectTab(projectId, 'activities')}>الفعاليات</Link>
      </div>

      {type && (
        <div className="fu-form">
          <label className="regf">
            <span className="lb">
              وصف المتابعة<b className="regf-r" aria-label="إلزامي">*</b>
            </span>
            <span className="fld fld-a">
              <textarea
                rows={3}
                autoFocus
                value={body}
                onChange={(e) => setBody(e.target.value)}
                aria-label="وصف المتابعة"
                placeholder={`ما الذي تغيّر في «${type}»`}
              />
            </span>
          </label>
          <div className="acts-up">
            {file ? <DocFile name={file} /> : (
              <UploadButton label="ارفع مرفقًا للمتابعة" onPick={(f) => setFile(f.name)} />
            )}
            <span className="sub">أقل من 32 ميجابايت · pdf doc docx txt jpg jpeg gif png xls xlsx</span>
          </div>
          <div className="acts-foot">
            <span className="sub">
              يُسجَّل باسم <Person name={me} quiet={false} />
            </span>
            <span className="pc-sp" />
            {tried && !body.trim() && <span className="sub">ناقص: وصف المتابعة</span>}
            <button type="button" className="btn btn-2" onClick={close}>إلغاء</button>
            <button type="button" className="btn btn-p" onClick={save}>
              <Icon name={icons.plus} size="sm" />
              أضف المتابعة
            </button>
          </div>
        </div>
      )}
    </Glass>
  )
}

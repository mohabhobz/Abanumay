import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DateField, DateText, Empty, FieldSelect, Glass, Head, Icon, Num, Person, icons } from '@/components/ui'
import { DocFile, DocList, UploadButton } from '@/components/docs'
import { isolate } from '@/lib/format'
import { ROUTES } from '@/app/routes'
import {
  ACTIVITY_SOURCES, ACTIVITY_TYPES, type Activity, type ActivityType,
} from '../activities'

export interface ActivitiesTabProps {
  projectId: string
  /** Current user · recorded as the one who entered the activity */
  me: string
  list: Activity[]
  onAdd: (a: Omit<Activity, 'id' | 'projectId' | 'time'>) => void
}

const today = () => new Date().toISOString().slice(0, 10)

const EMPTY = { title: '', at: '', type: '' as ActivityType | '', description: '', source: '' }

/**
 * Activities («الفعاليات»).
 *
 * The only entry point for manual events: field visits, meetings, workshops, calls. Each one is
 * written into the project log with its source, so the log answers "where did this come from"
 * for every line. Adding from the log itself is deliberately not possible.
 */
export function ActivitiesTab({ projectId, me, list, onAdd }: ActivitiesTabProps) {
  const [f, setF] = useState({ ...EMPTY, at: today() })
  const [files, setFiles] = useState<string[]>([])
  const [tried, setTried] = useState(false)
  const [added, setAdded] = useState<string | null>(null)
  /* The form opens from «إضافة فعالية» instead of sitting open on the page: the tab reads as the
     list of what happened, and adding is one deliberate step from it. */
  const [adding, setAdding] = useState(false)

  const missing = [
    !f.title.trim() && 'اسم الفعالية',
    !f.at && 'التاريخ',
    !f.type && 'النوع',
    !f.source && 'مصدر المعلومة',
  ].filter(Boolean) as string[]

  const submit = () => {
    setTried(true)
    if (missing.length || !f.type) return
    onAdd({
      title: f.title.trim(),
      at: f.at,
      type: f.type,
      description: f.description.trim(),
      source: f.source,
      files,
      by: me,
    })
    setAdded(f.title.trim())
    close()
  }

  const close = () => {
    setF({ ...EMPTY, at: today() })
    setFiles([])
    setTried(false)
    setAdding(false)
  }

  const addBtn = (
    <button
      type="button"
      className="btn btn-p"
      aria-expanded={adding}
      onClick={() => { setAdded(null); setAdding(true) }}
      disabled={adding}
    >
      <Icon name={icons.plus} size="sm" />
      إضافة فعالية
    </button>
  )

  return (
    <>
      {adding && (
      <Glass>
        <Head title="فعالية جديدة" meta="تظهر في سجل المشروع بمصدرها" />

        <div className="regfields">
          <label className="regf regf-w">
            <span className="lb">
              اسم الفعالية<b className="regf-r" aria-label="إلزامي">*</b>
            </span>
            <span className="fld">
              <input
                value={f.title}
                onChange={(e) => setF({ ...f, title: e.target.value })}
                aria-label="اسم الفعالية"
                placeholder="زيارة ميدانية لموقع التنفيذ"
              />
            </span>
          </label>

          <div className="regf">
            <span className="lb">
              التاريخ<b className="regf-r" aria-label="إلزامي">*</b>
            </span>
            <DateField value={f.at} onChange={(x) => setF({ ...f, at: x })} label="تاريخ الفعالية" max={today()} />
          </div>

          <div className="regf">
            <span className="lb">
              النوع<b className="regf-r" aria-label="إلزامي">*</b>
            </span>
            <FieldSelect
              value={f.type}
              options={ACTIVITY_TYPES}
              onChange={(x) => setF({ ...f, type: x as ActivityType })}
              label="نوع الفعالية"
            />
          </div>

          <div className="regf">
            <span className="lb">
              مصدر المعلومة<b className="regf-r" aria-label="إلزامي">*</b>
            </span>
            <FieldSelect
              value={f.source}
              options={ACTIVITY_SOURCES}
              onChange={(x) => setF({ ...f, source: x })}
              label="مصدر المعلومة"
              end
            />
          </div>

          <label className="regf regf-w">
            <span className="lb">الوصف</span>
            <span className="fld fld-a">
              <textarea
                rows={3}
                value={f.description}
                onChange={(e) => setF({ ...f, description: e.target.value })}
                aria-label="وصف الفعالية"
                placeholder="ما الذي جرى، ومن حضر، وما الذي تقرّر"
              />
            </span>
          </label>

          <div className="regf regf-w">
            <span className="lb">المرفقات</span>
            {files.length > 0 && (
              <DocList
                label="مرفقات الفعالية"
                rows={files.map((n) => ({
                  name: n,
                  uploaded: true,
                  action: (
                    <button
                      type="button"
                      className="btn btn-2 btn-sm"
                      onClick={() => setFiles(files.filter((x) => x !== n))}
                    >
                      إزالة
                    </button>
                  ),
                }))}
              />
            )}
            <span className="acts-up">
              <UploadButton
                label="ارفع مرفقًا للفعالية"
                onPick={(file) => setFiles((xs) => (xs.includes(file.name) ? xs : [...xs, file.name]))}
              />
              <span className="sub">pdf · jpg · png</span>
            </span>
          </div>
        </div>

        <div className="acts-foot">
          <span className="sub">
            يُسجَّل باسم <Person name={me} quiet={false} />
          </span>
          <span className="pc-sp" />
          {tried && missing.length > 0 && (
            <span className="sub">ناقص: {missing.join('، ')}</span>
          )}
          <button type="button" className="btn btn-2" onClick={close}>
            إلغاء
          </button>
          <button type="button" className="btn btn-p" onClick={submit}>
            <Icon name={icons.plus} size="sm" />
            أضف إلى سجل المشروع
          </button>
        </div>
      </Glass>
      )}

      <Glass>
        <div className="acts-hd">
          <Head
            title="الفعاليات"
            meta={list.length ? <><Num>{list.length}</Num> مسجّلة</> : undefined}
          />
          {addBtn}
        </div>

        {added && (
          <p className="sub cnote">
            أُضيفت «{added}» إلى سجل المشروع ·{' '}
            <Link className="lnk" to={ROUTES.projectTab(projectId, 'log')}>افتح السجل</Link>
          </p>
        )}

        {list.length === 0 ? (
          <Empty
            title="لم تُسجَّل فعاليات على هذا المشروع بعد."
            note="الزيارة الميدانية والاجتماع والورشة والاتصال تُضاف من هنا، وتظهر في سجل المشروع مع مصدر المعلومة."
          />
        ) : (
          <ol className="acts">
            {list.map((a) => (
              <li className="acts-i" key={a.id}>
                <div className="lghead">
                  <b className="lgact">{a.title}</b>
                  <span className="lgdept">{a.type}</span>
                  <span className="pc-sp" />
                  <DateText>{a.at}</DateText>
                </div>
                {a.description && <div className="lgbody">{isolate(a.description)}</div>}
                <div className="lgby">
                  <span className="lgwho">{a.by}</span>
                  <span className="lgkind sub">المصدر: {a.source}</span>
                  <span className="pc-sp" />
                  <Link className="lnk" to={`${ROUTES.projectTab(projectId, 'log')}#ev-${a.id}`}>
                    في السجل
                    <Icon name={icons.chevron} size="sm" />
                  </Link>
                </div>
                {a.files.length > 0 && (
                  <div className="acts-files">
                    {a.files.map((n) => <DocFile key={n} name={n} />)}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </Glass>
    </>
  )
}

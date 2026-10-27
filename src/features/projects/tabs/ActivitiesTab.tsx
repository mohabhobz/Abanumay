import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FormField, FieldBox, Button, DateField, DateText, Empty, FieldSelect, Glass, Head, Icon, Num, Person, icons } from '@/components/ui'
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
    <Button
      type="button"
      variant="p"
      aria-expanded={adding}
      onClick={() => { setAdded(null); setAdding(true) }}
      disabled={adding}
    >
      <Icon name={icons.plus} size="sm" />
      إضافة فعالية
    </Button>
  )

  return (
    <>
      {adding && (
      <Glass>
        <Head title="فعالية جديدة" />

        <div className="regfields">
          <FormField label="اسم الفعالية" required wide>
            <FieldBox>
              <input
                value={f.title}
                onChange={(e) => setF({ ...f, title: e.target.value })}
                aria-label="اسم الفعالية"
                placeholder="زيارة ميدانية لموقع التنفيذ"
              />
            </FieldBox>
          </FormField>

          <FormField label="التاريخ" required as="div">
            <DateField value={f.at} onChange={(x) => setF({ ...f, at: x })} label="تاريخ الفعالية" max={today()} />
          </FormField>

          <FormField label="النوع" required as="div">
            <FieldSelect
              value={f.type}
              options={ACTIVITY_TYPES}
              onChange={(x) => setF({ ...f, type: x as ActivityType })}
              label="نوع الفعالية"
            />
          </FormField>

          <FormField label="مصدر المعلومة" required as="div">
            <FieldSelect
              value={f.source}
              options={ACTIVITY_SOURCES}
              onChange={(x) => setF({ ...f, source: x })}
              label="مصدر المعلومة"
              end
            />
          </FormField>

          <FormField label="الوصف" wide>
            <FieldBox area>
              <textarea
                rows={3}
                value={f.description}
                onChange={(e) => setF({ ...f, description: e.target.value })}
                aria-label="وصف الفعالية"
                placeholder="ما الذي جرى، ومن حضر، وما الذي تقرّر"
              />
            </FieldBox>
          </FormField>

          <FormField label="المرفقات" wide as="div">
            {files.length > 0 && (
              <DocList
                label="مرفقات الفعالية"
                rows={files.map((n) => ({
                  name: n,
                  uploaded: true,
                  action: (
                    <Button
                      type="button"
                      variant="2" size="sm"
                      onClick={() => setFiles(files.filter((x) => x !== n))}
                    >
                      إزالة
                    </Button>
                  ),
                }))}
              />
            )}
            <span className="acts-up">
              <UploadButton
                label="ارفع مرفقًا للفعالية"
                onPick={(file) => setFiles((xs) => (xs.includes(file.name) ? xs : [...xs, file.name]))}
              />
            </span>
          </FormField>
        </div>

        <div className="acts-foot">
          <span className="pc-sp" />
          {tried && missing.length > 0 && (
            <span className="sub">ناقص: {missing.join('، ')}</span>
          )}
          <Button type="button" variant="2" onClick={close}>
            إلغاء
          </Button>
          <Button type="button" variant="p" onClick={submit}>
            <Icon name={icons.plus} size="sm" />
            أضف إلى سجل المشروع
          </Button>
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
                  <span className="lgwho"><Person name={a.by} size="md" quiet={false} /></span>
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

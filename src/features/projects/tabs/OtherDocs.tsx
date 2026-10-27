import { useState } from 'react'
import { DateText, Num, Person } from '@/components/ui'
import { DocFile, UploadButton } from '@/components/docs'
import { dropMore, extrasOf, replaceMore, uploadMore, useFlow } from '@/data/intake/flow'
import { nf } from '@/lib/format'

/* Client 21 Oct (#32) · «مرفقات أخرى» · one sub-section with any number of documents, added in one
   pick, each with its size, date and who added it. The uploader removes their own file while the
   request is still open; nobody else can. The same list shows in the data tab's attachments card and
   in the project's «المرفقات» tab · one store, so the two never disagree. */

const ACCEPT = '.pdf,.xlsx,.docx,.jpg,.jpeg,.png,.zip,.mp4'

export const sizeSay = (b: number): string =>
  b >= 1_000_000 ? `${nf.format(Math.round(b / 100_000) / 10)} م.ب` : `${nf.format(Math.max(1, Math.round(b / 1000)))} ك.ب`

export function OtherDocs({ projectId, me, asEntity, canUpload }: { projectId: string; me: string; asEntity: boolean; canUpload: boolean }) {
  useFlow()
  const [said, setSaid] = useState('')
  const list = extrasOf(projectId).filter((x) => !(asEntity && x.internal))
  return (
    <div className="stdy-g">
      <h3 className="stdy-h">
        مرفقات أخرى <span className="sub"><Num>{list.length}</Num> {list.length === 1 ? 'ملف' : 'ملفات'}</span>
      </h3>
      {list.length > 0 ? (
        <div className="dlist">
          <table className="tbl" aria-label="مرفقات أخرى">
            <thead>
              <tr>
                <th>المستند</th>
                <th className="n">الحجم</th>
                <th>التاريخ</th>
                <th>رفعه</th>
                <th><span className="vis-h">الإجراء</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id}>
                  <td><DocFile name={x.name} download /></td>
                  <td className="n"><span className="num">{sizeSay(x.size)}</span></td>
                  <td><DateText>{x.at}</DateText></td>
                  <td><Person name={x.by} size="md" /></td>
                  <td>
                    {/* Client 24 Oct · «استبدال» beside the uploader's «احذف» */}
                    {canUpload
                      ? <span className="dact">
                          <UploadButton label={`استبدال ${x.name}`} text="استبدال" accept={ACCEPT} maxMb={50} onPick={(fl) => replaceMore(projectId, x.id, { name: fl.name, size: fl.size }, me)} />
                          {x.by === me && <button type="button" className="btn btn-ghost btn-sm" aria-label={`احذف ${x.name}`} onClick={() => setSaid(dropMore(projectId, x.id, me)[0] ?? '')}>احذف</button>}
                        </span>
                      : <span className="sub" aria-hidden="true"> </span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="sub cnote">لا مرفقات أخرى بعد.</p>
      )}
      {canUpload && (
        <div className="apv-row">
          <UploadButton label="ارفع مرفقات أخرى" accept={ACCEPT} maxMb={50} onPick={() => undefined}
            onPickMany={(files) => { setSaid(''); uploadMore(projectId, files.map((f) => ({ name: f.name, size: f.size })), me) }} />
        </div>
      )}
      {said && <p className="bad cnote" role="alert">{said}</p>}
    </div>
  )
}

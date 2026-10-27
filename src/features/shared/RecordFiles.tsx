import { useState } from 'react'
import { Button, Empty, Glass, Head, Num } from '@/components/ui'
import { DocList, UploadButton, type DocRow } from '@/components/docs'
import { addFiles, dropFile, filesOf, useFiles } from '@/data/shared/files'
import { nf } from '@/lib/format'

/* Client 27 Oct · «المرفقات» · one tab shape on every record · the record's own documents first, as
   its page passes them, then the files added here · anyone who may work on the record adds files in
   one pick, and only the one who added a file removes it. */

export interface SeedFile {
  name: string
  meta?: string
  /** A required document not uploaded yet reads as missing · default uploaded */
  uploaded?: boolean
  required?: boolean
  src?: string
}

const ACCEPT = '.pdf,.xlsx,.docx,.jpg,.jpeg,.png,.zip'
const sizeSay = (b: number): string =>
  b >= 1_000_000 ? `${nf.format(Math.round(b / 100_000) / 10)} م.ب` : `${nf.format(Math.max(1, Math.round(b / 1000)))} ك.ب`

export function RecordFiles({ record, seed = [], canUpload, me, title = 'المرفقات' }: {
  /** The record's key · `kind:id` */
  record: string
  seed?: SeedFile[]
  canUpload: boolean
  me: string
  title?: string
}) {
  useFiles()
  const [bad, setBad] = useState('')
  const added = filesOf(record)
  const rows: DocRow[] = [
    ...seed.map((f): DocRow => ({ name: f.name, meta: f.meta, uploaded: f.uploaded ?? true, required: f.required, src: f.src })),
    ...added.map((f): DocRow => ({
      name: f.name,
      meta: `${sizeSay(f.size)} · ${f.by} · ${f.at.slice(0, 10)}`,
      uploaded: true,
      action: f.by === me
        ? <Button type="button" variant="ghost" size="sm" aria-label={`احذف ${f.name}`} onClick={() => setBad(dropFile(f.id, me))}>احذف</Button>
        : undefined,
    })),
  ]
  return (
    <Glass>
      <Head
        title={title}
        meta={<span className="rowf gp-2">
          <span className="sub"><Num>{rows.filter((r) => r.uploaded).length}</Num> {rows.length === 1 ? 'ملف' : 'ملفات'}</span>
          {canUpload && (
            <UploadButton label={`أرفق ملفات · ${title}`} text="أضف مرفقات" accept={ACCEPT} maxMb={50} onPick={() => undefined}
              onPickMany={(fs) => { setBad(''); addFiles(record, fs.map((f) => ({ name: f.name, size: f.size })), me) }} />
          )}
        </span>}
      />
      {rows.length ? <DocList rows={rows} label={title} /> : <Empty title="لا مرفقات بعد." />}
      {bad && <p className="bad cnote" role="alert">{bad}</p>}
    </Glass>
  )
}

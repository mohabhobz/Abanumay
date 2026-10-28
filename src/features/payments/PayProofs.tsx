import { useState } from 'react'
import { Button, Glass, Head, Num, Tag } from '@/components/ui'
import { DocFile, UploadButton } from '@/components/docs'
import { addFiles, dropFile, filesOf, useFiles } from '@/data/shared/files'
import { PAY_PROOFS } from '@/data/mock/payEntity'
import type { PayRequest } from '@/types/domain'

/* Client 28 Oct · «إثبات الصرف» · each proof (the transfer's, the receipt) takes its files right on
   its row, and any number of other supporting files go under them. Every file lands in the shared
   files store, so the payment's log reads who attached or removed what. */

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.xlsx,.docx,.zip'

export function PayProofs({ r, me, asEntity }: { r: PayRequest; me: string; asEntity: boolean }) {
  useFiles()
  const [bad, setBad] = useState('')
  const open = r.state !== 'closed'
  /* the transfer's proof is finance's side · the receipt is the entity's, staff may attach it on its behalf */
  const may = (key: string) => open && (key === 'transfer' ? !asEntity : true)

  const fileRow = (f: { id: string; name: string; by: string; at: string }) => (
    <li key={f.id} className="payproof-f">
      <DocFile name={f.name} meta={`${f.by} · ${f.at.slice(0, 10)}`} />
      {f.by === me && <Button type="button" variant="ghost" size="sm" aria-label={`احذف ${f.name}`} onClick={() => setBad(dropFile(f.id, me))}>احذف</Button>}
    </li>
  )

  const others = filesOf(`pay:${r.id}:proof-other`)

  return (
    <Glass>
      <Head title="إثبات الصرف" />
      <ul className="payproof">
        {PAY_PROOFS.map((x) => {
          const rec = `pay:${r.id}:proof-${x.key}`
          const files = filesOf(rec)
          /* the proof recorded with the transfer itself counts as the transfer's file */
          const seeded = x.key === 'transfer' && r.transfer?.proof ? r.transfer.proof : ''
          const n = files.length + (seeded ? 1 : 0)
          return (
            <li key={x.key}>
              <span className="payproof-h">
                <b>{x.label}</b>
                <span className="sub">· {x.by}</span>
                <span className="pc-sp" />
                {n > 0 ? <Tag tone="ok"><Num>{n}</Num> {n === 1 ? 'مرفق' : 'مرفقات'}</Tag>
                  : <Tag tone={x.required ? 'warn' : 'mute'}>{x.required ? 'إلزامي' : 'اختياري'}</Tag>}
                {may(x.key) && (
                  <UploadButton label={`أرفق ${x.label}`} text="أرفق" accept={ACCEPT} maxMb={50} onPick={() => undefined}
                    onPickMany={(fs) => { setBad(''); addFiles(rec, fs.map((f) => ({ name: f.name, size: f.size })), me) }} />
                )}
              </span>
              {(seeded || files.length > 0) && (
                <ul className="payproof-fs">
                  {seeded && <li className="payproof-f"><DocFile name={seeded} meta={r.transfer ? `${r.transfer.by} · ${r.transfer.at}` : undefined} /></li>}
                  {files.map(fileRow)}
                </ul>
              )}
            </li>
          )
        })}

        {/* any number of other supporting files */}
        <li>
          <span className="payproof-h">
            <b>مرفقات أخرى</b>
            <span className="sub">· أي مستند داعم للصرف</span>
            <span className="pc-sp" />
            {others.length > 0 ? <Tag tone="mute"><Num>{others.length}</Num> {others.length === 1 ? 'مرفق' : 'مرفقات'}</Tag> : <Tag tone="mute">اختياري</Tag>}
            {open && (
              <UploadButton label="أضف مرفقات أخرى" text="أضف مرفقًا" accept={ACCEPT} maxMb={50} onPick={() => undefined}
                onPickMany={(fs) => { setBad(''); addFiles(`pay:${r.id}:proof-other`, fs.map((f) => ({ name: f.name, size: f.size })), me) }} />
            )}
          </span>
          {others.length > 0 && <ul className="payproof-fs">{others.map(fileRow)}</ul>}
        </li>
      </ul>
      {bad && <p className="bad cnote" role="alert">{bad}</p>}
    </Glass>
  )
}

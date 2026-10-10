import type { ReadOut } from './useDocReads'

/* 10 Oct · reading an uploaded file's content against what the form says (cross · document reading
   in disbursement, closing and Ehsan payments). One hook per form: `read(key, file, kind, typed)`
   reads the file (the service when connected, the browser otherwise) and `<DocReadNote>` says what
   came out · advisory, it never blocks a submission. */

export function DocReadNote({ r }: { r?: ReadOut }) {
  if (!r) return null
  return (
    <p className={`cnote ${r.diff.length ? 'bad' : 'sub'}`}>
      {r.diff.length ? `لا يطابق المُدخَل · ${r.diff.join(' · ')}` : r.note}
      {r.source !== 'none' && <> · استرشادي</>}
    </p>
  )
}

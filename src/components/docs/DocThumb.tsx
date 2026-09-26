import { docKind, isScan, type DocKind } from './kind'

/**
 * Document thumbnail — a miniature page drawing the **shape** of the content.
 * A single icon (a folded sheet) only says "this is a file." The thumbnail says whether it's a
 * table, text, or an image, without opening it — which is what lets a row with several attachments
 * be read at a glance instead of read line by line.
 * ⚠️ The drawing is generated from the file type, not a snapshot of the file itself. Once the
 * backend returns a real preview, it replaces this drawing and nothing else.
 */
export function DocThumb({ name, size = 'sm' }: { name: string; size?: 'sm' | 'lg' }) {
  const kind = docKind(name)
  return (
    <span className={`dthumb dthumb-${size} k-${kind}`} aria-hidden="true">
      <span className="dthumb-p">
        <Face kind={kind} />
      </span>
      {isScan(name) && <span className="dthumb-scan">صورة</span>}
      <span className="dthumb-corner" />
    </span>
  )
}

function Face({ kind }: { kind: DocKind }) {
  if (kind === 'sheet') {
    /* Grid: a dark header row with rows below — a table reads as one immediately. */
    return (
      <span className="dt-grid">
        {Array.from({ length: 12 }, (_, i) => <i key={i} className={i < 3 ? 'h' : undefined} />)}
      </span>
    )
  }
  if (kind === 'image') {
    /* Horizon and sun — the simplest drawing that reads as "image." */
    return (
      <span className="dt-img">
        <i className="sun" />
        <i className="hill" />
        <i className="hill b" />
      </span>
    )
  }
  if (kind === 'archive') {
    return (
      <span className="dt-zip">
        {Array.from({ length: 5 }, (_, i) => <i key={i} />)}
      </span>
    )
  }
  /* Text: a short title and lines of varying length. */
  return (
    <span className="dt-txt">
      <i className="t" />
      {[92, 78, 88, 60, 84, 44].map((w, i) => <i key={i} style={{ width: `${w}%` }} />)}
    </span>
  )
}

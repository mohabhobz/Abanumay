import { useState } from 'react'
import { Icon, icons } from '@/components/ui'
import { DocThumb } from './DocThumb'
import { DocPreview } from './DocPreview'
import { docKind, isScan, KIND_LABEL } from './kind'

export interface DocFileProps {
  name: string
  /** Line under the name: date, source, or size. */
  meta?: string
  /** A full row instead of a slice — for tables and lists. */
  block?: boolean
  /**
   * Download button inside the row. In tables it's removed from here and placed in the status
   * column, so download icons line up in one column instead of trailing each name in a different
   * spot.
   */
  download?: boolean
}

/**
 * An openable, downloadable document — **the one shape for any file in the system**.
 * Every place with a document uses it: project attachments, entity documents, follow-up
 * attachments, disbursement orders and their vouchers, and the agreement. Before this, each place
 * displayed the file its own way: sometimes an "attached file" link, sometimes "view/download"
 * buttons, sometimes a paper icon next to a name. Three shapes for the same thing.
 * And the thumbnail isn't decoration: it states the content type before opening, so a reviewer
 * knows the budget is a **scanned image** from the row itself, which is why the sample project has
 * a completion request.
 */
export function DocFile({ name, meta, block, download = true }: DocFileProps) {
  const [open, setOpen] = useState(false)
  const kind = docKind(name)

  return (
    <>
      <div className={`dfile${block ? ' block' : ''}`}>
        <button
          type="button"
          className="dfile-b"
          onClick={() => setOpen(true)}
          aria-label={`معاينة ${name}`}
        >
          <DocThumb name={name} />
          <span className="dfile-t">
            <span className="dfile-n">{name}</span>
            <span className="sub">
              {KIND_LABEL[kind]}
              {isScan(name) && ' · ممسوحة، لا تُقرأ آليًا'}
              {meta && ` · ${meta}`}
            </span>
          </span>
        </button>

        {/* Download is a separate button: clicking the file itself opens it, and downloading is a different
   decision — merging them turns every preview into a download. */}
        {download && <DocDownload name={name} />}
      </div>

      {open && <DocPreview name={name} meta={meta} onClose={() => setOpen(false)} />}
    </>
  )
}

/** Standalone download button — for tables that place it in the status column. */
export function DocDownload({ name }: { name: string }) {
  return (
    <a
      className="dfile-dl"
      download={name}
      href="#"
      onClick={(e) => e.preventDefault()}
      title="تنزيل"
      aria-label={`تنزيل ${name}`}
    >
      <Icon name={icons.export} size="sm" />
    </a>
  )
}

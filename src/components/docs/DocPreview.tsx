import { downloadDoc } from '@/lib/download'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon, icons } from '@/components/ui'
import { DocThumb } from './DocThumb'
import { docKind, isScan, KIND_LABEL } from './kind'

export interface DocPreviewProps {
  name: string
  meta?: string
  /** Client 21 Oct (#7) · the file's address in the storage · an image, video or PDF opens inside the
      preview itself, read in the browser with no download · without it the page drawing stands in */
  src?: string
  /** The file's MIME type · picks the viewer when the name has no telling extension */
  mime?: string
  onClose: () => void
}

/** Which in-browser viewer a stored file gets · none falls back to the drawn page */
const viewerOf = (name: string, mime = ''): 'img' | 'video' | 'pdf' | '' => {
  const n = name.toLowerCase()
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic)$/.test(n)) return 'img'
  if (mime.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/.test(n)) return 'video'
  if (mime === 'application/pdf' || n.endsWith('.pdf')) return 'pdf'
  return ''
}

/**
 * In-place document preview — a reviewer reads the file without downloading it.
 * A portal on `body`: any ancestor with `backdrop-filter` becomes the containing block for
 * `position:fixed`, so the modal used to land next to the card instead of centered on screen.
 * The page inside the preview is **the same thumbnail drawing, scaled up**, so what the user
 * clicked is what opens — no jump between the two shapes.
 */
export function DocPreview({ name, meta, src, mime, onClose }: DocPreviewProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const kind = docKind(name)
  const scan = isScan(name)
  const view = src ? viewerOf(name, mime) : ''

  return createPortal(
    <>
      <div className="ascrim on" onClick={onClose} aria-hidden="true" />

      <div className="fprev chrome" role="dialog" aria-label={`معاينة ${name}`}>
        <div className="fphead">
          <span className="badge badge-30"><Icon name={icons.file} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="atitle">{name}</div>
            <div className="sub">
              {KIND_LABEL[kind]}
              {scan ? ' · صورة ممسوحة، لا تُقرأ آليًا' : view ? ' · من مخزن المؤسسة' : ' · صفحة 1 من 1'}
              {meta && ` · ${meta}`}
            </div>
          </div>
          {src && <a className="aclose" href={src} target="_blank" rel="noreferrer" title="افتح في تبويب" aria-label="افتح في تبويب"><Icon name={icons.link} size="sm" /></a>}
          <a className="aclose" download={name} href="#" onClick={(e) => { e.preventDefault(); downloadDoc(name) }} title="تنزيل" aria-label="تنزيل">
            <Icon name={icons.export} size="sm" />
          </a>
          <button className="aclose" onClick={onClose} aria-label="إغلاق">
            <Icon name={icons.close} size="sm" />
          </button>
        </div>

        <div className="fpbody">
          {view === 'img' && <img className="fpmedia" src={src} alt={name} />}
          {view === 'video' && <video className="fpmedia" src={src} controls preload="metadata" aria-label={name} />}
          {view === 'pdf' && <iframe className="fpmedia fpframe" src={src} title={name} />}
          {!view && (
            <div className="fppage">
              <DocThumb name={name} size="lg" />
              <div className="fpnote sub">
                تُعرض المعاينة من مخزن المرفقات مباشرة دون تنزيل.
              </div>
            </div>
          )}
        </div>

        {scan && (
          <div className="fpfoot">
            <span className="tag warn">صورة</span>
            <span className="sub">
              الملف صورة، فلا يمكن مقارنة بنود الموازنة آليًا بالمبلغ المطلوب. ولهذا
              يطلب طلب الاستكمال الحالي نسخة قابلة للقراءة.
            </span>
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}

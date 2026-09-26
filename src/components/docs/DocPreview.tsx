import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon, icons } from '@/components/ui'
import { DocThumb } from './DocThumb'
import { docKind, isScan, KIND_LABEL } from './kind'

export interface DocPreviewProps {
  name: string
  meta?: string
  onClose: () => void
}

/**
 * In-place document preview — a reviewer reads the file without downloading it.
 * A portal on `body`: any ancestor with `backdrop-filter` becomes the containing block for
 * `position:fixed`, so the modal used to land next to the card instead of centered on screen.
 * The page inside the preview is **the same thumbnail drawing, scaled up**, so what the user
 * clicked is what opens — no jump between the two shapes.
 */
export function DocPreview({ name, meta, onClose }: DocPreviewProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const kind = docKind(name)
  const scan = isScan(name)

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
              {scan ? ' · صورة ممسوحة، لا تُقرأ آليًا' : ' · صفحة 1 من 1'}
              {meta && ` · ${meta}`}
            </div>
          </div>
          <a className="aclose" download={name} href="#" onClick={(e) => e.preventDefault()} title="تنزيل" aria-label="تنزيل">
            <Icon name={icons.export} size="sm" />
          </a>
          <button className="aclose" onClick={onClose} aria-label="إغلاق">
            <Icon name={icons.close} size="sm" />
          </button>
        </div>

        <div className="fpbody">
          <div className="fppage">
            <DocThumb name={name} size="lg" />
            <div className="fpnote sub">
              تُعرض المعاينة من مخزن المرفقات مباشرة دون تنزيل.
            </div>
          </div>
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

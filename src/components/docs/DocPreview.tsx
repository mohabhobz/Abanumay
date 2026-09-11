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
 * معاينة المستند في مكانه — المراجع يقرأ الملف من غير ما يحمّله.
 *
 * بورتال على الـbody: أي أب فيه `backdrop-filter` بيبقى الحاوية
 * للـ`position:fixed`، فالمودال كان بيقع جنب الكارت مش في نص الشاشة.
 *
 * والصفحة اللي جوّه المعاينة هي **نفس رسم الثامبنيل مكبَّرًا**، عشان
 * اللي المستخدم ضغط عليه هو اللي فتح — مفيش قفزة بين الشكلين.
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
            <Icon name={icons.export} size={16} />
          </a>
          <button className="aclose" onClick={onClose} aria-label="إغلاق">
            <Icon name={icons.close} size={16} />
          </button>
        </div>

        <div className="fpbody">
          <div className="fppage">
            <DocThumb name={name} size="lg" />
            <div className="fpnote sub">
              المعاينة تُقرأ من مخزن المرفقات مباشرة، بلا تحميل.
            </div>
          </div>
        </div>

        {scan && (
          <div className="fpfoot">
            <span className="tag warn">صورة</span>
            <span className="sub">
              الملف صورة، فبنود الموازنة ما تتقارنش آليًا بالمبلغ المطلوب. طلب الاستكمال الحالي
              يطلب نسخة قابلة للقراءة.
            </span>
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}

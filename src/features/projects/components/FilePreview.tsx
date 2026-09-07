import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon, icons } from '@/components/ui'

export interface PreviewFile {
  name: string
  uploaded?: boolean
}

/**
 * معاينة المرفق في مكانه — المراجع يقرأ الملف من غير ما يحمّله.
 *
 * بورتال على الـbody: أي أب فيه `backdrop-filter` بيبقى الحاوية
 * للـ`position:fixed`، فالمودال كان بيقع جنب الكارت مش في نص الشاشة.
 */
export function FilePreview({ file, onClose }: { file: PreviewFile; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // الموازنة في هذا المشروع صورة ممسوحة — بنقول كده صراحة بدل ما المراجع يكتشفه
  const scanned = file.name.includes('الموازنة')

  return createPortal(
    <>
      <div className="ascrim on" onClick={onClose} aria-hidden="true" />

      <div className="fprev chrome" role="dialog" aria-label={`معاينة ${file.name}`}>
        <div className="fphead">
          <span className="badge badge-30"><Icon path={icons.file} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="atitle">{file.name}</div>
            <div className="sub">{scanned ? 'صورة ممسوحة · لا تُقرأ آليًا' : 'PDF · صفحة 1 من 1'}</div>
          </div>
          <button className="aclose" title="تحميل" aria-label="تحميل">
            <Icon path={icons.clip} size={16} />
          </button>
          <button className="aclose" onClick={onClose} aria-label="إغلاق">
            <Icon path={icons.close} size={16} />
          </button>
        </div>

        <div className="fpbody">
          <div className="fppage">
            <div className="fpph">
              <Icon path={icons.file} />
              <div>معاينة الملف تظهر هنا</div>
              <div className="sub">يُقرأ من مخزن المرفقات مباشرة، بلا تحميل</div>
            </div>
          </div>
        </div>

        {scanned && (
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

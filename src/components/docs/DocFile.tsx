import { useState } from 'react'
import { Icon, icons } from '@/components/ui'
import { DocThumb } from './DocThumb'
import { DocPreview } from './DocPreview'
import { docKind, isScan, KIND_LABEL } from './kind'

export interface DocFileProps {
  name: string
  /** سطر تحت الاسم: تاريخ أو مصدر أو حجم */
  meta?: string
  /** صف كامل بدل شريحة · للجداول والقوائم */
  block?: boolean
  /**
   * زرار التنزيل جوّه الصف. في الجداول بيتشال من هنا ويتحطّ في
   * عمود الحالة (`DocDownload`)، عشان أيقونات التنزيل تتسطّر في
   * عمود واحد بدل ما تقف بعد كل اسم في مكان مختلف.
   */
  download?: boolean
}

/**
 * مستند قابل للفتح والتنزيل · **الشكل الواحد لأي ملف في السيستم**.
 *
 * كل مكان فيه مستند بياخده: مرفقات المشروع، ومستندات الجهة، ومرفق
 * المتابعة، وأذون الصرف وسنداتها، والاتفاقية. قبل كده كان كل مكان
 * بيعرض الملف بطريقته · مرة «الملف المرفق» كلينك، ومرة زرارين
 * «عرض/تحميل»، ومرة أيقونة ورقة جنب اسم. تلات أشكال لنفس الشيء.
 *
 * والثامبنيل مش زينة: بيقول نوع المحتوى قبل الفتح، فالمراجع يعرف
 * إن الموازنة **صورة ممسوحة** من الصف نفسه · وده سبب طلب الاستكمال
 * في المشروع النموذجي.
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

        {/* التنزيل زرار مستقل: الضغط على الملف نفسه بيفتحه، والتنزيل
            قرار تاني · دمجهم بيخلّي كل معاينة تحميلًا. */}
        {download && <DocDownload name={name} />}
      </div>

      {open && <DocPreview name={name} meta={meta} onClose={() => setOpen(false)} />}
    </>
  )
}

/** زرار تنزيل لوحده · للجداول اللي بتحطّه في عمود الحالة */
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
      <Icon name={icons.export} size={15} />
    </a>
  )
}

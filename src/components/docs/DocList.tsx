import type { ReactNode } from 'react'
import { Tag } from '@/components/ui'
import { DocDownload, DocFile } from './DocFile'

/* ═══════════════════════════════════════════════════════════
   قائمة المستندات · **الشكل الواحد لأي قائمة مرفقات في السيستم**.

   ⚠️ **`DocFile` كان مكوّنًا واحدًا فعلًا · والقائمة حواليه لأ.**
   كل شاشة كانت بتكتب جدولها بإيدها: عمود الاسم، وعمود الحالة،
   ووسم الحالة، وزرار التنزيل، والصفّ الباهت لغير المرفوع. النتيجة
   إن نفس القايمة طلعت بأربع صور مختلفة (مرفقات المشروع · مستندات
   الجهة · مستندات الاتفاقية · الحسابات البنكية)، وكل تعديل في
   الشكل كان لازم يتعمل أربع مرّات · واللي بينسى واحدة بيسيب شاشة
   بتتصرّف غير أخواتها.

   **المرجع هو جدول «المرفقات» في صفحة المشروع** (ده المتّفق عليه)،
   واللي هنا هو هو بالحرف:

     · بلا ترويسة أعمدة · عنوان الكارت فوق بيقول «المرفقات»،
       و«المرفق · الحالة» تحته بيكرّروه. والخلية بتوصف نفسها.
     · الاسم زرار معاينة بثامبنيله · النوع بيبان قبل الفتح،
       فالمراجع يعرف إن الموازنة **صورة ممسوحة** من الصفّ نفسه.
     · التنزيل **في آخر الصفّ جنب الحالة** لا بعد الاسم · عشان
       الأيقونات تتسطّر في عمود واحد.
     · غير المرفوع بلا ثامبنيل (مفيش محتوى) وصفّه باهت.

   الأعمدة الزيادة (تاريخ الرفع · نهاية الصلاحية) بتتبعت في
   `extra` · هي بيانات الشاشة دي، مش شكلًا تاني للقائمة.

   ⚠️ **والأفعال بتتبعت، ما بتتكتبش في الصفّ** · «اطلبه من الجهة»
   فعل الشاشة لا فعل الملف، فمكانه `action` وبيتحطّ في آخر عمود
   بنفس المحاذاة في كل مكان.

   و`tools/onedoc.mjs` بيمنع رسم جدول مستندات بره المكوّن ده.
   ═══════════════════════════════════════════════════════════ */

export interface DocRow {
  /** اسم الملف بامتداده · الثامبنيل والنوع بيتقروا منه */
  name: string
  /** سطر تحت الاسم: مصدر أو تاريخ */
  meta?: string
  uploaded: boolean
  /** بيغيّر نصّ وسم «غير مرفوع» · مطلوب ولا اختياري */
  required?: boolean
  /** مرفوع بس صلاحيته انتهت · وسم `منتهٍ` */
  expired?: boolean
  /** خلايا زيادة بين الاسم والحالة · تاريخ رفع مثلًا */
  extra?: ReactNode[]
  /** فعل الشاشة على الصفّ ده · بيتحطّ في آخر عمود */
  action?: ReactNode
}

export interface DocListProps {
  rows: DocRow[]
  /** اسم القائمة لقارئ الشاشة · «مرفقات المشروع وحالتها» */
  label: string
  /** عناوين الأعمدة الزيادة · بتظهر ترويسة بس لو اتبعتت */
  heads?: string[]
}

const stateTag = (r: DocRow) => {
  if (!r.uploaded) {
    return <Tag tone={r.required === false ? 'mute' : 'warn'}>
      {r.required === false ? 'اختياري، غير مرفوع' : 'مطلوب، غير مرفوع'}
    </Tag>
  }
  if (r.expired) return <Tag tone="no">منتهٍ</Tag>
  return <Tag tone="ok">مرفوع</Tag>
}

export function DocList({ rows, label, heads }: DocListProps) {
  const acts = rows.some((r) => r.action)

  return (
    <div className="dlist">
      <table className="tbl" aria-label={label}>
        {/* ⚠️ الترويسة بتظهر **بس** لو فيه أعمدة زيادة محتاجة تسمية ·
            عمود الاسم وعمود الحالة بيوصفوا نفسهم، وترويسة «المرفق ·
            الحالة» بتكرّر عنوان الكارت اللي فوقها. */}
        {heads && heads.length > 0 && (
          <thead>
            <tr>
              <th>المستند</th>
              {heads.map((h) => <th key={h}>{h}</th>)}
              <th>الحالة</th>
              {acts && <th> </th>}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className={r.uploaded ? '' : 'off'}>
              <td>
                {r.uploaded
                  ? <DocFile name={r.name} meta={r.meta} download={false} />
                  : <span className="nmc sub">{r.name}</span>}
              </td>
              {/* ⚠️ المفتاح من **اسم العمود** لا من ترتيبه · `heads`
                  هي نفس الأعمدة بنفس الترتيب في كل صفّ */}
              {(r.extra ?? []).map((c, i) => (
                <td key={`${r.name}-${heads?.[i] ?? i}`}>{c ?? <span className="sub"> </span>}</td>
              ))}
              <td className={acts ? '' : 'n'}>
                <span className="dstat">
                  {stateTag(r)}
                  {r.uploaded && <DocDownload name={r.name} />}
                </span>
              </td>
              {acts && <td className="n">{r.action}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

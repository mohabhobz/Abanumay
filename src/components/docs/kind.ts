/**
 * نوع المستند — بيتحدّد من الامتداد، وإلا من اسمه.
 *
 * ليه مهم: الثامبنيل بيرسم شكل المحتوى لا أيقونة عامة. صفحة سطور
 * لملف نصّي، وشبكة خانات للجدول، وكتلة صورة للصورة. المراجع بيعرف
 * إن ده جدول قبل ما يفتحه، وده الفرق اللي أيقونة الورقة الواحدة
 * ما بتديهوش.
 */
export type DocKind = 'pdf' | 'doc' | 'sheet' | 'image' | 'archive'

const EXT: Record<string, DocKind> = {
  pdf: 'pdf',
  doc: 'doc', docx: 'doc', txt: 'doc', rtf: 'doc',
  xls: 'sheet', xlsx: 'sheet', csv: 'sheet',
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image',
  zip: 'archive', rar: 'archive',
}

export const docKind = (name: string): DocKind => {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (EXT[ext]) return EXT[ext]
  /* بلا امتداد: الاسم بيقول. «الموازنة» جدول، و«صور» صورة. */
  if (/موازن|ميزاني|جدول|كشف/.test(name)) return 'sheet'
  if (/صور|صورة|فيديو|لقطات/.test(name)) return 'image'
  return 'pdf'
}

export const KIND_LABEL: Record<DocKind, string> = {
  pdf: 'PDF',
  doc: 'مستند',
  sheet: 'جدول',
  image: 'صورة',
  archive: 'أرشيف مضغوط',
}

/**
 * الموازنة في المشروع النموذجي **صورة ممسوحة**، وده مش تفصيلة:
 * بنودها ما تتقارنش آليًا بالمبلغ المطلوب، وطلب الاستكمال الحالي
 * سببه هي. فالتحذير ده بيتقال في المعاينة وفي الثامبنيل.
 */
export const isScan = (name: string): boolean => /الموازنة/.test(name)

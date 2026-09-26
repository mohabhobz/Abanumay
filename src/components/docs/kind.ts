/**
 * Document type — determined from the extension, or from its name otherwise.
 * Why it matters: the thumbnail draws the shape of the content, not a generic icon — a lined page
 * for a text file, a grid of cells for a table, an image block for a picture. A reviewer knows it's
 * a table before opening it, which is the difference a single paper icon can't give.
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
  /* No extension: the name tells you. "Budget" is a table, "Photos" is an image. */
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
 * In the sample project, the budget is a **scanned image**, and that's not incidental: its line
 * items can't be compared to the requested amount automatically, and it's the reason for the
 * current completion request. This warning is stated in both the preview and the thumbnail.
 */
export const isScan = (name: string): boolean => /الموازنة/.test(name)

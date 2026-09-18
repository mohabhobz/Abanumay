/** المستندات · شكل واحد لأي ملف في السيستم: ثامبنيل · معاينة · تنزيل */
export { DocFile, DocDownload, type DocFileProps } from './DocFile'
export { DocThumb } from './DocThumb'
export { DocPreview, type DocPreviewProps } from './DocPreview'
export { docKind, isScan, KIND_LABEL, type DocKind } from './kind'
/* ⚠️ القائمة كمان مكوّن واحد · مرجعها جدول «المرفقات» في صفحة
   المشروع، و`tools/onedoc.mjs` بيمنع رسمها بره (شوف DocList) */
export { DocList, type DocRow, type DocListProps } from './DocList'

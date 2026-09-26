/** Documents — one shape for any file in the system: thumbnail, preview, download. */
export { DocFile, DocDownload, type DocFileProps } from './DocFile'
export { DocThumb } from './DocThumb'
export { DocPreview, type DocPreviewProps } from './DocPreview'
export { docKind, isScan, KIND_LABEL, type DocKind } from './kind'
/* ⚠️ The list is also one component — its reference is the "Attachments" table on the project page,
   and a build check blocks drawing it outside (see DocList). */
export { DocList, type DocRow, type DocListProps } from './DocList'
export { UploadButton, type UploadButtonProps } from './UploadButton'

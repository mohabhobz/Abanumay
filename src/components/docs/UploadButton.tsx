import { Icon, icons } from '@/components/ui'

/* Upload button — **written once**.

   ⚠️ **"Upload" used to be a button with no action on several screens** (the entity gate, the
   closure page, the final-report editor). It looked like an upload and did nothing when pressed —
   and on the gate specifically it's **the primary action**: an entity whose request came back with
   missing items has nothing else to do but this.

   ⚠️ **And it's a `<label>` wrapping `<input type="file">`, not a `<button>`.** This is the only
   shape that opens the file picker with no script, works from the keyboard, and tells a screen
   reader it's a file upload. It's styled as the system's own button, so no new element exists.

   `onPick` receives the actual file — in this mock, the screen marks the row "uploaded" by its
   name; in the real system, this is the same point where the upload to the backend starts. */

export interface UploadButtonProps {
  /** The file the user selected. */
  onPick: (file: File) => void
  /** Document name for screen readers — "upload zakat certificate." */
  label: string
  /** Allowed formats. */
  accept?: string
}

export function UploadButton({
  onPick, label, accept = '.pdf,.jpg,.jpeg,.png',
}: UploadButtonProps) {
  return (
    <label className="btn btn-2 btn-sm upbtn">
      <input
        type="file"
        accept={accept}
        aria-label={label}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPick(f)
          /* ⚠️ Cleared after selection — otherwise picking the same file again (after "remove," for
             example) never fires `onChange` at all. */
          e.target.value = ''
        }}
      />
      <Icon name={icons.upload} size="sm" />
      ارفع
    </label>
  )
}

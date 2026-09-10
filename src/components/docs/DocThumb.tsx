import { docKind, isScan, type DocKind } from './kind'

/**
 * ثامبنيل المستند — صفحة مصغّرة بترسم **شكل** المحتوى.
 *
 * الأيقونة الواحدة (ورقة مطويّة) بتقول «ده ملف» وبس. الثامبنيل بيقول
 * ده جدول ولا نص ولا صورة، من غير ما تفتحه. وده اللي بيخلّي صفّ فيه
 * ستة مرفقات يتقري بالنظرة بدل ما يتقري بالقراءة.
 *
 * ⚠️ الرسم مولَّد من نوع الملف — مش لقطة من الملف نفسه. لما الباك
 * اند يرجّع معاينة حقيقية، بتتحطّ مكان الرسم ده وبس.
 */
export function DocThumb({ name, size = 'sm' }: { name: string; size?: 'sm' | 'lg' }) {
  const kind = docKind(name)
  return (
    <span className={`dthumb dthumb-${size} k-${kind}`} aria-hidden="true">
      <span className="dthumb-p">
        <Face kind={kind} />
      </span>
      {isScan(name) && <span className="dthumb-scan">صورة</span>}
      <span className="dthumb-corner" />
    </span>
  )
}

function Face({ kind }: { kind: DocKind }) {
  if (kind === 'sheet') {
    /* شبكة: ترويسة داكنة وتحتها صفوف — الجدول بيتعرف من ده فورًا */
    return (
      <span className="dt-grid">
        {Array.from({ length: 12 }, (_, i) => <i key={i} className={i < 3 ? 'h' : undefined} />)}
      </span>
    )
  }
  if (kind === 'image') {
    /* أفق وشمس: أقل رسم بيتقري «صورة» */
    return (
      <span className="dt-img">
        <i className="sun" />
        <i className="hill" />
        <i className="hill b" />
      </span>
    )
  }
  if (kind === 'archive') {
    return (
      <span className="dt-zip">
        {Array.from({ length: 5 }, (_, i) => <i key={i} />)}
      </span>
    )
  }
  /* نص: عنوان قصير وسطور بأطوال مختلفة */
  return (
    <span className="dt-txt">
      <i className="t" />
      {[92, 78, 88, 60, 84, 44].map((w, i) => <i key={i} style={{ width: `${w}%` }} />)}
    </span>
  )
}

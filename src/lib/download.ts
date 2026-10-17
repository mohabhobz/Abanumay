import { toast } from '@/data/feedback'

/* 17 Oct · every press answers · the download icons were `href="#"` and did nothing. Until the files
   live on a server, the prototype hands over a one-page sample PDF under the document's own name,
   and says so */
const pdfOf = (title: string): Blob => {
  const text = `Abanumay grants system - sample copy of: ${title.replace(/[^\x20-\x7E]/g, '').trim() || 'document'}`
  const stream = `BT /F1 14 Tf 60 760 Td (${text.replace(/[()\\]/g, '')}) Tj ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offs: number[] = []
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const x = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`
  return new Blob([out], { type: 'application/pdf' })
}

export function downloadDoc(name: string): void {
  const file = /\.[a-z0-9]{2,4}$/i.test(name) ? name.replace(/\.[a-z0-9]{2,4}$/i, '.pdf') : `${name}.pdf`
  try {
    const url = URL.createObjectURL(pdfOf(name))
    const a = document.createElement('a')
    a.href = url; a.download = file
    document.body.appendChild(a); a.click(); a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 4000)
    toast(`بدأ تنزيل «${file}» · نسخة العرض`)
  } catch {
    toast('تعذّر التنزيل في هذا المتصفح', 'bad')
  }
}

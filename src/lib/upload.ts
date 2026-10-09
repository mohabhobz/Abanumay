/** Batch 7 · intake#12 · every upload checks what the request form checks · the type the field
    accepts, not empty, under the size cap · `accept` alone let the picker's «all files» through */
export const uploadRefusal = (f: File, accept: string, maxMb = 10): string => {
  const ext = `.${f.name.split('.').pop()?.toLowerCase() ?? ''}`
  const ok = accept.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)
  if (ok.length && !ok.includes(ext)) return `الامتداد ${ext} غير مقبول · المسموح ${ok.join(' ')}`
  if (f.size === 0) return 'الملف فارغ · اختر النسخة الصحيحة.'
  if (f.size > maxMb * 1024 * 1024) return `الملف أكبر من ${maxMb} م.ب.`
  return ''
}


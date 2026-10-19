import { cacheRead, cachedRead } from '@/lib/docCache'

/* Client 19 Oct · a document's expiry is read from the document itself when the entity uploads it ·
   the date written next to «تاريخ الانتهاء / تنتهي / صالح حتى» first, else the latest date in it that
   is still ahead · nothing found leaves the field for the entity to fill. */

const NEAR = /(?:تاريخ\s*(?:ال)?انتهاء|تنتهي|ينتهي|الانتهاء|صالح(?:ة)?\s*(?:حتى|لغاية)|نهاية\s*(?:ال)?(?:صلاحية|الترخيص|التكليف)|expir(?:y|es|ation))[^\d٠-٩]{0,30}/i

const iso = (y: string, m: string, d: string) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
const lat = (s: string) => s.replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))

/** The expiry date the document states · '' when none is found */
export function expiryFromText(text: string, dates: string[], today = new Date().toISOString().slice(0, 10)): string {
  const t = lat(text)
  const m = t.match(new RegExp(NEAR.source + '((?:19|20)\\d\\d[-/.]\\d{1,2}[-/.]\\d{1,2}|\\d{1,2}[-/.]\\d{1,2}[-/.](?:19|20)\\d\\d)', 'i'))
  if (m) {
    const p = m[1].split(/[-/.]/)
    return p[0].length === 4 ? iso(p[0], p[1], p[2]) : iso(p[2], p[1], p[0])
  }
  const ahead = dates.filter((d) => d > today).sort()
  return ahead.at(-1) ?? ''
}

/** Read an uploaded document's expiry · uses the shared reading cache */
export async function readExpiry(file: File): Promise<string> {
  try {
    const r = cachedRead(file.name, file.size) ?? await cacheRead(file)
    return expiryFromText(r.text, r.picked.dates)
  } catch { return '' }
}

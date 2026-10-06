import type { Reading } from '@/components/assistant'

/** A blockers list as the assistant's readings · one flag per item, its reason as the source */
export function blockerReadings(items: { text: unknown; why?: unknown; head?: unknown }[], label: string): Reading[] {
  return items
    .filter((b) => typeof b.text === 'string')
    .map((b, i) => ({ id: `blk-${i}`, kind: 'flag' as const, label: typeof b.head === 'string' ? b.head : label, text: b.text as string, src: typeof b.why === 'string' ? b.why : undefined }))
}

import beneficiary from '@/assets/illus/partner-beneficiary.svg?raw'
import implementer from '@/assets/illus/partner-implementer.svg?raw'
import strategic from '@/assets/illus/partner-strategic.svg?raw'

/**
 * Partner-type drawings — a growth stage per relationship.
 * Beneficiary = a bud inside the gate, implementing partner = a sapling on the foundation's stake,
 * strategic partner = two trees with intertwined roots. Traced from reference art into a
 * three-layer SVG (ink, tone, accent), colored from the drawing's own tokens in `:root`, so it
 * works in both themes with no second copy.
 */
const ART: Record<string, string> = { beneficiary, implementer, strategic }

export function PartnerArt({ kind }: { kind: string }) {
  const svg = ART[kind]
  if (!svg) return null
  return <span className="pkind-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
}

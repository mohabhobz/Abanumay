import type { ReactNode } from 'react'

/**
 * Highlights specific words inside reading text.
 * The words come with the data rather than being computed from the text, so highlighting is an
 * editorial decision, not a guess.
 */
export function highlight(text: string, words: string[] = [], danger: string[] = []): ReactNode {
  if (!words.length) return text

  const parts: ReactNode[] = []
  let rest = text
  let key = 0

  while (rest.length) {
    let index = -1
    let hit: string | null = null
    for (const w of words) {
      const i = rest.indexOf(w)
      if (i !== -1 && (index === -1 || i < index)) { index = i; hit = w }
    }
    if (index === -1 || !hit) { parts.push(rest); break }

    parts.push(rest.slice(0, index))
    parts.push(
      <b key={key++} className={danger.includes(hit) ? 'bad' : undefined}>{hit}</b>,
    )
    rest = rest.slice(index + hit.length)
  }

  return parts
}

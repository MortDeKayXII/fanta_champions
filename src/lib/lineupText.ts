import type { Player } from './types'

export interface PastedSlot {
  input: string
  player: Player | null
  outOfPosition: boolean
  /** Why no player was picked (unknown or ambiguous name). */
  problem?: string
}

export const normalizeName = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Turns pasted text (one player per line, or comma separated) into lineup slots.
 * A trailing "*" marks the player as out of position (-1), as in the old spreadsheet.
 * Matching: exact name, else names starting with / containing the text; among several candidates
 * the ones in the team's roster win. Anything still ambiguous is left empty with a `problem`.
 */
export function matchPlayerNames(
  text: string,
  players: readonly Player[],
  rosterIds: ReadonlySet<number>,
): PastedSlot[] {
  const indexed = players.map((p) => ({ p, n: normalizeName(p.name) }))

  return text
    .split(/[\n,;]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): PastedSlot => {
      const outOfPosition = /\*\s*$/.test(line)
      const query = normalizeName(line.replace(/\*/g, ''))
      const fail = (problem: string): PastedSlot => ({
        input: line,
        player: null,
        outOfPosition,
        problem,
      })
      if (query.length < 2) return fail('Nome troppo corto')

      const pick = (candidates: Array<{ p: Player; n: string }>): PastedSlot | null => {
        if (candidates.length === 0) return null
        if (candidates.length === 1) return { input: line, player: candidates[0].p, outOfPosition }
        const inRoster = candidates.filter((c) => rosterIds.has(c.p.id))
        if (inRoster.length === 1) return { input: line, player: inRoster[0].p, outOfPosition }
        return fail(
          `Ambiguo: ${candidates
            .slice(0, 4)
            .map((c) => c.p.name)
            .join(', ')}`,
        )
      }

      return (
        pick(indexed.filter((c) => c.n === query)) ??
        pick(indexed.filter((c) => c.n.startsWith(query + ' ') || c.n.startsWith(query))) ??
        pick(indexed.filter((c) => c.n.includes(query))) ??
        fail('Giocatore non trovato')
      )
    })
}

import type { VoteRow } from '../engine'

export interface ParsedVotes {
  votes: VoteRow[]
  /** Players with "s.v." / "6*" (no official vote): they contribute 0. */
  noVote: number
  coaches: number
  warnings: string[]
}

const toInt = (cell: unknown): number => {
  const n = Number(cell)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

/** A vote is a plain number; "6*" (no vote, political 6) and anything else non numeric is null. */
function toVote(cell: unknown): number | null {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null
  if (typeof cell !== 'string') return null
  const text = cell.trim().replace(',', '.')
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : null
}

/**
 * Parses the rows of a Fantacalcio votes sheet ("Cod. Ruolo Nome Voto Gf Gs Rp Rs Rf Au Amm Esp Ass").
 * Only rows whose first cell is a player code and whose role is P/D/C/A are players; team headers,
 * column headers, the copyright lines and coaches (role ALL) are skipped.
 */
export function parseVotes(rows: ReadonlyArray<ReadonlyArray<unknown>>): ParsedVotes {
  const byId = new Map<number, VoteRow>()
  const warnings: string[] = []
  let coaches = 0
  let noVote = 0

  for (const row of rows) {
    const code = row[0]
    const isCode =
      typeof code === 'number' || (typeof code === 'string' && /^\d+$/.test(code.trim()))
    if (!isCode) continue
    const role = String(row[1] ?? '').trim()
    if (role === 'ALL') {
      coaches++
      continue
    }
    if (!['P', 'D', 'C', 'A'].includes(role)) continue

    const playerId = Number(code)
    const vote = toVote(row[3])
    if (vote === null) noVote++
    if (byId.has(playerId))
      warnings.push(`Giocatore ${playerId} (${row[2]}) presente più volte: uso l'ultima riga.`)
    byId.set(playerId, {
      playerId,
      vote,
      gf: toInt(row[4]),
      gs: toInt(row[5]),
      rp: toInt(row[6]),
      rs: toInt(row[7]),
      rf: toInt(row[8]),
      au: toInt(row[9]),
      amm: toInt(row[10]),
      esp: toInt(row[11]),
      ass: toInt(row[12]),
    })
  }

  if (byId.size === 0) warnings.push('Nessun giocatore trovato: è il file dei voti giusto?')
  return { votes: [...byId.values()], noVote, coaches, warnings }
}

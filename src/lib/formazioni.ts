import { normalizeName } from './lineupText'
import type { Player } from './types'
import { cellAt, type Grid } from './xlsxCells'

/**
 * Import of the lineup export of an original league ("Fanta Pepe · Giornata N").
 *
 * Layout: match blocks with two teams side by side. Each team has a header row
 * "Ruolo | Calciatore | | Sq. | V | FV | ...", the 11 starters, a "Panchina" row and the bench.
 * Players drawn in grey are the ones the original app did NOT count (not in the score).
 */

export interface FilePlayer {
  name: string
  /** Mantra roles as written in the file, e.g. ["Dd", "Dc"]. */
  roles: string[]
  /** Numeric vote when the player has one (final files), null for "SV" / missing. */
  vote: number | null
  /** true when the file marks the player as "SV" (no vote). */
  sv: boolean
  /** Grey in the file: not counted by the original app (replaced starter / unused bench). */
  grey: boolean
}

export interface FileTeam {
  teamName: string
  module: string
  starters: FilePlayer[]
  bench: FilePlayer[]
  /** The "Totale" printed in the file (includes modifiers such as "Modificatore difesa"). */
  fileTotal: number | null
}

const SYMBOLS = /[ⒸⓋ]|⇄[✓✗]?/gu

function readPlayer(grid: Grid, row: number, col: number): FilePlayer {
  const name = String(cellAt(grid, row, col + 1).v ?? '')
    .replace(SYMBOLS, '')
    .replace(/\s+/g, ' ')
    .trim()
  const v = cellAt(grid, row, col + 4).v
  return {
    name,
    roles: String(cellAt(grid, row, col).v ?? '')
      .split('/')
      .filter(Boolean),
    vote: typeof v === 'number' ? v : null,
    sv: typeof v === 'string' && v.trim().toUpperCase() === 'SV',
    grey: cellAt(grid, row, col + 1).grey,
  }
}

/** Finds every team block of the sheet (any number of columns pairs, any number of matches). */
export function parseFormazioni(grid: Grid): FileTeam[] {
  const teams: FileTeam[] = []

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r]?.length ?? 0); c++) {
      if (cellAt(grid, r, c).v !== 'Ruolo' || cellAt(grid, r, c + 1).v !== 'Calciatore') continue

      // Team name: first non-empty cell above the header that is not the "Modulo" row.
      let teamName = ''
      let module = ''
      let fileTotal: number | null = null
      for (let i = r - 1; i >= 0; i--) {
        const v = cellAt(grid, i, c).v
        if (v === null) continue
        if (v === 'Modulo') {
          module = String(cellAt(grid, i, c + 1).v ?? '')
          const total = cellAt(grid, i, c + 5).v
          fileTotal = typeof total === 'number' ? total : null
          continue
        }
        teamName = String(v).trim()
        break
      }
      if (!teamName) continue

      const starters: FilePlayer[] = []
      const bench: FilePlayer[] = []
      let i = r + 1
      for (; i < grid.length; i++) {
        const role = cellAt(grid, i, c).v
        if (role === null || role === 'Panchina') break
        starters.push(readPlayer(grid, i, c))
      }
      if (cellAt(grid, i, c).v === 'Panchina') {
        for (i++; i < grid.length; i++) {
          const role = cellAt(grid, i, c).v
          if (role === null || role === 'Modificatori') break
          bench.push(readPlayer(grid, i, c))
        }
      }
      teams.push({ teamName, module, starters, bench, fileTotal })
    }
  }
  return teams
}

/** Does the file carry match data (votes), i.e. is it a post-match export? */
export const hasVotes = (teams: readonly FileTeam[]) =>
  teams.some((t) => t.starters.some((p) => p.vote !== null))

// ---------------------------------------------------------------------------------------------

export type ImportMode = 'initial' | 'final'

export interface ImportOptions {
  /** 'initial': the 11 starters as fielded. 'final': apply the substitutions the app made. */
  mode: ImportMode
  /** Substitutions allowed by this competition; later ones in the file are not applied. */
  maxSubs: number
}

export interface Substitution {
  out: string
  in: string
}

export interface BuiltLineup {
  teamName: string
  /** 11 slots in file order; a replaced starter's slot holds the player who came in. */
  slots: Array<{ fileName: string; player: Player | null }>
  substitutions: Substitution[]
  /** Substitutions made by the original app but ignored because of the cap. */
  ignored: string[]
  warnings: string[]
}

export const playersByName = (players: readonly Player[]): Map<string, Player> =>
  new Map(players.map((p) => [normalizeName(p.name), p]))

const overlap = (a: readonly string[], b: readonly string[]) => a.some((x) => b.includes(x))

/**
 * Turns one file team into a lineup. In 'final' mode the original app's substitutions are applied
 * in bench order and only the first `maxSubs` are kept, so a league with 5 substitutions gives the
 * same result as a 3-substitution competition. Each kept substitute takes the place of a starter
 * who was not counted (no vote), preferring one with a compatible Mantra role.
 */
export function buildLineup(
  team: FileTeam,
  byName: ReadonlyMap<string, Player>,
  { mode, maxSubs }: ImportOptions,
): BuiltLineup {
  const warnings: string[] = []
  const find = (p: FilePlayer): Player | null => {
    const player = byName.get(normalizeName(p.name)) ?? null
    if (!player) warnings.push(`${team.teamName}: «${p.name}» non è nella lista giocatori.`)
    return player
  }

  const slots = team.starters.map((p) => ({
    fileName: p.name,
    player: null as Player | null,
    src: p,
  }))
  const substitutions: Substitution[] = []
  const ignored: string[] = []

  if (mode === 'final') {
    const entering = team.bench.filter((p) => !p.grey)
    const kept = entering.slice(0, Math.max(0, maxSubs))
    for (const p of entering.slice(kept.length)) ignored.push(p.name)

    const free = new Set(slots.map((s, i) => (s.src.grey ? i : -1)).filter((i) => i >= 0))
    for (const sub of kept) {
      const candidates = [...free]
      const pick = (f: (i: number) => boolean) => candidates.find(f)
      const target =
        pick((i) => overlap(slots[i].src.roles, sub.roles) && slots[i].src.sv) ??
        pick((i) => overlap(slots[i].src.roles, sub.roles)) ??
        pick((i) => slots[i].src.sv) ??
        candidates[0]
      if (target === undefined) {
        warnings.push(`${team.teamName}: entra ${sub.name} ma non c'è un titolare da sostituire.`)
        continue
      }
      free.delete(target)
      substitutions.push({ out: slots[target].src.name, in: sub.name })
      slots[target].fileName = sub.name
      slots[target].src = sub
    }
  }

  const built = slots.map((s) => ({ fileName: s.fileName, player: find(s.src) }))
  if (built.length !== 11)
    warnings.push(`${team.teamName}: ${built.length} titolari nel file (attesi 11).`)
  return { teamName: team.teamName, slots: built, substitutions, ignored, warnings }
}

export interface SavedFlag {
  team_id: number
  player_id: number | null
  out_of_position: boolean
}

/**
 * Database rows for one imported team: always the 11 slots, so the upsert replaces the whole
 * previous lineup of that matchday. A "-1 out of position" flag the admin had set is kept when the
 * same player is still in the lineup. Computed scores are cleared (they return with the next calculation).
 */
export function importRows(
  matchday: number,
  teamId: number,
  built: BuiltLineup,
  saved: readonly SavedFlag[],
) {
  const flagged = new Set(
    saved
      .filter((l) => l.team_id === teamId && l.out_of_position && l.player_id !== null)
      .map((l) => l.player_id),
  )
  return built.slots.map((s, i) => ({
    matchday,
    team_id: teamId,
    slot: i + 1,
    player_id: s.player?.id ?? null,
    player_name: s.player?.name ?? null,
    out_of_position: s.player ? flagged.has(s.player.id) : false,
    vote: null,
    fantavoto: null,
    counted: null,
    stats: null,
  }))
}

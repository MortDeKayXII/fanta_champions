import { moduleSlots, type ModuleSlot } from './modules'

/**
 * Puts a lineup on a pitch: each player goes to the position of the module that fits his Mantra
 * roles best, and positions are turned into coordinates on a landscape pitch where each team only
 * uses its own half (home on the left attacking right, away on the right attacking left).
 */

export interface FieldPlayer {
  /** Mantra roles of the player, e.g. ["Dd", "Dc"]. */
  roles: string[]
}

/** Role families, from the goal to the opponent's goal; used to place players out of role sensibly. */
const FAMILY: Record<string, number> = {
  Por: 0,
  Dd: 1,
  Ds: 1,
  Dc: 1,
  B: 1,
  E: 2,
  M: 2,
  C: 2,
  W: 3,
  T: 3,
  A: 4,
  Pc: 4,
}

/** How well a player fits a position: 10+ when a role matches, less the further away his family is. */
export function fit(player: FieldPlayer | null, slot: ModuleSlot): number {
  if (!player) return 0
  if (slot.roles.length === 0) return 5 // generic layout: any player fits
  if (player.roles.some((r) => slot.roles.includes(r))) {
    // the player's main role (first listed) matching is slightly better
    return player.roles[0] !== undefined && slot.roles.includes(player.roles[0]) ? 12 : 10
  }
  const pf = player.roles.map((r) => FAMILY[r]).filter((n) => n !== undefined)
  const sf = slot.roles.map((r) => FAMILY[r]).filter((n) => n !== undefined)
  if (pf.length === 0 || sf.length === 0) return 0
  const gap = Math.min(...pf.flatMap((a) => sf.map((b) => Math.abs(a - b))))
  return Math.max(0, 5 - gap * 2) // same family 5, one step away 3, two 1, else 0
}

/**
 * Best one-to-one assignment of the lineup's players to the module's positions.
 * `players` are in lineup order (holes are null); the result gives, for each player, the index of
 * his position (null for holes). Ties prefer keeping the lineup order, which is how the original
 * export lists players (goalkeeper, defenders, midfield, attack).
 */
export function assignPlayers(
  players: ReadonlyArray<FieldPlayer | null>,
  slots: readonly ModuleSlot[],
): Array<number | null> {
  const n = slots.length
  const count = Math.min(players.length, n)
  // dp over players in order: best[mask] = best score having placed the first i players on `mask`
  const NEG = -Infinity
  let best = new Map<number, { score: number; pick: number[] }>([[0, { score: 0, pick: [] }]])
  for (let i = 0; i < count; i++) {
    const next = new Map<number, { score: number; pick: number[] }>()
    for (const [mask, state] of best) {
      if (players[i] === null) {
        // hole: takes no position
        const prev = next.get(mask)
        if (!prev || state.score > prev.score)
          next.set(mask, { score: state.score, pick: [...state.pick, -1] })
        continue
      }
      for (let j = 0; j < n; j++) {
        if (mask & (1 << j)) continue
        const score = state.score + fit(players[i], slots[j]) * 100 - Math.abs(i - j)
        const m = mask | (1 << j)
        const prev = next.get(m)
        if (!prev || score > prev.score) next.set(m, { score, pick: [...state.pick, j] })
      }
    }
    best = next
  }
  let top: { score: number; pick: number[] } | undefined
  let topScore = NEG
  for (const state of best.values()) {
    if (state.score > topScore) {
      topScore = state.score
      top = state
    }
  }
  const pick = top?.pick ?? []
  return players.map((_, i) => (pick[i] === undefined || pick[i] < 0 ? null : pick[i]))
}

export type Side = 'home' | 'away'

/**
 * 'landscape': the pitch is wider than tall, home on the left half attacking right.
 * 'portrait' (phones): the pitch is taller than wide, home on the top half attacking down.
 */
export type Orientation = 'landscape' | 'portrait'

/** Position on the drawn pitch, as fractions of what is seen on screen. */
export interface PitchPoint {
  /** 0 = left edge .. 1 = right edge of the drawn pitch. */
  x: number
  /** 0 = top edge .. 1 = bottom edge of the drawn pitch. */
  y: number
}

/**
 * Screen coordinates of a position for a team using only its own half.
 * The depth is rescaled so the goalkeeper sits near his goal and the strikers just before the
 * halfway line. Chart-left is the team's RIGHT hand, so what is on the left or right of the screen
 * depends on which way the team faces:
 *   landscape  home faces east (right hand = bottom), away faces west (right hand = top)
 *   portrait   home faces south (right hand = left),  away faces north (right hand = right)
 */
export function toPitch(
  slot: ModuleSlot,
  side: Side,
  orientation: Orientation = 'landscape',
): PitchPoint {
  const GK_Y = 0.09
  const ATT_Y = 0.85
  const depth = 0.05 + ((slot.y - GK_Y) / (ATT_Y - GK_Y)) * 0.4 // 0.05 .. 0.45 of the pitch length
  if (orientation === 'portrait') {
    return side === 'home' ? { x: slot.x, y: depth } : { x: 1 - slot.x, y: 1 - depth }
  }
  return side === 'home' ? { x: depth, y: 1 - slot.x } : { x: 1 - depth, y: slot.x }
}

export interface PlacedPlayer<T> {
  player: T
  slot: ModuleSlot
  /** The role of the position the player fills that he actually has, if any (else he is out of role). */
  matchedRole: string | null
  point: PitchPoint
}

/** Everything needed to draw one team: who stands where. Null when the module is missing or not in the chart. */
export function placeTeam<T extends FieldPlayer>(
  module: string | null | undefined,
  players: ReadonlyArray<T | null>,
  side: Side,
  orientation: Orientation = 'landscape',
): Array<PlacedPlayer<T>> | null {
  const slots = moduleSlots(module)
  if (!slots) return null
  const where = assignPlayers(players, slots)
  const placed: Array<PlacedPlayer<T>> = []
  players.forEach((player, i) => {
    const j = where[i]
    if (player === null || j === null) return
    const slot = slots[j]
    const matchedRole = player.roles.find((r) => slot.roles.includes(r)) ?? null
    placed.push({ player, slot, matchedRole, point: toPitch(slot, side, orientation) })
  })
  return placed
}

import { MANTRA_ORDER, splitMantraRoles } from './labels'
import type { Player } from './types'

/** Position of a player in the role legend, by his first (main) Mantra role. */
export function mantraRank(player: Pick<Player, 'mantra_roles'>): number {
  const main = splitMantraRoles(player.mantra_roles)[0]
  const i = main ? MANTRA_ORDER.indexOf(main) : -1
  return i === -1 ? MANTRA_ORDER.length : i
}

export interface RosterGroup<T> {
  key: 'goalkeepers' | 'field'
  title: string
  items: T[]
}

/**
 * Roster sections: goalkeepers, then "Giocatori di movimento" ordered as in the role legend
 * (DS, DC, DD, B, E, M, C, W, T, A, PC by main role), then by name.
 */
export function groupRoster<T extends { player: Player }>(items: readonly T[]): RosterGroup<T>[] {
  const byName = (a: T, b: T) => a.player.name.localeCompare(b.player.name)
  return [
    {
      key: 'goalkeepers',
      title: 'Portieri',
      items: items.filter((i) => i.player.role === 'P').sort(byName),
    },
    {
      key: 'field',
      title: 'Giocatori di movimento',
      items: items
        .filter((i) => i.player.role !== 'P')
        .sort((a, b) => mantraRank(a.player) - mantraRank(b.player) || byName(a, b)),
    },
  ]
}

import type { LineupRow } from './types'

export type StatKey = keyof NonNullable<LineupRow['stats']>

/** Icon and label for each bonus/malus event, in display order. */
export const STAT_ICONS: Array<[StatKey, string, string]> = [
  ['gf', '⚽', 'Gol'],
  ['ass', '🅰️', 'Assist'],
  ['rp', '🧤', 'Rigore parato'],
  ['rf', '🎯', 'Rigore segnato'],
  ['gs', '🥅', 'Gol subito'],
  ['rs', '❌', 'Rigore sbagliato'],
  ['au', '↩️', 'Autogol'],
  ['amm', '🟨', 'Ammonizione'],
  ['esp', '🟥', 'Espulsione'],
]

/** On the pitch "goals conceded" would clutter every goalkeeper and defender: leave it to the table. */
export const PITCH_STAT_ICONS = STAT_ICONS.filter(([key]) => key !== 'gs')

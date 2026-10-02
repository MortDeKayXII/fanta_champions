import type { League, Matchday, Phase } from './types'

const PHASE_NAME: Record<Phase, string> = {
  group: 'Fase a gironi',
  playoff: 'Playoff',
  r16: 'Ottavi di finale',
  quarter: 'Quarti di finale',
  semi: 'Semifinali',
  final: 'Finale',
}

export const LEAGUE_NAME: Record<League, string> = {
  A: 'Fanta Montelparo',
  B: 'Fanta Pepe',
  C: 'Fanta Ortezzano',
}

/**
 * One colour per league, used both for team names and for the legend dots so they always match.
 * Dark enough to read as text on white.
 */
export const LEAGUE_COLOR: Record<League, string> = {
  A: '#15803d', // green
  B: '#b91c1c', // red
  C: '#1d4ed8', // blue
}

export function matchdayTitle(m: Matchday): string {
  if (m.phase === 'group') return `Giornata ${m.number}`
  if (m.phase === 'final') return PHASE_NAME.final
  return `${PHASE_NAME[m.phase]} · ${m.leg === 1 ? 'andata' : 'ritorno'}`
}

export function matchdayShort(m: Matchday): string {
  return String(m.number)
}

export const ITALIAN_NUMBER = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

export const formatPoints = (n: number) => ITALIAN_NUMBER.format(n)

/** Mantra positions (Fantacalcio legend), with the colour group used for their chips. */
export const MANTRA_NAME: Record<string, string> = {
  Por: 'Portiere',
  Ds: 'Terzino sinistro',
  Dc: 'Difensore centrale',
  Dd: 'Terzino destro',
  B: 'Braccetto difensivo',
  E: 'Esterno basso',
  M: 'Centrocampista difensivo',
  C: 'Centrocampista centrale',
  W: 'Ala',
  T: 'Trequartista',
  A: 'Attaccante di raccordo',
  Pc: 'Punta centrale',
}

/** Chip colours sampled from the Fantacalcio role legend (one colour per family). */
const ORANGE = '#EBA216' // goalkeeper
const GREEN = '#4A9B13' // defenders
const BLUE = '#286DDB' // midfielders
const MAGENTA = '#D01CC0' // wingers, playmakers
const RED = '#B9161F' // forwards

const MANTRA_COLOR: Record<string, string> = {
  Por: ORANGE,
  Ds: GREEN,
  Dc: GREEN,
  Dd: GREEN,
  B: GREEN,
  E: BLUE,
  M: BLUE,
  C: BLUE,
  W: MAGENTA,
  T: MAGENTA,
  A: RED,
  Pc: RED,
}

/** Background colour (hex) of a Mantra role chip. */
export const mantraColor = (role: string): string => MANTRA_COLOR[role] ?? '#64748B'

/** Role order of the legend: goalkeeper, defenders, midfielders, wingers, forwards. */
export const MANTRA_ORDER: string[] = Object.keys(MANTRA_NAME)

/** Short label as drawn in the legend (P, DS, DC, DD, B, E, M, C, W, T, A, PC). */
export const mantraLabel = (role: string): string => (role === 'Por' ? 'P' : role.toUpperCase())

export const splitMantraRoles = (roles: string): string[] => roles.split(';').filter(Boolean)

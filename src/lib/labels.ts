import type { League, Matchday, Phase, Role } from './types'

const PHASE_NAME: Record<Phase, string> = {
  group: 'Fase a gironi',
  playoff: 'Playoff',
  r16: 'Ottavi di finale',
  quarter: 'Quarti di finale',
  semi: 'Semifinali',
  final: 'Finale',
}

export const ROLE_NAME: Record<Role, string> = {
  P: 'Portieri',
  D: 'Difensori',
  C: 'Centrocampisti',
  A: 'Attaccanti',
}

export const ROLE_ORDER: Role[] = ['P', 'D', 'C', 'A']

export const LEAGUE_NAME: Record<League, string> = {
  A: 'Fanta Montelparo',
  B: 'Fanta Pepe',
  C: 'Fanta Ortezzano',
}

/** Subtle colours used only for team names and small badges. */
export const LEAGUE_TEXT: Record<League, string> = {
  A: 'text-teal-700',
  B: 'text-orange-700',
  C: 'text-purple-700',
}
export const LEAGUE_DOT: Record<League, string> = {
  A: 'bg-teal-500',
  B: 'bg-orange-500',
  C: 'bg-purple-500',
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

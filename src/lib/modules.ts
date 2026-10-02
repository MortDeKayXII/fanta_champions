/**
 * The Mantra modules of the 2026/27 chart: where each of the 11 players stands and which roles
 * each position accepts (e.g. "DC/B" = Dc or B).
 *
 * Coordinates are fractions of the chart's pitch, as the chart draws it: the goalkeeper at the
 * top, the attack at the bottom.
 *   x: 0 = left edge of the chart .. 1 = right edge. Seen from the goalkeeper looking at the
 *      opposing goal, chart-left is the team's RIGHT hand side (DD is on the left of the chart).
 *   y: 0 = own goal line .. 1 = opponent goal line.
 * Slots are listed goalkeeper, defenders (chart left to right), midfield, attack.
 */

export interface ModuleSlot {
  /** Mantra roles accepted by this position, in the app's notation (Por, Dd, Ds, Dc, B, E, M, C, W, T, A, Pc). */
  roles: string[]
  x: number
  y: number
}

const ROLE: Record<string, string> = { P: 'Por', DD: 'Dd', DS: 'Ds', DC: 'Dc', PC: 'Pc' }
const role = (chartRole: string) => ROLE[chartRole] ?? chartRole

/** s('DC/B', 0.737, 0.204): a position accepting DC or B. */
const s = (chartRoles: string, x: number, y: number): ModuleSlot => ({
  roles: chartRoles.split('/').map(role),
  x,
  y,
})

// Shared rows of the chart
const GK = s('P', 0.5, 0.09)
const BACK3 = [s('DC', 0.274, 0.204), s('DC', 0.5, 0.204), s('DC/B', 0.737, 0.204)]
const BACK4 = [
  s('DD', 0.195, 0.204),
  s('DC', 0.398, 0.204),
  s('DC', 0.598, 0.204),
  s('DS', 0.797, 0.204),
]

export const MODULES: Record<string, ModuleSlot[]> = {
  '3-4-3': [
    GK,
    ...BACK3,
    s('E', 0.124, 0.433),
    s('M/C', 0.346, 0.5),
    s('C', 0.643, 0.5),
    s('E', 0.872, 0.433),
    s('W/A', 0.203, 0.741),
    s('A/PC', 0.5, 0.853),
    s('W/A', 0.793, 0.741),
  ],
  '3-4-1-2': [
    GK,
    ...BACK3,
    s('E', 0.124, 0.433),
    s('M/C', 0.35, 0.5),
    s('C', 0.647, 0.5),
    s('E', 0.872, 0.433),
    s('T', 0.5, 0.687),
    s('A/PC', 0.312, 0.809),
    s('A/PC', 0.692, 0.809),
  ],
  '3-4-2-1': [
    GK,
    ...BACK3,
    s('E/W', 0.21, 0.578),
    s('M', 0.357, 0.439),
    s('M/C', 0.647, 0.501),
    s('E', 0.861, 0.433),
    s('T', 0.376, 0.679),
    s('T/A', 0.729, 0.728),
    s('A/PC', 0.508, 0.85),
  ],
  '3-5-2': [
    GK,
    ...BACK3,
    s('E/W', 0.169, 0.621),
    s('M/C', 0.346, 0.501),
    s('M', 0.556, 0.403),
    s('C', 0.722, 0.578),
    s('E', 0.857, 0.433),
    s('A/PC', 0.308, 0.804),
    s('A/PC', 0.692, 0.804),
  ],
  '3-5-1-1': [
    GK,
    ...BACK3,
    s('E/W', 0.214, 0.64),
    s('M', 0.353, 0.417),
    s('C', 0.5, 0.499),
    s('M', 0.647, 0.417),
    s('E/W', 0.793, 0.64),
    s('T/A', 0.5, 0.722),
    s('A/PC', 0.5, 0.85),
  ],
  '4-3-3': [
    GK,
    ...BACK4,
    s('M/C', 0.195, 0.496),
    s('M', 0.5, 0.501),
    s('C', 0.812, 0.501),
    s('W/A', 0.203, 0.744),
    s('A/PC', 0.5, 0.847),
    s('W/A', 0.789, 0.744),
  ],
  '4-3-1-2': [
    GK,
    ...BACK4,
    s('M/C', 0.195, 0.496),
    s('M', 0.5, 0.501),
    s('C', 0.812, 0.501),
    s('T', 0.5, 0.706),
    s('T/A/PC', 0.301, 0.798),
    s('A/PC', 0.737, 0.798),
  ],
  '4-4-2': [
    GK,
    ...BACK4,
    s('E/W', 0.173, 0.608),
    s('M/C', 0.335, 0.417),
    s('C', 0.647, 0.496),
    s('E', 0.853, 0.441),
    s('A/PC', 0.312, 0.798),
    s('A/PC', 0.692, 0.798),
  ],
  '4-1-4-1': [
    GK,
    ...BACK4,
    s('M', 0.5, 0.392),
    s('E/W', 0.162, 0.692),
    s('C/T', 0.293, 0.553),
    s('T', 0.756, 0.553),
    s('W', 0.865, 0.698),
    s('A/PC', 0.5, 0.847),
  ],
  '4-4-1-1': [
    GK,
    ...BACK4,
    s('E/W', 0.211, 0.638),
    s('M', 0.35, 0.493),
    s('C', 0.643, 0.493),
    s('E/W', 0.789, 0.638),
    s('T/A', 0.496, 0.719),
    s('A/PC', 0.5, 0.847),
  ],
  '4-2-3-1': [
    GK,
    ...BACK4,
    s('M', 0.35, 0.499),
    s('M/C', 0.643, 0.499),
    s('W/T', 0.192, 0.681),
    s('T', 0.5, 0.681),
    s('W/A', 0.797, 0.681),
    s('A/PC', 0.5, 0.847),
  ],
}

/** The modules a lineup can have: exactly the 11 of the chart, in chart order. */
export const MODULE_NAMES: string[] = Object.keys(MODULES)

export const isChartModule = (module: string | null | undefined): module is string =>
  typeof module === 'string' && Object.hasOwn(MODULES, module)

/** The chart layout of a module; null when the module is missing or not one of the 11. */
export function moduleSlots(module: string | null | undefined): ModuleSlot[] | null {
  return isChartModule(module) ? MODULES[module] : null
}

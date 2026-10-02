/**
 * Colour of the bar beside each row of the group table:
 * 1-8 green (straight to the round of 16), 9-24 a blue gradient (playoff, darkest for the best
 * placed), 25+ red (eliminated).
 */
export const ZONE_GREEN = '#16a34a'
export const ZONE_RED = '#dc2626'
export const PLAYOFF_FROM = '#1d4ed8' // rank 9
export const PLAYOFF_TO = '#93c5fd' // rank 24

const hexToRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const rgbToHex = (rgb: number[]) =>
  '#' + rgb.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')

export type Zone = 'direct' | 'playoff' | 'eliminated'

export function zoneOf(position: number): Zone {
  return position <= 8 ? 'direct' : position <= 24 ? 'playoff' : 'eliminated'
}

export function zoneColor(position: number): string {
  const zone = zoneOf(position)
  if (zone === 'direct') return ZONE_GREEN
  if (zone === 'eliminated') return ZONE_RED
  const t = (position - 9) / (24 - 9)
  const from = hexToRgb(PLAYOFF_FROM)
  const to = hexToRgb(PLAYOFF_TO)
  return rgbToHex(from.map((c, i) => c + (to[i] - c) * t))
}

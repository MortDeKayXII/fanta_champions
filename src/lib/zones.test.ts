import { describe, expect, it } from 'vitest'
import { PLAYOFF_FROM, PLAYOFF_TO, ZONE_GREEN, ZONE_RED, zoneColor, zoneOf } from './zones'

describe('zones', () => {
  it('splits the table 1-8 / 9-24 / 25-30', () => {
    expect([1, 8, 9, 24, 25, 30].map(zoneOf)).toEqual([
      'direct',
      'direct',
      'playoff',
      'playoff',
      'eliminated',
      'eliminated',
    ])
  })

  it('green for the top 8, red for the eliminated', () => {
    for (const pos of [1, 4, 8]) expect(zoneColor(pos)).toBe(ZONE_GREEN)
    for (const pos of [25, 28, 30]) expect(zoneColor(pos)).toBe(ZONE_RED)
  })

  it('playoff bars are a gradient of blue from rank 9 (darkest) to rank 24 (lightest)', () => {
    expect(zoneColor(9)).toBe(PLAYOFF_FROM)
    expect(zoneColor(24)).toBe(PLAYOFF_TO)
    const brightness = (hex: string) =>
      [1, 3, 5].reduce((s, i) => s + parseInt(hex.slice(i, i + 2), 16), 0)
    const colors = Array.from({ length: 16 }, (_, i) => zoneColor(9 + i))
    expect(new Set(colors).size).toBe(16)
    for (let i = 1; i < colors.length; i++) {
      expect(brightness(colors[i])).toBeGreaterThan(brightness(colors[i - 1]))
    }
    // every step stays blue (blue channel dominates)
    for (const c of colors) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
      expect(b).toBeGreaterThan(r)
      expect(b).toBeGreaterThanOrEqual(g)
    }
  })
})

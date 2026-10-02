import { describe, expect, it } from 'vitest'
import { assignPlayers, fit, placeTeam, toPitch, type FieldPlayer } from './fieldLayout'
import { MODULES, MODULE_NAMES, isChartModule, moduleSlots } from './modules'

const p = (roles: string): FieldPlayer => ({ roles: roles.split('/') })

describe('module charts', () => {
  it('has the 11 modules of the chart, each with 11 positions and one goalkeeper', () => {
    expect(Object.keys(MODULES).sort()).toEqual([
      '3-4-1-2',
      '3-4-2-1',
      '3-4-3',
      '3-5-1-1',
      '3-5-2',
      '4-1-4-1',
      '4-2-3-1',
      '4-3-1-2',
      '4-3-3',
      '4-4-1-1',
      '4-4-2',
    ])
    for (const [name, slots] of Object.entries(MODULES)) {
      expect(slots, name).toHaveLength(11)
      expect(
        slots.filter((s) => s.roles.includes('Por')),
        name,
      ).toHaveLength(1)
      // the first digit of the name is the number of defenders, all on the same row
      const defenders = Number(name.split('-')[0])
      expect(
        slots.filter((s) => s.y === 0.204),
        name,
      ).toHaveLength(defenders)
    }
  })

  it('every position is inside the pitch and no two players share a spot', () => {
    for (const [name, slots] of Object.entries(MODULES)) {
      const seen = new Set<string>()
      for (const s of slots) {
        expect(s.x).toBeGreaterThan(0)
        expect(s.x).toBeLessThan(1)
        expect(s.y).toBeGreaterThan(0)
        expect(s.y).toBeLessThan(1)
        const key = `${s.x}/${s.y}`
        expect(seen.has(key), `${name} ${key}`).toBe(false)
        seen.add(key)
      }
    }
  })

  it('only the 11 modules of the chart are available, in chart order', () => {
    expect(MODULE_NAMES).toEqual([
      '3-4-3',
      '3-4-1-2',
      '3-4-2-1',
      '3-5-2',
      '3-5-1-1',
      '4-3-3',
      '4-3-1-2',
      '4-4-2',
      '4-1-4-1',
      '4-4-1-1',
      '4-2-3-1',
    ])
    for (const ok of MODULE_NAMES) expect(isChartModule(ok)).toBe(true)
    // modules that are not in the chart are not usable, however sensible they look
    for (const bad of [
      '5-3-2',
      '5-4-1',
      '3-3-3',
      'x-y',
      '',
      'toString',
      '__proto__',
      null,
      undefined,
    ]) {
      expect(isChartModule(bad)).toBe(false)
      expect(moduleSlots(bad)).toBeNull()
    }
    expect(moduleSlots('4-3-3')).toBe(MODULES['4-3-3'])
  })
})

describe('assigning players to positions', () => {
  it('fits by role, preferring the main role', () => {
    const dcSlot = MODULES['3-4-3'][1] // DC
    expect(fit(p('Dc/Dd'), dcSlot)).toBeGreaterThan(fit(p('Dd/Dc'), dcSlot))
    expect(fit(p('Dd/Dc'), dcSlot)).toBeGreaterThan(fit(p('A'), dcSlot))
    expect(fit(null, dcSlot)).toBe(0)
  })

  it('puts every player on a different position of the module', () => {
    const lineup = [
      p('Por'),
      p('Dc'),
      p('Dc'),
      p('Dd/Dc'),
      p('E/W'),
      p('M/C'),
      p('C/T'),
      p('E'),
      p('T/A'),
      p('Pc'),
      p('A/Pc'),
    ]
    const where = assignPlayers(lineup, MODULES['3-4-2-1'])
    expect(where.every((w) => w !== null)).toBe(true)
    expect(new Set(where).size).toBe(11)
    expect(where[0]).toBe(0) // the goalkeeper takes the goalkeeper position
  })

  it('places players in the position that fits their role, whatever the order of the list', () => {
    const slots = MODULES['4-3-3']
    const lineup = [
      p('Pc'),
      p('Dc'),
      p('Dd'),
      p('Ds'),
      p('Por'),
      p('Dc'),
      p('C'),
      p('M'),
      p('M/C'),
      p('W/A'),
      p('W/A'),
    ]
    const where = assignPlayers(lineup, slots)
    expect(slots[where[4]!].roles).toContain('Por') // GK listed fifth still goes in goal
    expect(slots[where[0]!].roles).toContain('Pc') // striker listed first goes up front
    expect(slots[where[2]!].roles).toEqual(['Dd']) // right-back on the right-back spot
    expect(slots[where[3]!].roles).toEqual(['Ds'])
  })

  it('a player out of role still gets the nearest position (same line first)', () => {
    const lineup = [
      p('Por'),
      p('Dc'),
      p('Dc'),
      p('Dc'),
      p('M'),
      p('M'),
      p('M'),
      p('M'),
      p('A'),
      p('A'),
      p('C'),
    ]
    const where = assignPlayers(lineup, MODULES['3-4-3'])
    expect(new Set(where).size).toBe(11)
    // the only attackers available go to forward positions of a 3-4-3
    const forward = MODULES['3-4-3'].map((s, i) => (s.y > 0.7 ? i : -1)).filter((i) => i >= 0)
    expect(forward).toContain(where[8])
    expect(forward).toContain(where[9])
  })

  it('holes leave their position empty', () => {
    const where = assignPlayers([p('Por'), null, p('Dc')], MODULES['3-4-3'])
    expect(where[1]).toBeNull()
    expect(where[0]).not.toBeNull()
    expect(where[2]).not.toBeNull()
  })
})

describe('pitch coordinates', () => {
  const dd = MODULES['4-3-3'][1] // DD (right-back)
  const ds = MODULES['4-3-3'][4] // DS (left-back)

  it('the home team uses the left half, attacking right; its left-back is at the top', () => {
    const gk = toPitch(MODULES['4-3-3'][0], 'home')
    const st = toPitch(MODULES['4-3-3'][9], 'home')
    expect(gk.x).toBeLessThan(0.1)
    expect(st.x).toBeLessThan(0.5)
    expect(st.x).toBeGreaterThan(gk.x)
    expect(toPitch(ds, 'home').y).toBeLessThan(0.5) // left-back, facing right = top
    expect(toPitch(dd, 'home').y).toBeGreaterThan(0.5) // right-back = bottom
  })

  it('the away team uses the right half, attacking left; its left-back is at the bottom', () => {
    const gk = toPitch(MODULES['4-3-3'][0], 'away')
    const st = toPitch(MODULES['4-3-3'][9], 'away')
    expect(gk.x).toBeGreaterThan(0.9)
    expect(st.x).toBeGreaterThan(0.5)
    expect(st.x).toBeLessThan(gk.x)
    expect(toPitch(ds, 'away').y).toBeGreaterThan(0.5)
    expect(toPitch(dd, 'away').y).toBeLessThan(0.5)
  })

  it('portrait (phones): home on the top half, away on the bottom half', () => {
    const gkH = toPitch(MODULES['4-3-3'][0], 'home', 'portrait')
    const stH = toPitch(MODULES['4-3-3'][9], 'home', 'portrait')
    expect(gkH.y).toBeLessThan(0.1)
    expect(stH.y).toBeLessThan(0.5)
    expect(stH.y).toBeGreaterThan(gkH.y)
    const gkA = toPitch(MODULES['4-3-3'][0], 'away', 'portrait')
    const stA = toPitch(MODULES['4-3-3'][9], 'away', 'portrait')
    expect(gkA.y).toBeGreaterThan(0.9)
    expect(stA.y).toBeGreaterThan(0.5)
    expect(stA.y).toBeLessThan(gkA.y)
  })

  it('portrait keeps left and right correct: facing down, the right-back is on the left of the screen', () => {
    // home faces south: its right-back (DD) is on the screen's left, its left-back (DS) on the right
    expect(toPitch(dd, 'home', 'portrait').x).toBeLessThan(0.5)
    expect(toPitch(ds, 'home', 'portrait').x).toBeGreaterThan(0.5)
    // away faces north: the opposite
    expect(toPitch(dd, 'away', 'portrait').x).toBeGreaterThan(0.5)
    expect(toPitch(ds, 'away', 'portrait').x).toBeLessThan(0.5)
  })

  it('no player of a team crosses the halfway line', () => {
    for (const slots of Object.values(MODULES)) {
      for (const s of slots) {
        expect(toPitch(s, 'home').x).toBeLessThan(0.5)
        expect(toPitch(s, 'away').x).toBeGreaterThan(0.5)
      }
    }
  })

  it('placeTeam returns one point per player and null for an unusable module', () => {
    const lineup = [
      p('Por'),
      p('Dc'),
      p('Dc'),
      p('Dc/B'),
      p('E'),
      p('M/C'),
      p('C'),
      p('E'),
      p('W/A'),
      p('A/Pc'),
      p('W/A'),
    ]
    const placed = placeTeam('3-4-3', lineup, 'home')!
    expect(placed).toHaveLength(11)
    expect(placed.every((x) => x.matchedRole !== null)).toBe(true)
    expect(placeTeam('nonsense', lineup, 'home')).toBeNull()
    expect(placeTeam(null, lineup, 'home')).toBeNull()
  })
})

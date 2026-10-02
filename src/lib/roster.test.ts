import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { LeagueLegend, MantraRoles, TeamName } from '../components/ui'
import { LEAGUE_COLOR, MANTRA_ORDER, mantraColor, mantraLabel } from './labels'
import { groupRoster, mantraRank } from './roster'
import type { Player, Role } from './types'

const p = (name: string, role: Role, mantra_roles: string): { player: Player } => ({
  player: { id: name.length, name, role, mantra_roles, serie_a_team: 'X' },
})

describe('role legend', () => {
  it('follows the order of the legend image', () => {
    expect(MANTRA_ORDER).toEqual(['Por', 'Ds', 'Dc', 'Dd', 'B', 'E', 'M', 'C', 'W', 'T', 'A', 'Pc'])
    expect(MANTRA_ORDER.map(mantraLabel)).toEqual([
      'P',
      'DS',
      'DC',
      'DD',
      'B',
      'E',
      'M',
      'C',
      'W',
      'T',
      'A',
      'PC',
    ])
  })

  it('uses one colour per family, as in the legend', () => {
    const same = (roles: string[]) => new Set(roles.map(mantraColor)).size === 1
    expect(same(['Ds', 'Dc', 'Dd', 'B'])).toBe(true)
    expect(same(['E', 'M', 'C'])).toBe(true)
    expect(same(['W', 'T'])).toBe(true)
    expect(same(['A', 'Pc'])).toBe(true)
    const families = ['Por', 'Dc', 'M', 'W', 'A'].map(mantraColor)
    expect(new Set(families).size).toBe(5)
  })

  it('renders chips with the legend colour and short label', () => {
    const html = renderToStaticMarkup(createElement(MantraRoles, { roles: 'Dd;Dc' }))
    expect(html).toContain('>DD<')
    expect(html).toContain('>DC<')
    expect(html).toContain('background-color:#4A9B13')
    expect(renderToStaticMarkup(createElement(MantraRoles, { roles: 'Por' }))).toContain('>P<')
  })
})

describe('groupRoster', () => {
  const items = [
    p('Zeta', 'A', 'Pc'),
    p('Alfa', 'C', 'C;T'),
    p('Beta', 'D', 'Dd;Dc'),
    p('Carlo', 'D', 'Ds;E'),
    p('Dani', 'D', 'Dc'),
    p('Portiere B', 'P', 'Por'),
    p('Portiere A', 'P', 'Por'),
    p('Esterno', 'C', 'E;W'),
    p('Ala', 'A', 'W;A'),
    p('Rifinitore', 'A', 'T;A'),
    p('Punta', 'A', 'A'),
    p('Braccetto', 'D', 'B;Dc'),
    p('Mediano', 'C', 'M;C'),
  ]

  it('has goalkeepers and "Giocatori di movimento" only', () => {
    const groups = groupRoster(items)
    expect(groups.map((g) => g.title)).toEqual(['Portieri', 'Giocatori di movimento'])
    expect(groups[0].items.map((i) => i.player.name)).toEqual(['Portiere A', 'Portiere B'])
    expect(groups[1].items).toHaveLength(items.length - 2)
  })

  it('orders field players by main role as in the legend, then by name', () => {
    const names = groupRoster(items)[1].items.map((i) => i.player.name)
    // DS, DC, DD, B, E, M, C, W, T, A, PC
    expect(names).toEqual([
      'Carlo', // Ds
      'Dani', // Dc
      'Beta', // Dd
      'Braccetto', // B
      'Esterno', // E
      'Mediano', // M
      'Alfa', // C
      'Ala', // W
      'Rifinitore', // T
      'Punta', // A
      'Zeta', // Pc
    ])
  })

  it('puts players without Mantra roles last and does not fail', () => {
    expect(mantraRank({ mantra_roles: '' })).toBe(MANTRA_ORDER.length)
    const groups = groupRoster([p('Senza', 'D', ''), p('Con', 'D', 'Dc')])
    expect(groups[1].items.map((i) => i.player.name)).toEqual(['Con', 'Senza'])
  })
})

describe('league colours', () => {
  it('team names and the legend use exactly the same colour for each league', () => {
    for (const league of ['A', 'B', 'C'] as const) {
      const color = LEAGUE_COLOR[league]
      const name = renderToStaticMarkup(createElement(TeamName, { team: { name: 'X', league } }))
      expect(name).toContain(`color:${color}`)
      const legend = renderToStaticMarkup(createElement(LeagueLegend))
      // dot (background) and label (text) of this league both use the same colour
      expect(legend).toContain(`background-color:${color}`)
      expect(legend).toContain(`color:${color}`)
    }
  })

  it('the three leagues have three different colours', () => {
    expect(new Set(Object.values(LEAGUE_COLOR)).size).toBe(3)
  })
})

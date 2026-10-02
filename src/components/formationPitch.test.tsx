import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { LineupRow, Player, Team } from '../lib/types'
import FormationPitch, { pitchProblem, shortName, type TeamFormation } from './FormationPitch'

const home: Team = { id: 1, name: 'Casa FC', slug: 'casa', league: 'A' }
const away: Team = { id: 2, name: 'Ospiti FC', slug: 'ospiti', league: 'B' }

// A 4-3-3 lineup: goalkeeper, DD, DC, DC, DS, M/C, M, C, W/A, A/PC, W/A
const SQUAD: Array<[string, string]> = [
  ['Portiere', 'Por'],
  ['Terzino Destro', 'Dd'],
  ['Centrale Uno', 'Dc'],
  ['Centrale Due', 'Dc'],
  ['Terzino Sinistro', 'Ds'],
  ['Mezzala', 'M;C'],
  ['Regista', 'M'],
  ['Interno', 'C'],
  ['Ala Destra', 'W;A'],
  ['Punta', 'Pc'],
  ['Ala Sinistra', 'W;A'],
]

const playersFor = (prefix: string): Player[] =>
  SQUAD.map(([name, roles], i) => ({
    id: (prefix === 'h' ? 100 : 200) + i,
    name: `${prefix}${name}`,
    role: 'C',
    mantra_roles: roles,
    serie_a_team: 'X',
  }))

const rowsFor = (
  team: Team,
  players: Player[],
  module: string | null,
  scored = false,
): LineupRow[] =>
  players.map((p, i) => ({
    matchday: 1,
    team_id: team.id,
    slot: i + 1,
    player_id: p.id,
    player_name: p.name,
    out_of_position: false,
    module,
    vote: scored ? 6.5 : null,
    fantavoto: scored ? (i === 9 ? 9.5 : 6.5) : null,
    counted: scored ? true : null,
    stats: scored && i === 9 ? { gf: 1 } : null,
  }))

const hp = playersFor('h')
const ap = playersFor('a')
const byId = new Map([...hp, ...ap].map((p) => [p.id, p]))

const render = (h: TeamFormation, a: TeamFormation) =>
  renderToStaticMarkup(<FormationPitch home={h} away={a} playerById={byId} />)

/** left% of the token containing `name` */
const leftOf = (html: string, name: string) => {
  const at = html.indexOf(`>${name}<`)
  const start = html.lastIndexOf('left:', at)
  return Number(/left:([\d.]+)%/.exec(html.slice(start))![1])
}

describe('pitchProblem', () => {
  const f = (rows: LineupRow[]): TeamFormation => ({ team: home, rows })
  it('explains why a team cannot be drawn', () => {
    expect(pitchProblem(f([]))).toBe('Formazione non ancora inserita')
    expect(pitchProblem(f(rowsFor(home, hp, null)))).toBe('Modulo non indicato')
    expect(pitchProblem(f(rowsFor(home, hp, '5-3-2')))).toBe('Modulo 5-3-2 non previsto')
    expect(pitchProblem(f(rowsFor(home, hp, '4-3-3')))).toBeNull()
  })
})

describe('shortName', () => {
  it('drops the trailing initial', () => {
    expect(shortName('Milinkovic-Savic V.')).toBe('Milinkovic-Savic')
    expect(shortName('Martinez Jo.')).toBe('Martinez')
    expect(shortName('Dimarco')).toBe('Dimarco')
  })
})

describe('FormationPitch', () => {
  const html = render(
    { team: home, rows: rowsFor(home, hp, '4-3-3', true), points: 71.5 },
    { team: away, rows: rowsFor(away, ap, '4-3-3', true), points: 68 },
  )

  it('draws all 22 players, the module tags and the totals', () => {
    for (const p of [...hp, ...ap]) expect(html).toContain(`>${p.name}<`)
    expect(html).toContain('Casa FC')
    expect(html).toContain('Ospiti FC')
    expect(html).toContain('4-3-3')
    expect(html).toContain('Totale 71,5')
    expect(html).toContain('Totale 68')
  })

  it('home stands on the left half, away on the right half, goalkeepers at the ends', () => {
    expect(leftOf(html, 'hPortiere')).toBeLessThan(10)
    expect(leftOf(html, 'aPortiere')).toBeGreaterThan(90)
    for (const p of hp) expect(leftOf(html, p.name)).toBeLessThan(50)
    for (const p of ap) expect(leftOf(html, p.name)).toBeGreaterThan(50)
  })

  it('shows role chips in the legend colours and the fantavoto with bonus icons', () => {
    expect(html).toContain('background-color:#EBA216') // goalkeeper orange
    expect(html).toContain('background-color:#4A9B13') // defenders green
    expect(html).toContain('9,5') // the scorer's fantavoto
    expect(html).toContain('⚽')
  })

  it('before the matchday is calculated it shows names and roles only', () => {
    const early = render(
      { team: home, rows: rowsFor(home, hp, '4-3-3') },
      { team: away, rows: rowsFor(away, ap, '4-3-3') },
    )
    expect(early).toContain('>hPortiere<')
    expect(early).not.toContain('Totale')
    expect(early).not.toContain('9,5')
  })

  it('a team that cannot be drawn gets a message, the other is still drawn', () => {
    const partial = render(
      { team: home, rows: rowsFor(home, hp, '4-3-3') },
      { team: away, rows: rowsFor(away, ap, null) },
    )
    expect(partial).toContain('>hPortiere<')
    expect(partial).not.toContain('>aPortiere<')
    expect(partial).toContain('Modulo non indicato')
  })

  it('a player out of position gets a dashed outline', () => {
    const rows = rowsFor(home, hp, '4-3-3')
    rows[10] = { ...rows[10] } // Ala Sinistra
    const swapped = { ...byId.get(rows[0].player_id!)!, mantra_roles: 'A' } // a striker in goal
    const html2 = renderToStaticMarkup(
      <FormationPitch
        home={{ team: home, rows }}
        away={{ team: away, rows: rowsFor(away, ap, '4-3-3') }}
        playerById={new Map([...byId, [swapped.id, swapped]])}
      />,
    )
    expect(html2).toContain('border-dashed')
  })
})

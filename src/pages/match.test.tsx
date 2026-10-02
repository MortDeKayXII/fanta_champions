import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '../lib/auth'
import type { LineupRow, Player, Team } from '../lib/types'
import { LineupTable, TeamTitle } from './Match'

const wrap = (node: React.ReactNode) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <MemoryRouter>{node}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )

const team: Team = { id: 1, name: 'Fc Palo', slug: 'fcpalo', league: 'A' }
const player = (id: number, name: string, mantra_roles: string): Player => ({
  id,
  name,
  role: 'D',
  mantra_roles,
  serie_a_team: 'X',
})
const row = (slot: number, p: Player | null): LineupRow => ({
  matchday: 1,
  team_id: 1,
  slot,
  player_id: p?.id ?? null,
  player_name: p?.name ?? null,
  out_of_position: false,
  vote: 6.5,
  fantavoto: 6.5,
  counted: true,
  stats: null,
})

describe('match page pieces', () => {
  it('shows the module in grey in parentheses next to the team name', () => {
    const html = wrap(<TeamTitle team={team} module="4-3-1-2" />)
    expect(html).toContain('Fc Palo')
    expect(html).toContain('(4-3-1-2)')
    expect(html).toContain('text-slate-500')
  })

  it('shows nothing extra when the module is unknown', () => {
    const html = wrap(<TeamTitle team={team} module={null} />)
    expect(html).toContain('Fc Palo')
    expect(html).not.toContain('(')
  })

  it('lists the Mantra roles of every player, as chips like on the rosters page', () => {
    const a = player(1, 'Celik', 'B;Dd;E')
    const b = player(2, 'Rowe', 'W;T')
    const html = wrap(
      <LineupTable
        rows={[row(1, a), row(2, b), row(3, null)]}
        playerById={new Map([a, b].map((p) => [p.id, p]))}
      />,
    )
    for (const label of ['>B<', '>DD<', '>E<', '>W<', '>T<']) expect(html).toContain(label)
    expect(html).toContain('background-color:#4A9B13') // defenders green
    expect(html).toContain('background-color:#D01CC0') // W / T magenta
    expect(html).toContain('Celik')
  })
})

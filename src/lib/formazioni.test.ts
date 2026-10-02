import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import {
  buildLineup,
  hasVotes,
  importRows,
  parseFormazioni,
  playersByName,
  type FileTeam,
} from './formazioni'
import type { Player } from './types'
import { isGreyColor, readGrid } from './xlsxCells'

// ---- a miniature xlsx with the same structure as the league export -------------------------

type Spec = { role: string; name: string; v: number | 'SV'; grey?: boolean }
const starter = (role: string, name: string, v: number | 'SV' = 6, grey = false): Spec => ({
  role,
  name,
  v,
  grey,
})

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/** One team block in columns `c`.. (0-based) starting at row `r0`; returns cell XML per row. */
function teamBlock(
  rows: Map<number, string[]>,
  r0: number,
  c: number,
  name: string,
  starters: Spec[],
  bench: Spec[],
  total: number,
) {
  const col = (i: number) => String.fromCharCode(65 + i)
  const put = (r: number, i: number, xml: (ref: string) => string) => {
    const list = rows.get(r) ?? []
    list.push(xml(`${col(i)}${r + 1}`))
    rows.set(r, list)
  }
  const text = (r: number, i: number, t: string, style = 0) =>
    put(r, i, (ref) => `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${escape(t)}</t></is></c>`)
  const num = (r: number, i: number, n: number, style = 0) =>
    put(r, i, (ref) => `<c r="${ref}" s="${style}"><v>${n}</v></c>`)

  text(r0, c, name)
  text(r0 + 1, c, name)
  text(r0 + 2, c, 'Modulo')
  text(r0 + 2, c + 1, '3-4-3')
  text(r0 + 2, c + 4, 'Totale')
  num(r0 + 2, c + 5, total)
  text(r0 + 4, c, 'Ruolo')
  text(r0 + 4, c + 1, 'Calciatore')
  let r = r0 + 5
  const player = (p: Spec) => {
    text(r, c, p.role)
    text(r, c + 1, p.name, p.grey ? 1 : 0) // style 1 = grey font
    if (p.v === 'SV') text(r, c + 4, 'SV', p.grey ? 1 : 0)
    else num(r, c + 4, p.v, p.grey ? 1 : 0)
    r++
  }
  starters.forEach(player)
  text(r++, c, 'Panchina')
  bench.forEach(player)
  text(r, c, 'Modificatori')
}

function makeXlsx(
  blocks: Array<{ name: string; starters: Spec[]; bench: Spec[]; total?: number }>,
) {
  const rows = new Map<number, string[]>()
  blocks.forEach((b, i) => teamBlock(rows, 4, i * 17, b.name, b.starters, b.bench, b.total ?? 0))
  const sheetRows = [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([r, cells]) => `<row r="${r + 1}">${cells.join('')}</row>`)
    .join('')
  const sheet = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`
  const styles = `<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><color rgb="1F2937"/></font><font><sz val="10"/><color rgb="A0A7B1"/></font></fonts><cellXfs count="2"><xf fontId="0" fillId="0"/><xf fontId="1" fillId="0"/></cellXfs></styleSheet>`
  return zipSync({
    'xl/worksheets/sheet1.xml': strToU8(sheet),
    'xl/styles.xml': strToU8(styles),
  })
}

// ---- data ---------------------------------------------------------------------------------

const names = [
  ['P1', 'Por', 'Portiere Uno'],
  ['D1', 'Dc', 'Difensore Uno'],
  ['D2', 'Dc', 'Difensore Due'],
  ['D3', 'Dd;Dc', 'Difensore Tre'],
  ['C1', 'C', 'Centro Uno'],
  ['C2', 'M;C', 'Centro Due'],
  ['C3', 'C;T', 'Centro Tre'],
  ['C4', 'E;W', 'Centro Quattro'],
  ['A1', 'Pc', 'Attacco Uno'],
  ['A2', 'Pc', 'Attacco Due'],
  ['A3', 'A', 'Attacco Tre'],
  // bench
  ['B1', 'Pc', 'Panchina Attacco Uno'],
  ['B2', 'Pc', 'Panchina Attacco Due'],
  ['B3', 'Dc', 'Panchina Difesa Uno'],
  ['B4', 'C', 'Panchina Centro Uno'],
  ['B5', 'Por', 'Panchina Portiere'],
] as const
const players: Player[] = names.map(([, roles, name], i) => ({
  id: 100 + i,
  name,
  role: 'C',
  mantra_roles: roles,
  serie_a_team: 'X',
}))
const byName = playersByName(players)

const XI = (greyed: string[] = []): Spec[] =>
  names.slice(0, 11).map(([, roles, name]) => {
    const grey = greyed.includes(name)
    return starter(roles.replace(/;/g, '/'), name, grey ? 'SV' : 6.5, grey)
  })
const bench = (entering: string[]): Spec[] =>
  names.slice(11).map(([, roles, name]) => {
    const grey = !entering.includes(name)
    return starter(roles.replace(/;/g, '/'), name, grey ? 5.5 : 7, grey)
  })

// ---- tests --------------------------------------------------------------------------------

describe('readGrid', () => {
  it('reads inline strings, numbers and the grey font of cells', () => {
    const grid = readGrid(
      makeXlsx([{ name: 'Squadra A', starters: XI(['Centro Due']), bench: bench([]) }]),
    )
    expect(grid[4][0].v).toBe('Squadra A')
    expect(grid[8][0].v).toBe('Ruolo')
    // first starter: dark, Centro Due (6th) is grey
    expect(grid[9][1]).toEqual({ v: 'Portiere Uno', grey: false })
    expect(grid[14][1].grey).toBe(true)
    expect(grid[9][4].v).toBe(6.5)
  })

  it('tells grey from dark and coloured fonts', () => {
    expect(isGreyColor('A0A7B1')).toBe(true)
    expect(isGreyColor('FFC4C9D0')).toBe(true)
    expect(isGreyColor('1F2937')).toBe(false)
    expect(isGreyColor('0B5CD5')).toBe(false)
    expect(isGreyColor('B91C1C')).toBe(false)
    expect(isGreyColor(undefined)).toBe(false)
  })
})

describe('parseFormazioni', () => {
  it('finds both teams of a match block, side by side', () => {
    const teams = parseFormazioni(
      readGrid(
        makeXlsx([
          { name: 'Squadra A', starters: XI(), bench: bench([]), total: 70 },
          { name: 'Squadra B', starters: XI(), bench: bench([]), total: 65.5 },
        ]),
      ),
    )
    expect(teams.map((t) => t.teamName)).toEqual(['Squadra A', 'Squadra B'])
    expect(teams[0]).toMatchObject({ module: '3-4-3', fileTotal: 70 })
    expect(teams[1].fileTotal).toBe(65.5)
    expect(teams[0].starters).toHaveLength(11)
    expect(teams[0].bench).toHaveLength(5)
    expect(teams[0].starters[0]).toMatchObject({
      name: 'Portiere Uno',
      roles: ['Por'],
      vote: 6.5,
      grey: false,
    })
    expect(hasVotes(teams)).toBe(true)
  })

  it('strips captain and switch markers from names', () => {
    const marked = XI()
    marked[1] = { ...marked[1], name: 'Difensore Uno ⇄✗' }
    marked[2] = { ...marked[2], name: 'Ⓒ Difensore Due' }
    const [team] = parseFormazioni(
      readGrid(makeXlsx([{ name: 'A', starters: marked, bench: bench([]) }])),
    )
    expect(team.starters[1].name).toBe('Difensore Uno')
    expect(team.starters[2].name).toBe('Difensore Due')
  })
})

function team(greyed: string[], entering: string[]): FileTeam {
  return parseFormazioni(
    readGrid(makeXlsx([{ name: 'T', starters: XI(greyed), bench: bench(entering) }])),
  )[0]
}

describe('buildLineup', () => {
  it('initial mode: the 11 starters, no substitutions, even if the file is a final one', () => {
    const b = buildLineup(team(['Centro Due'], ['Panchina Centro Uno']), byName, {
      mode: 'initial',
      maxSubs: 3,
    })
    expect(b.slots.map((s) => s.player?.name)).toEqual(names.slice(0, 11).map((n) => n[2]))
    expect(b.substitutions).toEqual([])
    expect(b.warnings).toEqual([])
  })

  it('final mode: the substitute takes the place of the uncounted starter', () => {
    const b = buildLineup(team(['Centro Due'], ['Panchina Centro Uno']), byName, {
      mode: 'final',
      maxSubs: 3,
    })
    expect(b.substitutions).toEqual([{ out: 'Centro Due', in: 'Panchina Centro Uno' }])
    expect(b.slots[5].player?.name).toBe('Panchina Centro Uno')
    expect(b.slots).toHaveLength(11)
  })

  it('pairs each substitute with a starter of a compatible role', () => {
    const b = buildLineup(
      team(['Attacco Uno', 'Difensore Due'], ['Panchina Difesa Uno', 'Panchina Attacco Uno']),
      byName,
      { mode: 'final', maxSubs: 3 },
    )
    // bench order is Attacco Uno, Attacco Due, Difesa Uno...: attacker for the attacker, defender for the defender
    expect(b.substitutions).toEqual(
      expect.arrayContaining([
        { out: 'Attacco Uno', in: 'Panchina Attacco Uno' },
        { out: 'Difensore Due', in: 'Panchina Difesa Uno' },
      ]),
    )
  })

  it('keeps only the first 3 substitutions (bench order) when the original league allowed 5', () => {
    const greyed = ['Difensore Uno', 'Centro Due', 'Centro Tre', 'Attacco Uno', 'Attacco Tre']
    const entering = [
      'Panchina Attacco Uno',
      'Panchina Attacco Due',
      'Panchina Difesa Uno',
      'Panchina Centro Uno',
      'Panchina Portiere',
    ]
    const t = team(greyed, entering)
    const all = buildLineup(t, byName, { mode: 'final', maxSubs: 5 })
    expect(all.substitutions).toHaveLength(5)
    expect(all.ignored).toEqual([])

    const capped = buildLineup(t, byName, { mode: 'final', maxSubs: 3 })
    expect(capped.substitutions.map((s) => s.in)).toEqual([
      'Panchina Attacco Uno',
      'Panchina Attacco Due',
      'Panchina Difesa Uno',
    ])
    expect(capped.ignored).toEqual(['Panchina Centro Uno', 'Panchina Portiere'])
    // the two starters that lost their replacement stay in the eleven
    const inXI = capped.slots.map((s) => s.player?.name)
    expect(inXI).toHaveLength(11)
    expect(inXI).not.toContain('Panchina Centro Uno')
    expect(inXI.filter((n) => greyed.includes(n!))).toHaveLength(2)
  })

  it('maxSubs 0 behaves like the initial lineup', () => {
    const b = buildLineup(team(['Centro Due'], ['Panchina Centro Uno']), byName, {
      mode: 'final',
      maxSubs: 0,
    })
    expect(b.slots.map((s) => s.player?.name)).toEqual(names.slice(0, 11).map((n) => n[2]))
    expect(b.ignored).toEqual(['Panchina Centro Uno'])
  })

  it('reports players that are not in the player list and leaves the slot empty', () => {
    const t = team([], [])
    t.starters[3] = { ...t.starters[3], name: 'Giocatore Sconosciuto' }
    const b = buildLineup(t, byName, { mode: 'initial', maxSubs: 3 })
    expect(b.slots[3].player).toBeNull()
    expect(b.warnings[0]).toContain('Giocatore Sconosciuto')
  })
})

describe('importRows', () => {
  const built = () => buildLineup(team([], []), byName, { mode: 'initial', maxSubs: 3 })

  it('always produces the 11 slots with cleared scores', () => {
    const rows = importRows(4, 7, built(), [])
    expect(rows).toHaveLength(11)
    expect(rows.map((r) => r.slot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(rows[0]).toMatchObject({
      matchday: 4,
      team_id: 7,
      player_name: 'Portiere Uno',
      out_of_position: false,
      vote: null,
      fantavoto: null,
      counted: null,
      stats: null,
    })
  })

  it('keeps a previously set out-of-position flag for a player who is still in the lineup', () => {
    const b = built()
    const kept = b.slots[3].player!.id
    const gone = 999
    const rows = importRows(4, 7, b, [
      { team_id: 7, player_id: kept, out_of_position: true },
      { team_id: 7, player_id: gone, out_of_position: true },
      { team_id: 8, player_id: b.slots[0].player!.id, out_of_position: true }, // other team
    ])
    expect(rows.filter((r) => r.out_of_position).map((r) => r.player_id)).toEqual([kept])
  })

  it('leaves an empty slot for an unknown player', () => {
    const t = team([], [])
    t.starters[2] = { ...t.starters[2], name: 'Nessuno' }
    const rows = importRows(1, 1, buildLineup(t, byName, { mode: 'initial', maxSubs: 3 }), [])
    expect(rows[2]).toMatchObject({ player_id: null, player_name: null, out_of_position: false })
  })
})

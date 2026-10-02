import type { CSSProperties, ReactNode } from 'react'
import { FINAL_ID, LEFT_HALF, RIGHT_HALF, type HalfLayout } from '../lib/bracketLayout'
import { pendingShort, type TieView } from '../lib/knockout'
import type { Team } from '../lib/types'
import { TeamLink } from './ui'

/**
 * The knockout stage drawn as a tree, like a cup bracket: playoff on the outer edges, then round
 * of 16, quarter-finals, semi-finals, and the final in the middle. Lines follow each winner's path.
 *
 * Grid: 17 columns (9 for matches, 8 narrow ones for connectors) x 8 rows. A round-of-16 tie
 * takes 2 rows, a quarter-final 4, a semi-final 8, so each tie is centred between its feeders.
 */

const LINE = '#bfdbfe' // blue-200: path not played yet
const LINE_DONE = '#2563eb' // blue-600: path of a decided tie

const HEADER_ROW = 1
const ROWS = 8

// Columns, left to right: matches (m) and connectors (c)
const COL = {
  playoffL: 1,
  c1: 2,
  r16L: 3,
  c2: 4,
  quarterL: 5,
  c3: 6,
  semiL: 7,
  c4: 8,
  final: 9,
  c5: 10,
  semiR: 11,
  c6: 12,
  quarterR: 13,
  c7: 14,
  r16R: 15,
  c8: 16,
  playoffR: 17,
} as const

const MATCH_W = 'minmax(136px, 1fr)'
const CONNECTOR_W = '22px'
const TEMPLATE = [
  MATCH_W,
  CONNECTOR_W,
  MATCH_W,
  CONNECTOR_W,
  MATCH_W,
  CONNECTOR_W,
  MATCH_W,
  CONNECTOR_W,
  'minmax(170px, 1.2fr)',
  CONNECTOR_W,
  MATCH_W,
  CONNECTOR_W,
  MATCH_W,
  CONNECTOR_W,
  MATCH_W,
  CONNECTOR_W,
  MATCH_W,
].join(' ')

const place = (col: number, firstRow: number, span: number): CSSProperties => ({
  gridColumn: col,
  gridRow: `${HEADER_ROW + 1 + firstRow} / span ${span}`,
})

function Box({
  tie,
  teamById,
  final = false,
}: {
  tie: TieView | undefined
  teamById: Map<number, Team>
  final?: boolean
}) {
  if (!tie) return null
  const decided = tie.winner !== null
  const multi = tie.legs.length > 1

  const line = (side: 'a' | 'b') => {
    const id = side === 'a' ? tie.a : tie.b
    const from = side === 'a' ? tie.aFrom : tie.bFrom
    const team = id === null ? undefined : teamById.get(id)
    const won = decided && tie.winner === id
    const lost = decided && !won
    const agg = side === 'a' ? tie.aggregate.goalsA : tie.aggregate.goalsB
    return (
      <div className={`flex items-center justify-between gap-1 ${lost ? 'opacity-45' : ''}`}>
        <span className="line-clamp-2 min-w-0 break-words leading-tight" title={team?.name}>
          {team ? (
            <TeamLink team={team} bold={won} />
          ) : (
            <span className="italic text-slate-400">{pendingShort(from)}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1 tabular-nums">
          {multi &&
            tie.legs.map((l) => (
              <span key={l.fixtureId} className="w-3 text-center text-[10px] text-slate-400">
                {l.played ? (side === 'a' ? l.goalsA : l.goalsB) : '·'}
              </span>
            ))}
          {tie.legs.some((l) => l.played) && (
            <strong className={`w-4 text-center ${won ? 'text-green-700' : 'text-blue-900'}`}>
              {agg}
            </strong>
          )}
        </span>
      </div>
    )
  }

  return (
    <div
      className={`w-full rounded-lg bg-white px-2 py-1 text-xs shadow-sm ring-1 ${
        final ? 'py-2 ring-2 ring-blue-500' : decided ? 'ring-blue-300' : 'ring-blue-100'
      }`}
    >
      {final && (
        <div className="mb-1 text-center text-[10px] font-bold uppercase tracking-wide text-blue-700">
          🏆 Finale
        </div>
      )}
      {line('a')}
      <div className="my-0.5 border-t border-blue-50" />
      {line('b')}
      {tie.outcome.decidedBy === 'undecided' && (
        <div className="mt-0.5 text-center text-[10px] text-amber-700">
          parità: decide l&apos;admin
        </div>
      )}
    </div>
  )
}

/** Two feeders -> one tie: a bracket shape "⊐" (mirrored on the right half). */
function Join({ done, mirror = false }: { done: boolean; mirror?: boolean }) {
  const color = done ? LINE_DONE : LINE
  const style: CSSProperties = {
    top: '25%',
    bottom: '25%',
    left: mirror ? '50%' : 0,
    right: mirror ? 0 : '50%',
    borderTop: `2px solid ${color}`,
    borderBottom: `2px solid ${color}`,
    ...(mirror ? { borderLeft: `2px solid ${color}` } : { borderRight: `2px solid ${color}` }),
  }
  return (
    <div className="relative h-full w-full" aria-hidden="true">
      <span className="absolute" style={style} />
      <span
        className="absolute"
        style={{
          top: '50%',
          left: mirror ? 0 : '50%',
          right: mirror ? '50%' : 0,
          borderTop: `2px solid ${color}`,
        }}
      />
    </div>
  )
}

/** One feeder -> one tie: a straight line at mid height. */
function Straight({ done }: { done: boolean }) {
  return (
    <div className="relative h-full w-full" aria-hidden="true">
      <span
        className="absolute inset-x-0"
        style={{ top: '50%', borderTop: `2px solid ${done ? LINE_DONE : LINE}` }}
      />
    </div>
  )
}

const HEADERS: Array<[number, string]> = [
  [COL.playoffL, 'Playoff'],
  [COL.r16L, 'Ottavi'],
  [COL.quarterL, 'Quarti'],
  [COL.semiL, 'Semifinale'],
  [COL.final, 'Finale'],
  [COL.semiR, 'Semifinale'],
  [COL.quarterR, 'Quarti'],
  [COL.r16R, 'Ottavi'],
  [COL.playoffR, 'Playoff'],
]

interface HalfColumns {
  po: number
  c1: number
  r16: number
  c2: number
  q: number
  c3: number
  sf: number
  c4: number
}

export default function BracketTree({
  ties,
  teamById,
}: {
  ties: TieView[]
  teamById: Map<number, Team>
}) {
  const byId = new Map(ties.map((t) => [t.id, t]))
  const get = (id: string) => byId.get(id)
  const decided = (id: string) => get(id)?.winner != null

  const cells: ReactNode[] = []
  const add = (key: string, style: CSSProperties, node: ReactNode, pad = true) =>
    cells.push(
      <div key={key} style={style} className={pad ? 'flex items-center px-0.5 py-1' : ''}>
        {node}
      </div>,
    )

  const drawHalf = (h: HalfLayout, c: HalfColumns, mirror: boolean) => {
    h.playoff.forEach((id, i) => {
      add(`po-${id}`, place(c.po, i * 2, 2), <Box tie={get(id)} teamById={teamById} />)
      add(`pl-${id}`, place(c.c1, i * 2, 2), <Straight done={decided(id)} />, false)
    })
    h.r16.forEach((id, i) => {
      add(`r16-${id}`, place(c.r16, i * 2, 2), <Box tie={get(id)} teamById={teamById} />)
    })
    h.quarter.forEach((id, i) => {
      add(`q-${id}`, place(c.q, i * 4, 4), <Box tie={get(id)} teamById={teamById} />)
      add(
        `qj-${id}`,
        place(c.c2, i * 4, 4),
        <Join mirror={mirror} done={decided(h.r16[2 * i]) && decided(h.r16[2 * i + 1])} />,
        false,
      )
    })
    add(`s-${h.semi}`, place(c.sf, 0, ROWS), <Box tie={get(h.semi)} teamById={teamById} />)
    add(
      `sj-${h.semi}`,
      place(c.c3, 0, ROWS),
      <Join mirror={mirror} done={decided(h.quarter[0]) && decided(h.quarter[1])} />,
      false,
    )
    add(`sl-${h.semi}`, place(c.c4, 0, ROWS), <Straight done={decided(h.semi)} />, false)
  }

  drawHalf(
    LEFT_HALF,
    {
      po: COL.playoffL,
      c1: COL.c1,
      r16: COL.r16L,
      c2: COL.c2,
      q: COL.quarterL,
      c3: COL.c3,
      sf: COL.semiL,
      c4: COL.c4,
    },
    false,
  )
  // The right half is the mirror image: its columns run from the final outwards.
  drawHalf(
    RIGHT_HALF,
    {
      po: COL.playoffR,
      c1: COL.c8,
      r16: COL.r16R,
      c2: COL.c7,
      q: COL.quarterR,
      c3: COL.c6,
      sf: COL.semiR,
      c4: COL.c5,
    },
    true,
  )
  add('final', place(COL.final, 0, ROWS), <Box tie={get(FINAL_ID)} teamById={teamById} final />)

  return (
    <div className="overflow-x-auto rounded-2xl bg-white/60 p-3 ring-1 ring-blue-100">
      <div
        role="group"
        aria-label="Tabellone a eliminazione diretta"
        className="grid min-w-[1500px]"
        style={{
          gridTemplateColumns: TEMPLATE,
          gridTemplateRows: `auto repeat(${ROWS}, minmax(46px, auto))`,
        }}
      >
        {HEADERS.map(([col, label]) => (
          <div
            key={col}
            style={{ gridColumn: col, gridRow: HEADER_ROW }}
            className="pb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-blue-800"
          >
            {label}
          </div>
        ))}
        {cells}
      </div>
    </div>
  )
}

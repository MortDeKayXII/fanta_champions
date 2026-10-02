import { useSyncExternalStore } from 'react'
import { placeTeam, type FieldPlayer, type Orientation, type Side } from '../lib/fieldLayout'
import { formatPoints, mantraColor, mantraLabel, splitMantraRoles } from '../lib/labels'
import { isChartModule } from '../lib/modules'
import { PITCH_STAT_ICONS } from '../lib/statIcons'
import type { LineupRow, Player, Team } from '../lib/types'

/**
 * The two lineups on one pitch, each team on its own half: home on the left attacking right (on
 * phones: home on top attacking down). Players stand where the module chart puts them, matched by
 * Mantra role. Shows the fantavoto and bonus icons once the matchday has been calculated.
 */

export interface TeamFormation {
  team: Team | undefined
  rows: LineupRow[]
  /** Total fantapoints of the match, when the match has been calculated. */
  points?: number
}

interface PitchPlayer extends FieldPlayer {
  row: LineupRow
}

const WIDE = '(min-width: 768px)'

/** true on screens wide enough for the landscape pitch. */
function useIsWide(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(WIDE)
      query.addEventListener('change', notify)
      return () => query.removeEventListener('change', notify)
    },
    () => window.matchMedia(WIDE).matches,
    () => true,
  )
}

/** "Milinkovic-Savic V." -> "Milinkovic-Savic": the initial only makes the name longer. */
export const shortName = (name: string): string =>
  name.replace(/ [A-Z]\.$/, '').replace(/ \S+\.$/, '')

/** Why a team cannot be drawn, if so. */
export function pitchProblem(f: TeamFormation): string | null {
  if (f.rows.length === 0) return 'Formazione non ancora inserita'
  const module = f.rows[0].module
  if (!module) return 'Modulo non indicato'
  if (!isChartModule(module)) return `Modulo ${module} non previsto`
  return null
}

function PitchLines({ orientation }: { orientation: Orientation }) {
  const line = { stroke: '#fff', strokeWidth: 3, fill: 'none', opacity: 0.92 } as const
  // Drawn as a landscape pitch (1050 x 680); the portrait one is the same drawing with x and y swapped.
  const body = (
    <>
      {Array.from({ length: 14 }, (_, i) => (
        <rect
          key={i}
          x={(i * 1050) / 14}
          y={0}
          width={1050 / 14}
          height={680}
          fill={i % 2 ? '#4fae36' : '#58ba3d'}
        />
      ))}
      <rect x={20} y={20} width={1010} height={640} {...line} />
      <line x1={525} y1={20} x2={525} y2={660} {...line} />
      <circle cx={525} cy={340} r={91} {...line} />
      <circle cx={525} cy={340} r={4} fill="#fff" />
      <rect x={20} y={138} width={165} height={404} {...line} />
      <rect x={20} y={248} width={55} height={184} {...line} />
      <rect x={865} y={138} width={165} height={404} {...line} />
      <rect x={975} y={248} width={55} height={184} {...line} />
      <circle cx={130} cy={340} r={3.5} fill="#fff" />
      <circle cx={920} cy={340} r={3.5} fill="#fff" />
      <path d="M185 282 A91 91 0 0 1 185 398" {...line} />
      <path d="M865 282 A91 91 0 0 0 865 398" {...line} />
      <rect x={12} y={300} width={8} height={80} fill="#fff" opacity={0.9} />
      <rect x={1030} y={300} width={8} height={80} fill="#fff" opacity={0.9} />
    </>
  )
  return orientation === 'landscape' ? (
    <svg
      viewBox="0 0 1050 680"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {body}
    </svg>
  ) : (
    <svg
      viewBox="0 0 680 1050"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <g transform="matrix(0 1 1 0 0 0)">{body}</g>
    </svg>
  )
}

function Token({
  player,
  matchedRole,
  point,
}: {
  player: PitchPlayer
  matchedRole: string | null
  point: { x: number; y: number }
}) {
  const { row } = player
  const role = matchedRole ?? player.roles[0] ?? '?'
  const outOfRole = matchedRole === null
  const icons = PITCH_STAT_ICONS.filter(([key]) => (row.stats?.[key] ?? 0) > 0)
  const title = [
    row.player_name,
    outOfRole ? 'fuori posizione' : null,
    row.out_of_position ? 'fuori ruolo (−1)' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      className="absolute w-[72px] -translate-x-1/2 -translate-y-1/2 text-center md:w-[100px]"
      style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
      title={title}
    >
      <div
        className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full border-2 text-[9px] font-bold text-white shadow md:h-[30px] md:w-[30px] md:text-[10.5px] ${
          row.out_of_position
            ? 'border-amber-300'
            : outOfRole
              ? 'border-dashed border-amber-200'
              : 'border-white'
        }`}
        style={{ backgroundColor: mantraColor(role) }}
      >
        {mantraLabel(role)}
      </div>
      <div
        className={`mt-0.5 truncate text-[10px] font-semibold text-white md:text-xs ${
          row.counted === false ? 'opacity-60' : ''
        }`}
        style={{ textShadow: '0 1px 2px rgba(0,0,0,.65), 0 0 4px rgba(0,0,0,.5)' }}
      >
        {shortName(row.player_name ?? '')}
      </div>
      {row.fantavoto !== null ? (
        <div className="inline-block rounded-full bg-white px-1.5 text-[10px] font-bold leading-4 text-blue-900 shadow md:px-2 md:text-[11px] md:leading-[17px]">
          {formatPoints(row.fantavoto)}
          {icons.length > 0 && (
            <span className="ml-0.5" aria-label={icons.map(([, , label]) => label).join(', ')}>
              {icons
                .map(
                  ([key, icon]) =>
                    icon + ((row.stats?.[key] ?? 0) > 1 ? `×${row.stats?.[key]}` : ''),
                )
                .join('')}
            </span>
          )}
        </div>
      ) : row.counted === false ? (
        <div className="inline-block rounded-full bg-white/80 px-1.5 text-[10px] leading-4 text-slate-500">
          s.v.
        </div>
      ) : null}
    </div>
  )
}

function Half({
  formation,
  side,
  orientation,
  playerById,
}: {
  formation: TeamFormation
  side: Side
  orientation: Orientation
  playerById: Map<number, Player>
}) {
  const problem = pitchProblem(formation)
  const landscape = orientation === 'landscape'
  const corner = side === 'home' ? 'left-3' : 'right-3'

  const slots: Array<PitchPlayer | null> = [...formation.rows]
    .sort((a, b) => a.slot - b.slot)
    .map((row) =>
      row.player_id === null
        ? null
        : {
            row,
            roles: splitMantraRoles(playerById.get(row.player_id)?.mantra_roles ?? ''),
          },
    )
  const placed = problem ? null : placeTeam(formation.rows[0].module, slots, side, orientation)

  return (
    <>
      {placed?.map((p) => (
        <Token
          key={p.player.row.slot}
          player={p.player}
          matchedRole={p.matchedRole}
          point={p.point}
        />
      ))}
      {landscape && (
        <>
          <div
            className={`absolute top-2.5 ${corner} whitespace-nowrap rounded-full bg-slate-900/80 px-3 py-0.5 text-xs font-semibold text-white`}
          >
            {formation.team?.name}
            {formation.rows[0]?.module && (
              <span className="ml-1 font-normal opacity-80">{formation.rows[0].module}</span>
            )}
          </div>
          {formation.points !== undefined && (
            <div
              className={`absolute bottom-2.5 ${corner} rounded-lg bg-white/95 px-2.5 py-0.5 text-xs font-bold text-blue-900`}
            >
              Totale {formatPoints(formation.points)}
            </div>
          )}
        </>
      )}
      {problem && (
        <div
          className="absolute text-center text-xs italic text-white/90"
          style={
            landscape
              ? {
                  top: '50%',
                  transform: 'translateY(-50%)',
                  [side === 'home' ? 'left' : 'right']: '8%',
                }
              : {
                  left: '50%',
                  transform: 'translateX(-50%)',
                  [side === 'home' ? 'top' : 'bottom']: '22%',
                }
          }
        >
          {problem}
        </div>
      )}
    </>
  )
}

/** Team name, module and total: on phones they sit above / below the pitch instead of on it. */
function TeamBar({ formation }: { formation: TeamFormation }) {
  const module = formation.rows[0]?.module
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
      <span className="font-semibold text-blue-900">
        {formation.team?.name}
        {module && <span className="ml-1 font-normal text-slate-500">({module})</span>}
      </span>
      {formation.points !== undefined && (
        <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-900">
          Totale {formatPoints(formation.points)}
        </span>
      )}
    </div>
  )
}

export default function FormationPitch({
  home,
  away,
  playerById,
  orientation: forced,
}: {
  home: TeamFormation
  away: TeamFormation
  playerById: Map<number, Player>
  /** Overrides the screen-size choice (used to preview the phone layout). */
  orientation?: Orientation
}) {
  const wide = useIsWide()
  const orientation: Orientation = forced ?? (wide ? 'landscape' : 'portrait')

  const pitch = (
    <div
      role="img"
      aria-label={`Formazioni in campo: ${home.team?.name ?? 'casa'} contro ${away.team?.name ?? 'ospite'}`}
      className={`relative overflow-hidden rounded-xl ${
        orientation === 'landscape' ? 'aspect-[1050/680]' : 'aspect-[680/1100]'
      }`}
    >
      <PitchLines orientation={orientation} />
      <Half formation={home} side="home" orientation={orientation} playerById={playerById} />
      <Half formation={away} side="away" orientation={orientation} playerById={playerById} />
    </div>
  )

  if (orientation === 'landscape') return pitch
  return (
    <div>
      <TeamBar formation={home} />
      {pitch}
      <TeamBar formation={away} />
    </div>
  )
}

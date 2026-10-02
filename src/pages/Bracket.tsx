import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LEGS } from '../engine'
import BracketTree from '../components/BracketTree'
import { Card, ErrorBox, Loading, Notice, PageTitle, TeamLink } from '../components/ui'
import { useAuth } from '../lib/auth'
import { ROUND_NAME, ROUND_ORDER, pendingLabel, type TieView } from '../lib/knockout'
import { useKnockout } from '../lib/queries'
import type { Team } from '../lib/types'

function Side({
  teamId,
  from,
  teamById,
  winner,
  loser,
}: {
  teamId: number | null
  from?: string
  teamById: Map<number, Team>
  winner: boolean
  loser: boolean
}) {
  const team = teamId === null ? undefined : teamById.get(teamId)
  return (
    <span className={`flex items-center gap-1 ${loser ? 'opacity-50' : ''}`}>
      {winner && <span aria-label="Qualificata">✓</span>}
      {team ? (
        <TeamLink team={team} bold={winner} />
      ) : (
        <span className="text-sm italic text-slate-400">{pendingLabel(from)}</span>
      )}
    </span>
  )
}

function TieCard({ tie, teamById }: { tie: TieView; teamById: Map<number, Team> }) {
  const { session } = useAuth()
  const decided = tie.winner !== null
  const anyPlayed = tie.legs.some((l) => l.played)
  const showAggregate = tie.legs.length > 1 && anyPlayed

  return (
    <Card>
      <div className="space-y-1 text-sm">
        {(['a', 'b'] as const).map((side) => {
          const id = side === 'a' ? tie.a : tie.b
          const won = decided && tie.winner === id
          return (
            <div key={side} className="flex items-center justify-between gap-2">
              <Side
                teamId={id}
                from={side === 'a' ? tie.aFrom : tie.bFrom}
                teamById={teamById}
                winner={won}
                loser={decided && !won}
              />
              <span className="flex items-center gap-2 tabular-nums">
                {tie.legs.map((l) => (
                  <span key={l.fixtureId} className="w-5 text-center text-slate-600">
                    {l.played ? (side === 'a' ? l.goalsA : l.goalsB) : '·'}
                  </span>
                ))}
                {showAggregate && (
                  <strong className="w-6 text-center text-blue-900">
                    {side === 'a' ? tie.aggregate.goalsA : tie.aggregate.goalsB}
                  </strong>
                )}
              </span>
            </div>
          )
        })}
      </div>
      {tie.outcome.decidedBy === 'points' && (
        <p className="mt-2 text-xs text-slate-500">
          Gol pari: passa chi ha più punti totali ({tie.aggregate.pointsA} - {tie.aggregate.pointsB}
          ).
        </p>
      )}
      {tie.outcome.decidedBy === 'manual' && (
        <p className="mt-2 text-xs text-slate-500">
          Parità totale: vincitore deciso dall&apos;amministratore.
        </p>
      )}
      {tie.outcome.decidedBy === 'undecided' && (
        <p className="mt-2 text-xs text-amber-700">
          In parità: deve decidere l&apos;amministratore.
        </p>
      )}
      {session && tie.legs.some((l) => l.played) && (
        <p className="mt-2 text-xs">
          {tie.legs.map((l, i) =>
            l.played ? (
              <Link
                key={l.fixtureId}
                to={`/partita/${l.fixtureId}`}
                className="mr-3 text-blue-700 hover:underline"
              >
                {LEGS[tie.round] === 2 ? (i === 0 ? 'Andata' : 'Ritorno') : 'Dettaglio'}
              </Link>
            ) : null,
          )}
        </p>
      )}
    </Card>
  )
}

export default function Bracket() {
  const k = useKnockout()
  // The tree needs room: start on the list view on small screens.
  const [view, setView] = useState<'tree' | 'list'>(() =>
    window.matchMedia('(min-width: 1000px)').matches ? 'tree' : 'list',
  )
  if (k.isLoading) return <Loading />
  if (k.error) return <ErrorBox>Impossibile caricare il tabellone.</ErrorBox>

  const started = k.views.some((t) => t.generated)
  const anyGroupPlayed = k.ranking.some((r) => r.played > 0)
  const teamByName = new Map(k.teams.map((t) => [t.name, t]))
  const eliminated = k.ranking.slice(24).map((r) => teamByName.get(r.team)!)
  const finalWinner = k.views.find((t) => t.id === 'F')?.winner
  const champion = finalWinner == null ? undefined : k.teamById.get(finalWinner)

  return (
    <div>
      <PageTitle sub="Le prime 8 saltano i playoff, dalla 9ª alla 24ª giocano i playoff, dalla 25ª in poi sono eliminate. Ogni turno è andata e ritorno (gol totali, poi punti totali); la finale è gara singola.">
        Tabellone
      </PageTitle>

      {!k.groupComplete && (
        <div className="mb-4">
          <Notice>
            {anyGroupPlayed
              ? 'La fase a gironi non è conclusa: gli accoppiamenti dei playoff sono provvisori e seguono la classifica attuale.'
              : 'La fase a gironi non è ancora iniziata: gli accoppiamenti dei playoff seguono la classifica provvisoria.'}
          </Notice>
        </div>
      )}

      {k.views.length === 0 && <Notice>Tabellone non ancora disponibile.</Notice>}

      {champion && (
        <div className="mb-4 rounded-2xl bg-gradient-to-r from-blue-700 to-blue-500 p-4 text-center text-white shadow-sm">
          <p className="text-xs uppercase tracking-wide text-blue-100">Campione</p>
          <p className="text-2xl font-extrabold">🏆 {champion.name}</p>
        </div>
      )}

      <div className="mb-3 flex gap-2" role="group" aria-label="Vista del tabellone">
        {(
          [
            ['tree', 'Schema'],
            ['list', 'Elenco'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={view === key}
            onClick={() => setView(key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ${
              view === key
                ? 'bg-blue-600 text-white ring-blue-600'
                : 'bg-white text-blue-800 ring-blue-200 hover:bg-blue-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'tree' && k.views.length > 0 && (
        // Wider than the page column so the whole tree fits on large screens.
        <div className="relative left-1/2 w-[min(calc(100vw-3rem),1700px)] -translate-x-1/2">
          <BracketTree ties={k.views} teamById={k.teamById} />
          <p className="mt-2 text-xs text-slate-500">
            Nei due turni a doppia gara i piccoli numeri sono i gol di andata e ritorno, il numero
            in grassetto è il totale. Le linee blu scure mostrano il percorso dei turni già decisi.
            Su schermi piccoli scorri lo schema in orizzontale o passa a «Elenco».
          </p>
        </div>
      )}

      <div className={`space-y-6 ${view === 'tree' ? 'hidden' : ''}`}>
        {ROUND_ORDER.map((round) => {
          const ties = k.views.filter((t) => t.round === round)
          if (ties.length === 0) return null
          const roundGenerated = ties.every((t) => t.generated)
          return (
            <section key={round}>
              <h2 className="mb-2 flex items-baseline gap-2 text-lg font-semibold text-blue-900">
                {ROUND_NAME[round]}
                {!roundGenerated && started && (
                  <span className="text-xs font-normal text-slate-500">
                    in attesa dei turni precedenti
                  </span>
                )}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {ties.map((t) => (
                  <TieCard key={t.id} tie={t} teamById={k.teamById} />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {k.groupComplete && eliminated.length > 0 && (
        <Card title="Eliminate dopo la fase a gironi (25°–30°)" className="mt-6">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {eliminated.map((t) => (
              <li key={t.id}>
                <TeamLink team={t} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

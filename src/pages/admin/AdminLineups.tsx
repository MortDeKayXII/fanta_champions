import { useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import LineupEditor from '../../components/LineupEditor'
import LineupImport from '../../components/LineupImport'
import { Card, ErrorBox, Loading, Notice } from '../../components/ui'
import { matchdayTitle } from '../../lib/labels'
import { findProgress } from '../../lib/progress'
import { useCompetition, useLineups, usePlayers, useRosterEntries } from '../../lib/queries'

export default function AdminLineups() {
  const comp = useCompetition()
  const players = usePlayers()
  const entries = useRosterEntries()
  const [params, setParams] = useSearchParams()
  // Bumped after a file import so the editors below reload the imported lineups.
  const [importVersion, setImportVersion] = useState(0)

  const withFixtures = [...new Set(comp.fixtures.map((f) => f.matchday))].sort((a, b) => a - b)
  const { next, last } = findProgress(comp.fixtures, comp.results)
  const requested = Number(params.get('g'))
  const matchday = withFixtures.includes(requested) ? requested : (next ?? last ?? 1)
  const lineups = useLineups(matchday)

  if (comp.isLoading || players.isLoading || entries.isLoading || lineups.isLoading)
    return <Loading />
  if (comp.error || players.error || entries.error || lineups.error)
    return <ErrorBox>Impossibile caricare i dati.</ErrorBox>

  const fixtures = comp.fixtures.filter((f) => f.matchday === matchday)
  const md = comp.matchdayByNumber.get(matchday)
  const rosterOf = (teamId: number) =>
    new Set((entries.data ?? []).filter((e) => e.team_id === teamId).map((e) => e.player_id))
  const savedOf = (teamId: number) => (lineups.data ?? []).filter((l) => l.team_id === teamId)
  const done = new Set((lineups.data ?? []).map((l) => l.team_id)).size

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">
          Giornata{' '}
          <select
            className="ml-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5"
            value={matchday}
            onChange={(e) => setParams({ g: e.target.value })}
          >
            {withFixtures.map((n) => {
              const m = comp.matchdayByNumber.get(n)
              return (
                <option key={n} value={n}>
                  {n} — {m ? matchdayTitle(m) : ''}
                </option>
              )
            })}
          </select>
        </label>
        <span className="text-sm text-slate-600">
          Formazioni inserite: {done}/{fixtures.length * 2}
        </span>
      </div>
      <Notice>
        Le formazioni non sono vincolate alla rosa: puoi scegliere qualsiasi giocatore. Dopo aver
        salvato o modificato una formazione vai su «Voti e calcolo» e premi «Calcola giornata». Con
        «Incolla elenco» inserisci i nomi tutti insieme (un * dopo il nome = fuori ruolo, −1).
      </Notice>

      <Card title="Importa da file">
        <LineupImport
          matchday={matchday}
          matchdayLabel={md ? matchdayTitle(md) : `Giornata ${matchday}`}
          teams={comp.teams}
          players={players.data!}
          saved={lineups.data ?? []}
          onImported={() => setImportVersion((v) => v + 1)}
        />
      </Card>

      {fixtures.map((f) => {
        const home = comp.teamById.get(f.home_team)!
        const away = comp.teamById.get(f.away_team)!
        const complete = savedOf(home.id).length > 0 && savedOf(away.id).length > 0
        return (
          <details key={f.id} className="group" open={!complete}>
            <summary className="cursor-pointer rounded-xl bg-white px-4 py-3 text-sm font-semibold text-blue-900 shadow-sm ring-1 ring-blue-100">
              {home.name} vs {away.name}
              {complete && (
                <span className="ml-2 text-xs font-normal text-green-700">
                  ✓ formazioni inserite
                </span>
              )}
              {comp.resultByFixture.has(f.id) && (
                <span className="ml-2 text-xs font-normal text-slate-500">(già calcolata)</span>
              )}
            </summary>
            <Card className="mt-2">
              <div className="grid gap-6 md:grid-cols-2">
                {[home, away].map((team) => (
                  <LineupEditor
                    key={`${matchday}-${team.id}-${importVersion}-${savedOf(team.id).length}`}
                    matchday={matchday}
                    team={team}
                    saved={savedOf(team.id)}
                    players={players.data!}
                    rosterIds={rosterOf(team.id)}
                  />
                ))}
              </div>
            </Card>
          </details>
        )
      })}
      {md && fixtures.length === 0 && <Notice>Nessuna partita per questa giornata.</Notice>}
    </div>
  )
}

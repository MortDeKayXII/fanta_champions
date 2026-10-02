import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  ErrorBox,
  Loading,
  MantraRoles,
  Notice,
  PageTitle,
  TeamName,
  inputClass,
  secondaryButtonClass,
} from './ui'
import { ROLE_NAME, ROLE_ORDER } from '../lib/labels'
import { usePlayers, useRosterEntries, useRosterHistory, useTeams } from '../lib/queries'
import { supabase } from '../lib/supabase'

const ACTION_LABEL = { add: 'Aggiunto', remove: 'Rimosso', cost: 'Costo modificato' } as const

/** Roster of one team: the owner edits their own, the admin any team (enforced by row level security). */
export default function RosterEditor({
  teamId,
  title,
  subtitle,
}: {
  teamId: number
  title: string
  subtitle?: string
}) {
  const teams = useTeams()
  const players = usePlayers()
  const entries = useRosterEntries()
  const history = useRosterHistory(teamId)
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['roster_entries'] })
    void queryClient.invalidateQueries({ queryKey: ['roster_history'] })
  }
  const onError = (e: Error) => setError(`Operazione non riuscita: ${e.message}`)

  const add = useMutation({
    mutationFn: async (playerId: number) => {
      const { error } = await supabase
        .from('roster_entries')
        .insert({ team_id: teamId, player_id: playerId, cost: 1 })
      if (error) throw error
    },
    onSuccess: () => {
      setError(null)
      refresh()
    },
    onError,
  })
  const remove = useMutation({
    mutationFn: async (playerId: number) => {
      const { error } = await supabase
        .from('roster_entries')
        .delete()
        .eq('team_id', teamId!)
        .eq('player_id', playerId)
      if (error) throw error
    },
    onSuccess: () => {
      setError(null)
      refresh()
    },
    onError,
  })
  const setCost = useMutation({
    mutationFn: async ({ playerId, cost }: { playerId: number; cost: number }) => {
      const { error } = await supabase
        .from('roster_entries')
        .update({ cost })
        .eq('team_id', teamId!)
        .eq('player_id', playerId)
      if (error) throw error
    },
    onSuccess: () => {
      setError(null)
      refresh()
    },
    onError,
  })

  const playerById = useMemo(
    () => new Map((players.data ?? []).map((p) => [p.id, p])),
    [players.data],
  )
  const myTeam = teams.data?.find((t) => t.id === teamId)

  const mine = useMemo(
    () =>
      (entries.data ?? [])
        .filter((e) => e.team_id === teamId)
        .map((e) => ({ ...e, player: playerById.get(e.player_id)! })),
    [entries.data, teamId, playerById],
  )

  // Who owns each player in my league: swaps need the other side to release the player first.
  const ownerInMyLeague = useMemo(() => {
    const leagueTeams = new Map(
      (teams.data ?? []).filter((t) => t.league === myTeam?.league).map((t) => [t.id, t]),
    )
    const owner = new Map<number, string>()
    for (const e of entries.data ?? []) {
      const t = leagueTeams.get(e.team_id)
      if (t && e.team_id !== teamId) owner.set(e.player_id, t.name)
    }
    return owner
  }, [entries.data, teams.data, myTeam, teamId])

  if (teams.isLoading || players.isLoading || entries.isLoading) return <Loading />
  if (teams.error || players.error || entries.error)
    return <ErrorBox>Impossibile caricare la rosa.</ErrorBox>

  const myIds = new Set(mine.map((e) => e.player_id))
  const term = search.trim().toLowerCase()
  const results =
    term.length >= 2
      ? (players.data ?? [])
          .filter((p) => !myIds.has(p.id) && p.name.toLowerCase().includes(term))
          .slice(0, 12)
      : []

  const total = mine.reduce((s, e) => s + e.cost, 0)

  return (
    <div>
      <PageTitle sub={subtitle}>
        {title} — <TeamName team={myTeam} />
      </PageTitle>
      {error && <ErrorBox>{error}</ErrorBox>}
      {message && <Notice>{message}</Notice>}

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_20rem]">
        <Card title={`Giocatori (${mine.length}) · costo ${total}`}>
          {ROLE_ORDER.map((role) => {
            const list = mine
              .filter((e) => e.player.role === role)
              .sort((a, b) => a.player.name.localeCompare(b.player.name))
            return (
              <div key={role} className="mb-4 last:mb-0">
                <h3 className="mb-1 text-sm font-semibold text-blue-900">
                  {ROLE_NAME[role]} ({list.length})
                </h3>
                <ul>
                  {list.map((e) => (
                    <li
                      key={e.player_id}
                      className="flex items-center gap-2 py-1 text-sm odd:bg-blue-50/40"
                    >
                      <span className="flex-1 pl-2">
                        {e.player.name}
                        <span className="ml-2">
                          <MantraRoles roles={e.player.mantra_roles} />
                        </span>
                        <span className="ml-2 text-xs text-slate-500">{e.player.serie_a_team}</span>
                      </span>
                      <label className="sr-only" htmlFor={`cost-${e.player_id}`}>
                        Costo di {e.player.name}
                      </label>
                      <input
                        id={`cost-${e.player_id}`}
                        type="number"
                        min={0}
                        defaultValue={e.cost}
                        className="w-16 rounded border border-slate-300 px-1 py-0.5 text-right text-sm"
                        onBlur={(ev) => {
                          const cost = Number(ev.target.value)
                          if (Number.isInteger(cost) && cost >= 0 && cost !== e.cost) {
                            setCost.mutate({ playerId: e.player_id, cost })
                          }
                        }}
                      />
                      <button
                        className="pr-2 text-xs font-medium text-red-700 hover:underline"
                        onClick={() => {
                          if (window.confirm(`Rimuovere ${e.player.name} dalla rosa?`)) {
                            remove.mutate(e.player_id)
                            setMessage(null)
                          }
                        }}
                      >
                        Rimuovi
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </Card>

        <div className="space-y-4">
          <Card title="Aggiungi giocatore">
            <input
              className={inputClass}
              placeholder="Cerca per nome (min. 2 lettere)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cerca giocatore"
            />
            <ul className="mt-2">
              {results.map((p) => {
                const owner = ownerInMyLeague.get(p.id)
                return (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                    <span>
                      {p.name}{' '}
                      <span className="text-xs text-slate-500">
                        {p.role} · {p.serie_a_team}
                      </span>
                      <span className="ml-1">
                        <MantraRoles roles={p.mantra_roles} />
                      </span>
                      {owner && (
                        <span className="block text-xs text-amber-700">
                          Attualmente in rosa a {owner}
                        </span>
                      )}
                    </span>
                    <button
                      className={secondaryButtonClass}
                      onClick={() => {
                        add.mutate(p.id)
                        setMessage(`${p.name} aggiunto alla rosa.`)
                        setSearch('')
                      }}
                    >
                      Aggiungi
                    </button>
                  </li>
                )
              })}
              {term.length >= 2 && results.length === 0 && (
                <li className="text-sm text-slate-500">Nessun giocatore trovato.</li>
              )}
            </ul>
          </Card>

          <Card title="Ultime modifiche">
            {history.data && history.data.length > 0 ? (
              <ul className="space-y-1 text-xs text-slate-600">
                {history.data.map((h) => (
                  <li key={h.id}>
                    {new Date(h.changed_at).toLocaleString('it-IT')} · {ACTION_LABEL[h.action]}{' '}
                    <strong>{playerById.get(h.player_id)?.name}</strong>
                    {h.action !== 'remove' && h.cost !== null ? ` (${h.cost})` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Nessuna modifica registrata.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  ErrorBox,
  Loading,
  Notice,
  PageTitle,
  buttonClass,
  inputClass,
} from '../components/ui'
import { useAuth } from '../lib/auth'
import { matchdayTitle } from '../lib/labels'
import { useCompetition, useLineups, useMyReports, usePlayers } from '../lib/queries'
import { supabase } from '../lib/supabase'
import type { ReportStatus } from '../lib/types'

const STATUS: Record<ReportStatus, { label: string; cls: string }> = {
  open: { label: 'Aperta', cls: 'bg-amber-100 text-amber-800' },
  resolved: { label: 'Risolta', cls: 'bg-green-100 text-green-800' },
  rejected: { label: 'Respinta', cls: 'bg-slate-200 text-slate-700' },
}

export default function Report() {
  const { profile } = useAuth()
  const comp = useCompetition()
  const players = usePlayers()
  const reports = useMyReports()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()

  const [fixtureId, setFixtureId] = useState(params.get('partita') ?? '')
  const [playerId, setPlayerId] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const fixture = comp.fixtureById.get(Number(fixtureId))
  const lineups = useLineups(fixture?.matchday)

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('error_reports').insert({
        team_id: profile!.team_id,
        matchday: fixture?.matchday ?? null,
        fixture_id: fixture?.id ?? null,
        player_id: playerId ? Number(playerId) : null,
        message: message.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      setMessage('')
      setPlayerId('')
      setSent(true)
      void queryClient.invalidateQueries({ queryKey: ['error_reports'] })
    },
  })

  if (comp.isLoading || !profile) return <Loading />

  // Only played matches of my team can be reported.
  const myMatches = comp.fixtures.filter(
    (f) =>
      (f.home_team === profile.team_id || f.away_team === profile.team_id) &&
      comp.resultByFixture.has(f.id),
  )
  const playerName = new Map((players.data ?? []).map((p) => [p.id, p.name]))
  const lineupPlayers = (lineups.data ?? []).filter(
    (l) => fixture && [fixture.home_team, fixture.away_team].includes(l.team_id) && l.player_id,
  )

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSent(false)
    submit.mutate()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle sub="Hai notato un voto, un bonus o una formazione sbagliati? Scrivilo qui: l'amministratore controlla.">
        Segnala un errore
      </PageTitle>
      <Card>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm font-medium">
            Partita (facoltativo)
            <select
              className={`${inputClass} mt-1`}
              value={fixtureId}
              onChange={(e) => {
                setFixtureId(e.target.value)
                setPlayerId('')
              }}
            >
              <option value="">— nessuna partita in particolare —</option>
              {myMatches.map((f) => {
                const md = comp.matchdayByNumber.get(f.matchday)
                return (
                  <option key={f.id} value={f.id}>
                    {md ? matchdayTitle(md) : f.matchday}: {comp.teamById.get(f.home_team)?.name} -{' '}
                    {comp.teamById.get(f.away_team)?.name}
                  </option>
                )
              })}
            </select>
          </label>
          {fixture && (
            <label className="block text-sm font-medium">
              Giocatore (facoltativo)
              <select
                className={`${inputClass} mt-1`}
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
              >
                <option value="">— nessun giocatore in particolare —</option>
                {lineupPlayers.map((l) => (
                  <option key={`${l.team_id}-${l.slot}`} value={l.player_id!}>
                    {l.player_name ?? playerName.get(l.player_id!)} (
                    {comp.teamById.get(l.team_id)?.name})
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-sm font-medium">
            Descrizione
            <textarea
              className={`${inputClass} mt-1 h-28`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              required
              placeholder="Es. Il portiere ha parato un rigore ma non ha il bonus."
            />
            <span className="text-xs font-normal text-slate-500">{message.length}/1000</span>
          </label>
          {submit.error && <ErrorBox>Invio non riuscito: {submit.error.message}</ErrorBox>}
          {sent && <Notice>Segnalazione inviata. Grazie!</Notice>}
          <button
            className={buttonClass}
            disabled={submit.isPending || message.trim().length === 0}
          >
            {submit.isPending ? 'Invio…' : 'Invia segnalazione'}
          </button>
        </form>
      </Card>

      <Card title="Le mie segnalazioni" className="mt-4">
        {reports.data && reports.data.length > 0 ? (
          <ul className="space-y-3">
            {reports.data.map((r) => (
              <li key={r.id} className="text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[r.status].cls}`}
                  >
                    {STATUS[r.status].label}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(r.created_at).toLocaleString('it-IT')}
                    {r.matchday ? ` · giornata ${r.matchday}` : ''}
                    {r.player_id ? ` · ${playerName.get(r.player_id) ?? ''}` : ''}
                  </span>
                </div>
                <p className="mt-1">{r.message}</p>
                {r.admin_note && (
                  <p className="mt-1 rounded bg-blue-50 p-2 text-blue-900">
                    <strong>Risposta:</strong> {r.admin_note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Non hai ancora inviato segnalazioni.</p>
        )}
      </Card>
    </div>
  )
}

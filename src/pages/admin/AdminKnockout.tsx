import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  ErrorBox,
  Loading,
  Notice,
  TeamName,
  buttonClass,
  secondaryButtonClass,
} from '../../components/ui'
import {
  ROUND_NAME,
  ROUND_ORDER,
  fixturesForRound,
  nextRound,
  pendingLabel,
} from '../../lib/knockout'
import { useKnockout } from '../../lib/queries'
import { supabase } from '../../lib/supabase'

export default function AdminKnockout() {
  const k = useKnockout()
  const queryClient = useQueryClient()
  const refresh = () => {
    for (const key of ['fixtures', 'results', 'tie_decisions']) {
      void queryClient.invalidateQueries({ queryKey: [key] })
    }
  }

  const generate = useMutation({
    mutationFn: async () => {
      const next = nextRound(k.views)
      if (!next?.ready) throw new Error('Il turno non è ancora definito')
      const rows = fixturesForRound(k.views, next.round, k.matchdays)
      const { error } = await supabase.from('fixtures').insert(rows)
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const decide = useMutation({
    mutationFn: async ({ tieId, teamId }: { tieId: string; teamId: number }) => {
      const { error } = await supabase
        .from('tie_decisions')
        .upsert({ tie_id: tieId, winner_team: teamId, decided_at: new Date().toISOString() })
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const undo = useMutation({
    mutationFn: async (tieId: string) => {
      const { error } = await supabase.from('tie_decisions').delete().eq('tie_id', tieId)
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const removeRound = useMutation({
    mutationFn: async (ids: string[]) => {
      const fx = await supabase.from('fixtures').delete().in('tie_id', ids)
      if (fx.error) throw fx.error
      const dec = await supabase.from('tie_decisions').delete().in('tie_id', ids)
      if (dec.error) throw dec.error
    },
    onSuccess: refresh,
  })

  if (k.isLoading) return <Loading />
  if (k.views.length === 0) return <Notice>Tabellone non disponibile.</Notice>

  const next = nextRound(k.views)
  const generatedRounds = ROUND_ORDER.filter((r) =>
    k.views.some((t) => t.round === r && t.generated),
  )
  const lastGenerated = generatedRounds[generatedRounds.length - 1]
  const undecided = k.views.filter((t) => t.outcome.decidedBy === 'undecided')
  const manual = k.views.filter((t) => t.outcome.decidedBy === 'manual')
  const error = generate.error ?? decide.error ?? undo.error ?? removeRound.error

  const onGenerate = () => {
    if (next?.round === 'playoff' && !k.groupComplete) {
      const ok = window.confirm(
        'La fase a gironi non è conclusa (mancano dei risultati). Generare lo stesso i playoff con la classifica attuale? Gli accoppiamenti restano fissi.',
      )
      if (!ok) return
    }
    generate.mutate()
  }

  return (
    <div className="space-y-4">
      <Card title="Prossimo turno">
        {next ? (
          <>
            <p className="mb-2 text-sm text-slate-600">
              Prossimo da creare: <strong>{ROUND_NAME[next.round]}</strong>.{' '}
              {next.ready
                ? 'Gli accoppiamenti sono definiti. Una volta creato il turno restano fissi.'
                : 'Mancano ancora dei vincitori del turno precedente (giocare e calcolare le giornate, poi decidere eventuali parità).'}
            </p>
            {next.round === 'playoff' && !k.groupComplete && (
              <Notice>La fase a gironi non è ancora conclusa: mancano dei risultati.</Notice>
            )}
            <button
              className={`${buttonClass} mt-2`}
              disabled={!next.ready || generate.isPending}
              onClick={onGenerate}
            >
              {generate.isPending ? 'Creo…' : `Crea ${ROUND_NAME[next.round]}`}
            </button>
          </>
        ) : (
          <p className="text-sm">Tutti i turni sono stati creati.</p>
        )}
        {lastGenerated && (
          <div className="mt-4 border-t border-blue-100 pt-3">
            <p className="mb-2 text-sm text-slate-600">
              Hai sbagliato qualcosa? Puoi eliminare l&apos;ultimo turno creato (
              {ROUND_NAME[lastGenerated]}): sparisce con le sue partite e i suoi risultati, le
              formazioni restano.
            </p>
            <button
              className={secondaryButtonClass}
              disabled={removeRound.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Eliminare il turno «${ROUND_NAME[lastGenerated]}» con partite e risultati?`,
                  )
                ) {
                  removeRound.mutate(
                    k.views.filter((t) => t.round === lastGenerated).map((t) => t.id),
                  )
                }
              }}
            >
              Elimina {ROUND_NAME[lastGenerated]}
            </button>
          </div>
        )}
      </Card>

      <Card title="Parità da decidere">
        {undecided.length === 0 ? (
          <p className="text-sm text-slate-600">Nessuna parità in sospeso.</p>
        ) : (
          <ul className="space-y-3">
            {undecided.map((t) => (
              <li key={t.id} className="text-sm">
                <p>
                  <strong>{ROUND_NAME[t.round]}</strong> · {t.id}: gol {t.aggregate.goalsA}-
                  {t.aggregate.goalsB}, punti {t.aggregate.pointsA}-{t.aggregate.pointsB}
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {[t.a, t.b].map((id) => {
                    const team = id === null ? undefined : k.teamById.get(id)
                    return (
                      <button
                        key={id}
                        className={buttonClass}
                        disabled={decide.isPending || id === null}
                        onClick={() => id !== null && decide.mutate({ tieId: t.id, teamId: id })}
                      >
                        Passa {team?.name ?? pendingLabel(undefined)}
                      </button>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
        {manual.length > 0 && (
          <div className="mt-4 border-t border-blue-100 pt-3">
            <h3 className="mb-1 text-sm font-semibold">Decisioni prese</h3>
            <ul className="space-y-1 text-sm">
              {manual.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <span>
                    {t.id}: passa{' '}
                    <TeamName
                      team={t.winner === null ? undefined : k.teamById.get(t.winner)}
                      bold
                    />
                  </span>
                  <button
                    className="text-xs text-red-700 hover:underline"
                    onClick={() => undo.mutate(t.id)}
                  >
                    Annulla
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {error && <ErrorBox>Operazione non riuscita: {error.message}</ErrorBox>}
    </div>
  )
}

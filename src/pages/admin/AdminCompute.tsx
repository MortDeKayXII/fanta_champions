import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import readXlsxFile from 'read-excel-file/browser'
import {
  Card,
  ErrorBox,
  Loading,
  Notice,
  TeamName,
  buttonClass,
  secondaryButtonClass,
} from '../../components/ui'
import type { VoteRow } from '../../engine'
import { computeMatchday, type ComputeOutput } from '../../lib/computeMatchday'
import { formatPoints, matchdayTitle } from '../../lib/labels'
import { findProgress } from '../../lib/progress'
import { useCompetition } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import type { LineupRow } from '../../lib/types'
import { findItaliaSheet, parseVotes } from '../../lib/votesFile'

interface VoteDbRow {
  matchday: number
  player_id: number
  vote: number | null
  gf: number
  gs: number
  rp: number
  rs: number
  rf: number
  au: number
  amm: number
  esp: number
  ass: number
}

const toDb = (matchday: number, v: VoteRow): VoteDbRow => ({
  matchday,
  player_id: v.playerId,
  vote: v.vote,
  gf: v.gf,
  gs: v.gs,
  rp: v.rp,
  rs: v.rs,
  rf: v.rf,
  au: v.au,
  amm: v.amm,
  esp: v.esp,
  ass: v.ass,
})
const fromDb = (r: VoteDbRow): VoteRow => ({
  playerId: r.player_id,
  vote: r.vote,
  gf: r.gf,
  gs: r.gs,
  rp: r.rp,
  rs: r.rs,
  rf: r.rf,
  au: r.au,
  amm: r.amm,
  esp: r.esp,
  ass: r.ass,
})

const CHUNK = 400

export default function AdminCompute() {
  const comp = useCompetition()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [workbook, setWorkbook] = useState<{
    fileName: string
    sheets: Array<{ name: string; rows: unknown[][] }>
  } | null>(null)
  const [sheetName, setSheetName] = useState('')
  const [readError, setReadError] = useState<string | null>(null)
  const [output, setOutput] = useState<ComputeOutput | null>(null)

  const withFixtures = [...new Set(comp.fixtures.map((f) => f.matchday))].sort((a, b) => a - b)
  const { next, last } = findProgress(comp.fixtures, comp.results)
  const requested = Number(params.get('g'))
  const matchday = withFixtures.includes(requested) ? requested : (next ?? last ?? 1)

  const stored = useQuery({
    queryKey: ['votes-count', matchday],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })
        .eq('matchday', matchday)
      if (error) throw error
      return count ?? 0
    },
  })

  // Votes come from the "Italia" sheet (Redazione Italia); the admin can pick another one.
  const parsed = useMemo(() => {
    const sheet = workbook?.sheets.find((x) => x.name === sheetName)
    return workbook && sheet ? { fileName: workbook.fileName, data: parseVotes(sheet.rows) } : null
  }, [workbook, sheetName])

  async function onFile(file: File | undefined) {
    setWorkbook(null)
    setReadError(null)
    if (!file) return
    try {
      const sheets = (await readXlsxFile(file)).map((x) => ({
        name: x.sheet,
        rows: x.data as unknown[][],
      }))
      setWorkbook({ fileName: file.name, sheets })
      setSheetName(findItaliaSheet(sheets.map((x) => x.name)) ?? '')
    } catch {
      setReadError('Non riesco a leggere il file: deve essere un .xlsx dei voti Fantacalcio.')
    }
  }

  const saveVotes = useMutation({
    mutationFn: async () => {
      const votes = parsed!.data.votes
      const del = await supabase.from('votes').delete().eq('matchday', matchday)
      if (del.error) throw del.error
      for (let i = 0; i < votes.length; i += CHUNK) {
        const { error } = await supabase
          .from('votes')
          .insert(votes.slice(i, i + CHUNK).map((v) => toDb(matchday, v)))
        if (error) throw error
      }
    },
    onSuccess: () => {
      setWorkbook(null)
      void queryClient.invalidateQueries({ queryKey: ['votes-count', matchday] })
    },
  })

  const compute = useMutation({
    mutationFn: async () => {
      const [votesRes, lineupsRes] = await Promise.all([
        supabase.from('votes').select('*').eq('matchday', matchday),
        supabase.from('lineups').select('*').eq('matchday', matchday),
      ])
      if (votesRes.error) throw votesRes.error
      if (lineupsRes.error) throw lineupsRes.error
      const out = computeMatchday({
        fixtures: comp.fixtures.filter((f) => f.matchday === matchday),
        lineups: lineupsRes.data as LineupRow[],
        votes: (votesRes.data as VoteDbRow[]).map(fromDb),
        teamName: (id) => comp.teamById.get(id)?.name ?? `#${id}`,
      })
      if (out.lineups.length > 0) {
        const { error } = await supabase
          .from('lineups')
          .upsert(out.lineups, { onConflict: 'matchday,team_id,slot' })
        if (error) throw error
      }
      if (out.results.length > 0) {
        const { error } = await supabase.from('results').upsert(
          out.results.map((r) => ({ ...r, computed_at: new Date().toISOString() })),
          {
            onConflict: 'fixture_id',
          },
        )
        if (error) throw error
      }
      return out
    },
    onSuccess: (out) => {
      setOutput(out)
      void queryClient.invalidateQueries({ queryKey: ['results'] })
      void queryClient.invalidateQueries({ queryKey: ['lineups', matchday] })
    },
  })

  const reset = useMutation({
    mutationFn: async () => {
      const ids = comp.fixtures.filter((f) => f.matchday === matchday).map((f) => f.id)
      const steps = [
        supabase.from('results').delete().in('fixture_id', ids),
        supabase.from('votes').delete().eq('matchday', matchday),
        supabase
          .from('lineups')
          .update({ vote: null, fantavoto: null, counted: null, stats: null })
          .eq('matchday', matchday),
      ]
      for (const step of steps) {
        const { error } = await step
        if (error) throw error
      }
    },
    onSuccess: () => {
      setOutput(null)
      void queryClient.invalidateQueries({ queryKey: ['results'] })
      void queryClient.invalidateQueries({ queryKey: ['votes-count', matchday] })
      void queryClient.invalidateQueries({ queryKey: ['lineups', matchday] })
    },
  })

  if (comp.isLoading) return <Loading />
  const md = comp.matchdayByNumber.get(matchday)
  const fixtures = comp.fixtures.filter((f) => f.matchday === matchday)
  const computed = fixtures.filter((f) => comp.resultByFixture.has(f.id)).length

  return (
    <div className="space-y-4">
      <label className="text-sm font-medium">
        Giornata{' '}
        <select
          className="ml-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5"
          value={matchday}
          onChange={(e) => {
            setParams({ g: e.target.value })
            setOutput(null)
            setWorkbook(null)
          }}
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

      <Card title="1. File dei voti">
        <p className="mb-2 text-sm text-slate-600">
          Voti salvati per la giornata {matchday}:{' '}
          <strong>{stored.isLoading ? '…' : stored.data} giocatori</strong>. Caricare un nuovo file
          sostituisce quelli esistenti.
        </p>
        <input
          type="file"
          accept=".xlsx"
          aria-label="File dei voti"
          onChange={(e) => void onFile(e.target.files?.[0])}
          className="text-sm"
        />
        {readError && (
          <div className="mt-2">
            <ErrorBox>{readError}</ErrorBox>
          </div>
        )}
        {workbook && (
          <div className="mt-3 space-y-2">
            <label className="block text-sm font-medium">
              Foglio da usare
              <select
                className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-normal"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
              >
                {!sheetName && <option value="">— scegli un foglio —</option>}
                {workbook.sheets.map((x) => (
                  <option key={x.name} value={x.name}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            {!findItaliaSheet(workbook.sheets.map((x) => x.name)) && (
              <ErrorBox>
                Non trovo il foglio «Italia» (Redazione Italia): controlla di aver scelto il foglio
                giusto.
              </ErrorBox>
            )}
          </div>
        )}
        {parsed && (
          <div className="mt-3 space-y-2">
            <Notice>
              <strong>{parsed.fileName}</strong> · foglio «{sheetName}»: {parsed.data.votes.length}{' '}
              giocatori, di cui {parsed.data.noVote} senza voto (s.v./6*). {parsed.data.coaches}{' '}
              allenatori ignorati.
            </Notice>
            {parsed.data.warnings.map((w) => (
              <ErrorBox key={w}>{w}</ErrorBox>
            ))}
            <button
              className={buttonClass}
              disabled={saveVotes.isPending || parsed.data.votes.length === 0}
              onClick={() => saveVotes.mutate()}
            >
              {saveVotes.isPending ? 'Salvo…' : `Salva voti per la giornata ${matchday}`}
            </button>
          </div>
        )}
        {saveVotes.error && (
          <div className="mt-2">
            <ErrorBox>Salvataggio non riuscito: {saveVotes.error.message}</ErrorBox>
          </div>
        )}
        {saveVotes.isSuccess && !workbook && (
          <p className="mt-2 text-sm text-green-700">Voti salvati.</p>
        )}
      </Card>

      <Card title="2. Calcolo della giornata">
        <p className="mb-2 text-sm text-slate-600">
          Partite calcolate:{' '}
          <strong>
            {computed}/{fixtures.length}
          </strong>
          . Il calcolo usa le formazioni e i voti salvati e si può ripetere quando vuoi: i risultati
          vengono sovrascritti.
        </p>
        <button
          className={buttonClass}
          disabled={compute.isPending || !stored.data}
          onClick={() => compute.mutate()}
        >
          {compute.isPending ? 'Calcolo…' : `Calcola giornata ${matchday}`}
        </button>
        {!stored.isLoading && !stored.data && (
          <p className="mt-2 text-sm text-amber-700">Carica prima il file dei voti.</p>
        )}
        {compute.error && (
          <div className="mt-2">
            <ErrorBox>Calcolo non riuscito: {compute.error.message}</ErrorBox>
          </div>
        )}
      </Card>

      <Card title="Azzera la giornata">
        <p className="mb-2 text-sm text-slate-600">
          Cancella risultati, voti e punteggi calcolati della giornata {matchday}. Le formazioni
          inserite restano. Utile per un test o per ripartire da zero.
        </p>
        <button
          className={secondaryButtonClass}
          disabled={reset.isPending}
          onClick={() => {
            if (window.confirm(`Azzerare risultati e voti della giornata ${matchday}?`))
              reset.mutate()
          }}
        >
          {reset.isPending ? 'Azzero…' : `Azzera giornata ${matchday}`}
        </button>
        {reset.error && (
          <div className="mt-2">
            <ErrorBox>Non riuscito: {reset.error.message}</ErrorBox>
          </div>
        )}
        {reset.isSuccess && <p className="mt-2 text-sm text-green-700">Giornata azzerata.</p>}
      </Card>

      {output && (
        <Card title={`Risultato${md ? ` · ${matchdayTitle(md)}` : ''}`}>
          <table className="w-full text-sm">
            <tbody>
              {output.results.map((r) => {
                const f = comp.fixtureById.get(r.fixture_id)!
                return (
                  <tr key={r.fixture_id} className="odd:bg-blue-50/40">
                    <td className="py-1 pl-2 text-right">
                      <TeamName team={comp.teamById.get(f.home_team)} />
                    </td>
                    <td className="w-28 text-center font-semibold text-blue-900">
                      {r.home_goals} - {r.away_goals}
                      <span className="block text-xs font-normal text-slate-500">
                        {formatPoints(r.home_points)} · {formatPoints(r.away_points)}
                      </span>
                    </td>
                    <td>
                      <TeamName team={comp.teamById.get(f.away_team)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {output.warnings.length > 0 ? (
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-amber-800">
                Da controllare ({output.warnings.length})
              </h3>
              <ul className="mt-1 list-disc pl-5 text-sm text-amber-900">
                {output.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-sm text-green-700">Nessuna anomalia.</p>
          )}
          <button className={`${secondaryButtonClass} mt-3`} onClick={() => setOutput(null)}>
            Chiudi
          </button>
        </Card>
      )}
    </div>
  )
}

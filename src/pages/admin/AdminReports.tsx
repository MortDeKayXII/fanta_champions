import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, ErrorBox, Loading, TeamName, buttonClass, inputClass } from '../../components/ui'
import { matchdayTitle } from '../../lib/labels'
import { useCompetition, usePlayers } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import type { ErrorReport, ReportStatus } from '../../lib/types'

const STATUS_LABEL: Record<ReportStatus, string> = {
  open: 'Aperta',
  resolved: 'Risolta',
  rejected: 'Respinta',
}

function ReportCard({ report }: { report: ErrorReport }) {
  const comp = useCompetition()
  const players = usePlayers()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<ReportStatus>(report.status)
  const [note, setNote] = useState(report.admin_note ?? '')

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('error_reports')
        .update({ status, admin_note: note.trim() || null })
        .eq('id', report.id)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['all-reports'] }),
  })

  const md = report.matchday ? comp.matchdayByNumber.get(report.matchday) : undefined
  const fixture = report.fixture_id ? comp.fixtureById.get(report.fixture_id) : undefined
  const player = players.data?.find((p) => p.id === report.player_id)
  const changed = status !== report.status || note.trim() !== (report.admin_note ?? '')

  return (
    <Card>
      <div className="flex flex-wrap items-baseline gap-x-3 text-sm">
        <TeamName team={comp.teamById.get(report.team_id)} bold />
        <span className="text-xs text-slate-500">
          {new Date(report.created_at).toLocaleString('it-IT')}
        </span>
        {md && <span className="text-xs text-slate-500">{matchdayTitle(md)}</span>}
        {fixture && (
          <span className="text-xs text-slate-500">
            {comp.teamById.get(fixture.home_team)?.name} -{' '}
            {comp.teamById.get(fixture.away_team)?.name}
          </span>
        )}
        {player && <span className="text-xs text-blue-800">{player.name}</span>}
      </div>
      <p className="my-2 whitespace-pre-wrap text-sm">{report.message}</p>
      <div className="flex flex-wrap items-start gap-2">
        <select
          className={`${inputClass} !w-32`}
          value={status}
          onChange={(e) => setStatus(e.target.value as ReportStatus)}
          aria-label="Stato"
        >
          {(Object.keys(STATUS_LABEL) as ReportStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <input
          className={`${inputClass} !w-72 flex-1`}
          placeholder="Risposta per l'utente (facoltativa)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label="Risposta"
        />
        <button
          className={buttonClass}
          disabled={!changed || save.isPending}
          onClick={() => save.mutate()}
        >
          Salva
        </button>
      </div>
      {save.error && <ErrorBox>Salvataggio non riuscito: {save.error.message}</ErrorBox>}
    </Card>
  )
}

export default function AdminReports() {
  const [onlyOpen, setOnlyOpen] = useState(true)
  const reports = useQuery({
    queryKey: ['all-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('error_reports')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as ErrorReport[]
    },
  })

  if (reports.isLoading) return <Loading />
  if (reports.error) return <ErrorBox>Impossibile caricare le segnalazioni.</ErrorBox>
  const list = (reports.data ?? []).filter((r) => !onlyOpen || r.status === 'open')

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
        Solo segnalazioni aperte ({(reports.data ?? []).filter((r) => r.status === 'open').length})
      </label>
      {list.length === 0 && <p className="text-sm text-slate-500">Nessuna segnalazione.</p>}
      {list.map((r) => (
        <ReportCard key={r.id} report={r} />
      ))}
    </div>
  )
}

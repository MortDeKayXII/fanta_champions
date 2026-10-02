import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  buildLineup,
  hasVotes,
  importRows,
  parseFormazioni,
  playersByName,
  type FileTeam,
  type ImportMode,
} from '../lib/formazioni'
import { normalizeName } from '../lib/lineupText'
import { supabase } from '../lib/supabase'
import type { LineupRow, Player, Team } from '../lib/types'
import { readGrid } from '../lib/xlsxCells'
import { ErrorBox, MantraRoles, Notice, buttonClass, inputClass } from './ui'

/**
 * Imports the lineup export of an original league. Teams are matched by name, so one file fills
 * the 10 teams of a league. Importing again for the same matchday overwrites those teams' lineups
 * (e.g. the initial lineups first, the final ones with substitutions after the games).
 */
export default function LineupImport({
  matchday,
  matchdayLabel,
  teams,
  players,
  saved,
  onImported,
}: {
  matchday: number
  matchdayLabel: string
  teams: readonly Team[]
  players: readonly Player[]
  saved: readonly LineupRow[]
  onImported: () => void
}) {
  const queryClient = useQueryClient()
  const [fileName, setFileName] = useState('')
  const [fileTeams, setFileTeams] = useState<FileTeam[] | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const [mode, setMode] = useState<ImportMode>('initial')
  const [maxSubs, setMaxSubs] = useState(3)
  const [done, setDone] = useState<string | null>(null)

  const byName = useMemo(() => playersByName(players), [players])
  const teamByName = useMemo(() => new Map(teams.map((t) => [normalizeName(t.name), t])), [teams])

  async function onFile(file: File | undefined) {
    setFileTeams(null)
    setReadError(null)
    setDone(null)
    if (!file) return
    try {
      const parsed = parseFormazioni(readGrid(new Uint8Array(await file.arrayBuffer())))
      if (parsed.length === 0) throw new Error('nessuna squadra')
      setFileName(file.name)
      setFileTeams(parsed)
      // A file with votes is a post-match export: default to the final lineups.
      setMode(hasVotes(parsed) ? 'final' : 'initial')
    } catch {
      setReadError(
        'Non riesco a leggere il file: deve essere l’export delle formazioni di una giornata (.xlsx).',
      )
    }
  }

  const preview = useMemo(
    () =>
      (fileTeams ?? []).map((ft) => ({
        file: ft,
        team: teamByName.get(normalizeName(ft.teamName)),
        built: buildLineup(ft, byName, { mode, maxSubs }),
      })),
    [fileTeams, teamByName, byName, mode, maxSubs],
  )
  const matched = preview.filter((p) => p.team)
  const unknownTeams = preview.filter((p) => !p.team).map((p) => p.file.teamName)

  const apply = useMutation({
    mutationFn: async () => {
      const rows = matched.flatMap(({ team, built }) =>
        importRows(matchday, team!.id, built, saved),
      )
      const { error } = await supabase.from('lineups').upsert(rows, {
        onConflict: 'matchday,team_id,slot',
      })
      if (error) throw error
      return matched.length
    },
    onSuccess: (n) => {
      setDone(
        `Importate ${n} formazioni per «${matchdayLabel}». Ricorda di premere «Calcola giornata» se la giornata era già stata calcolata.`,
      )
      setFileTeams(null)
      void queryClient.invalidateQueries({ queryKey: ['lineups', matchday] })
      onImported()
    },
  })

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Carica l&apos;export delle formazioni di una lega (un file = le 10 squadre di quella lega).
        Le squadre vengono riconosciute dal nome e la formazione della giornata{' '}
        <strong>{matchdayLabel}</strong> viene sovrascritta: puoi importare prima gli schieramenti
        iniziali e, a partite finite, quelli finali.
      </p>
      <input
        type="file"
        accept=".xlsx"
        aria-label="File delle formazioni"
        className="text-sm"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {readError && <ErrorBox>{readError}</ErrorBox>}
      {done && <p className="text-sm font-medium text-green-700">{done}</p>}

      {fileTeams && (
        <div className="space-y-3">
          <fieldset className="space-y-1 text-sm">
            <legend className="font-medium">Cosa importare da «{fileName}»</legend>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="import-mode"
                checked={mode === 'initial'}
                onChange={() => setMode('initial')}
              />
              <span>
                <strong>Schieramento iniziale</strong> — i 11 titolari come schierati (prima delle
                partite, per far vedere agli utenti contro chi giocano).
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="import-mode"
                checked={mode === 'final'}
                onChange={() => setMode('final')}
              />
              <span>
                <strong>Formazione finale</strong> — con le sostituzioni fatte dall&apos;app
                originale (i giocatori in grigio nel file sono quelli non entrati nel punteggio).
              </span>
            </label>
            {mode === 'final' && (
              <label className="ml-6 flex items-center gap-2">
                Sostituzioni massime
                <input
                  type="number"
                  min={0}
                  max={5}
                  className={`${inputClass} !w-16`}
                  value={maxSubs}
                  onChange={(e) =>
                    setMaxSubs(Math.max(0, Math.min(5, Number(e.target.value) || 0)))
                  }
                />
                <span className="text-xs text-slate-500">
                  (le sostituzioni oltre questo numero, in ordine di panchina, non vengono
                  applicate)
                </span>
              </label>
            )}
            {mode === 'final' && !hasVotes(fileTeams) && (
              <Notice>
                Il file non contiene voti: sembra un export pre-partita, scegli «Schieramento
                iniziale».
              </Notice>
            )}
          </fieldset>

          {unknownTeams.length > 0 && (
            <ErrorBox>Squadre non riconosciute (saltate): {unknownTeams.join(', ')}.</ErrorBox>
          )}

          <ul className="space-y-2">
            {matched.map(({ team, built }) => {
              const exists = saved.some((l) => l.team_id === team!.id)
              const missing = built.slots.filter((s) => !s.player).length
              return (
                <li key={team!.id} className="rounded-lg border border-blue-100 p-2 text-sm">
                  <details>
                    <summary className="cursor-pointer">
                      <strong>{team!.name}</strong> — {11 - missing}/{built.slots.length} giocatori
                      {built.substitutions.length > 0 &&
                        `, ${built.substitutions.length} sostituzioni`}
                      {exists && (
                        <span className="ml-2 text-xs text-amber-700">
                          sovrascrive la formazione salvata
                        </span>
                      )}
                      {built.warnings.length > 0 && (
                        <span className="ml-2 text-xs text-red-700">
                          {built.warnings.length} da controllare
                        </span>
                      )}
                    </summary>
                    <ol className="mt-2 columns-2 text-xs">
                      {built.slots.map((s, i) => (
                        <li key={i}>
                          {s.player ? (
                            <>
                              {s.player.name} <MantraRoles roles={s.player.mantra_roles} />
                            </>
                          ) : (
                            <span className="text-red-700">{s.fileName} (non trovato)</span>
                          )}
                        </li>
                      ))}
                    </ol>
                    {built.substitutions.length > 0 && (
                      <p className="mt-1 text-xs text-slate-600">
                        Sostituzioni:{' '}
                        {built.substitutions.map((s) => `${s.out} → ${s.in}`).join('; ')}
                      </p>
                    )}
                    {built.ignored.length > 0 && (
                      <p className="mt-1 text-xs text-amber-700">
                        Non applicate (oltre {maxSubs}): {built.ignored.join(', ')}
                      </p>
                    )}
                    {built.warnings.map((w) => (
                      <p key={w} className="mt-1 text-xs text-red-700">
                        {w}
                      </p>
                    ))}
                  </details>
                </li>
              )
            })}
          </ul>

          <button
            className={buttonClass}
            disabled={apply.isPending || matched.length === 0}
            onClick={() => apply.mutate()}
          >
            {apply.isPending
              ? 'Importo…'
              : `Importa ${matched.length} formazioni (${matchdayLabel})`}
          </button>
          {apply.error && <ErrorBox>Importazione non riuscita: {apply.error.message}</ErrorBox>}
        </div>
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { matchPlayerNames } from '../lib/lineupText'
import { supabase } from '../lib/supabase'
import type { LineupRow, Player, Team } from '../lib/types'
import PlayerPicker from './PlayerPicker'
import {
  ErrorBox,
  MantraRoles,
  Notice,
  TeamName,
  buttonClass,
  inputClass,
  secondaryButtonClass,
} from './ui'

interface Slot {
  player: Player | null
  outOfPosition: boolean
}

const SLOTS = 11

function initialSlots(saved: readonly LineupRow[], playerById: Map<number, Player>): Slot[] {
  return Array.from({ length: SLOTS }, (_, i) => {
    const row = saved.find((r) => r.slot === i + 1)
    return {
      player: row?.player_id != null ? (playerById.get(row.player_id) ?? null) : null,
      outOfPosition: row?.out_of_position ?? false,
    }
  })
}

/** Final lineup of one team for one matchday: 11 slots, holes allowed, any player allowed. */
export default function LineupEditor({
  matchday,
  team,
  saved,
  players,
  rosterIds,
}: {
  matchday: number
  team: Team
  saved: readonly LineupRow[]
  players: readonly Player[]
  rosterIds: ReadonlySet<number>
}) {
  const queryClient = useQueryClient()
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const [slots, setSlots] = useState<Slot[]>(() => initialSlots(saved, playerById))
  const [picking, setPicking] = useState<number | null>(null)
  const [pasting, setPasting] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [problems, setProblems] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)

  const update = (i: number, patch: Partial<Slot>) => {
    setSlots((s) => s.map((slot, j) => (j === i ? { ...slot, ...patch } : slot)))
    setDirty(true)
  }

  function applyPaste() {
    const matched = matchPlayerNames(pasteText, players, rosterIds)
    setProblems(matched.filter((m) => m.problem).map((m) => `${m.input}: ${m.problem}`))
    const next: Slot[] = Array.from({ length: SLOTS }, (_, i) => ({
      player: matched[i]?.player ?? null,
      outOfPosition: matched[i]?.outOfPosition ?? false,
    }))
    if (matched.length > SLOTS) {
      setProblems((p) => [...p, `Hai incollato ${matched.length} nomi: ne uso solo ${SLOTS}.`])
    }
    setSlots(next)
    setDirty(true)
    setPasting(false)
  }

  const save = useMutation({
    mutationFn: async () => {
      const rows = slots.map((s, i) => ({
        matchday,
        team_id: team.id,
        slot: i + 1,
        player_id: s.player?.id ?? null,
        player_name: s.player?.name ?? null,
        out_of_position: s.player ? s.outOfPosition : false,
        // Scores are cleared: they come back with "Calcola giornata".
        vote: null,
        fantavoto: null,
        counted: null,
        stats: null,
      }))
      const { error } = await supabase
        .from('lineups')
        .upsert(rows, { onConflict: 'matchday,team_id,slot' })
      if (error) throw error
    },
    onSuccess: () => {
      setDirty(false)
      void queryClient.invalidateQueries({ queryKey: ['lineups', matchday] })
    },
  })

  const filled = slots.filter((s) => s.player).length

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <TeamName team={team} bold />
        <span className="text-xs text-slate-500">
          {filled}/{SLOTS} ·{' '}
          {saved.length > 0 && !dirty ? 'salvata' : dirty ? 'modificata' : 'non inserita'}
        </span>
      </div>

      <ol className="space-y-1">
        {slots.map((s, i) => (
          <li key={i}>
            <div className="flex items-center gap-2 rounded px-1 py-0.5 text-sm odd:bg-blue-50/40">
              <span className="w-5 text-right text-xs text-slate-400">{i + 1}</span>
              <button
                type="button"
                className="flex-1 truncate text-left hover:underline"
                onClick={() => setPicking(picking === i ? null : i)}
              >
                {s.player ? (
                  <>
                    {s.player.name} <MantraRoles roles={s.player.mantra_roles} />
                    {!rosterIds.has(s.player.id) && (
                      <span className="ml-1 text-[10px] text-amber-700">(non in rosa)</span>
                    )}
                  </>
                ) : (
                  <span className="italic text-slate-400">vuoto — clicca per scegliere</span>
                )}
              </button>
              <label className="flex items-center gap-1 text-xs" title="Fuori ruolo: −1">
                <input
                  type="checkbox"
                  checked={s.outOfPosition}
                  disabled={!s.player}
                  onChange={(e) => update(i, { outOfPosition: e.target.checked })}
                />
                −1
              </label>
              {s.player && (
                <button
                  type="button"
                  aria-label={`Svuota slot ${i + 1}`}
                  className="text-xs text-red-700"
                  onClick={() => update(i, { player: null, outOfPosition: false })}
                >
                  ✕
                </button>
              )}
            </div>
            {picking === i && (
              <PlayerPicker
                players={players}
                rosterIds={rosterIds}
                onPick={(player) => {
                  update(i, { player })
                  setPicking(null)
                }}
              />
            )}
          </li>
        ))}
      </ol>

      {pasting ? (
        <div className="space-y-2">
          <textarea
            className={`${inputClass} h-40`}
            placeholder={
              'Un giocatore per riga (o separati da virgola).\nAggiungi * dopo il nome per il −1 fuori ruolo.'
            }
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            aria-label="Elenco giocatori"
          />
          <div className="flex gap-2">
            <button type="button" className={buttonClass} onClick={applyPaste}>
              Applica
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setPasting(false)}
            >
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonClass}
            disabled={save.isPending || !dirty}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Salvo…' : 'Salva formazione'}
          </button>
          <button type="button" className={secondaryButtonClass} onClick={() => setPasting(true)}>
            Incolla elenco
          </button>
        </div>
      )}

      {problems.length > 0 && (
        <Notice>
          Da controllare:
          <ul className="list-disc pl-5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Notice>
      )}
      {save.error && <ErrorBox>Salvataggio non riuscito: {save.error.message}</ErrorBox>}
    </div>
  )
}

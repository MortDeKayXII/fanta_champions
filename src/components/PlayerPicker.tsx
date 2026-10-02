import { useMemo, useState } from 'react'
import { MANTRA_NAME, mantraLabel, splitMantraRoles } from '../lib/labels'
import { normalizeName } from '../lib/lineupText'
import type { Player } from '../lib/types'
import { MantraRoles, inputClass } from './ui'

/**
 * Search box for any of the players. Lineups are not tied to rosters, so the whole list is
 * available; roster players come first and are marked. Filters: role, Mantra role, roster only.
 */
export default function PlayerPicker({
  players,
  rosterIds,
  onPick,
}: {
  players: readonly Player[]
  rosterIds: ReadonlySet<number>
  onPick: (player: Player) => void
}) {
  const [text, setText] = useState('')
  const [mantra, setMantra] = useState('')
  const [rosterOnly, setRosterOnly] = useState(false)

  const found = useMemo(() => {
    const q = normalizeName(text)
    return players
      .filter(
        (p) =>
          (!mantra || splitMantraRoles(p.mantra_roles).includes(mantra)) &&
          (!rosterOnly || rosterIds.has(p.id)) &&
          (!q || normalizeName(p.name).includes(q)),
      )
      .sort(
        (a, b) =>
          Number(rosterIds.has(b.id)) - Number(rosterIds.has(a.id)) || a.name.localeCompare(b.name),
      )
      .slice(0, 25)
  }, [players, rosterIds, text, mantra, rosterOnly])

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} !w-48`}
          placeholder="Cerca giocatore…"
          aria-label="Cerca giocatore"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <select
          className={`${inputClass} !w-32`}
          value={mantra}
          onChange={(e) => setMantra(e.target.value)}
          aria-label="Ruolo Mantra"
        >
          <option value="">Ruolo Mantra</option>
          {Object.entries(MANTRA_NAME).map(([k, name]) => (
            <option key={k} value={k}>
              {mantraLabel(k)} · {name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={rosterOnly}
            onChange={(e) => setRosterOnly(e.target.checked)}
          />
          Solo rosa
        </label>
      </div>
      <ul className="mt-2 max-h-64 overflow-y-auto">
        {found.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onPick(p)}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-blue-100"
            >
              <span className="flex-1">
                {p.name}{' '}
                {rosterIds.has(p.id) && (
                  <span className="rounded bg-green-100 px-1 text-[10px] text-green-800">
                    in rosa
                  </span>
                )}
              </span>
              <MantraRoles roles={p.mantra_roles} />
              <span className="w-20 truncate text-right text-xs text-slate-500">
                {p.serie_a_team}
              </span>
            </button>
          </li>
        ))}
        {found.length === 0 && (
          <li className="px-2 py-1 text-sm text-slate-500">Nessun risultato.</li>
        )}
      </ul>
    </div>
  )
}

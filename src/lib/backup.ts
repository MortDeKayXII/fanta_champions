import { supabase } from './supabase'

/** Tables worth saving, with the columns that give a stable order while paging through them. */
export const BACKUP_TABLES: ReadonlyArray<{ table: string; order: readonly string[] }> = [
  { table: 'teams', order: ['id'] },
  { table: 'roster_entries', order: ['team_id', 'player_id'] },
  { table: 'roster_history', order: ['id'] },
  { table: 'matchdays', order: ['number'] },
  { table: 'fixtures', order: ['id'] },
  { table: 'votes', order: ['matchday', 'player_id'] },
  { table: 'lineups', order: ['matchday', 'team_id', 'slot'] },
  { table: 'results', order: ['fixture_id'] },
  { table: 'tie_decisions', order: ['tie_id'] },
  { table: 'error_reports', order: ['id'] },
]

const PAGE = 1000 // PostgREST returns at most 1000 rows per request

/** Reads every row of a source that serves at most PAGE rows at a time. */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const page = await fetchPage(from, from + PAGE - 1)
    rows.push(...page)
    if (page.length < PAGE) return rows
  }
}

export interface Backup {
  createdAt: string
  tables: Record<string, unknown[]>
}

export async function createBackup(): Promise<Backup> {
  const tables: Record<string, unknown[]> = {}
  for (const { table, order } of BACKUP_TABLES) {
    tables[table] = await fetchAllPages(async (from, to) => {
      let q = supabase.from(table).select('*')
      for (const column of order) q = q.order(column)
      const { data, error } = await q.range(from, to)
      if (error) throw new Error(`${table}: ${error.message}`)
      return data as unknown[]
    })
  }
  return { createdAt: new Date().toISOString(), tables }
}

export const backupFileName = (date: Date) =>
  `fanta-champions-backup-${date.toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`

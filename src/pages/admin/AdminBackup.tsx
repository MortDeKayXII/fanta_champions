import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Card, ErrorBox, Notice, buttonClass } from '../../components/ui'
import { backupFileName, createBackup, type Backup } from '../../lib/backup'

function download(backup: Backup) {
  const blob = new Blob([JSON.stringify(backup, null, 1)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = backupFileName(new Date(backup.createdAt))
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminBackup() {
  const [summary, setSummary] = useState<Array<[string, number]> | null>(null)
  const backup = useMutation({
    mutationFn: createBackup,
    onSuccess: (data) => {
      download(data)
      setSummary(Object.entries(data.tables).map(([table, rows]) => [table, rows.length]))
    },
  })

  return (
    <div className="space-y-4">
      <Card title="Copia di sicurezza">
        <p className="mb-3 text-sm text-slate-600">
          Scarica un file con rose, formazioni, voti, risultati, tabellone e segnalazioni. Il piano
          gratuito di Supabase non fa backup automatici: conviene scaricarne uno dopo ogni giornata
          calcolata e conservarlo fuori dal repository.
        </p>
        <button className={buttonClass} disabled={backup.isPending} onClick={() => backup.mutate()}>
          {backup.isPending ? 'Preparo il file…' : 'Scarica backup'}
        </button>
        {backup.error && (
          <div className="mt-3">
            <ErrorBox>Backup non riuscito: {backup.error.message}</ErrorBox>
          </div>
        )}
        {summary && (
          <div className="mt-3 text-sm">
            <p className="font-semibold text-green-700">Backup scaricato.</p>
            <ul className="mt-1 columns-2 text-slate-600">
              {summary.map(([table, n]) => (
                <li key={table}>
                  {table}: {n}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
      <Notice>
        Il file contiene i voti dei giocatori: tienilo privato e non caricarlo su GitHub. Per
        ripristinare i dati da un backup serve un intervento sul database (chiedimelo e preparo lo
        script).
      </Notice>
    </div>
  )
}

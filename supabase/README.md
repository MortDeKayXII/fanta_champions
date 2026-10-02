# Supabase – messa in opera

Progetto: `jngwqahyfmrmcfenmfhj` (https://supabase.com/dashboard/project/jngwqahyfmrmcfenmfhj)

## 1. Creare le tabelle e caricare i dati (una volta sola)

1. Dashboard → **SQL Editor** → **New query**.
2. Apri `supabase/migrations/0001_schema.sql`, copia tutto il contenuto, incollalo e premi **Run**.
   Risultato atteso: `Success. No rows returned`.
3. Nuova query: apri `supabase/seed.sql`, copia tutto, incolla, **Run**.
4. Controllo: **Table Editor** → `teams` deve avere 30 righe, `players` 535, `roster_entries` 810,
   `fixtures` 120, `matchdays` 17.

Se devi rifare tutto da zero: SQL Editor →
`drop schema public cascade; create schema public;` poi ripeti i passi 2 e 3 (cancella tutti i dati!).

## 2. Creare i 30 utenti

1. Copia `scripts/scripts.env.example` in `.env.scripts` (nella cartella principale del progetto).
2. Compila `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API Keys → chiave **service_role** / **secret**)
   e `INITIAL_PASSWORD`. Questo file è ignorato da git: **non committarlo e non condividere la chiave**.
3. Da terminale, nella cartella del progetto:

   ```
   npm ci
   node --env-file=.env.scripts scripts/create_users.mjs
   ```

4. Controllo: **Authentication → Users** mostra 30 utenti con email `nomesquadra@fanta.invalid`;
   la tabella `profiles` ha 30 righe e `bomberini` ha `is_admin = true`.

Lo script si può rilanciare senza problemi: salta le squadre già collegate.
Se Supabase rifiuta il dominio `fanta.invalid`, avvisami e lo cambio.

## 3. Funzione per il reset password (si può rimandare alla Fase 4)

```
npx supabase login
npx supabase link --project-ref jngwqahyfmrmcfenmfhj
npx supabase functions deploy admin-reset-password
```

Serve solo alla pagina admin per reimpostare la password di una squadra.

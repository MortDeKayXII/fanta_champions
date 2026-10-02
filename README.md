# Fanta Champions

Competizione tra tre leghe fantacalcio (Fanta Montelparo, Fanta Pepe, Fanta Ortezzano) basata sulla Serie A: 30 squadre, fase a gironi di 8 giornate e poi eliminazione diretta (playoff, ottavi, quarti, semifinali, finale).

**Sito:** https://mortdekayxii.github.io/fanta_champions/

## Documentazione

- [Guida per i partecipanti](docs/guida-utente.md)
- [Guida per l'amministratore](docs/guida-admin.md)
- [Piano di implementazione](PLAN.md) (regole, modello dati, fasi di lavoro)
- [Messa in opera di Supabase](supabase/README.md)

## Come è fatto

| Parte | Tecnologia |
|---|---|
| Sito | React + TypeScript + Vite + Tailwind CSS, pubblicato su GitHub Pages |
| Backend | Supabase (Postgres, Auth, Row Level Security, Edge Function) |
| Calcolo | Modulo TypeScript puro in `src/engine` (voti → fantavoti → gol → classifica → tabellone), con test |
| Test | Vitest; i test del database girano su Postgres in-process (PGlite) con lo schema reale |

```
src/engine/      regole: punteggi, gol, classifica, tabellone
src/lib/         accesso ai dati, calcolo di una giornata, lettura del file voti, logica dell'eliminazione
src/pages/       pagine pubbliche e utente;  src/pages/admin/  area amministratore
src/db/          test di schema, permessi (RLS) e flussi admin
supabase/        migrazioni SQL, dati iniziali, Edge Function
scripts/         importazione dati e creazione utenti (uso locale)
data/            rose e calendario importati
docs/            guide
```

## Sviluppo

```
npm ci
cp .env.example .env.local   # poi inserisci la chiave anon di Supabase
npm run dev                  # sito in locale
npm test                     # test
npm run lint
npm run build
```

Il deploy è automatico a ogni push su `main` (GitHub Actions). I segreti del repository `SUPABASE_URL` e `SUPABASE_ANON_KEY` servono al build e al controllo periodico che tiene attivo il database gratuito.

## Riservatezza

- Non vanno mai committati: la chiave `service_role` di Supabase, il file `.env.scripts`, i file dei voti ufficiali (`Voti_Fantacalcio_*.xlsx`, `matchday_*.xlsx`). Sono esclusi da `.gitignore`.
- I voti dei singoli giocatori sono visibili solo agli utenti registrati; la home pubblica mostra solo classifica, calendario e risultati.

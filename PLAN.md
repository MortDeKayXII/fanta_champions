# Fanta Champions – Piano di implementazione

Competizione tra 3 leghe fantacalcio (A = Fanta Montelparo, B = Fanta Pepe, C = Fanta Ortezzano) basata sulla Serie A.
30 squadre, fase a gironi "all'italiana" (8 giornate) + fase a eliminazione diretta.

Legenda: 🧑 = azione che devi fare tu · 🤖 = lo faccio io · 🤝 = insieme.

---

## 1. Regole di dominio

### 1.1 Punteggio di un giocatore
`fantavoto = voto + 3·Gf − Gs + 3·Rp − 3·Rs + 3·Rf − 2·Au − 0.5·Amm − Esp + Ass`
(da `conversion_table.txt`).

- Voto con `*` (senza voto, "s.v.") → il giocatore non conta (0 nel totale).
- Nel codice vecchio, un giocatore marcato `*` in formazione ha −1 sul fantavoto (da confermare in fase di sviluppo, vedi §9).
- Gli allenatori (ruolo `ALL`) nel file voti vengono ignorati.
- I voti si collegano ai giocatori per **ID** (`Cod.` del file voti = `Id` della lista giocatori; verificato).

### 1.2 Risultato di una partita
- Totale squadra = somma dei fantavoti degli 11 in formazione (possono esserci "buchi": slot vuoti valgono 0).
- Gol: `< 66` → 0; altrimenti `⌊(punti − 66) / 4⌋ + 1`.

### 1.3 Fase a gironi
- 8 giornate da 15 partite, calendario fisso da `calendario.pdf` (parsing fatto da me, da verificare a mano).
- Classifica: 3 punti vittoria, 1 pareggio. Ordinamento: **punti, poi punti totali fanta** (come il codice vecchio).
- Le squadre sono colorate per lega (A, B, C) con un accento discreto sul nome.

### 1.4 Fase a eliminazione
- Posizioni 1–8: saltano i playoff. 9–24: giocano i playoff. 25–30: eliminate.
- Playoff (andata/ritorno): 9–24, 10–23, 11–22, 12–21, 13–20, 14–19, 15–18, 16–17.
- Quarti (andata/ritorno): 1 vs v(16–17), 8 vs v(9–24), 5 vs v(12–21), 4 vs v(13–20), 3 vs v(14–19), 6 vs v(11–22), 7 vs v(10–23), 2 vs v(15–18).
- Semifinali (andata/ritorno): [1/8] vs [4/5] e [3/6] vs [2/7]. Finale: gara singola.
- Ogni turno (tranne la finale) è a doppia gara. Passa chi ha più **gol totali**, poi più **punti totali**.
- Se ancora pari: l'admin sceglie il vincitore con un pulsante "Decidi vincitore".
- Le giornate di eliminazione proseguono la numerazione (`matchday_9` ultima dei gironi → `matchday_10` e `_11` = playoff, ecc.).

---

## 2. Stack tecnologico

| Livello | Scelta |
|---|---|
| Frontend | React + TypeScript + Vite, Tailwind CSS, React Router (hash routing per GitHub Pages) |
| Hosting frontend | GitHub Pages, deploy automatico con GitHub Actions |
| Backend | Supabase (free): Postgres, Auth, Row Level Security, Edge Functions |
| Logica di calcolo | Modulo TypeScript puro condiviso (voti → punteggi → gol → classifica → tabellone), con test Vitest |
| Import voti | Parsing `.xlsx` nel browser (SheetJS) nella pagina admin |
| Keep-alive | GitHub Actions schedulato ogni 3 giorni, query leggera sul DB |
| Qualità | ESLint, Prettier, Vitest |

Nessun server da gestire. Tutte le chiavi nel client sono pubbliche per design (anon key); la `service_role` key non va mai nel repo né nel frontend.

---

## 3. Modello dati (Postgres)

| Tabella | Contenuto |
|---|---|
| `players` | id (Id Fantacalcio), nome, ruolo (P/D/C/A), ruoli Mantra, squadra Serie A (535 righe) |
| `teams` | id, nome, slug, lega (A/B/C), user_id |
| `profiles` | user_id, team_id, is_admin |
| `roster_entries` | team_id, player_id, costo |
| `roster_history` | log di ogni modifica (chi, quando, cosa) |
| `matchdays` | numero, fase (gironi/playoff/quarti/semi/finale), leg (andata/ritorno) |
| `fixtures` | matchday, home_team, away_team, slot bracket |
| `votes` | matchday, player_id, voto, Gf, Gs, Rp, Rs, Rf, Au, Amm, Esp, Ass (righe grezze dal file) |
| `lineups` | matchday, team_id, slot 1–11, player_id, nome (snapshot), flag `*` |
| `results` | fixture, punti casa/ospite, gol casa/ospite |
| `player_scores` | matchday, team, player, voto, fantavoto (per il dettaglio partita) |
| `tie_decisions` | tie bracket, team vincitore scelto dall'admin |
| `error_reports` | team, matchday, fixture, player opzionale, testo, stato (aperta/risolta/rifiutata) |

**Regole di accesso (RLS):**
- Lettura pubblica: calendario, risultati, classifica, tabellone (serve alla home per i non loggati).
- Utente: modifica solo la propria rosa e le proprie segnalazioni; legge le proprie segnalazioni.
- Admin: scrive tutto (rose, formazioni, voti, calcolo, decisioni, segnalazioni).
- Le formazioni **non** sono vincolate alla rosa: il selettore giocatori usa tutti i 535 giocatori; la rosa è solo un suggerimento (giocatori della squadra in cima all'elenco).

**Login:** Supabase Auth con email interna `slug-squadra@fanta.invalid`. L'utente scrive il nome squadra (case-insensitive, ignorando accenti e punteggiatura), l'app lo converte nello slug. Password iniziale generica uguale per tutti, cambiabile dal profilo. Nessuna email → nessun "password dimenticata": l'admin la resetta dalla pagina admin (Edge Function con service_role).

---

## 4. Pagine

**Non loggato:** home pubblica (presentazione, classifica, ultimi risultati), calendario, classifica, tabellone, pagina login.
**Loggato:** dashboard (prossima giornata, ultima giornata, mini-classifica, i tuoi punti), rose (tutte, con la tua evidenziata), calendario, dettaglio giornata (formazioni e voti), classifica completa, tabellone, modifica rosa, segnala errore, profilo/cambio password.
**Admin:** gestione rose di tutti, inserimento formazioni per giornata, upload file voti + "Calcola giornata" (ripetibile), decisione vincitori in caso di pareggio, gestione segnalazioni, reset password, generazione giornate di eliminazione.

Stile: tema chiaro, stessa palette blu e stessa struttura delle schermate in `new_version_settings/`, senza loghi, solo italiano.

---

## 5. Fasi di lavoro e cosa serve da te

### Fase 0 – Preparazione account 🧑 (prima di iniziare il codice, ~20 minuti)
1. 🧑 Crea un **account GitHub** se non lo hai, poi crea un **repository pubblico** (es. `fanta-champions`). Non inizializzarlo con file, oppure dimmi se lo hai già fatto.
2. 🧑 Collega la cartella locale al repo (`git init`, `git remote add origin …`); se preferisci lo faccio io quando mi dai l'URL.
3. 🧑 Crea un account su **supabase.com** (login con GitHub va bene) e crea un **nuovo progetto** (free tier). Scegli una regione europea (es. Frankfurt) e **annota la password del database**.
4. 🧑 Da *Project Settings → API* copiami: **Project URL** e **anon public key** (sono pubbliche, puoi incollarle in chat). **Non** darmi la `service_role` key in chat né nel repo: la userai tu in locale (vedi Fase 2).
5. 🧑 Nel repo GitHub: *Settings → Pages → Source: GitHub Actions*.
6. 🧑 Nel repo GitHub: *Settings → Secrets and variables → Actions* aggiungi `SUPABASE_URL` e `SUPABASE_ANON_KEY` (per il keep-alive e il build).
7. 🧑 Decidi la **password generica iniziale** per gli utenti e il **nome squadra/username** che userai come admin.

### Fase 1 – Scaffold e motore di calcolo 🤖
- Progetto Vite + React + TS + Tailwind, routing, CI (lint, test, build, deploy su Pages).
- Modulo di calcolo con test, usando `matchday_1.xlsx` come dati di esempio.
- Parser del calendario PDF → `data/calendar.json`. 🤝 Tu verifichi che le partite siano corrette.
- Script `join_rosters.mjs` (già fatto → `data/rosters.json`).

### Fase 2 – Database, auth, import dati 🤖 + 🧑
- 🤖 Migrazioni SQL (tabelle, RLS) e seed di giocatori, squadre, rose, calendario.
- 🧑 Esegui le migrazioni: nella *SQL Editor* di Supabase incolli il file che ti preparo (oppure usi la Supabase CLI, ti guido io).
- 🤖 Script locale di creazione dei 30 utenti con password generica e profilo admin.
- 🧑 Lanci lo script sul tuo PC con la `service_role` key (da *Project Settings → API*) come variabile d'ambiente; non va mai committata.
- 🧑 In *Authentication → Providers → Email* disattiva "Confirm email" (necessario perché le email sono fittizie).
- 🤖 Edge Function per il reset password. 🧑 La pubblichi con la CLI (`supabase functions deploy`), ti guido passo passo.

### Fase 3 – Pagine pubbliche e utente 🤖
Home pubblica/loggata, calendario, classifica, dettaglio giornata, rose, modifica rosa con storico, segnalazione errori, profilo. Colori per lega.

### Fase 4 – Pagina admin 🤖
Gestione rose, inserimento formazioni, upload voti con numero di giornata, calcolo ripetibile, gestione segnalazioni, reset password, decisione pareggi.
🧑 Test con dati reali: inserisci qualche formazione, carica un file voti, controlla i risultati rispetto al vecchio sistema.

### Fase 5 – Eliminazione diretta 🤖
Generazione tabellone dalla classifica finale, giornate andata/ritorno, calcolo del turno, avanzamento automatico, pulsante vincitore manuale.
🧑 Mi mandi il link di corrispondenza giornate Serie A ↔ giornate Champions e i file voti man mano.

### Fase 6 – Rifinitura, keep-alive e guide 🤖
- Workflow di keep-alive (cron ogni 3 giorni + avvio manuale).
- Guida utente e guida admin in italiano (`docs/`).
- Controlli finali: accessibilità, mobile, prestazioni.
- 🧑 Comunichi agli utenti URL del sito, nome utente (= nome squadra) e password iniziale.

---

## 6. Flusso d'uso durante la stagione

1. 🧑 Scarichi il file voti della giornata Serie A.
2. 🧑 In admin inserisci le formazioni finali dei 30 team per la giornata Champions corrispondente.
3. 🧑 Carichi il file voti indicando il numero della giornata Champions (es. `matchday_10`).
4. 🧑 Premi "Calcola": risultati, classifica e dettaglio si aggiornano. Puoi ripetere il calcolo quando vuoi (correzioni, scambi di rosa, segnalazioni accolte).
5. 🧑 Controlli le segnalazioni aperte e le chiudi.

## 7. Repository

```
fanta_champions/
  PLAN.md
  data/            rosters.json, calendar.json
  scripts/         import e creazione utenti (uso locale)
  supabase/        migrazioni SQL, Edge Functions
  src/             app React, src/engine = motore di calcolo testato
  docs/            guida utente e admin
  .github/workflows/  deploy.yml, keepalive.yml
```

## 8. Rischi e note

- **Pausa Supabase free** dopo ~7 giorni di inattività: mitigata dal keep-alive. GitHub disattiva i workflow schedulati dopo 60 giorni senza commit: basta riattivarlo dalla tab Actions o fare un commit.
- **Repository pubblico**: le rose sono visibili a tutti; nessun dato personale è presente.
- **Nessun recupero password via email**: il reset passa dall'admin.
- **Nomi giocatori** nelle rose sono stati collegati per nome alla lista completa: tutti e 810 i collegamenti riusciti. Se la lista cambia, rilanciare `scripts/join_rosters.mjs`.
- **Il file voti** è di uso personale (nota di copyright nel file): il repo non deve contenere file voti ufficiali. Vanno nel `.gitignore`; sono caricati solo tramite la pagina admin.

## 9. Punti da confermare durante lo sviluppo

- Significato esatto del `*` in formazione (−1 come nel codice vecchio?).
- Trattamento di un giocatore in formazione senza voto (0, in attesa di tua gestione a mano, come oggi).
- Numerazione definitiva delle giornate di eliminazione (`matchday_10 … matchday_17` o altro schema).
- Corrispondenza giornate Serie A ↔ Champions (link che mi invierai).

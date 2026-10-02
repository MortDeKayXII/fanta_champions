# Fanta Champions – Guida per l'amministratore

Questa guida è per chi gestisce la competizione (account con permessi di amministratore). Le regole e le pagine viste dai partecipanti sono nella [guida utente](guida-utente.md).

L'area admin è nel menu **Admin** (visibile solo a te) e ha sette sezioni: Formazioni, Voti e calcolo, Eliminazione, Rose, Segnalazioni, Squadre, Backup.

---

## 1. Il ciclo di ogni giornata

Per ogni giornata della competizione:

1. **Formazioni** – inserisci le 11 di ciascuna squadra (30 squadre = 15 partite).
2. **Voti e calcolo** – carica il file dei voti e salva.
3. **Voti e calcolo** – premi **Calcola giornata**.
4. Controlla i messaggi "Da controllare" e, se serve, correggi e ricalcola.

Puoi ripetere il calcolo quante volte vuoi: i risultati vengono sovrascritti e la classifica si aggiorna da sola.

I numeri delle giornate sono quelli della competizione, non della Serie A:

| Giornate | Fase |
|---|---|
| 1–8 | Fase a gironi |
| 9 e 10 | Playoff (andata, ritorno) |
| 11 e 12 | Ottavi di finale |
| 13 e 14 | Quarti di finale |
| 15 e 16 | Semifinali |
| 17 | Finale |

---

## 2. Formazioni

**Admin → Formazioni**.

1. Scegli la **giornata** in alto. Vedi le 15 partite; quelle con entrambe le formazioni salvate sono segnate con ✓.
2. Apri una partita: a sinistra e a destra ci sono le due squadre con 11 slot ciascuna.

### Importare le formazioni da file (consigliato)
In cima alla pagina, nel riquadro **Importa da file**, carichi l'export delle formazioni di una lega dell'app originale (per esempio `fanta-pepe_formazioni_m1.xlsx`). Un file contiene le 10 squadre di quella lega, quindi per una giornata ne importi tre (una per lega). Il file non viene salvato: viene solo letto nel tuo browser.

1. Scegli in alto la **giornata della competizione** di destinazione (il numero "Giornata N" scritto nel file è quello della lega originale e non conta).
2. Scegli il file. Le squadre vengono riconosciute dal **nome**; quelle non riconosciute vengono elencate e saltate.
3. Scegli cosa importare:
   - **Schieramento iniziale**: i 11 titolari come schierati, prima delle partite. Serve per far vedere agli utenti contro chi giocano.
   - **Formazione finale**: applica le sostituzioni fatte dall'app originale. Nel file i giocatori in **grigio** sono quelli che non sono entrati nel punteggio; chi era SV viene sostituito dal panchinaro entrato.
4. Controlla l'anteprima (apri una squadra per vedere i 11, le sostituzioni e gli avvisi) e premi **Importa**.

**Sostituzioni massime.** In questa competizione sono **3**; alcune leghe originali ne ammettono fino a 5. Con "Formazione finale" vengono applicate solo le prime N sostituzioni (nell'ordine della panchina) e le altre vengono ignorate: l'anteprima le elenca come "Non applicate", e il titolare che le avrebbe lasciate resta in campo. Il numero N si può cambiare prima di importare.

**Sovrascrittura.** Importare di nuovo la stessa giornata **sostituisce** la formazione delle squadre presenti nel file: puoi quindi caricare gli schieramenti iniziali prima delle partite e, a partite finite, il file con le formazioni finali. Il malus **−1 fuori ruolo** che avevi già impostato a mano resta se quel giocatore è ancora in formazione. I punteggi già calcolati vengono azzerati: dopo l'importazione finale premi **Calcola giornata**.

Avvertenze:
- Il file non segna i giocatori fuori ruolo: il −1 lo imposti tu dopo l'importazione.
- Il "Totale" che vedi nel file originale può includere un **modificatore** (es. "Modificatore difesa") che qui non viene applicato: i punteggi calcolati dal sito possono quindi differire dal totale dell'app originale.
- Un giocatore con un nome diverso da quello della lista giocatori viene lasciato vuoto e segnalato: sceglilo a mano nello slot.
- Il file contiene anche voti ufficiali: non va messo nel repository (è escluso da `.gitignore`).

### Inserire un giocatore
Clicca su uno slot: si apre la ricerca. Scrivi parte del nome, oppure filtra per **ruolo Mantra** (ad esempio solo `DC`; l'elenco segue l'ordine della legenda: P, DS, DC, DD, B, E, M, C, W, T, A, PC) o con **Solo rosa**. I giocatori della rosa vengono prima e sono marcati "in rosa".

**Le formazioni non sono legate alla rosa**: puoi scegliere qualsiasi giocatore (lo slot segnala "non in rosa" come promemoria). Così una giornata passata si può ricalcolare anche se nel frattempo la rosa è cambiata.

### Incollare un elenco (molto più veloce)
Premi **Incolla elenco**, incolla i nomi uno per riga (o separati da virgola) e premi **Applica**:
- Il confronto ignora maiuscole e accenti e accetta nomi parziali (`Lautaro` non funziona perché nella lista c'è `Martinez L.`: usa il nome come scritto nella lista giocatori).
- Se un nome ha più corrispondenze vince il giocatore della rosa; se resta ambiguo o non si trova, lo slot resta vuoto e sotto compare l'elenco **Da controllare** da sistemare a mano.
- Un **`*` dopo il nome** mette il giocatore "fuori ruolo" (−1), come nel vecchio foglio.

### Fuori ruolo e buchi
- La casella **−1** accanto al giocatore applica il malus di fuori ruolo: la decidi tu.
- Puoi lasciare slot **vuoti** (per esempio se non ci sono abbastanza giocatori con voto): valgono 0.
- Nessun controllo su moduli o ruoli.

### Salvare
**Salva formazione** (per ciascuna squadra). Modificare una formazione già calcolata azzera i suoi punteggi finché non ricalcoli la giornata.

---

## 3. Voti e calcolo

**Admin → Voti e calcolo**. Scegli prima la **giornata della competizione** a cui il file si riferisce.

### 1. File dei voti
1. Carica il file `.xlsx` dei voti.
2. Il foglio usato è **«Italia»** (Redazione Italia); viene scelto in automatico e lo vedi scritto sopra l'anteprima. Puoi cambiarlo dal menu "Foglio da usare". Gli altri fogli (Fantacalcio, Statistico) non si usano.
3. L'anteprima mostra quanti giocatori ha letto, quanti senza voto (s.v. o `6*`) e quanti allenatori ha ignorato.
4. **Salva voti per la giornata N**. Se c'erano già dei voti per quella giornata vengono **sostituiti**.

Il file dei voti è ad uso personale: non va mai messo nel repository (è già escluso da `.gitignore`).

### 2. Calcolo
**Calcola giornata N** usa le formazioni e i voti salvati e scrive risultati e punteggi di ogni giocatore. Dopo il calcolo vedi i risultati e un elenco **Da controllare**:
- giocatori che non sono nel file dei voti (valgono 0);
- giocatori senza voto;
- formazioni con meno di 11 giocatori;
- partite **saltate** perché manca la formazione di una squadra: non vengono mai calcolate come 0–0.

### Correzioni
Per correggere un voto o una formazione: sistema la formazione o ricarica il file dei voti, poi premi di nuovo **Calcola giornata**.

### Azzera la giornata
Cancella risultati, voti e punteggi calcolati della giornata, lasciando le formazioni. Serve per fare prove o ripartire da zero.

---

## 4. Eliminazione diretta

**Admin → Eliminazione**. I turni **non** si creano da soli: li crei tu quando il turno precedente è concluso.

1. **Fine gironi**: quando tutte le 8 giornate sono calcolate, premi **Crea Playoff**. Gli accoppiamenti seguono la classifica finale: 9ª–24ª, 10ª–23ª, 11ª–22ª, 12ª–21ª, 13ª–20ª, 14ª–19ª, 15ª–18ª, 16ª–17ª. Se mancano dei risultati ti viene chiesta conferma.
2. Inserisci formazioni, voti e calcola le giornate **9** (andata) e **10** (ritorno) come per le giornate normali.
3. Quando entrambe le gare sono calcolate, il vincitore avanza da solo. Premi **Crea Ottavi di finale**: le prime 8 incontrano i vincitori dei playoff (1ª contro v(16–17), 8ª contro v(9–24), 5ª contro v(12–21), 4ª contro v(13–20), 3ª contro v(14–19), 6ª contro v(11–22), 7ª contro v(10–23), 2ª contro v(15–18)).
4. Prosegui allo stesso modo con quarti (giornate 13–14), semifinali (15–16) e finale (17, gara singola).

Nel tabellone la 1ª e la 2ª si possono incontrare solo in finale.

### Chi passa il turno
Passa chi ha più **gol totali**, poi più **punti fanta totali**. Se c'è ancora parità, in **Parità da decidere** compaiono due bottoni "Passa <squadra>": scegli tu il vincitore. Puoi annullare la decisione dall'elenco "Decisioni prese".

### Errori
**Elimina <turno>** rimuove l'ultimo turno creato con le sue partite e i suoi risultati (le formazioni restano). Una volta creato, un turno **non cambia** anche se poi correggi la classifica dei gironi: se serve, eliminalo e ricrealo.

---

## 5. Rose

**Admin → Rose**: scegli la squadra e modifica la rosa come farebbe il proprietario (aggiungi, rimuovi, cambia il costo). Ogni modifica finisce nello storico con l'autore.

Aggiungere un giocatore che **non è nella lista** (ad esempio un nuovo acquisto a stagione in corso) richiede un inserimento nel database; vedi il paragrafo "Manutenzione".

---

## 6. Segnalazioni

**Admin → Segnalazioni**: elenco delle segnalazioni dei partecipanti (di default solo quelle aperte), con squadra, giornata, partita e giocatore.

Per ciascuna scegli lo stato (**Aperta**, **Risolta**, **Respinta**), scrivi se vuoi una risposta per l'utente e premi **Salva**. Se la segnalazione è fondata, correggi formazioni o voti e ricalcola la giornata.

---

## 7. Squadre e password

**Admin → Squadre**: per ogni squadra scrivi una nuova password (almeno 8 caratteri) e premi **Reimposta**. Comunicala all'utente, che potrà cambiarla dal proprio Profilo.

Questa funzione richiede che la funzione `admin-reset-password` sia pubblicata su Supabase (una volta sola):

```
npx supabase login
npx supabase link --project-ref jngwqahyfmrmcfenmfhj
npx supabase functions deploy admin-reset-password
```

---

## 8. Manutenzione

### Il sito o i dati non si caricano (Supabase in pausa)
I progetti gratuiti di Supabase vengono messi in pausa dopo circa 7 giorni di inattività. Il workflow **Supabase keep-alive** di GitHub lo evita leggendo una riga dal database ogni 3 giorni.
- Controllo: repository → **Actions** → *Supabase keep-alive* deve avere esecuzioni recenti in verde.
- GitHub spegne i workflow programmati dopo 60 giorni senza commit: se accade, apri Actions → *Supabase keep-alive* → **Run workflow** (riattiva anche la programmazione).
- Se il progetto è già in pausa, dalla dashboard di Supabase premi **Restore project**.

### Pubblicare modifiche al sito
Ogni `push` sul ramo `main` ricostruisce e pubblica il sito (scheda **Actions** → *Deploy to GitHub Pages*). Se il controllo (lint, test, build) fallisce, il sito precedente resta online.

### Aggiungere un giocatore mancante
Dal **SQL Editor** di Supabase:

```sql
insert into players (id, name, role, mantra_roles, serie_a_team)
values (9999, 'Cognome N.', 'C', 'C;T', 'Milan');
```

`id` è il codice Fantacalcio (lo stesso della colonna `Cod.` del file voti), `role` è P/D/C/A, `mantra_roles` i ruoli Mantra separati da `;`.

### Copia di sicurezza
Il piano gratuito non ha backup automatici. In **Admin → Backup** premi **Scarica backup**: ottieni un file `.json` con rose (e storico), formazioni, voti, risultati, tabellone, decisioni e segnalazioni. Conviene farlo dopo ogni giornata calcolata e conservare il file **fuori dal repository** (contiene i voti dei giocatori; il nome `fanta-champions-backup-*.json` è comunque escluso da git). Il ripristino da un backup richiede un intervento sul database: chiedi uno script di ripristino quando serve.

### Nuovi utenti o password
Gli account si creano con `scripts/create_users.mjs` (vedi `supabase/README.md`); lo script salta le squadre già collegate. La chiave `service_role` resta solo sul tuo computer, nel file `.env.scripts` che non va mai committato.

---

## 9. Se qualcosa non va

| Problema | Cosa fare |
|---|---|
| "Calcola giornata" non attivo | Prima salva il file dei voti per quella giornata. |
| Una partita non viene calcolata | Manca la formazione di una delle due squadre (è nell'elenco "Da controllare"). |
| Un giocatore vale 0 | Non è nel file dei voti o è senza voto; controlla di aver scelto il foglio «Italia». |
| Non trovo un giocatore nella ricerca | Cerca il nome come scritto nella lista Fantacalcio (es. `Martinez L.`), oppure aggiungilo al database. |
| Un utente non riesce ad accedere | Imposta una nuova password da **Admin → Squadre**. |
| "Reimposta" dà errore | La funzione `admin-reset-password` non è pubblicata (vedi punto 7). |
| Risultati strani dopo una modifica | Rilancia **Calcola giornata**: ricostruisce tutto da formazioni e voti salvati. |

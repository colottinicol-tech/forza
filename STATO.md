# Stato del progetto Forza (aggiornato il 2026-10-22)

## Completato
- **Fase 1**, verificata sull'iPhone: PWA installabile, icona, schermo intero, offline, banner «Aggiorna», avviso Safari,
  dati protetti. Correzione per la tab bar sollevata in iOS 26 (versione 0.1.1). Online su
  https://colottinicol-tech.github.io/forza/ con pubblicazione automatica a ogni push.
- **Fase 2, logica** in `src/lib/`, con 44 test che passano (`npm test`):
  - `weights.ts`: arrotondamento (vicino / a pari distanza per difetto / per eccesso / sempre per difetto), e1RM, calcolatore dischi.
  - `program531.ts`: settimane del ciclo (originale con scarico ogni N cicli, Forever Leader/Anchor + 7ª settimana),
    set pianificati (riscaldamento, lavoro, FSL per settimana), ripeti / settimana extra / salta, proposta del nuovo TM
    con regole a soglie.
  - `session.ts`: creazione del workout dal giorno, recuperi per posizione del set (prima/dopo il set "+", FSL 2' o 2'30"),
    superset, chiusura del workout (avanzamento dei principali e del giorno, microcicli).
  - `records.ts`: record di e1RM (set "+" = reps + bonus) e di reps a parità di peso.
  - `importSchema.ts`: formato JSON "forza-import" v1, validazione con errori in italiano, anteprima delle modifiche.
  - `dataio.ts`: applicazione dell'import, backup (esporta / leggi / ripristina), condivisione con il menu di iOS.
  - `db.ts` (Dexie), `hooks.ts`, `timer.ts` (timer basato su timestamp + suono), `defaults.ts`, `types.ts`.
- **Fase 2, interfaccia** (compila, ma NON ancora provata nel browser):
  - `components/controls.tsx`: pulsanti, Stepper, scelte a pillole, Sheet, conferma, interruttore.
  - `ExerciseEditor`, `ExercisePicker`, `PlateCalculator`, `RestTimerBar`.
  - `screens/Workout.tsx`: workout attivo completo (spunta, set "+" con e1RM, modifica set, RPE, ultima volta, record,
    note, aggiungi/togli/sostituisci/sposta, superset, dischi, fine workout con riepilogo e RPE della sessione).
  - `screens/Oggi.tsx`: prossimo giorno, avvio del workout, altro giorno, conferma del nuovo TM, promemoria backup.
- Programma di Nicolò salvato in `privato/programma.md` (cartella esclusa da git). Pesi verificati con l'arrotondamento.

## Resta da fare (fase 2)
1. **App.tsx**: mostrare `RestTimerBar` sopra la tab bar quando c'è un workout attivo (padding in fondo
   `+ TIMER_BAR_HEIGHT`) e nascondere `UpdateBanner` durante il workout.
2. **screens/Programma.tsx**, ancora il segnaposto della fase 1:
   - esercizi principali con posizione e TM;
   - pannello del principale: TM con storico, ripeti / extra / salta, template, scarico ogni N cicli, FSL per settimana,
     regole del TM, recuperi;
   - giorni (aggiungi, rinomina, ordina, elimina, imposta come prossimo, esercizi pianificati con set/reps/range/peso/
     RPE max/recupero/superset/note);
   - elenco esercizi con `ExerciseEditor`;
   - aggiungi un esercizio principale.
3. **screens/Storico.tsx**: posizione nei cicli per ogni principale, calendario con i giorni completati, elenco delle
   sessioni e dettaglio (set, reps, RPE, note), eliminazione.
4. **screens/Impostazioni.tsx**: arrotondamento, bilanciere, dischi, riscaldamento, incrementi upper/lower, bonus reps
   set "+", recupero complementari, suono. Dati: esporta backup, importa backup, «Importa da Claude» (incolla / scegli
   file → controlla → anteprima → applica).
5. **Onboarding** alla prima apertura (`settings.onboarded`): unità kg, arrotondamento, bilanciere, dischi.
6. **PROGRAM_SCHEMA.md** con lo schema e un esempio completo (dati finti), basato su `importSchema.ts`.
7. Convertire `privato/programma.md` in `privato/programma.json`: panca e squat come lift, giorni A / B / Gambe, campi
   [DA COMPLETARE] a null, squat con `awaitingTmReview: { s3PlusReps: 5 }`, `plusRepsBonus: 1`, `deloadEvery: 2`.
8. Prova completa nel browser a 390 px (chiaro e scuro), versione 0.2.0, README, push e prova sull'iPhone.

## Decisioni in sospeso (da chiedere a Nicolò)
- **Mappa muscoli**: il testo incollato si interrompe a «Valori da usare come». Per ora si usano i valori della tabella
  del progetto (`defaults.ts` → `suggestMuscles`).
- **Storico del ciclo 1** (set già fatti di panca e squat): caricarlo nell'app? Non ha date, andrebbero stimate.
- **Allineamento squat / panca**: lo decide lui più avanti con i comandi dell'app.
- Scelte fatte da me, da confermare: recupero prima del set "+" = 3' (lui ha scritto 3-4'); complementari dimezzati
  quando un principale è nella settimana di scarico; trazioni assistite con incremento 2,5.

## Da dove ripartire
Dal punto 1, poi il punto 2 (`screens/Programma.tsx`). Le API da usare sono già pronte in `src/lib/`
(`repeatLastWeek`, `insertExtraWeek`, `skipWeek`, `setTm`, `positionLabel`, `ExerciseEditor`, `ExercisePicker`).
Prima del push: `npx tsc -b`, `npm test`, `npm run build`.

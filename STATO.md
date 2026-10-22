# Stato del progetto Forza (aggiornato il 2026-10-22, sera)

## Completato
- **Fase 1**, verificata sull'iPhone: PWA installabile, offline, banner «Aggiorna», avviso Safari, tab bar corretta
  su iOS 26. Online su https://colottinicol-tech.github.io/forza/ con pubblicazione automatica a ogni push.
- **Fase 2 (versione 0.2.0)**, provata nel browser a 390 px, in chiaro e in scuro:
  - Primo avvio: unità, arrotondamento, bilanciere, dischi.
  - Oggi: prossimo giorno in sequenza, avvio del workout, scelta di un altro giorno, conferma/modifica del nuovo TM,
    promemoria del backup dopo 14 giorni.
  - Workout attivo: spunta con un tocco, set «+» con reps in più ed e1RM, modifica peso/reps/RPE (il peso nuovo passa ai
    set successivi), «ultima volta» separata per ruolo, record, note, aggiungi/togli/sostituisci/sposta, superset,
    calcolatore dischi, timer di recupero in basso (basato su timestamp, −15/+15, suono), schermo sempre acceso,
    riepilogo finale con RPE della sessione. Il workout sopravvive alla chiusura dell'app.
  - Programma: principali (TM con storico, ripeti / extra / salta, originale o Forever, scarico ogni N cicli, FSL per
    settimana, soglie del TM, recuperi), giorni (crea, rinomina, ordina, elimina, prossimo, esercizi pianificati),
    esercizi (con coefficienti muscolari proposti).
  - Storico: posizione nei cicli, calendario con ✓, elenco e dettaglio delle sessioni, eliminazione.
  - Impostazioni: esporta/importa backup, «Importa da Claude», arrotondamento, dischi, riscaldamento, incrementi, bonus
    reps dei set «+», recupero dei complementari, suono, stato dell'app.
  - `PROGRAM_SCHEMA.md`: schema ed esempi (controllati da un test automatico).
  - Il programma di Nicolò è in `privato/programma.json` (escluso da git) e supera il controllo dell'app.
- 46 test automatici sulla logica (`npm test`).

## Resta da fare
- Prova di Nicolò sull'iPhone della versione 0.2.0 e import del suo programma (fine fase 2).
- **Fase 3**: doppia progressione dei complementari (suggerimento di aumento, stallo dopo 3 settimane), mesociclo dei
  complementari, volume per muscolo e intensità (dashboard), grafici, peso corporeo da Oggi.
- **Fase 4**: «Esporta per Claude»; «Chiedi a Claude» solo se Nicolò lo vuole (API a pagamento).

## Decisioni in sospeso
- **Mappa muscoli**: il testo si interrompe a «Valori da usare come». Per ora valgono i coefficienti in `programma.json`.
- **Storico del ciclo 1** (set già fatti): caricarlo? Non ha date.
- Scelte da confermare: recupero prima del set «+» 3' (lui ha scritto 3-4'); complementari a metà set quando un
  principale è in scarico; incremento delle trazioni assistite 2,5; prossimo giorno = Giorno A.

## Da dove ripartire
Dopo il suo ok sulla fase 2: fase 3, partendo dalla doppia progressione (`PlannedExercise.repMin/repMax/rpeMax` ci sono
già) e dal volume per muscolo (`Exercise.muscles`, `countsForVolume`).

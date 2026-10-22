# Stato del progetto Forza (aggiornato il 2026-10-22)

## Completato
- **Fase 1**: PWA installabile, offline, banner «Aggiorna», avviso Safari. Online su
  https://colottinicol-tech.github.io/forza/ con pubblicazione automatica a ogni push.
- **Versione 0.3.0: rifatta più semplice su richiesta di Nicolò** («deve essere come una nota»):
  - Home = **Ciclo → settimane (S1, S2, S3, S4 scarico) → giorni** con il pallino come nelle Note. Tocchi un giorno,
    vedi cosa fare (riscaldamento, 5/3/1, FSL, complementari, dischi), alla fine **Fatto ✓**. Chiede solo le reps del set
    «+» (servono per il nuovo TM). Mostra il ciclo attuale, il prossimo e, appena finito, quello vecchio.
  - **Tutti gli esercizi avanzano insieme**: una sola posizione (`settings.position`) e una sola struttura dei cicli
    (`settings.cycleConfig`, scarico ogni N cicli o Forever). Spuntati tutti i giorni si passa alla settimana dopo; finita
    la S3 l'app propone i nuovi TM. «Togli la spunta» funziona anche sull'ultimo giorno di una settimana.
  - **Tab bar in stile iOS 26**: pillola di vetro che galleggia (`.glass` in `index.css`).
  - Tolti il workout serie per serie e il timer di recupero (troppo complicati per lui).
  - Programma: «Dove sei» (ripeti / extra / salta, scarico ogni N cicli), TM con FSL e soglie, giorni, esercizi.
  - Import: `position` e `settings.deloadEvery` a livello di programma (`PROGRAM_SCHEMA.md` aggiornato e controllato da
    un test). Le posizioni dentro i singoli esercizi ora sono un errore.
- 47 test automatici sulla logica (`npm test`).

## In sospeso
- **Il programma di Nicolò**: ora ha 4 giorni (Upper A, Lower A, Upper B, Lower B). Servono i loro esercizi per rifare
  `privato/programma.json` nel nuovo formato. La bozza Gmail «Forza – programma da importare» è nel formato VECCHIO:
  non va più bene, da sostituire.
- Mappa muscoli (il testo si interrompeva), storico del ciclo 1 sì/no.

## Da dove ripartire
Appena arriva il programma a 4 giorni: nuovo `privato/programma.json` (formato attuale), controllo con il validatore,
nuova bozza Gmail, poi prova sull'iPhone. Dopo il suo ok: fase 3 (doppia progressione, volume, grafici).

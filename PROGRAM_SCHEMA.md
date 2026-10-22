# Forza – formato JSON per «Importa da Claude»

> **Per Claude (in chat):** l'utente usa l'app per iPhone *Forza* (5/3/1 + complementari). Quando ti chiede un
> programma, una modifica ai Training Max o nuovi complementari, rispondi con **un solo blocco ```json** che rispetta
> questo schema. L'utente lo copia e lo incolla nell'app (Impostazioni → Importa da Claude): l'app controlla il JSON,
> mostra un'anteprima e applica le modifiche solo dopo la sua conferma. Se l'app segnala errori, l'utente te li incolla:
> correggi e rimanda il JSON completo.

## Come funziona l'app
- Il programma è come una nota: **Ciclo → Settimana (S1, S2, S3, eventuale S4 di scarico) → i giorni della settimana**.
- **Ogni settimana si fanno tutti i giorni** in `days` (es. Upper A, Lower A, Upper B, Lower B). Quando sono tutti spuntati
  si passa alla settimana dopo.
- **Tutti gli esercizi principali sono sempre nella stessa settimana**: la posizione è una sola (`position`).
- I pesi dei principali li calcola l'app dal Training Max. A fine S3 propone il nuovo TM in base alle reps del set «+».

## Regole generali
- Pesi in **kg**, numeri con il **punto** decimale (`92.5`, non `92,5`). Niente commenti dentro il JSON.
- Campi obbligatori in ogni import: `"format": "forza-import"` e `"version": 1`.
- Tutte le altre sezioni sono facoltative: metti solo quello che cambia.
- Gli `id` sono testi brevi senza spazi (es. `"panca"`, `"lat-machine"`). Lo stesso id indica sempre lo stesso esercizio:
  riusa gli id che l'utente ti ha già dato, così lo storico resta collegato.
- `null` = **da completare nell'app** (l'utente lo inserirà lui). Usalo invece di inventare un valore.

## `mode`
- `"merge"` (predefinito): aggiunge o aggiorna solo ciò che è nel JSON.
- `"replace"`: sostituisce **giorni ed esercizi principali** con quelli del JSON (servono `days`). Lo storico e gli
  esercizi già esistenti restano.

## `settings` (facoltativo)
| Campo | Significato | Valori |
|---|---|---|
| `deloadEvery` | Settimana di scarico (S4) ogni N cicli | `1` = a ogni ciclo, `2` = ogni due cicli |
| `template` | Schema dei cicli | `"original"` (S1-S3 + scarico) o `"forever"` (Leader/Anchor con 7ª settimana) |
| `leaderCycles` / `anchorCycles` / `seventhWeek` | Solo `forever`: cicli Leader, cicli Anchor, 7ª settimana | numeri; `"deload"` o `"tmtest"` |
| `roundingStep` | Arrotondamento dei pesi calcolati dal TM | es. `2.5` |
| `roundingMode` | Come arrotondare | `"nearest-down"` (al più vicino, a pari distanza per difetto), `"nearest-up"`, `"down"` |
| `plusRepsBonus` | Reps da aggiungere ai set «+» per stimare l'e1RM | `0` (set a cedimento), `1` (set chiusi a RPE 9) |
| `upperIncrement` / `lowerIncrement` | Aumento standard del TM a fine ciclo | es. `2.5` / `5` |
| `barWeight` | Peso del bilanciere | es. `20` |
| `warmup` | Riscaldamento dei principali | lista di `{ "pct": 0.4, "reps": 5 }` (pct = frazione del TM) |

## `position` (facoltativo): da dove si parte
`{ "cycle": 1, "week": "S3" }`. `week`: `S1`, `S2`, `S3`, `DELOAD`, `SEVENTH_DELOAD`, `SEVENTH_TEST`.
Aggiungi `"extra": true` per una settimana fuori sequenza (es. uno scarico in un ciclo che non lo prevede).

## `exercises`: elenco degli esercizi
| Campo | Obbl. | Significato |
|---|---|---|
| `id` | sì | Identificativo unico |
| `name` | sì | Nome mostrato nell'app |
| `barbell` | | `true` se si usa il bilanciere (attiva il calcolatore dischi) |
| `loadType` | | `"normal"` (peso), `"assisted"` (il peso è l'assistenza: progredire = scendere), `"weighted"` (zavorra sul corpo) |
| `bodyPart` | | `"upper"` o `"lower"` (decide l'aumento standard del TM) |
| `increment` | | Aumento di peso per la progressione, kg |
| `restSec` | | Recupero, secondi |
| `muscles` | | Mappa muscolo → `1` (diretto) o `0.5` (indiretto). Nomi: petto, dorsali, dorso alto, deltoide anteriore, deltoide laterale, deltoide posteriore, bicipiti, tricipiti, avambracci, quadricipiti, femorali, glutei, adduttori, erettori, polpacci, addominali |
| `countsForVolume` | | `false` per esercizi che non devono contare nel volume (es. riabilitativi) |
| `notes` | | Note fisse (es. `"fermo di 1\" al petto"`) |

## `lifts`: esercizi principali 5/3/1 (uno per esercizio)
| Campo | Obbl. | Significato |
|---|---|---|
| `exerciseId` | sì | Id dell'esercizio (deve esistere in `exercises` o già nell'app) |
| `tm` | sì | Training Max attuale, kg |
| `fsl` | | FSL per settimana: `{ "S1": { "sets": 3, "reps": 5 }, "S2": {...}, "S3": {...} }`. Settimana assente = niente FSL. Peso = primo set |
| `tmRules` | | Nuovo TM a fine ciclo in base alle reps del set «+» della S3: lista di `{ "minReps": 4, "increment": 5 }`. Vale la soglia più alta raggiunta; sotto tutte le soglie il TM resta uguale. Assente = regola standard |
| `awaitingTmReview` | | Ciclo appena finito, TM da rivedere: `{ "s3PlusReps": 5 }` (reps del set «+» della S3). L'app propone il nuovo TM e l'utente lo conferma |

Percentuali (fisse nell'app): S1 65/75/85% × 5/5/5+ · S2 70/80/90% × 3/3/3+ · S3 75/85/95% × 5/3/1+ · scarico
40/50/60% × 5 · 7ª scarico 70% × 5, 80% × 3-5, 90% × 1, 100% × 1 · 7ª test 70/80/90/100% × 5.

## `tmChanges`: solo cambiare il TM
Lista di `{ "exerciseId": "squat", "tm": 120, "reason": "test del 1RM" }`.

## `days`: i giorni della settimana, in ordine
Ogni giorno: `{ "id", "name", "exercises": [...] }`. Ogni esercizio del giorno:

| Campo | Significato |
|---|---|
| `exerciseId` | Id dell'esercizio |
| `role` | `"main531"` (pesi calcolati dal TM: serve una voce in `lifts`) o `"accessory"` |
| `sets`, `reps` | Solo complementari: set e reps (`null` = da completare) |
| `weight` | Peso (per `assisted` è l'assistenza, per `weighted` la zavorra; `null` = da completare) |
| `repMin`, `repMax` | Range della doppia progressione (es. 8 e 12; reps fisse: stesso numero) |
| `rpeMax` | RPE massimo per aumentare il peso (default 9) |
| `progression` | `"double"` (doppia progressione) o `"none"` (peso fisso) |
| `superset` | Lettera (`"A"`, `"B"`…): esercizi con la stessa lettera si fanno alternati |
| `notes` | Note |

Lo stesso esercizio può comparire in giorni diversi con ruoli diversi (es. principale 5/3/1 un giorno e complementare
4×8 un altro). Nella settimana di scarico l'app dimezza da sola i set dei complementari.

## Esempio completo (dati di esempio)
```json
{
  "format": "forza-import",
  "version": 1,
  "mode": "replace",
  "settings": { "deloadEvery": 2, "roundingStep": 2.5, "roundingMode": "nearest-down", "plusRepsBonus": 1 },
  "position": { "cycle": 1, "week": "S1" },
  "exercises": [
    { "id": "stacco", "name": "Stacco da terra", "barbell": true, "bodyPart": "lower", "increment": 5,
      "muscles": { "femorali": 1, "glutei": 1, "erettori": 1, "dorso alto": 0.5 } },
    { "id": "military", "name": "Military press", "barbell": true, "bodyPart": "upper", "increment": 2.5,
      "muscles": { "deltoide anteriore": 1, "tricipiti": 0.5, "deltoide laterale": 0.5 } },
    { "id": "trazioni", "name": "Trazioni", "loadType": "weighted",
      "muscles": { "dorsali": 1, "bicipiti": 0.5, "deltoide posteriore": 0.5 } },
    { "id": "leg-curl", "name": "Leg curl", "muscles": { "femorali": 1 } },
    { "id": "alzate", "name": "Alzate laterali", "muscles": { "deltoide laterale": 1 } },
    { "id": "face-pull", "name": "Face pull", "muscles": { "deltoide posteriore": 1, "dorso alto": 0.5 } }
  ],
  "lifts": [
    { "exerciseId": "stacco", "tm": 140,
      "fsl": { "S1": { "sets": 3, "reps": 5 }, "S2": { "sets": 3, "reps": 5 }, "S3": { "sets": 3, "reps": 5 } },
      "tmRules": [ { "minReps": 4, "increment": 5 }, { "minReps": 2, "increment": 2.5 } ] },
    { "exerciseId": "military", "tm": 50,
      "fsl": { "S1": { "sets": 5, "reps": 5 }, "S2": { "sets": 5, "reps": 5 }, "S3": { "sets": 5, "reps": 5 } },
      "awaitingTmReview": { "s3PlusReps": 6 } }
  ],
  "days": [
    { "id": "lower", "name": "Lower", "exercises": [
      { "exerciseId": "stacco", "role": "main531" },
      { "exerciseId": "leg-curl", "role": "accessory", "sets": 3, "reps": 12, "repMin": 10, "repMax": 15, "weight": 30 }
    ] },
    { "id": "upper", "name": "Upper", "exercises": [
      { "exerciseId": "military", "role": "main531" },
      { "exerciseId": "trazioni", "role": "accessory", "sets": 4, "reps": 6, "repMin": 5, "repMax": 8, "weight": 5, "rpeMax": 8.5 },
      { "exerciseId": "alzate", "role": "accessory", "sets": 3, "reps": 15, "repMin": 12, "repMax": 20, "weight": 8, "superset": "A" },
      { "exerciseId": "face-pull", "role": "accessory", "sets": 3, "reps": 15, "repMin": 12, "repMax": 20, "weight": null, "superset": "A" }
    ] }
  ]
}
```

## Esempio piccolo: solo modifiche
```json
{
  "format": "forza-import",
  "version": 1,
  "tmChanges": [ { "exerciseId": "stacco", "tm": 145, "reason": "ciclo andato bene" } ],
  "exercises": [ { "id": "hip-thrust", "name": "Hip thrust", "barbell": true, "bodyPart": "lower", "muscles": { "glutei": 1, "femorali": 0.5 } } ],
  "days": [ { "id": "lower", "name": "Lower", "exercises": [
    { "exerciseId": "stacco", "role": "main531" },
    { "exerciseId": "hip-thrust", "role": "accessory", "sets": 3, "reps": 10, "repMin": 8, "repMax": 12, "weight": 60 }
  ] } ]
}
```
Con `mode` `"merge"` un giorno con un `id` già esistente viene **sostituito per intero**: includi tutti i suoi esercizi.

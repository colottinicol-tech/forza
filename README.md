# Forza

App per iPhone (PWA) per gestire la programmazione 5/3/1 e registrare gli allenamenti.
Funziona offline e tiene tutti i dati sul telefono: niente server, niente account.

Indirizzo dell'app: `https://<utente-github>.github.io/forza/`

## Come si aggiorna l'app

1. Si modifica il codice (di solito chiedendo a Claude Code, in questa cartella).
2. Si fa un *push* su GitHub, nel ramo `main`.
3. GitHub esegue da solo test e build e pubblica la nuova versione in circa 1-2 minuti
   (scheda **Actions** del repository: il pallino verde vuol dire pubblicata).
4. Sull'iPhone, alla prossima apertura di Forza compare il banner **«Aggiorna»**: toccalo
   (non durante un allenamento). L'app non si ricarica mai da sola.

I dati restano sul telefono e non vengono toccati dagli aggiornamenti.

## Comandi utili (per chi sviluppa)

| Comando | A cosa serve |
|---|---|
| `npm install` | Scarica le librerie (la prima volta) |
| `npm run dev` | Avvia l'app sul computer per provarla |
| `npm test` | Esegue i test automatici della logica |
| `npm run build` | Prepara la versione da pubblicare in `dist/` |
| `npm run icons` | Rigenera le icone PNG da `public/icon.svg` |

## Tecnologie

Vite + React + TypeScript + Tailwind, `vite-plugin-pwa` (manifest e service worker),
Dexie (IndexedDB) per i dati, Vitest per i test, GitHub Actions + GitHub Pages per la pubblicazione.

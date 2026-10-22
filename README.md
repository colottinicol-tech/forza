# Forza

App per iPhone (PWA) per gestire la programmazione 5/3/1 e registrare gli allenamenti.
Funziona offline e tiene tutti i dati sul telefono: niente server, niente account.

Indirizzo dell'app: https://colottinicol-tech.github.io/forza/

## Come si aggiorna l'app

1. Si modifica il codice (di solito chiedendo a Claude Code, in questa cartella).
2. Si fa un *push* su GitHub, nel ramo `main`.
3. GitHub esegue da solo test e build e pubblica la nuova versione in circa 1-2 minuti
   (scheda **Actions** del repository: il pallino verde vuol dire pubblicata).
4. Sull'iPhone, alla prossima apertura di Forza compare il banner **«Aggiorna»**: toccalo
   (non durante un allenamento). L'app non si ricarica mai da sola.

I dati restano sul telefono e non vengono toccati dagli aggiornamenti.

## Programma e backup

- **Programma:** si prepara in chat con Claude incollando [PROGRAM_SCHEMA.md](PROGRAM_SCHEMA.md), poi nell'app
  Impostazioni → «Importa da Claude» (incolla il JSON o scegli il file). L'app mostra un'anteprima e cambia i dati solo
  dopo la conferma. Si può anche modificare tutto a mano nella scheda Programma.
- **Backup:** Impostazioni → «Esporta backup» → salva il file in File (iCloud Drive). L'app lo ricorda ogni 14 giorni.
  Per ripristinare: Impostazioni → «Importa backup».
- La cartella `privato/` (programma personale) resta solo sul PC: è esclusa da GitHub.

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

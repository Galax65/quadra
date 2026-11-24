# CLAUDE.md — ricetta di customizzazione per agenti AI

Guida pratica per un assistente AI (Claude Code e simili) che deve **personalizzare
questa installazione** di Quadra (computo metrico e contabilità lavori) per uno studio
tecnico: prezzario proprio, branding proprio, eventualmente un tool nuovo.

Per l'architettura completa vedi [Docs/01-Panoramica-e-Architettura.md](Docs/01-Panoramica-e-Architettura.md)
(cos'è, come sono incastrati i pezzi). Questo file non lo ripete: lo presuppone.

## 1. Orientamento rapido

Repo a sorgente unica (non un monorepo con package separati). I tool sono file HTML
autonomi generati dal build; si lavora nei sorgenti sotto `src/`.

```
src/
├── hub/        ← il lanciatore (registry, ricerca, resolve dei file)
│   └── data/registry.ts   ← APP_REGISTRY: fonte unica dell'elenco dei tool
├── shared/     ← layer condiviso: bus.ts, progetto-quadra.ts, theme.ts, lavoro/ (modello), ui/ (design system)
│   └── xpwe/   ← lettura/scrittura XPWE (formato di interscambio), usata da Lavoro
└── tools/
    ├── lavoro/          (lo strumento unico: computo, contratto, SAL, perizia)
    ├── amministrazione/ (pannello admin/statistiche dell'hub)
    ├── computo/engine/      (motore puro: parser prezzari, ricerca, export — solo motore, niente UI)
    └── contabilita/engine/  (motore puro della contabilità lavori pubblici — solo motore, niente UI)
scripts/        ← build, release, pipeline dati (prezzari), CLI ehub
tests/          ← Vitest, un'area per tool + hub/shared/integration/docs/web
```

**`src/hub/data/registry.ts`** (`APP_REGISTRY`) è la **fonte unica di verità** per
l'elenco dei tool: nome, cartella sorgente (`srcDir`), categoria, stato (`stable`/`beta`).
README e `Docs/` si rigenerano da lì con `npm run sync:docs` — non editarli a mano nei
blocchi `<!-- AUTO:...:START/END -->`.

Comandi principali:

```bash
npm install          # dipendenze
npm start             # avvia l'app Electron (desktop)
npm run serve          # server statico locale, per usare l'hub da browser (no Electron)
npm run build          # typecheck + test + build:web (rigenera gli HTML in root)
npm run build:web      # solo la build web (Vite → HTML self-contained per tool)
npm test                # vitest run
npm run typecheck       # tsc --noEmit
npm run lint:css        # stylelint sul contratto UI (vedi §6)
npm run sync:docs       # riallinea i blocchi AUTO nei doc dal registry/bus/package.json
```

Ogni tool ha anche una build dedicata (`npm run build:lavoro`, `build:amministrazione`,
`build:hub`): utile per iterare veloce su un solo tool senza
ricompilare tutta la suite.

## 2. "Porta il tuo prezzario" (Computo)

La pipeline dati è:

```
prezzari-src/<Regione>/<file grezzo>.xml|.csv|.xlsx   (gitignored, NON nel repo)
        │  npm run build:prezzari   (scripts/build-prezzari.ts)
        ▼
prezzari/<slug>-<anno>.json.gz                        (formato compatto, gzip)
        │  npm run bundle:prezzari  (scripts/bundle-prezzari.mjs)
        ▼
prezzari/_bundle/<slug>.js                             (gitignored, caricato a richiesta da μ)
```

**Importante: i prezzari NON sono inclusi in questo repo** (dati proprietari/licenziati
per regione). Per aggiungerne uno:

1. Scarica il prezzario ufficiale della tua regione (portale della Regione/Provincia
   autonoma) o il listino del tuo fornitore, e mettilo sotto `prezzari-src/<Nome>/`.
2. Se il formato non è già riconosciuto, guarda i parser esistenti in
   `src/tools/computo/engine/parsers/` (uno per famiglia di formato: EASY, Documento,
   Veneto, Lombardia/`lombardia-dataroot`, Basilicata, Cratere/CSV PUC, listini editoriali/xlsx,
   Friuli Venezia Giulia/xlsx, VdA, RFI) e registra un nuovo `detect`+`parse` in
   `scripts/build-prezzari.ts` (array `FAMILIES`) se serve un parser nuovo.
3. `npm run build:prezzari` (tutti) o `npm run build:prezzari <filtro>` (solo i path
   che contengono `<filtro>`, es. `calabria`).
4. `npm run bundle:prezzari` per rigenerare `prezzari/_bundle/` prima di avviare/pacchettare
   l'app (`prezzari/_bundle/` è gitignored, va rigenerato ad ogni build/packaging).
5. Alternativa senza toccare il codice: μ supporta anche l'**import diretto** di un file
   Excel/XML da UI ("porta il tuo prezzario" come escape hatch) — utile per un test
   rapido o un listino una tantum.

## 3. "Cambia branding"

Il branding specifico di un committente reale è già stato **rimosso** da questa base:
oggi c'è solo un profilo demo, sostituibile.

- **Azienda/logo/intestazioni documenti**: [src/hub/data/companies.ts](src/hub/data/companies.ts)
  — array `COMPANIES`. Aggiungere/sostituire un'azienda = una riga (`id`, `name`,
  `address?`, `logo?` come data URL così resta incorporato anche nei PDF). Nessun
  logo → placeholder automatico con la sigla (`short` o `id` maiuscolo).
- **Crediti/licenza mostrati nell'app**: [src/hub/data/credits.ts](src/hub/data/credits.ts)
  (modale "Crediti" dell'hub — nome sviluppatore/link letti da `versions.js`).
- **Nome app e versione**: [versions.js](versions.js) è la fonte unica (letta da build,
  README, modale crediti).
- **Colori/temi/palette/font**: [src/shared/ui/tokens.css](src/shared/ui/tokens.css) —
  design system condiviso (light/dark, palette nominate, font di sistema). L'accento
  per-tool è governato da `[data-tool="…"]` nello stesso file; non è "branding
  aziendale", è l'identità visiva di ogni tool (μ verde, β porpora, α quasi mono).

## 4. "Aggiungi un nuovo tool"

Tutorial completo: [Docs/04-Aggiungere-una-Nuova-App.md](Docs/04-Aggiungere-una-Nuova-App.md).
In sintesi (checklist di quel doc, quattro-cinque liste che devono restare allineate):

1. Sorgente in `src/tools/<tool>/` (index.html + main + styles/, sul modello di un tool
   esistente).
2. Voce in `src/hub/data/registry.ts` (`APP_REGISTRY`): `file` (nome HTML stabile a
   root) + `srcDir` obbligatorio (altrimenti non compila).
3. `vite.config.ts` → `TOOL_INPUT` (entry point per il build Vite).
4. `scripts/place-builds.mjs` (copia l'artefatto in root) e `scripts/build-web.mjs`
   (array `TOOLS`, per la build web/desktop completa).
5. `npm run sync:docs` per riallineare README/Docs dal registry (non editarli a mano).
6. `npm test` — in particolare `tests/web/deploy-completo.test.ts` verifica che nessuna
   catena di build sia rimasta indietro.

## 5. Convenzioni vincolanti (leggi PRIMA di modificare)

- **Bus hub↔tool**: contratto tipizzato in [src/shared/bus.ts](src/shared/bus.ts)
  (`postMessage`, messaggi `hub:*` / `app:*`). Non inventare messaggi fuori contratto;
  guardato da [tests/hub/bus-contract.test.ts](tests/hub/bus-contract.test.ts).
- **Progetto `.quadra`** (si aprono anche i vecchi `.ehub`): round-trip collect/restore dello stato di tutti i tool in un
  unico file (`src/shared/progetto-quadra.ts`). Coperto da
  [tests/shared/ehub-project.test.ts](tests/shared/ehub-project.test.ts) e
  [tests/shared/bus-cycle.test.ts](tests/shared/bus-cycle.test.ts) —
  ogni tool che salva stato deve restare compatibile col round-trip.
- **Contratto UI (pulsanti/identità)**: i pulsanti sono **solo** `.ehb-btn*` /
  `.ehb-icon-btn` (niente `.p-btn`/`.btn` di tool); il colore viene sempre dai token
  (`var(--accent)`), mai da un hex inline. Presidiato in CI da `npm run lint:css`
  (stylelint) e da `npx vitest run tests/shared/ui-coherence.test.ts`.
- **Niente breaking change silenziosi**: se un test esistente sembra "nel modo", capisci
  perché esiste prima di modificarlo o cancellarlo — spesso è lì proprio per una
  regressione già successa una volta.
- **"Niente sostituzioni"**: se rimuovi la fonte dati di una funzione (es. un dataset
  proprietario), rimuovi la funzione o il suo pezzo di UI in modo pulito — non
  fabbricare dati finti/hardcoded per farla sembrare ancora funzionante.

## 6. Prima di aprire una PR

```bash
npm run typecheck     # 0 errori
npx vitest run          # tutto verde
npm run lint:css        # 0 violazioni contratto UI
npm run sync:docs       # se hai toccato registry.ts, bus.ts o docs-manifest.ts
npm run build:web       # se hai toccato sorgenti di un tool: i bundle .html vanno rigenerati
```

Vedi anche [CONTRIBUTING.md](CONTRIBUTING.md) per il flusso lato umano.

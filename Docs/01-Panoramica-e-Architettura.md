# 01 — Panoramica e Architettura

## 1. Cos'è Quadra, spiegato semplice

Immagina una **cassetta degli attrezzi**. Dentro ci sono gli attrezzi (oggi **Lavoro**, che
tiene il lavoro dal computo alla contabilità, e **Amministrazione**). Ogni attrezzo è completo e funziona da solo. La cassetta
(il "hub") serve a tenerli tutti insieme e a passartene uno quando ti serve.

In Quadra:
- ogni **attrezzo** è un file `.html` (gira nel browser/in una finestra, senza installare nulla);
- la **cassetta** è `Quadra.html`, che mostra il menu e apre gli attrezzi;
- il tutto è chiuso dentro un'**app desktop** (Electron) così sembra e si comporta come un
  normale programma per Mac/Windows, e funziona **senza internet**.

## 2. Gli strumenti attuali

Il lanciatore **Quadra** (`Quadra.html`) scopre e apre gli altri tool. Il catalogo
qui sotto è **auto-generato** dal registry (fonte unica), quindi non invecchia:

<!-- AUTO:tools:table:START -->
<!-- ⚙️ generato da `npm run sync:docs` (fonte: src/hub/data/registry.ts) — NON editare a mano -->
| Strumento | Categoria | Cosa fa | Stato |
|---|---|---|---|
| **Lavoro** (`src/tools/lavoro/`) | Lavoro | Dal progetto alla contabilità, in una schermata sola | beta |
| **Amministrazione** (`src/tools/amministrazione/`) | Amministrazione | Centro di controllo dell'hub | stabile |
<!-- AUTO:tools:table:END -->

> **I nomi file sono stabili e SENZA versione** (es. `Amministrazione.html`, non più `phi_v6_14.html`).
> La versione di ogni tool e dell'app vive **solo** in [versions.js](../versions.js) (fonte unica),
> ed è mostrata in tabella nel [README.md](../README.md) (auto-generata da `versions.js`).

## 3. La struttura dei file

```
quadra/
├── src/                      ← I SORGENTI (si lavora qui)
│   ├── hub/                  ←   il lanciatore
│   ├── tools/<tool>/         ←   un tool per cartella (vedi tabella sotto)
│   └── shared/               ←   codice comune a tutti (bus, tema, XPWE, stampe PDF, documenti…)
│
├── *.html                    ← artefatti di build a nome stabile, aperti dall'hub
├── main.js                   ← Electron: crea la finestra, i menu
├── preload.js                ← Electron: "ponte" che fa funzionare il hub (vedi §6)
├── package.json              ← config del progetto + ricette di build
├── versions.js               ← fonte unica del numero di versione (la legge l'hub)
│
├── scripts/                  ← build, release, sincronizzazione dei doc
├── tests/                    ← test dei motori, dei contratti e della documentazione
│
├── prezzari/                 ← prezzari interni di Price
│   ├── *.json.gz             ←   dataset normalizzati (committati)
│   └── _bundle/              ←   wrapper .js generati (gitignored, rigenerati al build)
│
├── vendor/                   ← librerie scaricate in locale (per funzionare OFFLINE)
│   ├── xlsx.full.min.js      ←   lettura Excel (Lavoro)
│   ├── jszip.min.js          ←   zip (Lavoro)
│   ├── pdf.min.js / pdf.worker.min.js  ←  lettura PDF (Lavoro)
│   ├── fonts.css             ←   i font del progetto
│   └── fonts/*.woff2         ←   i file dei font (Inter, JetBrains Mono)
│
├── api/                      ← funzioni serverless dell'edizione 'server'
├── assets/icon.png           ← icona dell'app
├── .github/workflows/        ← CI: typecheck, lint, test, build
└── Docs/                     ← questa documentazione
```

Quale sorgente genera quale file a root:

<!-- AUTO:files:root:START -->
<!-- ⚙️ generato da `npm run sync:docs` (fonte: src/hub/data/registry.ts) — NON editare a mano -->
| File a root (aperto dall'hub) | Sorgente | Strumento |
|---|---|---|
| `Quadra.html` | [`src/hub/`](../src/hub/) | Quadra — il lanciatore |
| `Lavoro.html` | [`src/tools/lavoro/`](../src/tools/lavoro/) | Lavoro |
| `Amministrazione.html` | [`src/tools/amministrazione/`](../src/tools/amministrazione/) | Amministrazione |

I file a root sono **artefatti di build** (rigenerati da `npm run build:web`): si modifica il sorgente, mai l'HTML a root.
<!-- AUTO:files:root:END -->

> **Regola d'oro:** i file generati (`node_modules/`, `dist/`) **non** vanno su git —
> sono già nel [.gitignore](../.gitignore). Tutto il resto sì, **compreso `vendor/`**
> (così la build automatica funziona senza riscaricare nulla).

## 4. Come gira: i tre livelli

```
┌─────────────────────────────────────────────────────────┐
│  ELECTRON (l'app desktop: finestra, menu, accesso file)  │  ← main.js
│  ┌───────────────────────────────────────────────────┐  │
│  │  IL HUB  (Quadra.html)                                │  │  ← menu + lanciatore
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  IL TOOL ATTIVO  (es. Amministrazione.html)              │  │  │  ← dentro un <iframe>
│  │  │  caricato dentro un iframe                    │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

1. **Electron** apre una finestra e ci carica il hub.
2. **Il hub** mostra le card dei tool. Quando ne scegli uno, lo carica **dentro un `<iframe>`**
   (una "finestra nella finestra"), iniettandone l'HTML.
3. **Il tool** gira isolato nel suo iframe e fa il suo lavoro.

## 5. Come il hub scopre i tool (il "registry")

Il hub non ha link fissi agli altri file. Ha invece un **elenco**, `APP_REGISTRY`, definito in
[src/hub/data/registry.ts](../src/hub/data/registry.ts) (compilato dentro `Quadra.html`). Ogni voce
descrive un tool e punta a un **nome file stabile**:

```ts
{
  id:      "delta-pages",                  // identificatore unico
  name:    "Computo",                      // nome mostrato
  tagline: "Prezzari e computo metrico",
  file:    "Delta.html",                   // ← nome file STABILE (senza versione)
  srcDir:  "delta",                        // ← cartella sorgente in src/tools/ (OBBLIGATORIA)
  logoType:"delta",                        // icona
  tags:    ["copertine","elaborati","frontespizio","template","pdf","tavole","delta"],
  status:  "stable",                       // 'stable' | 'beta'
  category:"documenti-commessa",           // tematica (raggruppamento nell'hub)
}
```

> `srcDir` è **obbligatorio** apposta: è ciò che lega il tool alla sua cartella, e ci si
> appoggiano i doc generati e le guardie di build. Un tool nuovo senza `srcDir` non compila,
> quindi la documentazione non può restare indietro.

Il hub poi **scansiona la cartella** (`resolveFiles`) e, per ogni voce, verifica semplicemente che
`file` sia presente (`resolvedFile = file` o `null`). **Niente più parsing di versione dal nome**:
i file hanno nomi stabili (`Amministrazione.html`, `Lavoro.html`, `Quadra.html`) e la
versione è unica, definita in [versions.js](../versions.js) (vedi doc 03 §4). Vedi doc 04 per
aggiungere un tool.

## 6. Il pezzo magico: `preload.js` (perché esiste)

Questo è il punto più importante da capire, perché è anche il più facile da rompere.

**Il problema.** Il hub, nel browser, scopre i file usando una funzione del browser chiamata
`window.showDirectoryPicker()` (la "File System Access API"). Questa funzione **non esiste**
quando una pagina è aperta come file locale (`file://`), che è esattamente come Electron
carica il hub. Senza un rimedio, il pulsante "Apri cartella" non farebbe nulla e **nessun
tool si aprirebbe**.

**La soluzione.** [preload.js](../preload.js) **ricrea** quella funzione del browser, ma
appoggiandola al filesystem vero tramite Node (`fs`), puntandola alla cartella dell'app.
Così il hub funziona **senza modifiche al suo codice**, come se fosse in un browser normale.
In più la apre da sola all'avvio, così non devi cliccare "Apri cartella" ogni volta.

```
hub chiama showDirectoryPicker()  →  preload risponde con la cartella dell'app
hub legge i file                  →  preload li legge da disco con fs
hub inietta il tool nell'iframe   →  funziona ✅
```

> ⚠️ **Conseguenza tecnica:** per far funzionare questo ponte, in [main.js](../main.js) la
> finestra usa `contextIsolation: false` e `sandbox: false`. È accettabile perché qui
> **carichiamo solo contenuti nostri, locali e fidati** (nessuna pagina web esterna). Se un
> giorno l'app dovesse caricare contenuti da internet, questa scelta andrebbe rivista.

## 7. Come i tool "parlano" tra loro (bus di messaggi)

Hub e tool si scambiano messaggi con `postMessage` (è il modo standard con cui un iframe e
la pagina che lo contiene comunicano). Ecco il "contratto" completo — utile se aggiungi un
tool che vuole integrarsi (vedi anche doc 04).

Il contratto completo è tipizzato in [src/shared/bus.ts](../src/shared/bus.ts) — la tabella
qui sotto ne è generata, quindi non può divergere:

<!-- AUTO:bus:messages:START -->
<!-- ⚙️ generato da `npm run sync:docs` (fonte: src/shared/bus.ts) — NON editare a mano -->
**Hub → Tool**

| Messaggio | Dati | Cosa fa |
|---|---|---|
| `hub:set-theme` | `theme`, `palette?` | Push esplicito del tema dal picker dell'hub (il tema resta per-tool, con override locale). |
| `hub:set-palette` | `palette` | Palette di suite (ORTOGONALE al tema): propagata sempre a tutti i tool. |
| `hub:set-font` | `font` | Font di suite (ORTOGONALE a tema/palette): propagato sempre a tutti i tool. |
| `hub:set-text-size` | `size`, `scale?` | Dimensione testo di suite (ORTOGONALE alle altre): propagata sempre a tutti i tool. |
| `hub:set-motion` | `motion` | Riduci animazioni (ORTOGONALE alle altre): propagato sempre a tutti i tool. |
| `hub:set-shadow` | `shadow` | Intensità ombre (ORTOGONALE alle altre): propagata sempre a tutti i tool. |
| `hub:project-state` | `source`, `project` | Risposta a `app:request-state`: lo stato pubblicato da un altro tool. |
| `hub:collect-state` | — | "Progetto Quadra": l'hub chiede al tool il suo stato pieno serializzabile. |
| `hub:restore-state` | `appId?`, `state` | "Progetto Quadra": l'hub chiede al tool di ripristinare uno stato salvato. |
| `hub:vai-a` | `fase` | La sidebar ha cliccato una revisione: il tool apra quella fase. |
| `hub:apri-documento` | `fase`, `tipo` | L'albero in sidebar ha cliccato un ATTO dentro una fase: il tool lo apra. |
| `hub:comando` | `comando` | L'albero ha chiesto di CREARE qualcosa: un SAL, una perizia, una revisione. |
| `hub:set-company` | `company` | Intestazione azienda per le stampe (null = nessuna, es. admin). |

**Tool → Hub**

| Messaggio | Dati | Cosa fa |
|---|---|---|
| `app:ready` | — | Il tool ha finito di caricare: l'hub può togliere l'overlay di caricamento. |
| `app:theme` | `theme`, `palette?` | Il tool ha cambiato tema da sé: l'hub allinea l'interfaccia intorno all'iframe. |
| `app:request-state` | `want?` | Il tool chiede lo stato condiviso di un altro tool (`want` = quale). |
| `app:project-update` | `appId`, `project` | Il tool pubblica il proprio stato corrente, così gli altri possono consumarlo. |
| `app:full-state` | `appId`, `state` | Risposta a `hub:collect-state`: stato pieno del tool per il progetto Quadra. |
| `hub:navigate` | `appId` | Il tool chiede all'hub di aprire un altro tool (i "ponti" fra strumenti). |
| `hub:go-home` | — | Il tool chiede all'hub di tornare alla schermata iniziale. |

<!-- AUTO:bus:messages:END -->

> Attenzione alla direzione: `hub:navigate` e `hub:go-home` hanno prefisso `hub:` ma sono
> richieste del **tool verso l'hub** ("aprimi quest'altro tool", "torna alla home").

Esempio reale: **Lavoro** pubblica il proprio stato (`app:project-update`) con l'albero del
lavoro; l'hub lo conserva, ne disegna i rami in sidebar e lo ritrasmette agli altri tool. Un
tool appena aperto chiede lo stato (`app:request-state`) e lo riceve come replay.

## 8. Perché "tutto offline"

Originariamente i tool caricavano librerie (Excel, 3D, PDF, font) da internet (CDN). Un'app
desktop deve funzionare anche **senza rete**, quindi tutte queste librerie sono state
**scaricate dentro `vendor/`** e i riferimenti negli HTML puntano lì. Nessuna chiamata a
internet a runtime. Vedi doc 05 per come aggiornarle.

---

➡️ Prossimo: [02 — Guida Utente](02-Guida-Utente.md)

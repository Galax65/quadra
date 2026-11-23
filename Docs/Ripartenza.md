# Quadra — dove eravamo rimasti (23/11/2026)

Note per riprendere il lavoro. Il piano è in
[07-Un-lavoro-un-modulo.md](07-Un-lavoro-un-modulo.md) (il precedente,
[06-Interfaccia-unica.md](06-Interfaccia-unica.md), è chiuso): qui c'è lo stato,
quello che resta e come si compila.

## Stato

Su `main`, dopo la v0.12.0: **un lavoro, un modulo**. Computo e Contabilità non
sono più due strumenti: c'è **«Lavoro»** (`src/tools/lavoro/`, modello in
`src/shared/lavoro/`), dove computo e revisioni, contratto, SAL, perizie, stato
finale e CRE sono tappe della stessa catena, nella stessa schermata. I due
strumenti vecchi sono usciti dal registro (tappa 8); i loro **motori** restano
e li usa «Lavoro» (prezzari, XPWE, contabilità e stampe), mentre le loro
cartelle d'interfaccia sono ferme nel repository, da cancellare nella pulizia
finale.

Verifiche all'ultimo giro: `npm run typecheck` 0 errori · `npx vitest run`
1706 test verdi · `npm run lint:css` 0 violazioni · `npm run build:web` ok.

### Fatto

- Tappe 1–8 di Docs/07: modello del lavoro, schermata unica, pannello prezzi,
  contratto (in vigore subito, a ribasso o a prezzi unitari) e SAL, perizia,
  SAL finale e CRE, stampe dalla stessa finestra (il motore della Contabilità,
  con un test che ne verifica i conti contro quelli a schermo), tasto destro
  ovunque, uscita di Computo e Contabilità.
- Il **programma completo** (elenco «8bis» di Docs/07, tutto spuntato): cantiere
  (giornale, verbali, riserve, economie, scadenziario, registro degli atti),
  analisi prezzi, firma dei SAL con impronta, fascicoli e DOCX/ODT, quadro
  economico e offerte, struttura e modelli, misure (vedi voce, Excel, da altra
  voce), prezzi (storico, variazioni, prezzario nuovo, NP, filtri, confronto),
  libreria personale, contabilità senza computo e computo consuntivo.

## Cosa resta da fare

Nell'ordine chiesto dall'utente:

1. **Revisione prezzi** (art. 60 D.Lgs. 36/2023 — tappa 9 di
   Docs/07). Prima di scriverla: soglia, quota, indici e periodicità **dal
   testo vigente** dopo il correttivo D.Lgs. 209/2024, e la prassi dei programmi di contabilità.
2. **Ottimizzazione dell'interfaccia.**
3. **Pulizia**: cancellare le cartelle d'interfaccia di `src/tools/computo` e
   `src/tools/contabilita` (i motori `engine/` restano) e i loro test di
   interfaccia; togliere i residui di Open E.Hub (`hub:shared-plan`, il testo
   «strumenti di disegno» in Docs/01).

Restano aperti anche: validare i PDF/A con veraPDF; il compositore guidato e la
voce da scheda tecnica non ci sono, perché vivono di un catalogo che la build
non distribuisce.

## Come si compila e si avvia

Requisiti: **Node ≥ 24.15** (`node -v`) e npm.

> **Mai copiare `node_modules` da un Mac all'altro** (AirDrop, chiavetta,
> cloud): dentro ci sono Electron e moduli nativi per l'architettura di
> quel Mac, e macOS li blocca o li uccide. È quello che è successo in questa
> sessione. Su ogni Mac si reinstalla da zero.

### Sviluppo (su qualunque Mac, Apple Silicon o Intel)

```bash
cd ~/Progetti/Quadra
rm -rf node_modules          # solo se la cartella arriva da un altro Mac
npm ci                       # dipendenze per QUESTO Mac (scarica l'Electron giusto)
npm start                    # compila (build:web) e apre l'app desktop
```

Altri comandi utili:

```bash
npm run serve                # l'hub nel browser, su http://localhost:8080/Quadra.html
npm run typecheck            # controllo dei tipi
npx vitest run               # tutti i test
npm run lint:css             # contratto UI
npm run build:web            # rigenera Quadra.html, Computo.html, Contabilita.html…
```

### Applicazione da installare (.dmg)

```bash
# per il Mac su cui si lancia (Apple Silicon → arm64, Intel → x64)
npm run build:mac

# per Mac Intel, anche lanciandolo da un Mac Apple Silicon
npm run prebuild:mac && npx electron-builder --mac --x64

# una sola app per tutti e due (più grande)
npm run prebuild:mac && npx electron-builder --mac --universal
```

I file finiscono in `dist/` (`Quadra-<versione>-<arch>.dmg` e `.zip`).
`prebuild:mac` rigenera i tool e i prezzari in bundle: i prezzari regionali non
sono nel repo, vanno messi in `prezzari-src/` e compilati con
`npm run build:prezzari` (vedi `CLAUDE.md` §2).

L'app non è firmata con un certificato Apple: al primo avvio su un altro Mac
macOS la blocca. Si apre con **clic destro → Apri** (una volta), oppure da
Impostazioni di Sistema → Privacy e sicurezza → «Apri comunque».

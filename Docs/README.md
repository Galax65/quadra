# 📚 Documentazione Quadra

Questa cartella contiene **tutto il contesto del progetto**: com'è fatto, come si usa,
come si aggiorna e come si aggiungono nuove app. Se torni sul progetto fra sei mesi (o
se qualcun altro ci mette mano), parti da qui.

## Indice

<!-- AUTO:docs:index:START -->
<!-- ⚙️ generato da `npm run sync:docs` (fonte: scripts/docs-manifest.ts) — NON editare a mano -->
| Doc | A cosa serve | Quando leggerlo |
|---|---|---|
| [00 — Perché Quadra](00-Perche-Quadra.md) | Presentazione: cosa fa Quadra, gli strumenti, stato del progetto, origine e licenza | Per chi sta decidendo se scaricare Quadra |
| [01 — Panoramica e Architettura](01-Panoramica-e-Architettura.md) | Cos'è Quadra, come sono incastrati i pezzi e **perché** sono fatti così | Per capire il "big picture" |
| [02 — Guida Utente (ELI5)](02-Guida-Utente.md) | Come usare l'app tutti i giorni, spiegato semplice | Uso quotidiano |
| [03 — Build e Release](03-Build-e-Release.md) | Come creare gli installer macOS/Windows, versioni, tag, CI | Quando vuoi distribuire una nuova versione |
| [04 — Aggiungere una Nuova App](04-Aggiungere-una-Nuova-App.md) | Tutorial passo-passo per inserire un nuovo tool nella suite | Quando crei un nuovo strumento |
| [05 — Manutenzione e Troubleshooting](05-Manutenzione-e-Troubleshooting.md) | Aggiornare librerie, errori comuni, blocchi macOS/Windows | Quando qualcosa non va |
| [06 — Una sola interfaccia](06-Interfaccia-unica.md) | Perché computo e contabilità devono essere la stessa schermata, e le tappe per arrivarci | Prima di toccare il guscio, la barra delle voci o la tabella di misura |
| [07 — Un lavoro, un modulo](07-Un-lavoro-un-modulo.md) | Computo e contabilità come lo STESSO modulo: un lavoro, una catena di revisioni, una schermata, un pannello prezzi, una stampa | Prima di toccare la schermata delle misure, il pannello prezzi, le stampe o la sidebar |
| [Ripartenza — dove eravamo rimasti](Ripartenza.md) | Stato del lavoro, cosa resta da fare e come si compila e si avvia (anche su Mac Intel) | A inizio sessione, prima di riprendere il lavoro o di preparare un pacchetto |
<!-- AUTO:docs:index:END -->

## TL;DR in 30 secondi

Quadra è una **suite di strumenti** per illuminotecnica e impiantistica. Ogni strumento
è un **singolo file HTML** autonomo a nome stabile (es. `Amministrazione.html`), generato dal build a
partire da `src/tools/`. Un file "hub" (`Quadra.html`) fa da menu/lanciatore:
scopre gli altri tool e li apre dentro di sé.

Tutto questo è **impacchettato in un'app desktop** (Electron) per macOS e Windows, così
gira come un programma normale, anche **offline**. La stessa base gira anche come build web
statica.

```
Doppio click su Quadra  →  si apre il hub  →  scegli un tool  →  ci lavori
```

- **Aggiungere un tool** = creare un sorgente in `src/tools/` + una riga nel registry. Vedi doc 04.
- **Nuova versione** = cambiare un numero + creare un tag git. Vedi doc 03.
- **Non funziona** = vedi doc 05.

## Una fonte di verità per fatto

La regola che tiene in piedi questa documentazione: **ogni fatto ha un solo posto dove
è scritto**, e i documenti lo leggono da lì invece di ricopiarlo.

| Fatto | Fonte di verità |
|---|---|
| Catalogo dei tool, cartelle sorgente, stato beta/stabile | [src/hub/data/registry.ts](../src/hub/data/registry.ts) |
| Messaggi scambiati fra hub e tool | [src/shared/bus.ts](../src/shared/bus.ts) |
| Comandi disponibili | [package.json](../package.json) |
| Numero di versione | [versions.js](../versions.js) |
| Elenco dei documenti | [scripts/docs-manifest.ts](../scripts/docs-manifest.ts) |

Le parti di questi documenti racchiuse fra marker `<!-- AUTO:…:START -->` e
`<!-- AUTO:…:END -->` sono **generate** da quelle fonti con `npm run sync:docs`:
non vanno modificate a mano — la modifica verrebbe sovrascritta, e nel frattempo
[tests/docs/](../tests/docs/) fa fallire `npm test` se un blocco è fuori sync.

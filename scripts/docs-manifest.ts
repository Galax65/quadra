/**
 * INDICE della documentazione Quadra — fonte unica di `Docs/README.md`.
 *
 * Ogni file `.md` sotto `Docs/` deve comparire qui, e ogni voce qui deve esistere
 * su disco: la biiezione è verificata da [tests/docs/index.test.ts]. È il modo per
 * cui un doc nuovo non può restare fuori dall'indice e un doc cancellato non può
 * restare linkato — la deriva diventa un test rosso, non una scoperta a caso.
 *
 * Solo Node (script e test): non importarlo mai dal browser.
 */

export type DocStato = 'vivo'

export interface DocEntry {
  /** Path relativo a `Docs/` (es. '01-Panoramica-e-Architettura.md', 'archivio/06-….md'). */
  file: string
  /** Titolo mostrato nell'indice. */
  title: string
  /** A cosa serve. */
  purpose: string
  /** Quando leggerlo (vuoto per gli archiviati). */
  when: string
  stato: DocStato
}

/**
 * Ruolo delle sottocartelle di `src/shared/` che NON hanno un `index.ts` con
 * commento di testa (da cui il generatore prende la descrizione da sé). Se ne
 * nasce una senza né l'uno né l'altro, `npm run sync:docs` fallisce: nessuna
 * area condivisa può restare senza spiegazione.
 */
export const SHARED_AREAS: Record<string, string> = {
  data: 'Dati condivisi: database cavi CPR',
  ui: 'Design system: token, componenti, marchio ε, guida F1, tour guidato',
}

/** Aree di test (`tests/<dir>/`) e loro ruolo — niente numeri: cambiano a ogni commit. */
export const TEST_AREAS: Record<string, string> = {
  amministrazione: 'Amministrazione — pannello di controllo, utenti e statistiche',
  cli: 'CLI unificata «quadra»: invarianti del registry, parser argv, dispatch, smoke dei comandi',
  docs: 'Documentazione: blocchi AUTO in sync, indice, link, path citati',
  computo: 'Computo — parser prezzari, ricerca, computo, export verso altri programmi',
  contabilita: 'Contabilità — contabilità lavori pubblici (SAL, certificati, verbali)',
  lavoro: 'Lavoro — lo strumento unico: ogni tappa (computo, contratto, SAL, perizia) nella stessa schermata',
  hub: 'Hub: registry, resolve/search, visibilità, contratto bus',
  integration: 'Interconnessione fra tool e progetti `.quadra` reali',
  shared: 'Layer condiviso: bus, progetto `.quadra`, tema, documenti, compositore',
  ui: 'Coerenza del design system (contratto UI)',
  web: 'Catene di build e deploy: nessun tool resta indietro',
}

export const DOCS: DocEntry[] = [
  {
    file: 'README.md',
    title: 'Indice',
    purpose: 'Questa pagina: mappa di tutta la documentazione',
    when: 'Punto di partenza',
    stato: 'vivo',
  },
  {
    file: '00-Perche-Quadra.md',
    title: '00 — Perché Quadra',
    purpose: 'Presentazione: cosa fa Quadra, gli strumenti, stato del progetto, origine e licenza',
    when: 'Per chi sta decidendo se scaricare Quadra',
    stato: 'vivo',
  },
  {
    file: '01-Panoramica-e-Architettura.md',
    title: '01 — Panoramica e Architettura',
    purpose: 'Cos\'è Quadra, come sono incastrati i pezzi e **perché** sono fatti così',
    when: 'Per capire il "big picture"',
    stato: 'vivo',
  },
  {
    file: '02-Guida-Utente.md',
    title: '02 — Guida Utente (ELI5)',
    purpose: 'Come usare l\'app tutti i giorni, spiegato semplice',
    when: 'Uso quotidiano',
    stato: 'vivo',
  },
  {
    file: '03-Build-e-Release.md',
    title: '03 — Build e Release',
    purpose: 'Come creare gli installer macOS/Windows, versioni, tag, CI',
    when: 'Quando vuoi distribuire una nuova versione',
    stato: 'vivo',
  },
  {
    file: '04-Aggiungere-una-Nuova-App.md',
    title: '04 — Aggiungere una Nuova App',
    purpose: 'Tutorial passo-passo per inserire un nuovo tool nella suite',
    when: 'Quando crei un nuovo strumento',
    stato: 'vivo',
  },
  {
    file: '05-Manutenzione-e-Troubleshooting.md',
    title: '05 — Manutenzione e Troubleshooting',
    purpose: 'Aggiornare librerie, errori comuni, blocchi macOS/Windows',
    when: 'Quando qualcosa non va',
    stato: 'vivo',
  },
  {
    file: '06-Interfaccia-unica.md',
    title: '06 — Una sola interfaccia',
    purpose: 'Perché computo e contabilità devono essere la stessa schermata, e le tappe per arrivarci',
    when: 'Prima di toccare il guscio, la barra delle voci o la tabella di misura',
    stato: 'vivo',
  },
  {
    file: '07-Un-lavoro-un-modulo.md',
    title: '07 — Un lavoro, un modulo',
    purpose: 'Computo e contabilità come lo STESSO modulo: un lavoro, una catena di revisioni, una schermata, un pannello prezzi, una stampa',
    when: 'Prima di toccare la schermata delle misure, il pannello prezzi, le stampe o la sidebar',
    stato: 'vivo',
  },
  {
    file: 'Ripartenza.md',
    title: 'Ripartenza — dove eravamo rimasti',
    purpose: 'Stato del lavoro, cosa resta da fare e come si compila e si avvia (anche su Mac Intel)',
    when: 'A inizio sessione, prima di riprendere il lavoro o di preparare un pacchetto',
    stato: 'vivo',
  },
]

/**
 * LA GRIGLIA CONDIVISA — tappa 4 di Docs/06-Interfaccia-unica.md.
 *
 * Tutto quello che fa di una schermata «un computo», in un modulo solo:
 *  - il DESCRITTORE DI FASE (fase.ts): colonne, quale si scrive, quale si
 *    confronta, quali valori in calce, quali voci MOSTRA;
 *  - la GRIGLIA delle voci (griglia.ts), con gruppi, sezioni e dettaglio;
 *  - le CELLE (celle.ts): codice, designazione, campo, quantità misurata,
 *    numero, comandi — com'è fatta ogni cella, uguale in ogni fase;
 *  - la BARRA (ui/barra-voci.ts): ricerca, viste, ordinamenti, comandi;
 *  - il FOGLIO: le misure dentro la griglia e la riga SOMMANO (griglia.ts),
 *    con i campi di compositore/misure-tabella.ts;
 *  - il PIEDE con i valori di controllo (piede.ts);
 *  - la TESTATA DI FASE, con l'unico comando di stampa (testata.ts).
 * Computo e Contabilità la richiamano entrambi.
 */
export * from './fase'
export * from './griglia'
export * from './celle'
export * from './piede'
export * from './testata'
export { barraVoci, type BarraVociOpts, type AzioneBarra, type OpzioneOrdine } from '../ui/barra-voci'
export { TASTI_MISURE, type AzioniMisure } from '../compositore/misure-tabella'

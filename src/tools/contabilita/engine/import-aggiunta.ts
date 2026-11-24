/**
 * Contabilità — IMPORTARE IN UN LAVORO GIÀ AVVIATO.
 *
 * L'import «di partenza» sostituisce tutto: il computo diventa il contratto e
 * nasce il primo libretto. Ma un lavoro vero non comincia sempre da lì. Capita
 * di ereditare una contabilità già avviata — SAL emessi, atti firmati — e di
 * doverla portare dentro per proseguire da dove si era; capita di dover
 * aggiungere le voci di una perizia, o un pezzo di computo arrivato dopo.
 *
 * In quei casi importare NON deve cancellare nulla: le voci nuove si
 * AGGIUNGONO all'elenco prezzi, con il SAL (o la perizia) da cui esistono, e
 * le voci che l'elenco ha già si riconoscono dal codice e non si duplicano —
 * al massimo portano le loro misure nel libretto indicato.
 *
 * Modulo PURO: decide e calcola, non tocca il DOM.
 */
import type { MisurazioneRiga } from '../../../shared/compositore/misurazioni'
import type { Partita } from './types'

export interface AnteprimaAggiunta {
  /** Voci che l'elenco prezzi non ha ancora. */
  nuove: number
  /** Voci già in elenco, riconosciute dal codice: non si duplicano. */
  gia: number
  /** Quante portano misure con sé. */
  conMisure: number
  /** Codici già presenti con prezzo diverso: il prezzo di contratto NON si tocca. */
  prezziDiversi: { codice: string; inElenco: number | null; nelFile: number | null }[]
  /**
   * Voci già in elenco a cui MANCA la quantità di contratto e che questo file
   * può completare. Succede sempre quando il lavoro è stato ereditato da un
   * file di contabilità (che porta l'eseguito ma non il progetto) e poi si
   * importa il computo di contratto: senza questo, il contratto vigente resta
   * a zero e ogni perizia sembra tutta in aumento.
   */
  completabili: number
}

export interface EsitoAggiunta {
  /** Partite da aggiungere all'elenco (già pronte, con id e introdottaSal). */
  nuove: Partita[]
  /** Misure da portare nel contenitore scelto: id della partita → righe. */
  misure: { partitaId: string; righe: MisurazioneRiga[] }[]
  gia: number
  /** Voci già in elenco a cui questo file ha dato la quantità di contratto che mancava. */
  completate: number
}


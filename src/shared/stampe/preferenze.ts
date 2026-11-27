/**
 * PREFERENZE DI STAMPA — una sola per tutto il programma.
 *
 * Erano tre: le opzioni del computo (descrizione estesa/ridotta/accorciata con
 * le prime e le ultime righe), quelle degli atti contabili e lo stile del
 * foglio. Risultato: le prime 3 e le ultime 2 righe impostate nel computo non
 * valevano nel libretto, che ne stampava 4 e 3 per conto suo. Qui stanno
 * insieme, si salvano insieme e valgono per ogni stampa, di progetto o di
 * contabilità.
 *
 * Sono preferenze di chi stampa, non dati del lavoro: vivono nel programma e
 * non entrano nel file di progetto.
 */
import { STILE_STAMPA_DEFAULT, type StileStampa } from '../doc/stile-stampa'

export interface PreferenzeStampa {
  /** Quanto testo della voce: tutto, la sola descrizione breve, o inizio e fine. */
  descrizione: 'estesa' | 'ridotta' | 'compatta'
  /** Con 'compatta': righe stampate all'inizio e alla fine della declaratoria. */
  righeMax: number
  righeFinali: number
  /** Descrizione breve in grassetto sopra l'estesa. */
  conRidotta: boolean
  /** Computo senza prezzi (computo metrico non estimativo). */
  senzaPrezzi: boolean
  /** Riga WBS sotto ogni voce. */
  rigaWbs: boolean
  riepilogo: 'entrambi' | 'categorie' | 'wbs' | 'nessuno'
  /** Date dei rilevamenti accanto alla tariffa (libretto delle misure). */
  date: boolean
  /** Righe di misura sotto ogni voce del computo: senza, la voce porta la sola quantità (stampa sintetica). */
  misure: boolean
  /** Luogo, data e firme in calce agli elaborati di progetto. */
  firme: boolean
  /** Luogo della firma («Udine»): vuoto = il comune dei lavori. */
  luogo: string
  /** Copertina (frontespizio) in testa agli elaborati di progetto. */
  copertina: boolean
  /** Foglio, margini, carattere, testata e cartiglio. */
  stile: StileStampa
}

export const PREFERENZE_STAMPA_DEFAULT: PreferenzeStampa = {
  descrizione: 'compatta', righeMax: 3, righeFinali: 2, conRidotta: true,
  senzaPrezzi: false, rigaWbs: true, riepilogo: 'entrambi', date: true,
  misure: true, firme: true, luogo: '', copertina: false,
  stile: { ...STILE_STAMPA_DEFAULT },
}

export const CHIAVE_PREFERENZE_STAMPA = 'quadra:stampe'

export function leggiPreferenzeStampa(): PreferenzeStampa {
  try {
    const salvate = JSON.parse(localStorage.getItem(CHIAVE_PREFERENZE_STAMPA) || '{}') as Partial<PreferenzeStampa>
    return { ...PREFERENZE_STAMPA_DEFAULT, ...salvate, stile: { ...STILE_STAMPA_DEFAULT, ...(salvate.stile || {}) } }
  } catch {
    return { ...PREFERENZE_STAMPA_DEFAULT }
  }
}

export function salvaPreferenzeStampa(p: PreferenzeStampa): void {
  try { localStorage.setItem(CHIAVE_PREFERENZE_STAMPA, JSON.stringify(p)) } catch { /* preferenza non salvata: pazienza */ }
}

/** Righe da stampare di una declaratoria, o undefined se va stampata intera. */
export function limiteRighe(p: PreferenzeStampa): { maxRighe?: number; righeFinali?: number } {
  if (p.descrizione !== 'compatta') return {}
  return { maxRighe: Math.max(1, p.righeMax), righeFinali: Math.max(0, p.righeFinali) }
}

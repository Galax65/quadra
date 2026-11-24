import type { Partita, Sal } from './types'
/**
 * Contabilità — IMPORT DI UNA CONTABILITÀ XPWE (XPWE con TipoDocumento 2).
 *
 * Ogni voce del file è una misura DATATA (DataMis). Le date si raggruppano in SAL
 * (di default: date vicine, entro `giorniStessoSal`, nello stesso SAL; l'utente può
 * cambiare l'abbinamento). Ogni SAL riceve le misure PROGRESSIVE: quelle delle sue
 * date più tutte quelle dei SAL precedenti, come nel libretto.
 * Ogni voce del file diventa una voce del libretto: le ripetizioni dello stesso articolo
 * NON si accorpano (restano annotazioni distinte, come nell'originale). Ciascuna si abbina
 * a una partita di progetto ancora libera con lo stesso codice e prezzo; le altre diventano
 * partite a misura nuove (senza quantità di progetto).
 */

/** «gg/mm/aaaa» → numero di giorni (per ordinare e misurare le distanze). */
export function giornoDi(dataIt: string | undefined): number | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((dataIt || '').trim())
  if (!m) return null
  return Math.floor(Date.UTC(+m[3], +m[2] - 1, +m[1]) / 86_400_000)
}

export interface EsitoImportContabilita {
  partite: Partita[]
  sals: Sal[]
  abbinate: number
  nuove: number
  senzaData: number
}


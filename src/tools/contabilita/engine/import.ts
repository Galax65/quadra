/**
 * Contabilità — import del COMPUTO METRICO in partite contabili.
 * Sorgente: il carrello Computo via bus — strutturalmente compatibile con
 * `CartItem` (shared/compositore).
 *
 * Modalità:
 *  - **misura**: ogni voce → una `Partita` a misura (prezzo, qtyProgetto,
 *    misurazioni conservate per il libretto).
 *  - **corpo**: le voci sono aggregate per CATEGORIA (categorie di lavorazioni
 *    omogenee) in corpi d'opera con importo contrattuale = Σ importi.
 */
import type { MisurazioneRiga } from '../../../shared/compositore/misurazioni'

/** Voce di computo in ingresso — sottoinsieme di `CartItem` (nessuna dipendenza tool→tool). */
export interface VoceImport {
  codice?: string
  desc_short?: string
  declaratoria?: string
  um?: string
  prezzo?: number | null
  qty?: number | null
  categoria?: string
  /** Codice WBS gerarchico, se il file lo porta. */
  wbs?: string
  misurazioni?: MisurazioneRiga[]
  /** Oneri della sicurezza (non soggetti a ribasso). */
  sicurezza?: boolean
  /** Data della misura (contabilità da XPWE). */
  dataMis?: string
  /** Lavoro a corpo (prezzo complessivo fisso). */
  corpo?: boolean
  /** Prezzo unitario offerto dall'aggiudicatario (offerta a prezzi unitari). */
  prezzoOfferto?: number | null
}

const CAT_SEP = ' · '

/** Livello 1 della categoria (la Supercategoria / ambito), o etichetta di ripiego. */
export function categoriaLiv1(categoria?: string): string {
  const c = (categoria || '').trim()
  if (!c) return '(senza categoria)'
  return c.split(CAT_SEP)[0].trim() || '(senza categoria)'
}


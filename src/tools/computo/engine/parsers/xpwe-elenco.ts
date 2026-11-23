/**
 * Prezzario in formato XPWE (TipoDocumento 0: solo elenco prezzi, nessuna
 * misura) — per esempio un prezzario editoriale in formato XPWE. Ogni EPItem con prezzo diventa una
 * riga del prezzario: Tariffa, descrizione ridotta/estesa, U.M., Prezzo1, % manodopera,
 * e i livelli SuperCapitolo › Capitolo › SubCapitolo come capitoli della ricerca.
 */
import type { XpweDoc } from '../../../../shared/xpwe/xpwe'
import type { PriceRow } from '../types'

/** Vero se l'XPWE è un elenco prezzi (nessuna voce di computo, almeno un articolo). */
export function isElencoXpwe(doc: XpweDoc): boolean {
  return doc.voci.length === 0 && doc.elencoPrezzi.length > 0
}

/** Regione/edizione dal nome del file d'origine: l'anno, e se è un listino editoriale. */
export function edizioneDaNome(nome: string): { regione: string | null; anno: string | null } {
  const base = String(nome || '').split(/[\\/]/).pop() || ''
  const anno = base.match(/20\d{2}/)?.[0] ?? null
  // un listino editoriale si riconosce dalla sigla nel nome del file; si mostra senza nome commerciale
  const regione = /\bDEI\b|_DEI|DEI_/i.test(base) ? 'Listino editoriale' : null
  return { regione, anno }
}

export function righeDaElencoXpwe(doc: XpweDoc, fallback: { regione: string; anno: string }): PriceRow[] {
  const out: PriceRow[] = []
  for (const ep of doc.elencoPrezzi) {
    if (!ep.tariffa || !(ep.prezzo > 0)) continue // titoli di capitolo e articoli senza prezzo
    const breve = (ep.desRidotta || ep.desBreve || ep.desEstesa || ep.tariffa).trim()
    const [l1 = '', l2 = '', l3 = ''] = ep.capitolo
    out.push({
      codice: ep.tariffa.trim(),
      declaratoria: (ep.desEstesa || breve).trim(),
      desc_short: breve,
      um: ep.um || '',
      prezzo: ep.prezzo,
      importo_netto: 0,
      ru: ep.incMdo > 0 ? Math.round(ep.incMdo * 100) / 100 : 0,
      liv1: l1, liv2: l2, liv3: l3, liv4: '',
      materia: '', disciplina: l1, sistema: l2, attivita: '', settore: l3,
      keywords: '', tipologia: '',
      regione: fallback.regione, anno: fallback.anno,
    })
  }
  return out
}

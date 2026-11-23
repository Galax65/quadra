/**
 * Un computo XPWE (dagli altri programmi del settore) dentro una revisione del lavoro: ogni
 * voce XPWE diventa un articolo dell'elenco prezzi e una voce con le sue misure.
 * Modulo puro: lo usano main.ts e i test.
 */
import type { Articolo, Voce } from '../../shared/lavoro'
import type { VoceComputo } from '../../shared/xpwe/xpwe'

/** Una voce XPWE → un articolo e una voce del lavoro. */
export function daXpwe(v: VoceComputo): { articolo: Omit<Articolo, 'id'>; voce: Omit<Voce, 'id' | 'articolo'> } {
  return {
    articolo: {
      codice: v.codice || '', descrizione: (v.desc_short || v.declaratoria || '').trim(), ...(v.declaratoria && v.declaratoria !== v.desc_short ? { estesa: v.declaratoria } : {}),
      um: v.um || '', prezzo: v.prezzo ?? null, origine: v.np ? 'np' : v.analisiPrezzi ? 'analisi' : 'prezzario',
      ...(v.codiceOrig ? { codiceOrig: v.codiceOrig } : {}), ...(v.sicurezza ? { sicurezza: true } : {}),
      ...(v.incMdo ? { incMdo: v.incMdo } : {}),
    },
    voce: {
      misure: v.misurazioni ? v.misurazioni.map((m) => ({ ...m })) : [],
      ...(!v.misurazioni?.length && v.qty ? { quantita: v.qty } : {}),
      ...(v.categoria ? { categoria: v.categoria } : {}), ...(v.wbs ? { wbs: v.wbs } : {}), ...(v.corpo ? { corpo: true } : {}),
    },
  }
}

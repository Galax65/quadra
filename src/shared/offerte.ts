/**
 * OFFERTE: richieste d'offerta, quadro comparativo e offerta a prezzi unitari.
 *
 * Un'offerta indica i prezzi unitari voce per voce (per codice d'articolo) oppure un
 * ribasso unico percentuale. Le voci degli oneri della sicurezza non si offrono: restano
 * al prezzo di progetto, fuori dal ribasso. L'importo offerto è Σ quantità × prezzo
 * offerto sulle voci soggette a ribasso; il ribasso risultante è (base − offerta)/base.
 * Modulo puro: niente DOM, testabile.
 */
import type { VoceComputo } from './xpwe/xpwe'
import { importoQta } from './importo'

export interface Offerta {
  id: string
  /** Offerente (impresa o fornitore). */
  nome: string
  data?: string
  /** Ribasso unico % (vale per le voci senza un prezzo offerto esplicito). */
  ribassoPct?: number | null
  /** Prezzi unitari offerti per codice d'articolo. */
  prezzi?: Record<string, number>
  note?: string
}

const r2 = (n: number): number => { const x = Math.abs(n) * 100; return Math.sign(n) * Math.round(Number(x.toPrecision(15))) / 100 }

const qtaVoce = (v: VoceComputo): number =>
  v.misurazioni?.length ? r2(v.misurazioni.reduce((s, m) => s + (m.quantita || 0), 0)) : r2(v.qty ?? 0)

/** Prezzo offerto per una voce: quello esplicito, o il prezzo di progetto ribassato; null se manca. */
export function prezzoOfferto(o: Offerta, v: VoceComputo): number | null {
  if (v.sicurezza) return v.prezzo ?? 0
  const p = o.prezzi?.[v.codice]
  if (p != null && Number.isFinite(p)) return p
  if (o.ribassoPct != null && Number.isFinite(o.ribassoPct)) return r2((v.prezzo ?? 0) * (1 - o.ribassoPct / 100))
  return null
}

export interface EsitoOfferta {
  offerta: Offerta
  /** Σ importi offerti sulle voci soggette a ribasso. */
  importo: number
  /** Importo a base di gara (voci soggette a ribasso, prezzi di progetto). */
  base: number
  /** Ribasso risultante % (4 decimali, come negli atti). */
  ribasso: number | null
  /** Voci soggette a ribasso senza prezzo offerto: offerta incompleta. */
  mancanti: string[]
  /** Posizione in graduatoria (1 = minor prezzo, solo tra le complete). */
  posizione: number | null
}

/** Valuta le offerte sulle voci del computo e le mette in graduatoria (minor prezzo). */
export function valutaOfferte(offerte: Offerta[], voci: VoceComputo[]): EsitoOfferta[] {
  const soggette = voci.filter((v) => !v.sicurezza)
  const base = r2(soggette.reduce((s, v) => s + importoQta(qtaVoce(v), v.prezzo, v.um), 0))
  const esiti: EsitoOfferta[] = offerte.map((o) => {
    let importo = 0
    const mancanti: string[] = []
    for (const v of soggette) {
      const p = prezzoOfferto(o, v)
      if (p == null) { mancanti.push(v.codice); continue }
      importo += importoQta(qtaVoce(v), p, v.um)
    }
    importo = r2(importo)
    const ribasso = base > 0 && !mancanti.length ? Math.round((base - importo) / base * 100 * 1e4) / 1e4 : null
    return { offerta: o, importo, base, ribasso, mancanti, posizione: null }
  })
  const complete = esiti.filter((e) => !e.mancanti.length).sort((a, b) => a.importo - b.importo)
  complete.forEach((e, i) => { e.posizione = i + 1 })
  return esiti
}

/** Le voci del computo con il prezzo dell'offerta aggiudicataria (prezzoOfferto). */
export function vociConOfferta(voci: VoceComputo[], o: Offerta | null | undefined): VoceComputo[] {
  if (!o) return voci
  return voci.map((v) => {
    if (v.sicurezza) return v
    const p = prezzoOfferto(o, v)
    return p == null ? v : { ...v, prezzoOfferto: p }
  })
}

/**
 * Legge una colonna di prezzi incollata da Excel (una riga per voce, nell'ordine delle
 * voci; accetta «1.234,56», «1234.56», «€ 12,5»). Le righe vuote o non numeriche → null.
 */
export function leggiColonnaPrezzi(testo: string): (number | null)[] {
  return String(testo || '').replace(/\r/g, '').split('\n').map((riga) => {
    const cella = riga.split('\t').pop()!.replace(/[€\s]/g, '')
    if (!cella) return null
    const norm = /,\d{1,}$/.test(cella) ? cella.replace(/\./g, '').replace(',', '.') : cella.replace(/,/g, '')
    const n = Number(norm)
    return Number.isFinite(n) ? n : null
  })
}

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
import type { MisurazioneRiga } from '../../../shared/compositore/misurazioni'
import type { Partita, RigaSal, Sal } from './types'
import type { VoceImport } from './import'

let _seq = 0
const uid = (): string => `pc${Date.now().toString(36)}${(_seq++).toString(36)}`

/** «gg/mm/aaaa» → numero di giorni (per ordinare e misurare le distanze). */
export function giornoDi(dataIt: string | undefined): number | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((dataIt || '').trim())
  if (!m) return null
  return Math.floor(Date.UTC(+m[3], +m[2] - 1, +m[1]) / 86_400_000)
}

/** Proposta di SAL: date ordinate, una nuova SAL quando fra due date passano più di `giorni`. */
export function proponiSal(date: string[], giorni = 30): Map<string, number> {
  const uniche = [...new Set(date.filter((d) => giornoDi(d) != null))].sort((a, b) => giornoDi(a)! - giornoDi(b)!)
  const out = new Map<string, number>()
  let n = 0, prec: number | null = null
  for (const d of uniche) {
    const g = giornoDi(d)!
    if (prec == null || g - prec > giorni) n++
    out.set(d, n)
    prec = g
  }
  return out
}

export interface EsitoImportContabilita {
  partite: Partita[]
  sals: Sal[]
  abbinate: number
  nuove: number
  senzaData: number
}

/**
 * Costruisce partite e SAL dalle misure datate. `salPerData` assegna ogni data a un
 * SAL (le voci senza data vanno nel primo SAL). La data del SAL è l'ultima delle sue.
 */
export function contabilitaDaVoci(voci: VoceImport[], partiteEsistenti: Partita[], salPerData: Map<string, number>): EsitoImportContabilita {
  const partite = [...partiteEsistenti]
  let abbinate = 0, nuove = 0, senzaData = 0
  // NESSUN ACCORPAMENTO AUTOMATICO: ogni voce del file resta una voce del libretto,
  // anche se ripete un articolo già annotato (la stessa grondaia misurata due volte, in
  // giorni diversi o nello stesso SAL, sono due annotazioni distinte come nell'originale).
  // Accorpare o duplicare una voce è una scelta del direttore dei lavori, non dell'import.
  const perSal = new Map<number, { partita: Partita; misure: MisurazioneRiga[]; qty: number | null; data?: string }[]>()
  const primo = Math.min(...[...salPerData.values(), 1])
  const prese = new Set<string>()
  for (const v of voci) {
    const codice = (v.codice || '').trim()
    const uguale = (x: Partita): boolean => x.modalita === 'misura' && x.codice.trim() === codice && (x.prezzoUnitario ?? null) === (v.prezzo ?? null)
    // si abbina a una partita di progetto ancora libera: prima quella della STESSA categoria
    let p: Partita | undefined = partite.find((x) => uguale(x) && (x.categoria || '') === (v.categoria || '') && !prese.has(x.id))
      || partite.find((x) => uguale(x) && !prese.has(x.id))
    if (p) abbinate++
    else {
      p = {
        id: uid(), modalita: 'misura', codice, descrizione: (v.desc_short || v.declaratoria || codice).trim(), um: v.um,
        ...(v.declaratoria ? { declaratoria: v.declaratoria.trim() } : {}),
        categoria: v.categoria, ...(v.wbs ? { wbs: v.wbs } : {}), prezzoUnitario: v.prezzo == null || v.prezzo <= 0 ? null : v.prezzo, qtyProgetto: null,
        ...(v.sicurezza ? { sicurezza: true } : {}),
      }
      partite.push(p); nuove++
    }
    prese.add(p.id)
    let n = v.dataMis ? salPerData.get(v.dataMis) : undefined
    if (n == null) { n = primo; senzaData++ }
    const arr = perSal.get(n) || []
    arr.push({ partita: p, misure: v.misurazioni || [], qty: v.misurazioni?.length ? null : (v.qty ?? null), data: v.dataMis })
    perSal.set(n, arr)
  }
  // SAL progressivi
  const numeri = [...new Set([...perSal.keys()])].sort((a, b) => a - b)
  const dataSal = new Map<number, string>()
  for (const [d, n] of salPerData) {
    const cur = dataSal.get(n)
    if (!cur || (giornoDi(d) ?? 0) > (giornoDi(cur) ?? 0)) dataSal.set(n, d)
  }
  // la DATA del rilevamento resta sulla riga: è la colonna «DATA» del libretto,
  // e si perdeva nel momento stesso in cui serviva a dividere i SAL
  const accumulo = new Map<string, { misure: MisurazioneRiga[]; qty: number; data?: string }>()
  const sals: Sal[] = numeri.map((n) => {
    for (const e of perSal.get(n) || []) {
      const a = accumulo.get(e.partita.id) || { misure: [], qty: 0 }
      if (e.misure.length) a.misure = [...a.misure, ...e.misure.map((m) => ({ ...m }))]
      else a.misure = [...a.misure, { descrizione: 'Quantità contabilizzata', quantita: e.qty ?? 0 }]
      if (e.data) a.data = e.data
      accumulo.set(e.partita.id, a)
    }
    const righe: RigaSal[] = [...accumulo.entries()].map(([partitaId, a]) => ({
      partitaId, misurazioni: a.misure.map((m) => ({ ...m })), ...(a.data ? { dataMisura: a.data } : {}),
    }))
    return { numero: n, data: dataSal.get(n), righe }
  })
  return { partite, sals, abbinate, nuove, senzaData }
}

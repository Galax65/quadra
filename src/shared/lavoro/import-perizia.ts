/**
 * L'IMPORT DI UNA PERIZIA XPWE — la variante preparata con un altro programma (o in un altro
 * programma) dentro la perizia in bozza.
 *
 * Gli ARTICOLI: ogni voce del file si abbina all'articolo del contratto con lo
 * stesso codice e lo stesso prezzo. Un articolo che il contratto non ha è un
 * nuovo prezzo (NP); uno con il codice del contratto ma un prezzo diverso
 * anche, perché in perizia i prezzi di contratto non cambiano: entra come NP
 * che deriva da quel codice, e si elenca perché lo si controlli.
 *
 * Le VOCI: con «sostituisci» il file è la perizia intera. Ogni voce del file
 * prende il posto di una voce della perizia con lo stesso articolo (prima la
 * stessa categoria) e ne CONSERVA L'IDENTITÀ: i SAL già emessi la ritrovano.
 * Le voci della perizia che il file non ha si tolgono, tranne quelle già
 * contabilizzate in un SAL emesso: restano, e si elencano. Con «aggiungi» le
 * voci del file si accodano.
 */
import {
  misurata, nuovoId, revisione,
  type Articolo, type Lavoro, type Voce,
} from './modello'

export interface RigaImport { articolo: Omit<Articolo, 'id'>; voce: Omit<Voce, 'id' | 'articolo'> }

export interface EsitoImportPerizia {
  lavoro: Lavoro
  /** Voci della perizia aggiornate dal file (conservano l'identità). */
  aggiornate: number
  /** Voci nuove. */
  nuove: number
  /** Voci tolte perché il file non le ha. */
  tolte: number
  /** Articoli nuovi, entrati come NP. */
  np: { codice: string; descrizione: string; prezzoDiverso?: number }[]
  /** Voci che il file non ha, tenute perché già contabilizzate. */
  tenute: { codice: string; descrizione: string; sal: number }[]
}

const stessoPrezzo = (a: number | null | undefined, b: number | null | undefined): boolean =>
  a == null || b == null ? a == b : Math.abs(a - b) < 0.005

export function importaPerizia(l: Lavoro, perId: string, righe: RigaImport[], modo: 'sostituisci' | 'aggiungi' = 'sostituisci'): EsitoImportPerizia {
  const r = revisione(l, perId)
  if (r.tipo !== 'perizia') throw new Error('Si importa in una perizia')
  if (r.stato !== 'aperta') throw new Error('La perizia è approvata: si legge, non si modifica')

  const articoli = [...r.articoli]
  const np: EsitoImportPerizia['np'] = []
  /** L'articolo per una riga del file: di contratto se codice e prezzo coincidono, altrimenti un NP. */
  const articoloPer = (a: Omit<Articolo, 'id'>): Articolo => {
    const cod = a.codice.trim()
    const uguale = articoli.find((x) => x.codice.trim() === cod && x.um === a.um && stessoPrezzo(x.prezzo, a.prezzo))
    if (uguale) return uguale
    const diContratto = cod ? articoli.find((x) => x.codice.trim() === cod && x.origine !== 'np') : undefined
    const nuovo: Articolo = {
      ...a, id: nuovoId('art'), origine: 'np',
      ...(diContratto ? { codiceOrig: a.codiceOrig || cod } : {}),
    }
    articoli.push(nuovo)
    np.push({ codice: cod, descrizione: a.descrizione, ...(diContratto && diContratto.prezzo != null ? { prezzoDiverso: diContratto.prezzo } : {}) })
    return nuovo
  }

  // quello che i SAL emessi hanno già contabilizzato non si toglie
  const contabilizzate = new Map<string, number>()
  for (const a of l.avanzamenti) {
    if (a.stato !== 'emesso') continue
    for (const x of a.righe) if (misurata(x) && !contabilizzate.has(x.voce)) contabilizzate.set(x.voce, a.n)
  }

  const libere = modo === 'sostituisci' ? [...r.voci] : []
  const voci: Voce[] = []
  let aggiornate = 0, nuove = 0
  for (const riga of righe) {
    const art = articoloPer(riga.articolo)
    const cat = riga.voce.categoria || ''
    const i = [libere.findIndex((v) => v.articolo === art.id && (v.categoria || '') === cat), libere.findIndex((v) => v.articolo === art.id)].find((k) => k >= 0) ?? -1
    if (i >= 0) {
      const [vecchia] = libere.splice(i, 1)
      voci.push({ id: vecchia.id, articolo: art.id, ...riga.voce, misure: riga.voce.misure.map((m) => ({ ...m })) })
      aggiornate++
    } else {
      voci.push({ id: nuovoId('voce'), articolo: art.id, ...riga.voce, misure: riga.voce.misure.map((m) => ({ ...m })) })
      nuove++
    }
  }
  const tenute: EsitoImportPerizia['tenute'] = []
  let tolte = 0
  for (const v of libere) {
    const sal = contabilizzate.get(v.id)
    if (sal != null) {
      const a = articoli.find((x) => x.id === v.articolo)
      tenute.push({ codice: a?.codice || '', descrizione: a?.descrizione || '', sal })
      voci.push(v)
    } else tolte++
  }
  const tutte = modo === 'aggiungi' ? [...r.voci, ...voci] : voci
  // gli articoli che nessuna voce usa più restano solo se erano del contratto
  const usati = new Set(tutte.map((v) => v.articolo))
  const art = articoli.filter((a) => usati.has(a.id) || r.articoli.some((x) => x.id === a.id))
  const lavoro: Lavoro = { ...l, revisioni: l.revisioni.map((x) => (x.id === perId ? { ...x, articoli: art, voci: tutte } : x)) }
  return { lavoro, aggiornate, nuove, tolte, np, tenute }
}

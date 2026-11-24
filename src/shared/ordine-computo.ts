/**
 * ORDINE DELLE VOCI DI COMPUTO — a schermo e in stampa.
 *
 * Tre modi:
 *  - 'manuale'   : l'ordine scelto dall'utente (trascinamento, pulsanti su/giù);
 *  - 'categorie' : raggruppate per Supercategoria › Categoria › Subcategoria;
 *                  i gruppi seguono l'ordine in cui compaiono nell'ordine manuale
 *                  (così si spostano trascinando una voce), le voci senza categoria
 *                  vanno in coda; dentro un gruppo vale l'ordine manuale;
 *  - 'wbs'       : per codice WBS (01, 01.01, 01.02, 02…), senza WBS in coda;
 *                  a parità di codice vale l'ordine manuale.
 *
 * L'ordine manuale (`ordine`) è un elenco di chiavi: le voci che non ci sono
 * (appena aggiunte) seguono nell'ordine in cui arrivano.
 */

export type ModoOrdine = 'manuale' | 'categorie' | 'wbs'

export interface DatiOrdine {
  /** Ordine manuale: chiavi delle voci. */
  ordine?: string[]
  /** Chiave → «Super · Categoria · Sub». */
  categoria?: Record<string, string | undefined>
  /** Chiave → codice WBS. */
  wbs?: Record<string, string | undefined>
  /**
   * Ordine DEFINITO dei nomi per livello [Super, Categoria, Sub] (Struttura, import XPWE).
   * I nomi in elenco seguono questo ordine; quelli non elencati vengono dopo, in ordine
   * di prima comparsa.
   */
  ordineLivelli?: string[][]
}

/** Confronto tra due nomi dello stesso livello secondo l'ordine definito (null = non deciso). */
export function confrontaNomiLivello(ordineLivelli: string[][] | undefined, livello: number, a: string, b: string): number | null {
  const l = ordineLivelli?.[livello]
  if (!l?.length) return null
  const ia = l.indexOf(a), ib = l.indexOf(b)
  if (ia < 0 && ib < 0) return null
  if (ia < 0) return 1
  if (ib < 0) return -1
  return ia - ib
}

export const SEP_CATEGORIA = ' · '

/** Le chiavi nell'ordine manuale: prima quelle note in `ordine`, poi le nuove. */
export function ordineManuale(chiavi: string[], ordine: string[] = []): string[] {
  const presenti = new Set(chiavi)
  const visti = new Set<string>()
  const out: string[] = []
  for (const k of ordine) if (presenti.has(k) && !visti.has(k)) { out.push(k); visti.add(k) }
  for (const k of chiavi) if (!visti.has(k)) { out.push(k); visti.add(k) }
  return out
}

const cmpWbs = (a: string, b: string): number => a.localeCompare(b, 'it', { numeric: true })

/** Ordina le chiavi secondo il modo scelto (ordinamento stabile). */
export function ordinaVoci(chiavi: string[], modo: ModoOrdine, d: DatiOrdine = {}): string[] {
  const base = ordineManuale(chiavi, d.ordine)
  if (modo === 'manuale') return base
  const pos = new Map(base.map((k, i) => [k, i]))
  if (modo === 'wbs') {
    const w = (k: string): string => (d.wbs?.[k] ?? '').trim()
    return [...base].sort((a, b) => {
      const wa = w(a), wb = w(b)
      if (!wa !== !wb) return wa ? -1 : 1
      return (wa && wb ? cmpWbs(wa, wb) : 0) || pos.get(a)! - pos.get(b)!
    })
  }
  // categorie: rango di ogni prefisso (Super, Super·Cat, Super·Cat·Sub) = prima comparsa
  const parti = (k: string): string[] => (d.categoria?.[k] ?? '').split(SEP_CATEGORIA).map(s => s.trim()).filter(Boolean)
  const rango = new Map<string, number>()
  for (const k of base) {
    const p = parti(k)
    for (let i = 1; i <= p.length; i++) {
      const pre = p.slice(0, i).join(SEP_CATEGORIA)
      if (!rango.has(pre)) rango.set(pre, rango.size)
    }
  }
  return [...base].sort((a, b) => {
    const pa = parti(a), pb = parti(b)
    if (!pa.length !== !pb.length) return pa.length ? -1 : 1
    const n = Math.max(pa.length, pb.length)
    for (let i = 1; i <= n; i++) {
      // una voce con la sola Supercategoria viene prima delle sue Categorie
      if (i > pa.length) return -1
      if (i > pb.length) return 1
      // i livelli sopra coincidono (altrimenti si è già deciso): vale l'ordine definito
      if (pa[i - 1] !== pb[i - 1]) {
        const def = confrontaNomiLivello(d.ordineLivelli, i - 1, pa[i - 1], pb[i - 1])
        if (def) return def
      }
      const ra = rango.get(pa.slice(0, i).join(SEP_CATEGORIA))!, rb = rango.get(pb.slice(0, i).join(SEP_CATEGORIA))!
      if (ra !== rb) return ra - rb
    }
    return pos.get(a)! - pos.get(b)!
  })
}

/**
 * Titoli di raggruppamento di una voce, dal livello più alto: le parti della
 * categoria, oppure i nodi WBS che la contengono («01 Opere», «01.02 Scavi»).
 */
export function titoliGruppo(modo: ModoOrdine, categoria: string | undefined, wbs: string | undefined, nodiWbs: Record<string, string> = {}): string[] {
  if (modo === 'categorie') return (categoria ?? '').split(SEP_CATEGORIA).map(s => s.trim()).filter(Boolean)
  if (modo === 'wbs') {
    const c = (wbs ?? '').trim()
    if (!c) return []
    const p = c.split('.')
    return p.map((_, i) => {
      const k = p.slice(0, i + 1).join('.')
      return nodiWbs[k] ? `${k} ${nodiWbs[k]}` : k
    })
  }
  return []
}


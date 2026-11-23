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
import { importoQta } from '../../../shared/importo'
import type { MisurazioneRiga } from '../../../shared/compositore/misurazioni'
import type { Modalita, Partita } from './types'

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

const round2 = (n: number): number => { const x = Math.abs(n) * 100; return Math.sign(n) * Math.round(Number(x.toPrecision(15))) / 100 }
const CAT_SEP = ' · '
let _seq = 0
const uid = (): string => `p${Date.now().toString(36)}${(_seq++).toString(36)}`

/** Livello 1 della categoria (la Supercategoria / ambito), o etichetta di ripiego. */
export function categoriaLiv1(categoria?: string): string {
  const c = (categoria || '').trim()
  if (!c) return '(senza categoria)'
  return c.split(CAT_SEP)[0].trim() || '(senza categoria)'
}

const descOf = (v: VoceImport): string => (v.desc_short || v.declaratoria || '').trim()

/**
 * Import voce per voce: ogni voce → una partita, A MISURA o, se la voce è segnata a corpo
 * nel computo, A CORPO con importo fisso = quantità × prezzo. Con un'offerta a prezzi
 * unitari il prezzo di contratto è quello offerto (il prezzo di progetto resta in prezzoBase).
 */
export function importaAMisura(voci: VoceImport[]): Partita[] {
  return voci.map((v) => {
    const offerto = v.prezzoOfferto != null && !v.sicurezza ? v.prezzoOfferto : null
    const prezzo = offerto ?? v.prezzo
    if (v.corpo && !v.sicurezza) {
      return {
        id: uid(), modalita: 'corpo' as Modalita, codice: (v.codice || '').trim(), descrizione: descOf(v),
        ...(v.declaratoria && v.declaratoria.trim() !== descOf(v) ? { declaratoria: v.declaratoria.trim() } : {}),
        um: v.um, categoria: v.categoria, ...(v.wbs ? { wbs: v.wbs } : {}),
        importoContrattuale: importoQta(v.qty, prezzo, v.um),
        ...(offerto != null ? { prezzoBase: v.prezzo ?? null } : {}),
        qtyProgetto: v.qty ?? null,
      }
    }
    return voceAMisura(v, offerto)
  })
}
function voceAMisura(v: VoceImport, offerto: number | null): Partita {
  return {
    id: uid(),
    modalita: 'misura' as Modalita,
    codice: (v.codice || '').trim(),
    descrizione: descOf(v),
    ...(v.declaratoria && v.declaratoria.trim() !== descOf(v) ? { declaratoria: v.declaratoria.trim() } : {}),
    um: v.um,
    categoria: v.categoria,
    ...(v.wbs ? { wbs: v.wbs } : {}),
    ...(v.sicurezza ? { sicurezza: true } : {}),
    prezzoUnitario: offerto != null ? offerto : (v.prezzo == null || v.prezzo <= 0 ? null : v.prezzo),
    // il prezzo contrattuale (eventualmente quello OFFERTO, che è il prezzo del
    // contratto) resta registrato: la contabilità si fa a prezzi di contratto
    prezzoContratto: offerto != null ? offerto : (v.prezzo == null || v.prezzo <= 0 ? null : v.prezzo),
    ...(offerto != null ? { prezzoBase: v.prezzo ?? null } : {}),
    qtyProgetto: v.qty ?? null,
    ...(v.misurazioni && v.misurazioni.length ? { misurazioniProgetto: v.misurazioni } : {}),
  }
}

/** Import A CORPO: aggrega le voci per categoria (liv.1) in corpi d'opera. */
export function importaACorpo(voci: VoceImport[]): Partita[] {
  const gruppi = new Map<string, { importo: number; codici: string[] }>()
  for (const v of voci) {
    const cat = categoriaLiv1(v.categoria)
    const imp = importoQta(v.qty, v.prezzo, v.um)
    const g = gruppi.get(cat) || { importo: 0, codici: [] }
    g.importo = round2(g.importo + imp)
    if (v.codice) g.codici.push(v.codice.trim())
    gruppi.set(cat, g)
  }
  let n = 0
  return [...gruppi.entries()].map(([cat, g]) => ({
    id: uid(),
    modalita: 'corpo' as Modalita,
    codice: `C${String(++n).padStart(2, '0')}`,
    descrizione: cat,
    categoria: cat,
    importoContrattuale: g.importo,
  }))
}

/** Import secondo la modalità scelta. Per «misto» il default è a misura (l'utente potrà convertire gruppi a corpo). */
export function importaComputo(voci: VoceImport[], modalita: Modalita, ribassoPct?: number | null): Partita[] {
  const v = ribassoPct ? vociRibassate(voci, ribassoPct) : voci
  return modalita === 'corpo' ? importaACorpo(v) : importaAMisura(v)
}

/**
 * Applica il ribasso d'asta ai prezzi di progetto: è così che il computo diventa
 * CONTRATTO. Gli oneri della sicurezza non sono soggetti a ribasso, e un prezzo
 * già offerto voce per voce è di per sé il prezzo di contratto.
 */
export function vociRibassate(voci: VoceImport[], ribassoPct: number): VoceImport[] {
  const k = 1 - ribassoPct / 100
  return voci.map((v) => (v.sicurezza || v.prezzoOfferto != null || v.prezzo == null
    ? v
    : { ...v, prezzo: round2(v.prezzo * k) }))
}

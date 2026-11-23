/**
 * LE FASI DEL PROGETTO E LA PROMOZIONE A CONTRATTO (tappa 8 di
 * Docs/06-Interfaccia-unica.md).
 *
 * Il computo in corso non è «un computo» e basta: è il computo di una FASE del
 * progetto — PFTE, definitivo, esecutivo (All. I.7 D.Lgs. 36/2023). La fase si
 * chiude congelandola in una revisione e si passa alla successiva; non si torna
 * indietro per sbaglio, perché a ogni passaggio resta la fotografia di quella prima.
 *
 * Il CONTRATTO non è il computo di adesso con un ribasso scritto da qualche
 * parte. È un atto: si sceglie QUALE computo diventa contratto (quello in corso
 * o una revisione congelata, di solito l'esecutivo posto a base di gara) e COME
 * (ribasso d'asta, o prezzi unitari dell'offerta aggiudicata), e il risultato si
 * fotografa. La Contabilità importa quell'atto: se dopo il computo cambia, il
 * contratto resta quello firmato.
 *
 * Modulo PURO.
 */
import type { VoceComputo } from './xpwe/xpwe'
import { prezzoOfferto, type Offerta } from './offerte'
import { importoQta } from './importo'

/** Le fasi del progetto, nell'ordine in cui si attraversano. */
export const FASI_PROGETTO = ['PFTE', 'definitivo', 'esecutivo'] as const
export type FaseProgetto = (typeof FASI_PROGETTO)[number]

/** Come si chiama la fase a schermo. */
export const NOME_FASE: Record<FaseProgetto, string> = {
  PFTE: 'PFTE',
  definitivo: 'Definitivo',
  esecutivo: 'Esecutivo',
}

/** «al definitivo», «all'esecutivo», «al PFTE»: la preposizione giusta davanti alla fase. */
export function allaFase(f: FaseProgetto): string {
  return f === 'esecutivo' ? "all'esecutivo" : f === 'definitivo' ? 'al definitivo' : 'al PFTE'
}
/** «sul definitivo», «sull'esecutivo». */
export function sullaFase(f: FaseProgetto): string {
  return f === 'esecutivo' ? "sull'esecutivo" : f === 'definitivo' ? 'sul definitivo' : 'sul PFTE'
}

/** La fase di un computo salvato prima che le fasi esistessero: si comincia dal PFTE. */
export function faseDi(v: unknown): FaseProgetto {
  return (FASI_PROGETTO as readonly string[]).includes(String(v)) ? (v as FaseProgetto) : 'PFTE'
}

/** La fase dopo questa, o null se è l'ultima (dopo l'esecutivo viene il contratto). */
export function faseSuccessiva(f: FaseProgetto): FaseProgetto | null {
  const i = FASI_PROGETTO.indexOf(f)
  return i >= 0 && i < FASI_PROGETTO.length - 1 ? FASI_PROGETTO[i + 1] : null
}

/* ── Il contratto ─────────────────────────────────────────────────────── */

/** Da quale computo nasce il contratto. */
export interface FonteContratto {
  tipo: 'corrente' | 'revisione'
  /** id della revisione, se viene da una revisione congelata. */
  id?: string
  /** Come la si riconosce: «Computo esecutivo in corso», «rev.02 Esecutivo». */
  nome: string
  fase?: string
}

export interface AttoContratto {
  fonte: FonteContratto
  /** Ribasso d'asta in %, che la Contabilità deduce sul totale dei lavori di ogni SAL. */
  ribassoPct?: number
  /** Offerta a prezzi unitari: ogni voce porta il suo prezzo offerto. */
  prezziOfferti?: boolean
  /** Chi ha fatto l'offerta aggiudicata, se il contratto è a prezzi unitari. */
  offerente?: string
  data: string
  ts: number
  /** Le voci del contratto, fotografate: la Contabilità importa queste. */
  voci: VoceComputo[]
  /** Importo dei lavori a base d'asta (prezzi di progetto). */
  baseAsta: number
  /** Oneri della sicurezza: non soggetti a ribasso. */
  sicurezza: number
  /** Importo contrattuale: base d'asta ribassata (o prezzi offerti) + sicurezza. */
  importo: number
}

const r2 = (n: number): number => Math.round(n * 100) / 100

/** Una voce di revisione, nella forma minima che serve qui (engine/revisioni.ts del Computo). */
export interface VoceDiRevisione {
  key: string
  codice: string
  descrizione: string
  um: string
  prezzo: number
  qty: number
  corpo?: boolean
  sicurezza?: boolean
  categoria?: string
  wbs?: string
  misurazioni?: { descrizione?: string; quantita: number }[]
}

/** Le voci di una revisione congelata, nella forma in cui viaggia un computo. */
export function vociDaRevisione(voci: VoceDiRevisione[]): (VoceComputo & { _key?: string })[] {
  return voci.map((v) => ({
    _key: v.key,
    codice: v.codice,
    desc_short: v.descrizione,
    um: v.um,
    prezzo: v.prezzo,
    qty: v.qty,
    ...(v.categoria ? { categoria: v.categoria } : {}),
    ...(v.wbs ? { wbs: v.wbs } : {}),
    ...(v.sicurezza ? { sicurezza: true } : {}),
    ...(v.corpo ? { corpo: true } : {}),
    ...(v.misurazioni?.length ? { misurazioni: v.misurazioni.map((m) => ({ ...m })) } : {}),
  }) as VoceComputo & { _key?: string })
}

const qtyDi = (v: VoceComputo): number => (v.misurazioni?.length ? v.misurazioni.reduce((s, m) => s + (m.quantita || 0), 0) : (v.qty ?? 0))

/**
 * L'atto di promozione: il computo scelto diventa contratto, con il ribasso
 * oppure con i prezzi dell'offerta. Le due cose insieme no — il prezzo offerto
 * È già il prezzo di contratto, e ribassarlo di nuovo sarebbe contarlo due volte.
 */
export function promuoviAContratto(o: {
  fonte: FonteContratto
  voci: VoceComputo[]
  data: string
  ts: number
  ribassoPct?: number | null
  offerta?: (Offerta & { nome?: string }) | null
}): AttoContratto {
  if (!o.voci.length) throw new Error('Il computo scelto non ha voci: non può diventare contratto')
  const conOfferta = !!o.offerta
  const rib = !conOfferta && o.ribassoPct != null && Number.isFinite(o.ribassoPct) && o.ribassoPct > 0 ? o.ribassoPct : undefined
  if (rib != null && rib >= 100) throw new Error('Un ribasso del 100% o più non è un contratto')
  const voci = o.voci.map((v) => {
    // ogni voce si porta il SUO prezzo di contratto: con l'offerta quello offerto
    const { prezzoOfferto: _p, ...pulita } = v as VoceComputo & { prezzoOfferto?: number }
    void _p
    if (!conOfferta || v.sicurezza) return pulita as VoceComputo
    const p = prezzoOfferto(o.offerta!, v)
    return (p == null ? pulita : { ...pulita, prezzoOfferto: p }) as VoceComputo
  })
  let baseAsta = 0, sicurezza = 0, offerto = 0
  for (const v of voci) {
    const imp = importoQta(qtyDi(v), v.prezzo ?? 0, v.um)
    if (v.sicurezza) { sicurezza += imp; continue }
    baseAsta += imp
    const po = (v as VoceComputo & { prezzoOfferto?: number }).prezzoOfferto
    offerto += po != null ? importoQta(qtyDi(v), po, v.um) : imp
  }
  const lavori = conOfferta ? offerto : rib != null ? baseAsta * (1 - rib / 100) : baseAsta
  return {
    fonte: o.fonte,
    ...(rib != null ? { ribassoPct: rib } : {}),
    ...(conOfferta ? { prezziOfferti: true, ...(o.offerta!.nome ? { offerente: o.offerta!.nome } : {}) } : {}),
    data: o.data,
    ts: o.ts,
    voci,
    baseAsta: r2(baseAsta),
    sicurezza: r2(sicurezza),
    importo: r2(lavori + sicurezza),
  }
}

/** In una riga: da dove viene il contratto e come è stato fatto. */
export function descriviContratto(a: Pick<AttoContratto, 'fonte' | 'ribassoPct' | 'prezziOfferti' | 'offerente'>): string {
  const come = a.prezziOfferti ? `prezzi unitari${a.offerente ? ` di ${a.offerente}` : ''}` : a.ribassoPct != null ? `ribasso ${String(a.ribassoPct).replace('.', ',')}%` : 'senza ribasso'
  return `${a.fonte.nome} · ${come}`
}

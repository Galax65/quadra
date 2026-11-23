/**
 * COMPUTO METRICO — misurazioni multi-riga per una voce di carrello, stile
 * Ogni riga è un prodotto di fino a 4 fattori liberi (L1×L2×H×n,
 * tipico lunghezza×larghezza×altezza×numero-di-elementi) con una descrizione
 * libera (es. "piano terra", "corridoio nord"); più righe si sommano per la
 * quantità totale della voce. Un fattore `n` negativo è la detrazione tipica
 * (es. vani porta da sottrarre da una superficie muraria).
 *
 * Modulo PURO (nessun DOM), condiviso accanto a `cart-item.ts`/`analisi-prezzi.ts`.
 */

export interface MisurazioneRiga {
  descrizione?: string
  l1?: number | null
  l2?: number | null
  h?: number | null
  n?: number | null
  /** Prodotto dei fattori presenti (assenti = 1, non 0); negativo = detrazione. */
  quantita: number
  /**
   * Formule originali dei fattori quando non sono un numero semplice (es. par.ug.
   * «12+250+65»): si stampano accanto alla misura e si riscrivono nell'XPWE.
   */
  formule?: Partial<Record<'n' | 'l1' | 'l2' | 'h', string>>
  /** «Vedi voce»: chiave della voce di computo la cui quantità diventa il fattore L1. */
  vediVoce?: string
}

const round2 = (n: number): number => { const x = Math.abs(n) * 100; return Math.sign(n) * Math.round(Number(x.toPrecision(15))) / 100 }

/**
 * Prodotto dei fattori presenti: un fattore assente/null NON azzera il
 * risultato (altrimenti valorizzare solo L1 darebbe sempre 0) — si comporta
 * come 1, esattamente come le colonne vuote in `PRODUCT(E:H)`.
 */
export function calcolaRigaMisurazione(r: Pick<MisurazioneRiga, 'l1' | 'l2' | 'h' | 'n'>): number {
  const fattori = [r.l1, r.l2, r.h, r.n].filter((f): f is number => f != null && Number.isFinite(f))
  if (!fattori.length) return 0
  return round2(fattori.reduce((p, f) => p * f, 1))
}

/** Somma algebrica delle `quantita` delle righe (le detrazioni sottraggono naturalmente). */
export function sommaMisurazioni(righe: MisurazioneRiga[] | undefined | null): number {
  if (!righe || !righe.length) return 0
  return round2(righe.reduce((s, r) => s + (r.quantita || 0), 0))
}

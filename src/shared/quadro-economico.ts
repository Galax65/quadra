/**
 * QUADRO ECONOMICO dell'intervento (D.Lgs. 36/2023, All. I.7 art. 5 per i contenuti
 * del progetto): A) lavori, B) somme a disposizione della stazione appaltante.
 *
 * A1 lavori (dal computo, escluse le voci di sicurezza) · A2 oneri della sicurezza
 * non soggetti a ribasso (voci di sicurezza del computo + eventuale importo da PSC).
 * Le righe B sono libere: importo fisso oppure percentuale di una base, che può
 * essere «A» (totale lavori), «A1», «A2» o il codice di un'altra riga B (o più
 * codici separati da «+», es. «B2+B3» per l'IVA sulle spese tecniche con cassa).
 */

export interface RigaQE {
  codice: string
  descrizione: string
  /** 'importo' = valore in euro; 'percentuale' = valore % della base. */
  tipo: 'importo' | 'percentuale'
  valore: number
  base?: string
}

export interface QuadroEconomico {
  /** Oneri della sicurezza aggiunti a mano (es. costi da PSC non computati a voci). */
  sicurezzaExtra?: number
  righeB: RigaQE[]
}

export interface RisultatoQE {
  a1: number
  a2: number
  a: number
  righeB: (RigaQE & { importo: number })[]
  b: number
  totale: number
}

const r2 = (n: number): number => { const x = Math.abs(n) * 100; return Math.sign(n) * Math.round(Number(x.toPrecision(15))) / 100 }

/** Somme a disposizione proposte per un nuovo progetto (modificabili). */
export function righeBPredefinite(): RigaQE[] {
  return [
    { codice: 'B1', descrizione: 'IVA sui lavori', tipo: 'percentuale', valore: 10, base: 'A' },
    { codice: 'B2', descrizione: 'Spese tecniche (progettazione, direzione lavori, sicurezza)', tipo: 'importo', valore: 0 },
    { codice: 'B3', descrizione: 'Contributo previdenziale sulle spese tecniche', tipo: 'percentuale', valore: 4, base: 'B2' },
    { codice: 'B4', descrizione: 'IVA sulle spese tecniche e contributi', tipo: 'percentuale', valore: 22, base: 'B2+B3' },
    { codice: 'B5', descrizione: 'Incentivi per funzioni tecniche (art. 45 D.Lgs. 36/2023)', tipo: 'percentuale', valore: 2, base: 'A' },
    { codice: 'B6', descrizione: 'Imprevisti', tipo: 'percentuale', valore: 5, base: 'A' },
    { codice: 'B7', descrizione: 'Contributo ANAC', tipo: 'importo', valore: 0 },
    { codice: 'B8', descrizione: 'Arrotondamenti', tipo: 'importo', valore: 0 },
  ]
}

export function normalizzaQE(q: Partial<QuadroEconomico> | undefined | null): QuadroEconomico {
  const righe = Array.isArray(q?.righeB) ? q!.righeB.filter(r => r && typeof r.codice === 'string') : righeBPredefinite()
  return {
    sicurezzaExtra: Number(q?.sicurezzaExtra) || 0,
    righeB: righe.map(r => ({
      codice: String(r.codice).trim(),
      descrizione: String(r.descrizione ?? ''),
      tipo: r.tipo === 'percentuale' ? 'percentuale' : 'importo',
      valore: Number(r.valore) || 0,
      base: r.base ? String(r.base).trim() : undefined,
    })),
  }
}

/**
 * Calcola il quadro. `lavori` = importo totale del computo, `sicurezza` = parte del
 * computo fatta di voci di sicurezza. Le basi che rimandano a righe B si risolvono
 * nell'ordine (una riga può riferirsi solo a righe che la precedono).
 */
export function calcolaQE(q: QuadroEconomico, lavori: number, sicurezza = 0): RisultatoQE {
  const a2 = r2(sicurezza + (q.sicurezzaExtra ?? 0))
  const a1 = r2(lavori - sicurezza)
  const a = r2(a1 + a2)
  const val = new Map<string, number>([['A', a], ['A1', a1], ['A2', a2]])
  const righeB = q.righeB.map(r => {
    let importo = r.valore
    if (r.tipo === 'percentuale') {
      const base = (r.base || 'A').split('+').map(s => s.trim().toUpperCase()).filter(Boolean)
        .reduce((s, c) => s + (val.get(c) ?? 0), 0)
      importo = base * r.valore / 100
    }
    importo = r2(importo)
    val.set(r.codice.toUpperCase(), importo)
    return { ...r, importo }
  })
  const b = r2(righeB.reduce((s, r) => s + r.importo, 0))
  return { a1, a2, a, righeB, b, totale: r2(a + b) }
}

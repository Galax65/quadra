/**
 * Importo di una voce: quantità × prezzo, con una regola da rispettare.
 * Le voci con unità di misura «%» (es. costi della sicurezza espressi in percentuale)
 * hanno per prezzo la BASE e per quantità la percentuale: importo = q × p / 100.
 */
export function fattoreUm(um: string | null | undefined): number {
  return String(um ?? '').trim() === '%' ? 0.01 : 1
}

const r2 = (n: number): number => { const x = Math.abs(n) * 100; return Math.sign(n) * Math.round(Number(x.toPrecision(15))) / 100 }

/** Importo arrotondato al centesimo, rispettando le voci in «%». */
export function importoQta(qty: number | null | undefined, prezzo: number | null | undefined, um?: string | null): number {
  return r2((qty || 0) * (prezzo || 0) * fattoreUm(um))
}

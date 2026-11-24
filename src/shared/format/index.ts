/**
 * Formattatori numerici/valuta CONDIVISI (italiano). Prima duplicati dentro i
 * motori dei singoli tool (es. computo, contabilità): accentrati qui perché
 * Contabilità è fittamente monetario e non serviva una terza copia. Modulo PURO (no DOM),
 * deterministico via `Intl` sul locale 'it-IT'.
 */

const round2 = (n: number): number => { const x = Math.abs(n) * 100; return Math.sign(n) * Math.round(Number(x.toPrecision(15))) / 100 }

/** Numero con 2 decimali all'italiana ("1.234,50"); null/NaN → stringa vuota. */
export function num(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' as unknown as boolean })
}

/** Importo in euro ("€ 1.234,50"); null → em dash. */
export function eur(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return '€ ' + num(n)
}

/** Percentuale all'italiana; `decimals` cifre decimali (default 2). null → em dash. */
export function pct(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: 'always' as unknown as boolean }) + '%'
}

/**
 * Percentuale «esatta»: tante cifre decimali quante ne ha davvero il numero,
 * fino a un massimo. Un ribasso d'asta si scrive com'è stato offerto — 5,086%
 * non è 5,09%: arrotondarlo in un atto contabile significa dichiarare una
 * condizione contrattuale diversa da quella pattuita.
 */
export function pctEsatta(n: number | null | undefined, max = 5): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: max }) + '%'
}

export { round2 }

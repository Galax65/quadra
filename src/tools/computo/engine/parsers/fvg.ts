/**
 * Parser per il **Prezzario regionale dei lavori pubblici Friuli Venezia Giulia**
 * (pubblico, XLSX «descrizioni estese», es. 2026/1).
 *
 * Un solo foglio. Riga 1 = titolo («… Friuli Venezia Giulia 2026/1 …»), riga 2 =
 * intestazioni, poi i dati:
 *   [0] Codice · [1] Breve · [2] Estesa · [3] Voce ("x") · [4] Cod. U.M. ·
 *   [5] Des. U.M. · [6] Prezzo · [7] Pz. Man. (€) · [8] % Man.
 *
 * La gerarchia è nel codice puntato, a segmenti:
 *   01 (capitolo) › 01.1 (sezione) › 01.1.AB1 (gruppo) › 01.1.AB1.01 (voce)
 *   › 01.1.AB1.01.A (sottovoce/variante).
 * È voce di prezzario ogni riga con prezzo, a qualunque profondità (la maggior
 * parte sono sottovoci a 5 segmenti, ma molte voci a 4 hanno prezzo proprio).
 * Le sottovoci di norma NON hanno la descrizione estesa: la ereditano dalla voce
 * madre (stesso codice senza l'ultimo segmento) e vi aggiungono la propria breve.
 */
import type { ParseResult, PriceRow } from '../types'

const clean = (s: unknown): string => String(s ?? '').replace(/\s+/g, ' ').trim()

/** Prezzi nel grezzo come testo con punto decimale ("27.32"); tollera anche la virgola. */
function num(s: unknown): number {
  let t = clean(s).replace(/€/g, '').replace(/\s/g, '')
  if (!t) return 0
  if (t.includes(',') && t.includes('.')) t = t.replace(/\./g, '').replace(',', '.')
  else if (t.includes(',')) t = t.replace(',', '.')
  const n = parseFloat(t)
  return isFinite(n) ? n : 0
}

/** Vero se la griglia è un prezzario FVG: titolo regionale o intestazioni tipiche. */
export function isFvg(grid: unknown[][]): boolean {
  for (const row of grid.slice(0, 5)) {
    const a = clean(row?.[0]).toLowerCase()
    if (a.includes('friuli venezia giulia') && a.includes('prezzario')) return true
    if (a === 'codice' && clean(row?.[1]).toLowerCase() === 'breve' && clean(row?.[2]).toLowerCase() === 'estesa') return true
  }
  return false
}

/** Codice della voce madre: toglie l'ultimo segmento ("01.1.AB1.01.A" → "01.1.AB1.01"). */
const parentOf = (codice: string): string => codice.split('.').slice(0, -1).join('.')

interface Nodo { breve: string; estesa: string }

/**
 * @param grid righe del foglio (XLSX.utils.sheet_to_json header:1)
 * @param fallback regione/anno di default (l'anno si legge comunque dal titolo)
 */
export function parseFvg(grid: unknown[][], fallback: { regione?: string; anno?: string } = {}): ParseResult {
  const regione = fallback.regione ?? 'Friuli V.G.'
  const titolo = clean(grid[0]?.[0])
  // «2026/1» → edizione del prezzario; altrimenti l'anno del percorso
  const anno = titolo.match(/20\d{2}(?:\/\d+)?/)?.[0] ?? fallback.anno ?? null

  const nodi = new Map<string, Nodo>()
  const rows: PriceRow[] = []

  for (const row of grid) {
    const codice = clean(row?.[0])
    if (!codice || !/^[0-9A-Za-z]+(\.[0-9A-Za-z]+)*$/.test(codice)) continue // titolo, intestazioni, righe vuote
    const breve = clean(row[1])
    const estesa = clean(row[2])
    nodi.set(codice, { breve, estesa })

    const prezzo = num(row[6])
    if (prezzo <= 0) continue

    // antenati per livello (capitolo, sezione, gruppo, voce madre…)
    const segs = codice.split('.')
    const antenati: Nodo[] = []
    for (let k = 1; k < segs.length; k++) {
      const n = nodi.get(segs.slice(0, k).join('.'))
      if (n) antenati.push(n)
    }
    const madre = segs.length >= 5 ? nodi.get(parentOf(codice)) : undefined

    // descrizione estesa: la propria; per le sottovoci quella della madre + la breve
    let declaratoria = estesa
    if (!declaratoria && madre) declaratoria = [madre.estesa || madre.breve, breve].filter(Boolean).join(' – ')
    if (!declaratoria) declaratoria = breve || codice
    // anteprima breve: per le sottovoci «MADRE: variante»
    const desc_short = madre && madre.breve && breve ? `${madre.breve}: ${breve}` : (breve || codice)

    const lv = antenati.slice(0, 3).map(n => n.breve)
    rows.push({
      codice,
      declaratoria,
      desc_short,
      um: clean(row[5]) || clean(row[4]),
      prezzo,
      importo_netto: 0,
      ru: num(row[8]),
      liv1: lv[0] ?? '', liv2: lv[1] ?? '', liv3: lv[2] ?? '', liv4: madre?.breve ?? '',
      materia: '', disciplina: lv[0] ?? '', sistema: lv[1] ?? '', attivita: '', settore: lv[2] ?? '',
      keywords: '', tipologia: '',
      regione, anno: anno ?? '',
    })
  }

  return { rows, regione, anno }
}

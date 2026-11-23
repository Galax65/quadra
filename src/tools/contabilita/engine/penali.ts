/**
 * PENALI PER IL RITARDO (art. 126 D.Lgs. 36/2023).
 *
 * La penale giornaliera è stabilita dal contratto fra lo 0,3 e l'1 per mille
 * dell'ammontare netto contrattuale, in relazione all'entità delle conseguenze
 * del ritardo; l'importo complessivo non può superare il 10% dell'ammontare
 * netto contrattuale. Oltre quella soglia il RUP valuta la risoluzione: il
 * programma lo dice, non decide al posto suo.
 *
 * I giorni di ritardo NON si contano qui: vengono dai tempi contrattuali, cioè
 * dagli atti (consegna, sospensioni, riprese, proroghe, ultimazione). Una
 * penale calcolata su un termine che non tiene conto di una sospensione è una
 * penale sbagliata, e si contesta in due righe.
 */
import { escHtml } from '../../../shared/doc/doc'
import { eur } from '../../../shared/format'
import type { Appalto, Partita } from './types'
import { round2, totaleContrattuale } from './contabilita'
import { datiContratto } from './dati-contratto'
import type { Tempi } from './tempi'

/** Limiti di legge: la penale giornaliera sta fra questi due valori per mille. */
export const PENALE_MILLE_MIN = 0.3
export const PENALE_MILLE_MAX = 1
/** Tetto complessivo: 10% dell'ammontare netto contrattuale. */
export const PENALE_TETTO_PCT = 10

export interface EsitoPenale {
  /** Giorni di ritardo sul termine vigente (0 se nei termini). */
  giorni: number
  /** Millesimi applicati (quelli di contratto, o il minimo di legge). */
  permille: number
  /** Base di calcolo: ammontare netto contrattuale. */
  base: number
  /** Penale giornaliera. */
  giornaliera: number
  /** Penale dovuta, già ricondotta al tetto. */
  importo: number
  tetto: number
  /** true se il calcolo ha superato il tetto ed è stato ricondotto. */
  alTetto: boolean
  /** Millesimi fuori dai limiti di legge, così come sono stati inseriti. */
  fuoriLimite: boolean
  /** Che cosa manca per calcolare (termine non determinabile, base a zero…). */
  nonCalcolabile?: string
}

export function penale(appalto: Appalto, partite: Partita[], t: Tempi): EsitoPenale {
  const permille = appalto.penalePerMille ?? PENALE_MILLE_MIN
  const d = datiContratto(appalto, partite)
  const base = round2(d.importoContratto || totaleContrattuale(appalto, partite))
  const giornaliera = round2(base * permille / 1000)
  const tetto = round2(base * PENALE_TETTO_PCT / 100)
  const giorni = t.ritardo
  const lordo = round2(giornaliera * giorni)
  const importo = Math.min(lordo, tetto)
  return {
    giorni, permille, base, giornaliera, importo: round2(importo), tetto,
    alTetto: lordo > tetto,
    fuoriLimite: permille < PENALE_MILLE_MIN || permille > PENALE_MILLE_MAX,
    nonCalcolabile: !base ? "manca l'ammontare netto contrattuale"
      : t.termineVigente ? undefined : (t.nonCalcolabile || "il termine per l'ultimazione non è determinabile"),
  }
}

/** La penale entra negli atti solo se c'è davvero un ritardo da trattenere. */
export function penaleDovuta(p: EsitoPenale): boolean {
  return !p.nonCalcolabile && p.giorni > 0 && p.importo > 0
}

const g = (n: number): string => `${n} ${n === 1 ? 'giorno' : 'giorni'}`

/** Prospetto della penale, per il conto finale e lo stato finale. */
export function penaleHTML(p: EsitoPenale, t: Tempi): string {
  if (p.nonCalcolabile) {
    return `<h2 class="sec-h">Penale per il ritardo</h2>
      <p class="warn"><b>Penale non calcolabile:</b> ${escHtml(p.nonCalcolabile)}. Finché il dato manca, nessuna trattenuta per ritardo può essere disposta.</p>`
  }
  if (!p.giorni) {
    return `<h2 class="sec-h">Penale per il ritardo</h2>
      <p class="note">I lavori risultano ultimati entro il termine vigente${t.termineVigente ? ` del ${escHtml(t.termineVigente)}` : ''}: nessuna penale.</p>`
  }
  return `
    <h2 class="sec-h">Penale per il ritardo</h2>
    <table class="dtable">
      <tbody>
        <tr><td>Termine vigente per l'ultimazione</td><td class="num">${t.termineVigente ? escHtml(t.termineVigente) : '—'}</td></tr>
        <tr><td>Ultimazione dei lavori</td><td class="num">${t.ultimazione ? escHtml(t.ultimazione) : '<i>non ultimati</i>'}</td></tr>
        <tr><td>Ritardo</td><td class="num">${g(p.giorni)}</td></tr>
        <tr><td>Ammontare netto contrattuale</td><td class="num">${eur(p.base)}</td></tr>
        <tr><td>Penale giornaliera (${String(p.permille).replace('.', ',')} per mille)</td><td class="num">${eur(p.giornaliera)}</td></tr>
        <tr class="tot"><td>Penale dovuta${p.alTetto ? ` (ricondotta al tetto del ${PENALE_TETTO_PCT}%)` : ''}</td><td class="num">${eur(p.importo)}</td></tr>
      </tbody>
    </table>
    ${p.fuoriLimite ? `<p class="warn">La penale giornaliera indicata (${String(p.permille).replace('.', ',')}‰) è fuori dai limiti dell'art. 126 c. 1 D.Lgs. 36/2023, che la fissa fra lo 0,3 e l'1 per mille dell'ammontare netto contrattuale.</p>` : ''}
    ${p.alTetto ? `<p class="warn">La penale calcolata supera il <b>10% dell'ammontare netto contrattuale</b>: è stata ricondotta al tetto. Il responsabile unico del progetto valuta la risoluzione del contratto (art. 126 c. 2).</p>` : ''}
    <p class="note">La penale si applica sull'ammontare netto contrattuale e si trattiene in sede di conto finale, salvo diversa determinazione della stazione appaltante sulle cause del ritardo.</p>`
}

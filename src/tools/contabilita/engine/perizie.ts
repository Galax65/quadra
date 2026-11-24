/**
 * Contabilità — PERIZIE DI VARIANTE (art. 120 D.Lgs. 36/2023).
 *
 *  - `partiteVigenti`: le partite con quantità/importi del contratto VIGENTE al SAL n
 *    (contratto originario modificato dalle perizie con `dalSal ≤ n`, nell'ordine);
 *  - `quadroComparativo`: confronto voce per voce fra stato precedente e perizia,
 *    con aumenti, diminuzioni e variazione % sull'importo contrattuale (il «quinto
 *    d'obbligo» dell'art. 120 c.9 è segnalato, non deciso: la valutazione è del RUP);
 *  - `allineaQuotaCorpo`: ALLINEAMENTO delle voci a corpo — se la perizia cambia
 *    l'importo di un corpo d'opera, la quota % già eseguita si ricalcola sul nuovo
 *    importo in modo che l'importo maturato resti identico (quota × vecchio / nuovo).
 */
import type { Appalto, Partita, Perizia, VocePerizia } from './types'
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { eur, num, pct } from '../../../shared/format'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi, firmeHTML, ilDirettore } from './doc-common'
import { importoContrattualePartita, round2 } from './contabilita'
import { sommaMisurazioni } from '../../../shared/compositore/misurazioni'

/**
 * Le perizie IN VIGORE al SAL n: approvate e con vigenza raggiunta. Una perizia
 * in bozza non cambia ancora il contratto — i lavori che introduce si
 * contabilizzano in conto provvisorio fino all'approvazione.
 * (`approvata` assente = approvata: i progetti già in corso non cambiano di
 * significato quando aggiorni il programma.)
 */
export const periziaApprovata = (p: Perizia): boolean => p.approvata !== false

export function perizieAl(perizie: Perizia[] | undefined, salNumero: number): Perizia[] {
  return (perizie || []).filter(p => periziaApprovata(p) && p.dalSal <= salNumero).sort((a, b) => a.numero - b.numero)
}

/**
 * La nuova quantità di una voce di perizia: la somma delle misure di dettaglio se
 * ci sono (si misura come nel libretto), altrimenti la quantità scritta a mano.
 */
export const qtyVocePerizia = (v: VocePerizia): number | null | undefined =>
  (v.misurazioni?.length ? round2(sommaMisurazioni(v.misurazioni)) : v.qty)

/** Applica alle partite le perizie indicate (in ordine): copie, l'originale non cambia. */
export function applicaPerizie(partite: Partita[], perizie: Perizia[]): Partita[] {
  if (!perizie.length) return partite
  const mod = new Map<string, { qty?: number | null; importo?: number | null }>()
  for (const pz of perizie) for (const v of pz.voci) {
    const q = qtyVocePerizia(v)
    // solo i valori DICHIARATI cambiano: una perizia che tocca l'importo non
    // cancella la quantità variata da una perizia precedente
    mod.set(v.partitaId, { ...mod.get(v.partitaId), ...(q != null ? { qty: q } : {}), ...(v.importo != null ? { importo: v.importo } : {}) })
  }
  return partite.map(p => {
    const m = mod.get(p.id)
    if (!m) return p
    if (p.modalita === 'corpo' && m.importo != null) return { ...p, importoContrattuale: m.importo }
    if (p.modalita === 'misura' && m.qty != null) return { ...p, qtyProgetto: m.qty }
    return p
  })
}

/** Partite col contratto vigente al SAL n. */
export function partiteVigenti(partite: Partita[], perizie: Perizia[] | undefined, salNumero: number): Partita[] {
  return applicaPerizie(partite, perizieAl(perizie, salNumero))
}

export interface RigaComparativo {
  partita: Partita
  qtyPrima: number | null
  qtyDopo: number | null
  importoPrima: number
  importoDopo: number
  differenza: number
}

export interface QuadroComparativo {
  righe: RigaComparativo[]
  totalePrima: number
  totaleDopo: number
  aumenti: number
  diminuzioni: number
  differenza: number
  /** Variazione % rispetto al totale prima della perizia. */
  variazionePct: number | null
  /** Variazione % rispetto al CONTRATTO ORIGINARIO (cumulata con le perizie precedenti). */
  variazioneSuContrattoPct: number | null
  /** true se la variazione cumulata supera il 20% (quinto d'obbligo, art. 120 c.9). */
  oltreQuinto: boolean
}

/**
 * Quadro comparativo della perizia `pz`: «prima» = contratto vigente con le perizie
 * precedenti, «dopo» = con anche questa. Le partite introdotte dopo il SAL della
 * perizia non contano; quelle nuove della perizia compaiono con «prima» = 0.
 */
export function quadroComparativo(partite: Partita[], perizie: Perizia[] | undefined, pz: Perizia): QuadroComparativo {
  // «prima» = contratto davvero in vigore: le perizie precedenti ancora in bozza non contano
  const precedenti = (perizie || []).filter(p => p.numero < pz.numero && periziaApprovata(p)).sort((a, b) => a.numero - b.numero)
  const valide = partite.filter(p => (p.introdottaSal ?? 1) <= pz.dalSal)
  const prima = applicaPerizie(valide, precedenti)
  const dopo = applicaPerizie(valide, [...precedenti, pz])
  const nuove = new Set(valide.filter(p => (p.introdottaSal ?? 1) === pz.dalSal && (p.introdottaSal ?? 1) > 1).map(p => p.id))
  const righe: RigaComparativo[] = valide.map((p, i) => {
    const a = prima[i], d = dopo[i]
    const nuova = nuove.has(p.id)
    const importoPrima = nuova ? 0 : importoContrattualePartita(a)
    const importoDopo = importoContrattualePartita(d)
    return {
      partita: p,
      qtyPrima: p.modalita === 'misura' ? (nuova ? 0 : a.qtyProgetto ?? null) : null,
      qtyDopo: p.modalita === 'misura' ? d.qtyProgetto ?? null : null,
      importoPrima, importoDopo, differenza: round2(importoDopo - importoPrima),
    }
  })
  const totalePrima = round2(righe.reduce((s, r) => s + r.importoPrima, 0))
  const totaleDopo = round2(righe.reduce((s, r) => s + r.importoDopo, 0))
  const aumenti = round2(righe.filter(r => r.differenza > 0).reduce((s, r) => s + r.differenza, 0))
  const diminuzioni = round2(righe.filter(r => r.differenza < 0).reduce((s, r) => s - r.differenza, 0))
  const originario = round2(partite.filter(p => (p.introdottaSal ?? 1) <= 1).reduce((s, p) => s + importoContrattualePartita(p), 0))
  const variazionePct = totalePrima ? round2((totaleDopo - totalePrima) / totalePrima * 100) : null
  const variazioneSuContrattoPct = originario ? round2((totaleDopo - originario) / originario * 100) : null
  return {
    righe, totalePrima, totaleDopo, aumenti, diminuzioni, differenza: round2(totaleDopo - totalePrima),
    variazionePct, variazioneSuContrattoPct, oltreQuinto: variazioneSuContrattoPct != null && Math.abs(variazioneSuContrattoPct) > 20,
  }
}

/**
 * Allineamento di una voce a corpo: la quota % eseguita sul vecchio importo diventa
 * la quota sul nuovo importo che dà lo STESSO importo maturato (max 100%).
 */
export function allineaQuotaCorpo(quotaPct: number | null | undefined, importoPrima: number, importoDopo: number): number | null {
  if (quotaPct == null) return null
  if (!(importoDopo > 0)) return quotaPct
  return Math.min(100, Math.round(quotaPct * importoPrima / importoDopo * 1e4) / 1e4)
}

// ── Documento: QUADRO COMPARATIVO della perizia ──────────────────────────────

export function quadroComparativoHTML(appalto: Appalto, partite: Partita[], pz: Perizia): string {
  const q = quadroComparativo(partite, appalto.perizie, pz)
  const diff = (n: number): string => (n === 0 ? '—' : (n > 0 ? '+ ' : '− ') + eur(Math.abs(n)))
  const rows = q.righe.map(r => {
    const p = r.partita
    return `<tr${r.differenza ? '' : ' class="nv"'}>
      <td class="code">${escHtml(p.codice)}</td>
      <td>${escHtml(p.descrizione)}${p.modalita === 'corpo' ? '<span class="sub">a corpo</span>' : ''}</td>
      <td class="num">${escHtml(p.um || '')}</td>
      <td class="num">${p.modalita === 'misura' ? num(r.qtyPrima ?? 0) : ''}</td>
      <td class="num">${p.modalita === 'misura' ? num(r.qtyDopo ?? 0) : ''}</td>
      <td class="num">${p.modalita === 'misura' && p.prezzoUnitario != null ? eur(p.prezzoUnitario) : ''}</td>
      <td class="num">${eur(r.importoPrima)}</td>
      <td class="num">${eur(r.importoDopo)}</td>
      <td class="num">${diff(r.differenza)}</td>
    </tr>`
  }).join('')
  const body = `
    ${pz.oggetto ? `<p class="prose"><b>Oggetto:</b> ${escHtml(pz.oggetto)}</p>` : ''}
    ${pz.motivazione ? `<p class="prose"><b>Motivazione:</b> ${escHtml(pz.motivazione)}</p>` : ''}
    <p class="note">Confronto fra il contratto vigente${pz.numero > 1 ? ' (con le perizie precedenti)' : ''} e la perizia n. ${pz.numero}, in vigore dal SAL n. ${pz.dalSal}. Importi lordi, prima del ribasso d'asta.</p>
    <table class="dtable">
      <thead><tr><th>Codice</th><th>Designazione</th><th class="num">U.M.</th><th class="num">Q.tà contratto</th><th class="num">Q.tà perizia</th><th class="num">Prezzo</th><th class="num">Importo contratto</th><th class="num">Importo perizia</th><th class="num">Differenza</th></tr></thead>
      <tbody>${rows}
        <tr class="tot"><td colspan="6">TOTALE LAVORI</td><td class="num">${eur(q.totalePrima)}</td><td class="num">${eur(q.totaleDopo)}</td><td class="num">${diff(q.differenza)}</td></tr>
      </tbody>
    </table>
    <table class="dtable" style="margin-top:4mm"><tbody>
      <tr><td>Maggiori lavori</td><td class="num">+ ${eur(q.aumenti)}</td></tr>
      <tr><td>Minori lavori</td><td class="num">− ${eur(q.diminuzioni)}</td></tr>
      <tr class="tot"><td>Variazione netta della perizia</td><td class="num">${diff(q.differenza)}${q.variazionePct != null ? ` (${pct(q.variazionePct)})` : ''}</td></tr>
      <tr><td>Variazione cumulata sul contratto originario</td><td class="num">${q.variazioneSuContrattoPct != null ? pct(q.variazioneSuContrattoPct) : '—'}</td></tr>
    </tbody></table>
    ${q.oltreQuinto ? `<p class="note" style="border-left-color:#b02a7a">La variazione cumulata supera il quinto dell'importo del contratto (art. 120 c.9 D.Lgs. 36/2023): valutare con il RUP le condizioni e l'eventuale atto aggiuntivo.</p>` : ''}
    ${firmeHTML([{ ruolo: ilDirettore(appalto), nome: appalto.direttoreLavori }, { ruolo: 'Il RUP', nome: appalto.rup }])}`
  return renderDocPage({
    tool: 'contabilita', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, `Perizia di variante n. ${pz.numero}`),
    title: 'Quadro comparativo',
    sub: `Perizia di variante n. ${pz.numero}${pz.data ? ' del ' + pz.data : ''}`,
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: 'Art. 120 D.Lgs. 36/2023 — modifiche dei contratti in corso di esecuzione. Importi al netto di IVA.', page: `Quadro comparativo perizia ${pz.numero}` },
    docTitle: `Quadro comparativo — perizia n. ${pz.numero}`,
  })
}

// ── IMPORT DI UNA PERIZIA DA XPWE (computo di variante (XPWE)) ──────────────

export interface EsitoImportPerizia {
  perizia: Perizia
  /** Partite nuove (nuovi prezzi), da aggiungere con `introdottaSal = dalSal`. */
  nuove: Partita[]
  /** Voci del contratto che nella perizia non ci sono più (quantità portata a zero). */
  soppresse: number
  invariate: number
  modificate: number
}


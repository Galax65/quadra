/**
 * Contabilità — LIBRETTO DEI SOTTO-COMPUTI (lavori a corpo).
 *
 * In un appalto a corpo il corrispettivo è fisso e a ogni SAL si contabilizza
 * una **quota percentuale** del corpo d'opera. La domanda che in cantiere
 * arriva sempre è: *da dove viene quel 35%?* Se la risposta è «a occhio», la
 * contabilità non regge a un collaudo.
 *
 * Il sotto-computo è la risposta: il corpo si scompone nelle lavorazioni che
 * lo formano, con quantità e prezzi; a ogni avanzamento si misura quanto di
 * ciascuna è stato eseguito, e la quota del corpo è il rapporto fra l'eseguito
 * e il totale del sotto-computo. Il libretto dei sotto-computi lo stampa riga
 * per riga: è la dimostrazione della percentuale.
 *
 * Due cautele di metodo:
 *  - il sotto-computo **deve quadrare** con l'importo contrattuale del corpo;
 *    se non quadra il programma lo dice, non riscala di nascosto;
 *  - senza sotto-computo la quota resta attestata dal DL in percentuale, come
 *    prima: non si inventa una scomposizione che nessuno ha fatto.
 */
import { renderDocPage, escHtml } from '../../../shared/doc/doc'
import { eur, num, pct } from '../../../shared/format'
import type { Appalto, AvanzamentoSotto, Partita, RigaSal, Sal, VoceSottoComputo } from './types'
import { importoContrattualePartita, voceVisibileInSal, voceSoppressaInSal } from './contabilita'
import { enteDi, footerFieldsDi, headMetaDi, kickerDi, firmeHTML, ilDirettore } from './doc-common'

const round2 = (n: number): number => { const x = Math.abs(n) * 100; return Math.sign(n) * Math.round(Number(x.toPrecision(15))) / 100 }

/** Importo di progetto di una lavorazione del sotto-computo. */
export const importoVoceSotto = (v: VoceSottoComputo): number => round2((v.qty || 0) * (v.prezzo || 0))

/** Totale del sotto-computo: è la base su cui si misura la percentuale. */
export function totaleSottoComputo(p: Partita): number {
  return round2((p.sottoComputo || []).reduce((s, v) => s + importoVoceSotto(v), 0))
}

/** Il corpo ha una scomposizione utilizzabile (almeno una voce con importo). */
export const haSottoComputo = (p: Partita): boolean =>
  p.modalita === 'corpo' && !!p.sottoComputo?.length && totaleSottoComputo(p) > 0

/** Quadratura fra sotto-computo e importo contrattuale del corpo. */
export function quadraturaSottoComputo(p: Partita): { somma: number; corpo: number; scostamento: number; quadra: boolean } {
  const somma = totaleSottoComputo(p)
  const corpo = round2(importoContrattualePartita(p))
  const scostamento = round2(somma - corpo)
  return { somma, corpo, scostamento, quadra: Math.abs(scostamento) < 0.005 }
}

/** Quantità eseguita di una lavorazione del sotto-computo: le misure, se ci sono. */
export function eseguitoVoceSotto(av?: AvanzamentoSotto): number {
  if (!av) return 0
  if (av.misurazioni?.length) return round2(av.misurazioni.reduce((s, m) => s + (m.quantita || 0), 0))
  return av.quantitaProgressiva ?? 0
}

/** L'avanzamento registrato per una lavorazione in un SAL. */
export const avanzamentoDi = (riga: RigaSal | undefined, voceId: string): AvanzamentoSotto | undefined =>
  riga?.sotto?.find((x) => x.voceId === voceId)

/** Importo eseguito del sotto-computo a tutto il SAL. */
export function eseguitoSottoComputo(p: Partita, riga?: RigaSal): number {
  return round2((p.sottoComputo || []).reduce((s, v) => s + round2(eseguitoVoceSotto(avanzamentoDi(riga, v.id)) * (v.prezzo || 0)), 0))
}

/**
 * La quota % del corpo che discende dal sotto-computo: eseguito / totale del
 * sotto-computo. Null quando non c'è una scomposizione utilizzabile — e allora
 * la quota resta quella attestata a mano.
 */
export function quotaDaSottoComputo(p: Partita, riga?: RigaSal): number | null {
  if (!haSottoComputo(p)) return null
  const tot = totaleSottoComputo(p)
  if (tot <= 0) return null
  return round2(eseguitoSottoComputo(p, riga) / tot * 100)
}

/**
 * La quota che vale negli atti: quella **attestata** nel SAL (`quotaPct`), che
 * è ciò su cui il registro e il certificato fanno i conti. Il sotto-computo la
 * determina mentre il SAL è aperto; una volta firmato, l'attestazione resta
 * quella, anche se qualcuno cambiasse poi la scomposizione.
 */
export function quotaAttestata(p: Partita, riga?: RigaSal): number | null {
  if (riga?.quotaPct != null) return riga.quotaPct
  return quotaDaSottoComputo(p, riga)
}

/** I corpi d'opera di questo SAL che hanno un sotto-computo da stampare. */
export function corpiConSottoComputo(partite: Partita[], salNumero: number): Partita[] {
  return partite.filter((p) => haSottoComputo(p) && voceVisibileInSal(p, salNumero) && !voceSoppressaInSal(p, salNumero))
}

/**
 * LIBRETTO DEI SOTTO-COMPUTI: per ogni corpo d'opera, le lavorazioni che lo
 * compongono, quanto ne è stato eseguito a tutto il SAL e la percentuale che
 * ne discende. È l'allegato che dimostra la quota del corpo.
 */
export function librettoSottoComputiHTML(appalto: Appalto, partite: Partita[], sal: Sal): string {
  const corpi = corpiConSottoComputo(partite, sal.numero)
  const rigaById = new Map(sal.righe.map((r) => [r.partitaId, r]))
  const sezioni = corpi.map((p) => {
    const riga = rigaById.get(p.id)
    const q = quadraturaSottoComputo(p)
    const quota = quotaDaSottoComputo(p, riga)
    const righe = (p.sottoComputo || []).map((v) => {
      const av = avanzamentoDi(riga, v.id)
      const eseg = eseguitoVoceSotto(av)
      const impEseg = round2(eseg * (v.prezzo || 0))
      const impProg = importoVoceSotto(v)
      const misure = av?.misurazioni?.length
        ? `<span class="sub">${av.misurazioni.map((m) => `${escHtml(m.descrizione || '')} ${[m.n, m.l1, m.l2, m.h].filter((x) => x != null).map((x) => num(x as number)).join(' × ')} = ${num(m.quantita)}`.trim()).join(' · ')}</span>`
        : ''
      return `<tr>
        <td class="code">${escHtml(v.codice || '')}</td>
        <td>${escHtml(v.descrizione)}${misure}</td>
        <td class="num">${escHtml(v.um || '')}</td>
        <td class="num">${v.qty == null ? '—' : num(v.qty)}</td>
        <td class="num">${v.prezzo == null ? '—' : eur(v.prezzo)}</td>
        <td class="num">${eur(impProg)}</td>
        <td class="num">${num(eseg)}</td>
        <td class="num">${eur(impEseg)}</td>
      </tr>`
    }).join('')
    const eseguito = eseguitoSottoComputo(p, riga)
    const attestata = quotaAttestata(p, riga)
    const scarto = quota != null && attestata != null && Math.abs(quota - attestata) >= 0.005
    return `
      <h2 class="sec-h">${escHtml(p.codice)} — ${escHtml(p.descrizione)}</h2>
      <p class="note">Corpo d'opera di importo contrattuale ${eur(importoContrattualePartita(p))}.${q.quadra ? '' : ` <b>Il sotto-computo somma ${eur(q.somma)}: scostamento di ${eur(Math.abs(q.scostamento))} rispetto all'importo del corpo.</b> La percentuale è calcolata sul totale del sotto-computo.`}</p>
      <table class="dtable">
        <thead><tr><th>Codice</th><th>Lavorazione e misure</th><th class="num">U.M.</th><th class="num">Qtà progetto</th><th class="num">Prezzo</th><th class="num">Importo progetto</th><th class="num">Qtà eseguita</th><th class="num">Importo eseguito</th></tr></thead>
        <tbody>${righe}
          <tr class="tot"><td colspan="5">Totale del sotto-computo</td><td class="num">${eur(totaleSottoComputo(p))}</td><td class="num"></td><td class="num">${eur(eseguito)}</td></tr>
          <tr class="tot"><td colspan="7">Quota del corpo d'opera eseguita a tutto il SAL n. ${escHtml(String(sal.numero))}</td><td class="num">${attestata == null ? '—' : pct(attestata, 2)}</td></tr>
        </tbody>
      </table>
      ${scarto ? `<p class="note">La quota attestata negli atti è ${pct(attestata as number, 2)}; il sotto-computo come è oggi darebbe ${pct(quota as number, 2)}. Negli atti vale l'attestazione del SAL.</p>` : ''}`
  }).join('')
  const body = `
    <p class="note">Libretto dei sotto-computi — per i lavori a corpo, le lavorazioni in cui ogni corpo d'opera si scompone e quanto ne è stato eseguito a tutto il SAL n. ${escHtml(String(sal.numero))}${sal.data ? ` (${escHtml(sal.data)})` : ''}. È il documento che <b>dimostra</b> la percentuale di avanzamento riportata nel libretto delle misure e nel registro: in un appalto a corpo la quota non si stima, si misura.</p>
    ${sezioni || "<p class='note'><i>Nessun corpo d'opera con sotto-computo in questo stato di avanzamento.</i></p>"}
    ${firmeHTML([{ ruolo: ilDirettore(appalto), nome: appalto.direttoreLavori }, { ruolo: "L'esecutore" }])}
  `
  return renderDocPage({
    tool: 'contabilita', brand: 'none', enteHeader: enteDi(appalto),
    kicker: kickerDi(appalto, `Sotto-computi · SAL ${sal.numero}`),
    title: 'Libretto dei sotto-computi',
    sub: `SAL n. ${sal.numero}${sal.data ? ' del ' + sal.data : ''}`,
    headMeta: headMetaDi(appalto),
    bodyHTML: body,
    footer: { fields: footerFieldsDi(appalto), disc: "Art. 12 Allegato II.14 D.Lgs. 36/2023 — lavori a corpo: quota dell'aliquota eseguita a ogni stato di avanzamento. Importi al netto di IVA.", page: `Sotto-computi SAL ${sal.numero}` },
    docTitle: `Libretto dei sotto-computi — SAL ${sal.numero}`,
  })
}
